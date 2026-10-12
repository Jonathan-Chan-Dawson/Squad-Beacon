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
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[name],
  ]);
}
async function root() {
  await db.exec("reset role");
}
async function action(
  name: string,
  payload: Record<string, unknown> = {},
  requestId = crypto.randomUUID(),
) {
  return (
    await db.query<{ result: Record<string, any> }>(
      "select public.beacon_action($1,$2::jsonb,$3::uuid) result",
      [name, JSON.stringify(payload), requestId],
    )
  ).rows[0].result;
}
async function migration(name: string) {
  const sql = readFileSync(
    new URL("../supabase/migrations/" + name, import.meta.url),
    "utf8",
  ).replace("create extension if not exists pgcrypto;", "");
  try {
    await db.exec(sql);
  } catch (error) {
    throw new Error(`Migration ${name}: ${(error as Error).message}`);
  }
}
test("public discovery is opt-in, summary-only, and joins without social membership", async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
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
  for (const file of [
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
    "202610090001_profile_settings_unblock.sql",
  ])
    await migration(file);

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
     values($1,$2,'accepted'),($1,$3,'accepted'),($4,$5,'accepted'),($2,$3,'accepted'),($1,$5,'accepted')`,
    [ids.owner, ids.admin, ids.member, ids.admin, ids.invitee],
  );

  await migration("202610090002_live_updates.sql");
  await migration("202610100001_create_flow.sql");
  await migration("202610110001_map_discovery.sql");
  await migration("202610110002_place_knowledge.sql");
  await migration("202610110003_map_preview_refinement.sql");
  await migration("202610110004_ping_availability.sql");
  await migration("202610110005_squad_icons.sql");
  await migration("202610120001_solo_status_reactions.sql");
  await test("solo status reactions preserve visibility, expiry, opt-outs, actor ownership and request deduplication", async () => {
    await root();
    const statusId = crypto.randomUUID();
    await db.query(
      `insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,timezone,audience)
      values($1,$2,'Studying','Study','solo',now()-interval '5 minutes',now()+interval '1 hour','UTC','friends')`,
      [statusId, ids.owner],
    );
    await actor("admin");
    const requestId = crypto.randomUUID();
    await action("react", { id: statusId }, requestId);
    await action("react", { id: statusId }, requestId);
    assert.equal(
      (
        await db.query("select * from public.reactions where activity_id=$1", [
          statusId,
        ])
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from public.rsvps where activity_id=$1", [
          statusId,
        ])
      ).rows.length,
      0,
    );
    await actor("member");
    await action("react", { id: statusId });
    await actor("admin");
    await action("react", { id: statusId, remove: true, user_id: ids.member });
    const remaining = (
      await db.query<{ user_id: string }>(
        "select * from public.reactions where activity_id=$1",
        [statusId],
      )
    ).rows;
    assert.deepEqual(
      remaining.map((row) => row.user_id),
      [ids.member],
    );
    await actor("stranger");
    await assert.rejects(action("react", { id: statusId }), /unavailable/i);
    await root();
    await db.query(
      "update public.activities set enable_reactions=false where id=$1",
      [statusId],
    );
    await actor("admin");
    await assert.rejects(action("react", { id: statusId }), /unavailable/i);
    await root();
    await db.query(
      "update public.activities set enable_reactions=true,ends_at=now()-interval '1 minute' where id=$1",
      [statusId],
    );
    await actor("admin");
    await assert.rejects(action("react", { id: statusId }), /unavailable/i);
    await root();
    await db.query(
      "update public.activities set ends_at=now()+interval '1 hour' where id=$1",
      [statusId],
    );
    await db.query(
      "insert into public.blocks(blocker_id,blocked_id) values($1,$2)",
      [ids.owner, ids.admin],
    );
    await actor("admin");
    await assert.rejects(action("react", { id: statusId }), /unavailable/i);
    await root();
    await db.query(
      "delete from public.blocks where blocker_id=$1 and blocked_id=$2",
      [ids.owner, ids.admin],
    );
    await db.query("delete from public.activities where id=$1", [statusId]);
  });

  await test("Squad icons persist in authorized snapshots with admin-only writes and request deduplication", async () => {
    await actor("owner");
    const createdSquad = await action("create_squad", {
      name: "Icon crew",
      description: "Shared identity",
    });
    const squad = { id: createdSquad.squad_id };
    assert.equal(typeof squad.id, "string");
    await root();
    await db.query(
      "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'admin'),($1,$3,'member')",
      [squad.id, ids.admin, ids.member],
    );
    await actor("admin");
    await assert.rejects(
      action("update_squad_icon", { squad_id: squad.id, icon_key: "invalid" }),
      /valid Squad icon/i,
    );
    const requestId = crypto.randomUUID();
    const saved = await action(
      "update_squad_icon",
      { squad_id: squad.id, icon_key: "coffee" },
      requestId,
    );
    assert.equal(saved.icon_key, "coffee");
    const repeated = await action(
      "update_squad_icon",
      { squad_id: squad.id, icon_key: "sports" },
      requestId,
    );
    assert.equal(repeated.icon_key, "coffee");
    await actor("member");
    const snapshot = (
      await db.query<{ data: any }>("select public.beacon_snapshot() data")
    ).rows[0].data;
    assert.equal(
      snapshot.squads.find((row: any) => row.id === squad.id).icon_key,
      "coffee",
    );
    await assert.rejects(
      action("update_squad_icon", { squad_id: squad.id, icon_key: "sports" }),
      /current Squad admins/i,
    );
    await assert.rejects(
      db.query("update public.squads set icon_key='sports' where id=$1", [
        squad.id,
      ]),
      /permission denied/i,
    );
    await actor("stranger");
    await assert.rejects(
      action("update_squad_icon", { squad_id: squad.id, icon_key: "sports" }),
      /current Squad admins/i,
    );
    await root();
    await db.query(
      "delete from public.squad_members where squad_id=$1 and user_id=$2",
      [squad.id, ids.admin],
    );
    await actor("admin");
    await assert.rejects(
      action("update_squad_icon", { squad_id: squad.id, icon_key: "sports" }),
      /current Squad admins/i,
    );
    await actor("owner");
    await action("update_squad_icon", {
      squad_id: squad.id,
      icon_key: "sports",
    });
  });
  await actor("owner");
  await assert.rejects(
    action("start_location", {
      expires_at: new Date(Date.now() + 25 * 3600000).toISOString(),
      recipients: [ids.admin],
    }),
    /up to 24 hours/,
  );
  const shared = await action("start_location", {
    expires_at: new Date(Date.now() + 24 * 3600000 - 1000).toISOString(),
    recipients: [ids.admin],
  });
  await action("update_location", {
    id: shared.id,
    latitude: 41.8,
    longitude: -87.6,
  });
  await root();
  await db.query(
    "update public.locations set updated_at=now()-interval '12 hours' where id=$1",
    [shared.id],
  );
  await actor("admin");
  assert.equal(
    (await db.query("select id from public.locations")).rows.length,
    1,
  );
  await actor("stranger");
  assert.equal(
    (await db.query("select id from public.locations")).rows.length,
    0,
  );
  await root();
  await db.query(
    "update public.locations set updated_at=now()-interval '24 hours' where id=$1",
    [shared.id],
  );
  await actor("admin");
  assert.equal(
    (await db.query("select id from public.locations")).rows.length,
    0,
  );
  await actor("owner");
  await action("stop_location");

  await root();
  const activityId = crypto.randomUUID();
  await db.query(
    `insert into public.activities(id,owner_id,title,category,mode,starts_at,ends_at,timezone,audience,capacity_policy,capacity_limit)
    values($1,$2,'Pickup basketball','Fitness','squad',now()-interval '5 minutes',now()+interval '2 hours','America/Chicago','private','strict',2)`,
    [activityId, ids.owner],
  );
  await db.query(
    "insert into public.places(activity_id,label,latitude,longitude) values($1,'Secret courts',41.884123,-87.632987)",
    [activityId],
  );
  const search = () =>
    db.query<Record<string, any>>(
      "select * from public.public_beacon_search('',null,null)",
    );
  const publish = (enabled: boolean) =>
    db.query(
      "select public.set_beacon_discovery($1,$2,'Chicago',41.884123,-87.632987)",
      [activityId, enabled],
    );
  const join = () =>
    db.query<{ result: { status: string } }>(
      "select public.join_public_beacon($1) result",
      [activityId],
    );
  await actor("stranger");
  assert.equal((await search()).rows.length, 0);
  await assert.rejects(publish(true), /Only the host/i);
  await actor("owner");
  await publish(true);
  await actor("stranger");
  const rows = (await search()).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].accepted_seat_count, 1);
  assert.equal(
    (
      await db.query(
        "select * from public.public_beacon_search('basketball chicago',null,null)",
      )
    ).rows.length,
    1,
  );
  assert.deepEqual(
    Object.keys(rows[0]).sort(),
    [
      "activity_id",
      "title",
      "category",
      "interest_tags",
      "starts_at",
      "ends_at",
      "area_label",
      "coarse_lat",
      "coarse_lng",
      "requires_approval",
      "capacity_limit",
      "capacity_policy",
      "accepted_seat_count",
      "closed",
      "viewer_response",
    ].sort(),
  );
  assert.equal(Number(rows[0].coarse_lat), 41.88);
  assert.equal(Number(rows[0].coarse_lng), -87.63);
  assert.equal(
    (
      await db.query("select * from public.activities where id=$1", [
        activityId,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query("select * from public.places where activity_id=$1", [
        activityId,
      ])
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.query("select * from private.beacon_discovery"),
    /permission denied/i,
  );
  assert.equal((await join()).rows[0].result.status, "going");
  assert.equal(
    (await join()).rows[0].result.status,
    "going",
    "join retries are harmless",
  );
  assert.equal(
    (
      await db.query("select * from public.places where activity_id=$1", [
        activityId,
      ])
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query("select * from public.squad_members where user_id=$1", [
        ids.stranger,
      ])
    ).rows.length,
    0,
  );
  await actor("invitee");
  await assert.rejects(join(), /full/i);
  await root();
  await db.query(
    "update public.activities set capacity_limit=5,approval_required=true where id=$1",
    [activityId],
  );
  await actor("invitee");
  assert.equal((await join()).rows[0].result.status, "requested");
  assert.equal((await join()).rows[0].result.status, "requested");
  assert.equal(
    (
      await db.query("select * from public.places where activity_id=$1", [
        activityId,
      ])
    ).rows.length,
    0,
    "pending requests cannot hydrate meeting details",
  );
  await root();
  await db.query(
    "insert into private.activity_exclusions(activity_id,user_id) values($1,$2)",
    [activityId, ids.invitee],
  );
  await actor("invitee");
  assert.equal((await search()).rows.length, 0);
  await assert.rejects(join(), /unavailable/i);
  await root();
  await db.query(
    "insert into public.blocks(blocker_id,blocked_id) values($1,$2)",
    [ids.owner, ids.admin],
  );
  await actor("admin");
  assert.equal((await search()).rows.length, 0);
  await assert.rejects(join(), /unavailable/i);
  await actor("owner");
  await publish(false);
  await actor("member");
  assert.equal((await search()).rows.length, 0);
  await assert.rejects(join(), /unavailable/i);
  await db.exec("reset role; set role anon;");
  await assert.rejects(search(), /permission denied/i);
  await db.close();
});
