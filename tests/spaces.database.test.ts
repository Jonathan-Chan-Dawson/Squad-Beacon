import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  owner: "a1111111-1111-4111-8111-111111111111",
  admin: "b2222222-2222-4222-8222-222222222222",
  member: "c3333333-3333-4333-8333-333333333333",
  invitee: "d4444444-4444-4444-8444-444444444444",
  stranger: "e5555555-5555-4555-8555-555555555555",
};
const db = new PGlite();

async function actor(name: keyof typeof ids) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[name]]);
}
async function root() {
  await db.exec("reset role");
}
async function action(name: string, payload: Record<string, unknown> = {}) {
  return (
    await db.query<{ result: Record<string, any> }>(
      "select public.beacon_action($1,$2::jsonb,gen_random_uuid()) result",
      [name, JSON.stringify(payload)],
    )
  ).rows[0].result;
}
async function applyMigration(name: string) {
  const sql = readFileSync(
    new URL("../supabase/migrations/" + name, import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(sql);
  } catch (error) {
    throw new Error("Migration " + name + ": " + (error as Error).message);
  }
}

test("Spaces keep membership, invites, profile context, and linked Squad access independent", async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb not null default '{}'::jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql as $$
      select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]
    $$;
    create publication supabase_realtime;
  `);

  for (const migration of [
    "202609060001_beacon.sql",
    "202609060002_delivery.sql",
    "202609060003_profile_metrics.sql",
    "202609290001_simple_beacons.sql",
    "202609290002_map_workspace.sql",
    "202609290003_mini_avatars.sql",
    "202610010001_plans_profile_survey.sql",
    "202610010002_beacon_modules.sql",
    "202610010003_shared_libraries.sql",
    "202610010004_planning_threads.sql",
    "202610010005_beacon_controls.sql",
    "202610030001_profile_privacy.sql",
    "202610030002_beacon_module_collections.sql",
    "202610030003_beacon_media_teams.sql",
    "202610040001_organization_audience_type.sql",
    "202610040002_organizations_group_chat.sql",
    "202610040003_plan_routines.sql",
    "202610040005_places_search_budget.sql",
    "202610040006_spaces.sql",
    "202610040007_social_architecture.sql",
  ]) await applyMigration(migration);

  await root();
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query(
      "insert into public.profiles(id,username,name) values($1,$2,$2)",
      [id, name.toLowerCase()],
    );
  }
  await db.query(
    `insert into public.friendships(sender_id,recipient_id,status)
     values($1,$2,'accepted'),($1,$3,'accepted'),($4,$5,'accepted')`,
    [ids.owner, ids.admin, ids.member, ids.admin, ids.invitee],
  );

  await actor("owner");
  const created = await action("create_space", {
    name: "North Shore Space",
    description: "An independent member hub.",
  });
  const spaceId = created.space_id as string;
  assert.equal(created.id, spaceId);
  const ownerRow = await db.query<{ role: string; status: string }>(
    "select role,status from public.space_members where space_id=$1 and user_id=$2",
    [spaceId, ids.owner],
  );
  assert.deepEqual(ownerRow.rows[0], { role: "owner", status: "active" },
    "creation writes the active owner membership in the same action");

  await root();
  const squadId = (await db.query<{ id: string }>(
    `insert into public.squads(owner_id,name,description) values($1,'Private boxing squad','Private roster') returning id`,
    [ids.owner],
  )).rows[0].id;
  await db.query(
    "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner')",
    [squadId, ids.owner],
  );
  const otherSquadId = (await db.query<{ id: string }>(
    `insert into public.squads(owner_id,name,description) values($1,'Stranger squad','Private roster') returning id`,
    [ids.stranger],
  )).rows[0].id;
  await db.query(
    "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner')",
    [otherSquadId, ids.stranger],
  );
  await actor("owner");
  await action("attach_space_squad", { space_id: spaceId, squad_id: squadId });
  await assert.rejects(
    action("attach_space_squad", { space_id: spaceId, squad_id: otherSquadId }),
    /own or administer/i,
    "Space admin authority cannot link a Squad the actor does not administer",
  );
  await action("invite_space_member", { space_id: spaceId, user_id: ids.admin, role: "admin" });
  await actor("admin");
  const invitedSnapshot = (await db.query<{ data: any }>(
    "select public.beacon_snapshot() data",
  )).rows[0].data;
  assert.equal(invitedSnapshot.spaces.find((row: any) => row.id === spaceId)?.name,
    "North Shore Space", "pending invites see the Space basics");
  assert.deepEqual(invitedSnapshot.space_members.map((row: any) => row.user_id), [ids.admin],
    "pending invites see only their own invitation row");
  assert.equal(invitedSnapshot.space_squads.length, 0,
    "pending invites cannot see Squad link metadata");
  await assert.rejects(
    action("respond_space_invite", { space_id: spaceId, user_id: ids.owner, accept: true }),
    /only the invited person/i,
    "invite responses cannot choose another user from payload data",
  );
  await action("respond_space_invite", { space_id: spaceId, accept: true });

  await actor("owner");
  await action("invite_space_member", { space_id: spaceId, user_id: ids.member });
  await actor("member");
  await action("respond_space_invite", { space_id: spaceId, accept: true });
  await root();
  await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.owner, ids.invitee]);
  await actor("admin");
  await assert.rejects(
    action("invite_space_member", { space_id: spaceId, user_id: ids.invitee }),
    /valid, unblocked friend/i,
    "Space admins cannot invite a friend blocked by the Space owner",
  );
  await root();
  await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [ids.owner, ids.invitee]);
  await actor("admin");
  await action("invite_space_member", { space_id: spaceId, user_id: ids.invitee });
  await actor("invitee");
  await action("respond_space_invite", { space_id: spaceId, accept: true });

  await actor("owner");
  const ownerSnapshot = (await db.query<{ data: any }>(
    "select public.beacon_snapshot() data",
  )).rows[0].data;
  assert.equal(ownerSnapshot.space_squads.some((row: any) => row.squad_id === squadId), true,
    "Squad link metadata is visible to a current member of that linked Squad");

  await actor("invitee");
  const activeSnapshot = (await db.query<{ data: any }>(
    "select public.beacon_snapshot() data",
  )).rows[0].data;
  assert.equal(activeSnapshot.space_members.length, 4,
    "active membership snapshots include the current active roster");
  assert.equal(activeSnapshot.space_squads.some((row: any) => row.squad_id === squadId), false,
    "Space-only members cannot enumerate private Squad link metadata");
  assert.equal(activeSnapshot.squads.some((row: any) => row.id === squadId), false,
    "a Space link does not reveal the private Squad itself");
  assert.equal(activeSnapshot.squad_members.some((row: any) => row.squad_id === squadId), false,
    "a Space link does not reveal the private Squad roster");
  assert.equal((await db.query("select id from public.squads where id=$1", [squadId])).rows.length, 0,
    "Space membership cannot directly read linked private Squads");
  await assert.rejects(
    action("send_group_message", { scope: "squad", squad_id: squadId, body: "Space access only." }),
    /unavailable/i,
    "Space membership cannot enter linked Squad chat",
  );
  const ownerProfile = activeSnapshot.profiles.find((profile: any) => profile.id === ids.owner);
  assert.equal(ownerProfile?.viewer_can_view_full_profile, true,
    "the current Space relationship provides ordinary public profile context");

  await assert.rejects(
    db.query("insert into public.spaces(owner_id,name) values($1,'Forged')", [ids.admin]),
    /permission denied/i,
    "authenticated users cannot bypass the action handler with table writes",
  );
  await assert.rejects(
    db.query("select private.apply_space_action('create_space','{}'::jsonb)"),
    /permission denied/i,
    "the internal Space writer is not exposed as a direct RPC",
  );

  await actor("admin");
  await action("remove_space_member", { space_id: spaceId, user_id: ids.invitee });
  await actor("invitee");
  const removedSnapshot = (await db.query<{ data: any }>(
    "select public.beacon_snapshot() data",
  )).rows[0].data;
  assert.equal(removedSnapshot.spaces.some((row: any) => row.id === spaceId), false,
    "member removal immediately revokes Space basics");
  assert.equal(removedSnapshot.space_members.some((row: any) => row.space_id === spaceId), false,
    "member removal immediately revokes roster access");
  assert.equal(removedSnapshot.space_squads.some((row: any) => row.space_id === spaceId), false,
    "member removal immediately revokes linked-Squad metadata");
  assert.equal(removedSnapshot.profiles.some((profile: any) => profile.id === ids.owner), false,
    "Space-only profile context disappears after membership removal");
  await assert.rejects(
    action("respond_space_invite", { space_id: spaceId, accept: true }),
    /no longer available|unavailable/i,
  );

  await root();
  await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.owner, ids.member]);
  await actor("member");
  assert.equal((await db.query("select id from public.spaces where id=$1", [spaceId])).rows.length, 0,
    "a current block with the Space owner overrides otherwise-active membership");
  assert.equal((await db.query("select user_id from public.space_members where space_id=$1", [spaceId])).rows.length, 0,
    "the same block hides Space roster rows");
  await actor("admin");
  const ownerBlockedMemberSnapshot = (await db.query<{ data: any }>(
    "select public.beacon_snapshot() data",
  )).rows[0].data;
  assert.equal(ownerBlockedMemberSnapshot.space_members.some(
    (row: any) => row.space_id === spaceId && row.user_id === ids.member,
  ), false, "other members do not see identities blocked by the Space owner");

  await actor("owner");
  await assert.rejects(action("leave_space", { space_id: spaceId }), /owner cannot leave/i);
});
