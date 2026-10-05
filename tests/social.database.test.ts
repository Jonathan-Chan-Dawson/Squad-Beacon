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
async function root() { await db.exec("reset role"); }
async function action(name: string, payload: Record<string, unknown> = {}, requestId = crypto.randomUUID()) {
  return (await db.query<{ result: Record<string, any> }>(
    "select public.beacon_action($1,$2::jsonb,$3::uuid) result",
    [name, JSON.stringify(payload), requestId],
  )).rows[0].result;
}
async function migration(name: string) {
  const sql = readFileSync(new URL("../supabase/migrations/" + name, import.meta.url), "utf8")
    .replace("create extension if not exists pgcrypto;", "");
  try { await db.exec(sql); }
  catch (error) { throw new Error(`Migration ${name}: ${(error as Error).message}`); }
}
async function createSquad(name: string, discoverability = "private", join_mode = "invite") {
  const result = await action("create_squad", { name, discoverability, join_mode });
  return result.squad_id as string;
}

test("social directory and canonical actions preserve membership boundaries and source history", async () => {
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
    "202609060001_beacon.sql", "202609060002_delivery.sql", "202609060003_profile_metrics.sql",
    "202609290001_simple_beacons.sql", "202609290002_map_workspace.sql", "202609290003_mini_avatars.sql",
    "202610010001_plans_profile_survey.sql", "202610010002_beacon_modules.sql", "202610010003_shared_libraries.sql",
    "202610010004_planning_threads.sql", "202610010005_beacon_controls.sql", "202610030001_profile_privacy.sql",
    "202610030002_beacon_module_collections.sql", "202610030003_beacon_media_teams.sql",
    "202610040001_organization_audience_type.sql", "202610040002_organizations_group_chat.sql",
    "202610040003_plan_routines.sql", "202610040005_places_search_budget.sql", "202610040006_spaces.sql",
    "202610040007_social_architecture.sql",
  ]) await migration(file);

  await root();
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query("insert into public.profiles(id,username,name) values($1,$2,$2)", [id, name.toLowerCase()]);
  }
  await db.query(
    `insert into public.friendships(sender_id,recipient_id,status)
     values($1,$2,'accepted'),($1,$3,'accepted'),($4,$5,'accepted'),($2,$3,'accepted'),($1,$5,'accepted')`,
    [ids.owner, ids.admin, ids.member, ids.admin, ids.invitee],
  );

  // Search returns a fixed, safe summary projection and supports authenticated browse.
  await actor("owner");
  const standaloneOpenSquad = await createSquad("Open Table", "public", "open");
  const requestSquad = await createSquad("Request Table", "public", "request");
  const privateSquad = await createSquad("Private Table");
  await actor("stranger");
  const search = await db.query<Record<string, unknown>>(
    "select * from public.social_directory_search('', 'squad', 50, 0, null, null)",
  );
  assert.equal(search.rows.some((row) => row.entity_id === standaloneOpenSquad), true);
  assert.equal(search.rows.some((row) => row.entity_id === privateSquad), false);
  assert.deepEqual(Object.keys(search.rows[0]).sort(), [
    "action", "child_count", "description", "discoverability", "entity_id", "entity_type",
    "join_mode", "member_count", "membership_status", "name", "parent_id", "parent_name", "parent_type",
  ].sort(), "directory never returns rosters, messages, coordinates, or policy-owner data");
  await assert.rejects(
    db.query("select * from public.social_directory_search('x','all',20,0,null,null)"),
    /2 to 80 characters/i,
  );

  // Open join, request/cancel/approve, and invitation acceptance are independent paths.
  await actor("admin");
  const joined = await action("join_squad", { squad_id: standaloneOpenSquad });
  assert.equal(joined.status, "active");
  await assert.rejects(action("join_squad", { squad_id: requestSquad }), /requires a request/i);
  await action("request_squad_join", { squad_id: requestSquad });
  assert.equal((await db.query("select 1 from public.squad_join_requests where squad_id=$1 and user_id=$2", [requestSquad, ids.admin])).rows.length, 1);
  await actor("owner");
  assert.equal((await db.query("select 1 from public.squad_join_requests where squad_id=$1 and user_id=$2", [requestSquad, ids.admin])).rows.length, 1,
    "active admins can read pending request rows under RLS");
  await actor("admin");
  await action("cancel_squad_join_request", { squad_id: requestSquad });
  assert.equal((await db.query("select 1 from public.squad_join_requests where squad_id=$1 and user_id=$2", [requestSquad, ids.admin])).rows.length, 0);
  await action("request_squad_join", { squad_id: requestSquad });
  await actor("owner");
  await action("approve_squad_join_request", { squad_id: requestSquad, user_id: ids.admin });
  await action("approve_squad_join_request", { squad_id: requestSquad, user_id: ids.admin });
  assert.equal((await db.query("select count(*)::int n from public.squad_members where squad_id=$1 and user_id=$2", [requestSquad, ids.admin])).rows[0].n, 1,
    "approval retries are idempotent");

  const inviteBypass = await createSquad("Invitation Path", "public", "request");
  await action("invite_squad", { id: inviteBypass, user_id: ids.member });
  const invite = (await db.query<{ id: string }>("select id from public.squad_invites where squad_id=$1 and recipient_id=$2", [inviteBypass, ids.member])).rows[0];
  await actor("member");
  await action("accept_squad", { id: invite.id });
  assert.equal((await db.query("select 1 from public.squad_members where squad_id=$1 and user_id=$2", [inviteBypass, ids.member])).rows.length, 1);
  assert.equal((await db.query("select 1 from public.squad_join_requests where squad_id=$1 and user_id=$2", [inviteBypass, ids.member])).rows.length, 0,
    "accepting an invite bypasses the request workflow");

  await actor("owner");
  const senderMustStayActive = await createSquad("Current Inviter");
  await action("set_social_policy", {
    entity_type: "squad", entity_id: senderMustStayActive, discoverability: "private", join_mode: "invite", invite_policy: "members",
  });
  await action("invite_squad", { id: senderMustStayActive, user_id: ids.admin });
  const adminInvite = (await db.query<{ id: string }>("select id from public.squad_invites where squad_id=$1 and recipient_id=$2", [senderMustStayActive, ids.admin])).rows[0];
  await actor("admin");
  await action("accept_squad", { id: adminInvite.id });
  await action("invite_squad", { id: senderMustStayActive, user_id: ids.member });
  await root();
  const memberInvite = (await db.query<{ id: string }>("select id from public.squad_invites where squad_id=$1 and recipient_id=$2", [senderMustStayActive, ids.member])).rows[0];
  await actor("owner");
  await action("remove_member", { id: senderMustStayActive, user_id: ids.admin });
  await actor("member");
  await assert.rejects(action("accept_squad", { id: memberInvite.id }), /no longer available/i,
    "a pending invitation is invalid once its inviter no longer has active invite authority");

  // Parent join never autojoins the child. Link metadata remains independently visible.
  await actor("owner");
  const space = await action("create_space", { name: "Public Running Space", discoverability: "public", join_mode: "open" });
  await action("set_social_policy", {
    entity_type: "space", entity_id: space.space_id, discoverability: "public", join_mode: "open", invite_policy: "admins",
  });
  await action("attach_space_squad", { space_id: space.space_id, squad_id: standaloneOpenSquad });
  await action("invite_space_member", { space_id: space.space_id, user_id: ids.admin, role: "admin" });
  await actor("admin");
  await action("respond_space_invite", { space_id: space.space_id, accept: true });
  await actor("owner");
  const communityChild = await createSquad("Parent-gated Squad");
  await action("set_social_policy", {
    entity_type: "squad", entity_id: communityChild, discoverability: "community", join_mode: "open", invite_policy: "admins",
  });
  await action("attach_space_squad", { space_id: space.space_id, squad_id: communityChild });
  await actor("stranger");
  assert.equal((await db.query("select entity_id from public.social_directory_search('', 'squad', 50, 0, 'space', $1)", [space.space_id])).rows.some((row: any) => row.entity_id === communityChild), false);
  await assert.rejects(action("join_squad", { squad_id: communityChild }), /unavailable/i);
  await action("join_space", { space_id: space.space_id });
  assert.equal((await db.query("select entity_id from public.social_directory_search('', 'squad', 50, 0, 'space', $1)", [space.space_id])).rows.some((row: any) => row.entity_id === communityChild), true);
  assert.equal((await db.query("select 1 from public.squad_members where squad_id=$1 and user_id=$2", [communityChild, ids.stranger])).rows.length, 0,
    "joining an eligible parent does not auto-enroll a community-only child");
  await action("join_squad", { squad_id: communityChild });
  await actor("invitee");
  await action("join_space", { space_id: space.space_id });
  assert.equal((await db.query("select 1 from public.squad_members where squad_id=$1 and user_id=$2", [standaloneOpenSquad, ids.invitee])).rows.length, 0,
    "joining a Space does not grant linked Squad membership");
  const contextual = await db.query<{ entity_id: string; parent_type: string }>(
    "select entity_id,parent_type from public.social_directory_search('', 'squad', 50, 0, 'space', $1)", [space.space_id],
  );
  assert.equal(contextual.rows.some((row) => row.entity_id === standaloneOpenSquad && row.parent_type === "space"), true);
  await action("join_squad", { squad_id: standaloneOpenSquad });

  // A public activity keeps its legacy audience ACL and stores community context separately.
  const beacon = await action("create_activity", {
    title: "Open community run", category: "Fitness", mode: "squad", timezone: "America/Chicago",
    starts_at: "2026-10-06T15:00:00Z", ends_at: "2026-10-06T16:00:00Z",
    audience: "private", social_entity_type: "space", social_entity_id: space.space_id,
  });
  const activityId = beacon.id as string;
  assert.equal((await db.query<{ audience: string }>("select audience from public.activities where id=$1", [activityId])).rows[0].audience, "private");
  assert.equal((await db.query("select 1 from public.activity_social_links where activity_id=$1 and entity_type='space' and entity_id=$2", [activityId, space.space_id])).rows.length, 1);
  const associatedSnapshot = (await db.query<{ data: any }>("select public.beacon_snapshot() data")).rows[0].data;
  assert.equal(associatedSnapshot.activity_social_links.some((link: any) => link.activity_id === activityId), true,
    "associated Beacon metadata is projected to an authorized host without changing audience ACL");
  await actor("stranger");
  await assert.rejects(action("clear_social_association", { activity_id: activityId }, crypto.randomUUID()), /host can change/i);
  await actor("invitee");
  await action("clear_social_association", { activity_id: activityId });
  assert.equal((await db.query("select 1 from public.activity_social_links where activity_id=$1", [activityId])).rows.length, 0);

  // Role hierarchy allows an Elder to organize, but never grants moderation.
  await actor("owner");
  const roleSquad = await createSquad("Role Ladder");
  await root();
  await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'elder'),($1,$3,'member')", [roleSquad, ids.admin, ids.member]);
  await actor("admin");
  await assert.rejects(action("ban_squad_member", { squad_id: roleSquad, user_id: ids.member }), /only community admins/i);
  await actor("owner");
  await action("set_squad_member_role", { squad_id: roleSquad, user_id: ids.admin, role: "member" });
  await action("ban_squad_member", { squad_id: roleSquad, user_id: ids.member });
  assert.equal((await db.query("select 1 from public.squad_bans where squad_id=$1 and user_id=$2", [roleSquad, ids.member])).rows.length, 1);
  await actor("member");
  await assert.rejects(action("join_squad", { squad_id: roleSquad }, crypto.randomUUID()), /unavailable|banned/i);

  // Dual-end affiliation authority and Space grouping copy no membership.
  const organization = await action("create_organization", { name: "Lakefront Collective" });
  await action("set_social_policy", {
    entity_type: "organization", entity_id: organization.organization_id,
    discoverability: "public", join_mode: "request", invite_policy: "members",
  });
  await action("invite_organization_member", { organization_id: organization.organization_id, user_id: ids.admin, role: "admin" });
  await actor("admin");
  await assert.rejects(action("attach_organization_space", { organization_id: organization.organization_id, space_id: space.space_id }), /both communities/i,
    "Space admin without Organization admin authority cannot create the affiliation");
  await action("respond_organization_invite", { organization_id: organization.organization_id, accept: true });
  await actor("owner");
  const managedOne = await createSquad("Managed One");
  const managedTwo = await createSquad("Managed Two");
  await action("attach_space_squad", { space_id: space.space_id, squad_id: managedOne });
  await action("attach_space_squad", { space_id: space.space_id, squad_id: managedTwo });
  const grouping = await action("create_space_from_squads", { name: "Grouped Squads", squad_ids: [managedOne, managedTwo] });
  const grouped = (await db.query<{ id: string }>("select id from public.spaces where name='Grouped Squads'")).rows[0].id;
  assert.equal(grouping.linked_squad_count, 2);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.space_squads where space_id=$1", [grouped])).rows[0].n, 2,
    "group creation links selected Squads without cloning their membership");
  assert.equal((await db.query("select 1 from public.space_members where space_id=$1 and user_id=$2", [grouped, ids.admin])).rows.length, 0);
  await actor("admin");
  await action("attach_organization_space", { organization_id: organization.organization_id, space_id: space.space_id });
  assert.equal((await db.query("select 1 from public.organization_spaces where organization_id=$1 and space_id=$2", [organization.organization_id, space.space_id])).rows.length, 1,
    "authenticated administrators can read only visible affiliation metadata");

  // Conversion preserves source identity/history and copies only confirmed eligible members.
  await actor("owner");
  const sourceSquad = await createSquad("Source History");
  await root();
  await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'admin'),($1,$3,'member')", [sourceSquad, ids.admin, ids.member]);
  await actor("owner");
  const sourceMessage = await action("send_group_message", { scope: "squad", squad_id: sourceSquad, body: "Keep this history." });
  const sourceBeacon = await action("create_activity", {
    title: "Source activity", category: "Social", mode: "squad", timezone: "America/Chicago",
    starts_at: "2026-10-06T17:00:00Z", ends_at: "2026-10-06T18:00:00Z",
    audience: "squad", audience_id: sourceSquad,
  });
  await root();
  const sourcePlan = (await db.query<{ id: string }>(
    `insert into public.plans(owner_id,squad_id,title,timezone,start_date)
     values($1,$2,'Preserved source plan','America/Chicago','2026-10-06') returning id`, [ids.owner, sourceSquad],
  )).rows[0].id;
  await db.query("grant select on public.squad_members,public.space_members,public.group_messages,public.activities,public.plans to service_role");
  await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.owner, ids.member]);
  await actor("owner");
  const conversionRequest = "f6666666-6666-4666-8666-666666666666";
  const conversionPayload = { squad_id: sourceSquad, name: "Converted Group", copy_members: true, confirm_member_copy: true, expected_member_count: 1 };
  const converted = await action("organize_squad_into_space", conversionPayload, conversionRequest);
  const replayed = await action("organize_squad_into_space", { ...conversionPayload, name: "Changed Retry Name" }, conversionRequest);
  assert.equal(replayed.space_id, converted.space_id, "same request ID returns the cached conversion rather than applying a changed payload");
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.spaces where name='Changed Retry Name'")).rows[0].n, 0);
  assert.equal(converted.copied_member_count, 1);
  assert.equal(converted.skipped_member_count, 1);
  await db.exec("reset role; set role service_role");
  assert.deepEqual((await db.query("select user_id,role from public.squad_members where squad_id=$1 order by user_id", [sourceSquad])).rows,
    [{ user_id: ids.owner, role: "owner" }, { user_id: ids.admin, role: "admin" }, { user_id: ids.member, role: "member" }]);
  assert.deepEqual((await db.query("select id,body from public.group_messages where scope='squad' and scope_id=$1", [sourceSquad])).rows,
    [{ id: sourceMessage.id, body: "Keep this history." }]);
  assert.deepEqual((await db.query("select id from public.activities where id=$1", [sourceBeacon.id])).rows, [{ id: sourceBeacon.id }]);
  assert.deepEqual((await db.query("select id,squad_id from public.plans where id=$1", [sourcePlan])).rows,
    [{ id: sourcePlan, squad_id: sourceSquad }]);
  assert.equal((await db.query("select 1 from public.space_members where space_id=$1 and user_id=$2", [converted.space_id, ids.admin])).rows.length, 1);
  assert.equal((await db.query("select 1 from public.space_members where space_id=$1 and user_id=$2", [converted.space_id, ids.member])).rows.length, 0);
  await root();
  await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [ids.owner, ids.member]);

  // A newly banned user cannot retain eligibility through a stale membership row.
  await root();
  await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'member') on conflict do nothing", [roleSquad, ids.member]);
  await actor("member");
  assert.equal((await db.query("select * from public.social_directory_search('', 'squad', 50, 0, null, null)")).rows.some((row: any) => row.entity_id === roleSquad), false);
  await assert.rejects(action("join_squad", { squad_id: roleSquad }), /unavailable|banned/i);
});
