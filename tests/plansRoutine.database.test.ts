import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const ids = {
  owner: "81111111-1111-4111-8111-111111111111",
  member: "82222222-2222-4222-8222-222222222222",
  admin: "83333333-3333-4333-8333-333333333333",
  outsider: "84444444-4444-4444-8444-444444444444",
};

async function root() {
  await db.exec("reset role");
}
async function actor(name: keyof typeof ids) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [ids[name]]);
}
async function action(name: string, payload: Record<string, unknown> = {}, requestId?: string) {
  return (await db.query<{ result: Record<string, any> }>(
    "select public.beacon_action($1,$2::jsonb,coalesce($3::uuid,gen_random_uuid())) result",
    [name, JSON.stringify(payload), requestId ?? null],
  )).rows[0].result;
}
async function migration(name: string) {
  const sql = readFileSync(new URL("../supabase/migrations/" + name, import.meta.url), "utf8")
    .replace("create extension if not exists pgcrypto;", "");
  try { await db.exec(sql); }
  catch (error) { throw new Error(`Migration ${name}: ${JSON.stringify(error, Object.getOwnPropertyNames(error as object))}`); }
}
function futureDate(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}
function planSteps() {
  return [{
    title: "Friday dinner", description: "Dinner together", category: "Social",
    location_name: "North table", lat: null, lng: null, day_offset: 0,
    start_time: "18:00", duration_minutes: 60, aspiration_ids: [],
  }];
}
async function createPlan(title: string, startDate: string, squadId?: string) {
  return action("create_plan", {
    title, description: "Routine source plan", timezone: "UTC", start_date: startDate,
    ...(squadId ? { squad_id: squadId } : {}), steps: planSteps(),
  });
}

test("Plan membership and Routine actions enforce audience boundaries and persist occurrences", async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    grant execute on function auth.uid(),auth.role() to authenticated,anon,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb not null default '{}'::jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
    create publication supabase_realtime;
  `);
  for (const name of [
    "202609060001_beacon.sql", "202609060002_delivery.sql", "202609060003_profile_metrics.sql",
    "202609290001_simple_beacons.sql", "202609290002_map_workspace.sql", "202609290003_mini_avatars.sql",
    "202610010001_plans_profile_survey.sql", "202610010002_beacon_modules.sql", "202610010003_shared_libraries.sql",
    "202610010004_planning_threads.sql", "202610010005_beacon_controls.sql", "202610030001_profile_privacy.sql",
    "202610030002_beacon_module_collections.sql", "202610030003_beacon_media_teams.sql",
    "202610040001_organization_audience_type.sql", "202610040002_organizations_group_chat.sql",
    "202610040003_plan_routines.sql",
  ]) await migration(name);

  await root();
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query("insert into public.profiles(id,username,name) values($1,$2,$2)", [id, name]);
  }
  const squadId = "85555555-5555-4555-8555-555555555555";
  await db.query("insert into public.squads(id,owner_id,name,description) values($1,$2,'Routine crew','')", [squadId, ids.owner]);
  await db.query("insert into public.squad_members(squad_id,user_id,role) values($1,$2,'owner'),($1,$3,'member'),($1,$4,'admin')", [squadId, ids.owner, ids.member, ids.admin]);
  const personalDate = futureDate(2);
  const squadDate = futureDate(3);

  await actor("owner");
  const personal = await createPlan("Private source", personalDate);
  const squadPlan = await createPlan("Crew source", squadDate, squadId);
  const personalRoutine = await action("create_routine", {
    plan_id: personal.id,
    weekdays: [new Date(`${personalDate}T00:00:00Z`).getUTCDay() || 7],
    interval_weeks: 1,
    reminder_minutes: 30,
  });
  await action("cancel_plan", { id: personal.id });
  assert.equal((await db.query("select status from public.plan_routines where id=$1", [personalRoutine.id])).rows[0].status, "ended", "canceling a source Plan stops its Routine");
  await assert.rejects(action("join_plan", { plan_id: personal.id }), /unavailable to join/i);
  await assert.rejects(action("join_plan", { plan_id: squadPlan.id }), /already the owner/i);

  await actor("member");
  await assert.rejects(action("create_routine", { plan_id: squadPlan.id, weekdays: [5] }), /owner or a scoped Squad admin/i);
  await action("join_plan", { plan_id: squadPlan.id }, "91111111-1111-4111-8111-111111111111");
  await action("join_plan", { plan_id: squadPlan.id }, "92222222-2222-4222-8222-222222222222");
  assert.equal((await db.query("select count(*)::int n from public.plan_members where plan_id=$1 and user_id=$2", [squadPlan.id, ids.member])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from public.rsvps where user_id=$1", [ids.member])).rows[0].n, 0, "Plan join must not RSVP the member to each Beacon");
  const memberSnapshot = (await db.query<{ data: any }>("select public.beacon_snapshot() data")).rows[0].data;
  assert.equal(memberSnapshot.plans.some((row: any) => row.id === personal.id), false, "private Plan must remain invisible to another account");
  assert.equal(memberSnapshot.plans.some((row: any) => row.id === squadPlan.id), true);
  assert.equal(memberSnapshot.plan_members.some((row: any) => row.plan_id === squadPlan.id && row.user_id === ids.member), true);

  await actor("outsider");
  await assert.rejects(action("join_plan", { plan_id: squadPlan.id }), /unavailable to join/i);
  await assert.rejects(action("create_routine", { plan_id: personal.id, weekdays: [5] }), /owner or a scoped Squad admin/i);
  const outsiderSnapshot = (await db.query<{ data: any }>("select public.beacon_snapshot() data")).rows[0].data;
  assert.equal(outsiderSnapshot.plans.some((row: any) => row.id === squadPlan.id), false);

  await actor("admin");
  const repeatDay = new Date(`${squadDate}T00:00:00Z`).getUTCDay() || 7;
  await assert.rejects(action("create_routine", { plan_id: squadPlan.id, weekdays: [] }), /weekdays|schedule/i);
  await assert.rejects(action("create_routine", { plan_id: squadPlan.id, weekdays: [repeatDay], reminder_minutes: 0 }), /reminder/i);
  const created = await action("create_routine", {
    plan_id: squadPlan.id,
    weekdays: [repeatDay],
    interval_weeks: 1,
    ends_on: null,
    reminder_minutes: 30,
  });
  assert.ok(created.id);
  assert.equal(created.plan_id, squadPlan.id);
  assert.ok(created.next_occurrence_on);
  await assert.rejects(action("create_routine", { plan_id: personal.id, weekdays: [5] }), /owner or a scoped Squad admin/i);

  await root();
  await db.query("update public.places set online_url='https://example.com/meet' where activity_id in (select id from public.activities where plan_id=$1)", [squadPlan.id]);
  await db.exec("reset role; set role service_role");
  await db.query("select set_config('request.jwt.claim.role','service_role',false)");
  const made = (await db.query<{ count: number }>("select public.run_due_plan_routines(30) count")).rows[0].count;
  assert.ok(Number(made) >= 1, "trusted runner should create at least one occurrence Plan");
  await root();
  const occurrenceCount = (await db.query<{ count: number }>("select count(*)::int count from private.plan_routine_occurrences where routine_id=$1 and status='created'", [created.id])).rows[0].count;
  await db.exec("set role service_role");
  const repeated = (await db.query<{ count: number }>("select public.run_due_plan_routines(30) count")).rows[0].count;
  await root();
  assert.equal(Number(repeated), 0);
  assert.equal((await db.query<{ count: number }>("select count(*)::int count from private.plan_routine_occurrences where routine_id=$1 and status='created'", [created.id])).rows[0].count, occurrenceCount, "re-running must not duplicate or backfill already created dates");
  const occurrence = (await db.query<{ plan_id: string; routine_next: string }>(
    "select o.occurrence_plan_id plan_id,r.next_occurrence_on::text routine_next from private.plan_routine_occurrences o join public.plan_routines r on r.id=o.routine_id where r.id=$1 and o.status='created' limit 1",
    [created.id],
  )).rows[0];
  await actor("admin");
  const edited = await action("edit_routine", {
    id: created.id,
    weekdays: [repeatDay],
    interval_weeks: 1,
    ends_on: null,
    reminder_minutes: 30,
  });
  assert.equal(edited.next_occurrence_on, occurrence.routine_next, "editing the same schedule skips already materialized routine dates");
  assert.ok(occurrence.plan_id);
  assert.notEqual(occurrence.plan_id, squadPlan.id);
  assert.ok(occurrence.routine_next);
  const generated = (await db.query<{ owner_id: string; squad_id: string; count: number }>(
    "select p.owner_id,p.squad_id,(select count(*)::int from public.activities a where a.plan_id=p.id) count from public.plans p where p.id=$1",
    [occurrence.plan_id],
  )).rows[0];
  assert.equal(generated.owner_id, ids.owner, "runner must materialize through the source Plan owner");
  assert.equal(generated.squad_id, squadId, "occurrence preserves the approved Squad audience");
  assert.equal(Number(generated.count), 1);
  assert.equal((await db.query("select online_url from public.places where activity_id in (select id from public.activities where plan_id=$1)", [occurrence.plan_id])).rows[0].online_url, "https://example.com/meet", "virtual source link must be copied into occurrences");

  const once = await action("run_routine_once", { id: created.id });
  assert.ok(once.occurrence_plan_id);
  assert.notEqual(once.occurrence_plan_id, occurrence.plan_id);
  await action("pause_routine", { id: created.id });
  await assert.rejects(action("run_routine_once", { id: created.id }), /no upcoming date/i);
  await action("resume_routine", { id: created.id });
  await action("skip_routine_next", { id: created.id });
  await action("end_routine", { id: created.id });

  await actor("member");
  await action("leave_plan", { plan_id: squadPlan.id });
  await assert.rejects(action("leave_plan", { plan_id: squadPlan.id }), /not joined/i);
  assert.equal((await db.query("select count(*)::int n from public.plan_members where plan_id=$1 and user_id=$2", [squadPlan.id, ids.member])).rows[0].n, 0);

  await root();
  await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [ids.owner, ids.member]);
  await actor("member");
  await assert.rejects(action("join_plan", { plan_id: squadPlan.id }), /unavailable to join/i);
  const blockedSnapshot = (await db.query<{ data: any }>("select public.beacon_snapshot() data")).rows[0].data;
  assert.equal(blockedSnapshot.plans.some((row: any) => row.id === squadPlan.id), false, "blocked Squad members cannot view or join the Plan");

  await actor("owner");
  await assert.rejects(db.query("select public.run_due_plan_routines(30)"), /permission denied/i);
});
