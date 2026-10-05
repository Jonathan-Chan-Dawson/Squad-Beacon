import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  owner: "a1111111-1111-4111-8111-111111111111",
  admin: "b2222222-2222-4222-8222-222222222222",
  member: "c3333333-3333-4333-8333-333333333333",
  invitee: "d4444444-4444-4444-8444-444444444444",
  squadOnly: "e5555555-5555-4555-8555-555555555555",
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

test("organizations enforce hierarchy, membership-scoped chat and audience privacy", async () => {
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
  ]) await applyMigration(migration);

  await root();
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query("insert into public.profiles(id,username,name) values($1,$2,$2)", [id, name.toLowerCase()]);
  }

  await actor("owner");
  const organization = await action("create_organization", { name: "North Shore Crew", description: "A connected set of squads." });
  const orgId = organization.organization_id as string;
  assert.equal(organization.id, orgId);
  await action("invite_organization_member", { organization_id: orgId, user_id: ids.admin, role: "admin" });
  await actor("admin");
  await action("respond_organization_invite", { organization_id: orgId, accept: true });
  await action("invite_organization_member", { organization_id: orgId, user_id: ids.member, role: "member" });
  await actor("member");
  await action("respond_organization_invite", { organization_id: orgId, accept: true });
  await actor("admin");
  await action("invite_organization_member", { organization_id: orgId, user_id: ids.invitee, role: "member" });

  const orgMessage = await action("send_group_message", {
    scope: "organization", organization_id: orgId, body: "Council starts at six.",
  });
  assert.equal(orgMessage.scope, "organization");
  assert.equal(orgMessage.organization_id, orgId);
  await action("mark_group_chat_read", { scope: "organization", organization_id: orgId });
  const readState = await db.query<{ count: string }>(
    "select count(*)::text count from public.group_message_reads where scope='organization' and scope_id=$1 and user_id=$2",
    [orgId, ids.admin],
  );
  assert.equal(readState.rows[0].count, "1");

  await actor("invitee");
  assert.equal((await db.query("select id from public.organizations where id=$1", [orgId])).rows.length, 1,
    "a pending invite may see enough of the organization to respond");
  assert.equal((await db.query("select id from public.group_messages where scope='organization' and scope_id=$1", [orgId])).rows.length, 0,
    "a pending invite must not read group chat");
  await assert.rejects(
    action("send_group_message", { scope: "organization", organization_id: orgId, body: "Not yet." }),
    /unavailable/i,
  );
  await actor("admin");
  await assert.rejects(
    action("invite_organization_member", { organization_id: orgId, user_id: ids.owner, role: "member" }),
    /valid, unblocked/i,
    "the owner is represented immutably and cannot be inserted as an ordinary member",
  );
  await assert.rejects(
    action("set_organization_member_role", { organization_id: orgId, user_id: ids.owner, role: "member" }),
    /cannot change/i,
  );
  await assert.rejects(
    action("invite_organization_member", { organization_id: orgId, user_id: ids.squadOnly, role: "admin" }),
    /cannot invite that rank/i,
    "an admin cannot issue a same-rank invitation",
  );
  await actor("owner");
  await assert.rejects(action("leave_organization", { organization_id: orgId }), /owner cannot leave/i);

  await root();
  const ownerSquad = (await db.query<{ id: string }>(
    "insert into public.squads(owner_id,name,description) values($1,'Ridge Runners','Private roster') returning id",
    [ids.owner],
  )).rows[0].id;
  const adminSquad = (await db.query<{ id: string }>(
    "insert into public.squads(owner_id,name,description) values($1,'Admin Riders','Private roster') returning id",
    [ids.owner],
  )).rows[0].id;
  await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner'),($1,$3,'member')", [ownerSquad, ids.owner, ids.squadOnly]);
  await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner'),($1,$3,'admin')", [adminSquad, ids.owner, ids.admin]);
  await actor("owner");
  await action("attach_organization_squad", { organization_id: orgId, squad_id: ownerSquad });
  await actor("admin");
  await action("attach_organization_squad", { organization_id: orgId, squad_id: adminSquad });
  await action("send_group_message", { scope: "squad", squad_id: adminSquad, body: "Squad-only note." });
  await actor("member");
  assert.equal((await db.query("select squad_id from public.organization_squads where organization_id=$1", [orgId])).rows.length, 0,
    "linked private squads are not enumerated unless the viewer is also a squad member");
  assert.equal((await db.query("select id from public.group_messages where scope='squad' and scope_id=$1", [adminSquad])).rows.length, 0,
    "organization membership does not grant private squad chat access");
  await assert.rejects(
    action("send_group_message", { scope: "squad", squad_id: adminSquad, body: "Not a squad member." }),
    /unavailable/i,
  );

  await actor("owner");
  await action("save_profile_privacy", {
    profile_visibility: "custom", person_ids: [], squad_ids: [], list_ids: [], organization_ids: [orgId],
  });
  const privacyGrantSnapshot = (await db.query<{ data: any }>("select public.beacon_snapshot() data")).rows[0].data;
  assert.deepEqual(
    privacyGrantSnapshot.profile_visibility_grants.filter((grant: any) => grant.owner_id === ids.owner),
    [{ owner_id: ids.owner, kind: "organization", target_id: orgId }],
    "organization privacy grants are included in the owner snapshot for persistence",
  );
  await actor("invitee");
  await action("respond_organization_invite", { organization_id: orgId, accept: true });
  const ownerFullProfile = (await db.query<{ data: any }>("select public.beacon_snapshot() data")).rows[0].data.profiles
    .find((profile: any) => profile.id === ids.owner);
  assert.equal(ownerFullProfile?.viewer_can_view_full_profile, true,
    "an accepted organization identity grant allows the selected full profile");

  await root();
  await db.query(
    "insert into public.locations(owner_id,expires_at,latitude,longitude,updated_at) values($1,now()+interval '1 hour',41.8,-87.6,now())",
    [ids.owner],
  );
  const locationId = (await db.query<{ id: string }>("select id from public.locations where owner_id=$1", [ids.owner])).rows[0].id;
  await db.query("insert into private.location_recipients(session_id,user_id) values($1,$2)", [locationId, ids.invitee]);
  await actor("invitee");
  assert.equal((await db.query<{ data: any }>("select public.beacon_snapshot() data")).rows[0].data.locations.length, 0,
    "an organization profile grant cannot bypass the independent friendship and GPS gate");

  await actor("owner");
  const planningThread = await action("create_planning_thread", {
    kind: "vote",
    title: "Choose a weekend route",
    body: "Pick the next organization outing.",
    audience: "organization",
    audience_id: orgId,
    deadline_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    coowner_ids: [],
  });
  await actor("invitee");
  assert.equal((await db.query("select id from public.planning_threads where id=$1", [planningThread.id])).rows.length, 1,
    "active organization members can read organization-audience planning threads");

  await actor("member");
  const memberMessage = await action("send_group_message", {
    scope: "organization", organization_id: orgId, body: "I am here from the roster.",
  });
  assert.equal(memberMessage.scope, "organization");
  await root();
  await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.admin, ids.member]);
  await actor("admin");
  assert.equal((await db.query("select id from public.group_messages where id=$1", [memberMessage.id])).rows.length, 0,
    "a blocked sender's message is hidden without granting access through the block");
  await root();
  await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [ids.admin, ids.member]);

  await root();
  const activity = (await db.query<{ id: string }>(
    "insert into public.activities(owner_id,title,category,mode,starts_at,ends_at,timezone,audience,audience_id,approval_required) values($1,'Organization hike','Social','squad',now()+interval '1 day',now()+interval '2 days','UTC','organization',$2,true) returning id",
    [ids.owner, orgId],
  )).rows[0].id;
  await db.query("insert into public.rsvps(activity_id,user_id,status,approved) values($1,$2,'going',true)", [activity, ids.invitee]);
  await actor("invitee");
  assert.equal((await db.query("select id from public.activities where id=$1", [activity])).rows.length, 1,
    "active organization members can read organization-audience Beacons");

  await actor("admin");
  await action("ban_organization_member", { organization_id: orgId, user_id: ids.invitee, reason: "Removed from the roster." });
  await actor("invitee");
  assert.equal((await db.query("select id from public.activities where id=$1", [activity])).rows.length, 0,
    "an old approved RSVP cannot outlive organization membership for an organization Beacon");
  assert.equal((await db.query("select id from public.group_messages where scope='organization' and scope_id=$1", [orgId])).rows.length, 0,
    "banning immediately removes organization chat access");
  assert.equal((await db.query("select id from public.planning_threads where id=$1", [planningThread.id])).rows.length, 0,
    "removing organization membership revokes organization-audience planning access");
  assert.equal((await db.query("select data from public.beacon_snapshot() s(data)")).rows[0].data.profiles
    .some((profile: any) => profile.id === ids.owner), false,
    "organization-only custom-profile permission is revoked on removal");

  await actor("owner");
  const ownerRead = await db.query<{ count: string }>(
    "select count(*)::text count from public.group_messages where scope='organization' and scope_id=$1",
    [orgId],
  );
  assert.ok(Number(ownerRead.rows[0].count) >= 2);
  await actor("admin");
  await assert.rejects(
    action("invite_organization_member", { organization_id: orgId, user_id: ids.invitee, role: "member" }),
    /banned/i,
  );

  await root();
  const audit = await db.query<{ inviter: string | null; banned_by: string | null; added_by: string | null }>(
    `select m.invited_by inviter,b.banned_by,os.added_by
       from public.organization_members m
       cross join public.organization_bans b
       cross join public.organization_squads os
      where m.organization_id=$1 and m.user_id=$2
        and b.organization_id=$1 and b.user_id=$3
        and os.organization_id=$1 and os.squad_id=$4`,
    [orgId, ids.member, ids.invitee, adminSquad],
  );
  assert.equal(audit.rows.length, 1);
  assert.equal(audit.rows[0].inviter, ids.admin);
  assert.equal(audit.rows[0].banned_by, ids.admin);
  assert.equal(audit.rows[0].added_by, ids.admin);
  await db.query("delete from auth.users where id=$1", [ids.admin]);
  const afterDelete = await db.query<{ status: string; inviter: string | null; banned_by: string | null; added_by: string | null }>(
    `select m.status,m.invited_by inviter,b.banned_by,os.added_by
       from public.organization_members m
       cross join public.organization_bans b
       cross join public.organization_squads os
      where m.organization_id=$1 and m.user_id=$2
        and b.organization_id=$1 and b.user_id=$3
        and os.organization_id=$1 and os.squad_id=$4`,
    [orgId, ids.member, ids.invitee, adminSquad],
  );
  assert.equal(afterDelete.rows.length, 1, "admin account deletion must not cascade other members, bans, or links");
  assert.deepEqual(afterDelete.rows[0], { status: "active", inviter: null, banned_by: null, added_by: null });
});
