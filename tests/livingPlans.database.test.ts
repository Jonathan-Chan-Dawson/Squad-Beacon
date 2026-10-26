import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  alice: "81111111-1111-4111-8111-111111111111",
  bob: "82222222-2222-4222-8222-222222222222",
  carol: "83333333-3333-4333-8333-333333333333",
  outsider: "84444444-4444-4444-8444-444444444444",
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
  requestId?: string,
) {
  return (
    await db.query<{ result: Record<string, any> }>(
      "select public.beacon_action($1,$2::jsonb,coalesce($3::uuid,gen_random_uuid())) result",
      [name, JSON.stringify(payload), requestId ?? null],
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
function isoAfter(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
function beaconDraft(title: string, audience = "friends") {
  const starts_at = isoAfter(8);
  return {
    title,
    description: "A planning council option.",
    category: "Social",
    mode: "squad",
    starts_at,
    ends_at: new Date(Date.parse(starts_at) + 60 * 60 * 1000).toISOString(),
    timezone: "UTC",
    approval_required: false,
    audience,
    audience_id: null,
    target_count: null,
    label: "",
    online_url: null,
    latitude: null,
    longitude: null,
    aspiration_ids: [],
  };
}
async function createThread(
  owner: keyof typeof ids,
  kind: "ping" | "vote" | "draw",
  options: {
    coowners?: string[];
    payload?: Record<string, unknown>;
    id?: string;
  } = {},
) {
  await actor(owner);
  return action("create_planning_thread", {
    ...(options.id ? { id: options.id } : {}),
    kind,
    title: kind === "ping" ? "Free Saturday?" : "Choose a crew plan",
    body: "A focused planning test.",
    audience: "friends",
    audience_id: null,
    deadline_at: isoAfter(1),
    coowner_ids: options.coowners ?? [],
    ...(options.payload ? { payload: options.payload } : {}),
  });
}
async function makePast(threadId: string) {
  await root();
  await db.query(
    "update public.planning_threads set deadline_at=now()-interval '1 minute' where id=$1",
    [threadId],
  );
}

test("living Plans durable stops, safe links and role boundaries", async () => {
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql as $$select (string_to_array($1,'/'))[1:1]$$;
 create publication supabase_realtime;
 `);
  for (const migration of readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  )
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await applyMigration(migration);

  await root();
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query(
      "insert into public.profiles(id,username,name) values($1,$2,$3)",
      [id, name, name],
    );
  }

  await actor("alice");
  const squad = await action("create_squad", { name: "Plan crew" });
  const squadId = String(squad.squad_id ?? squad.id);
  await root();
  await db.query(
    "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'member'),($1,$3,'admin')",
    [squadId, ids.bob, ids.carol],
  );
  await actor("alice");
  const request = crypto.randomUUID();
  const created = await action(
    "create_living_plan",
    { title: "Saturday Adventure", timezone: "UTC", squad_id: squadId },
    request,
  );
  assert.equal(
    (
      await action(
        "create_living_plan",
        { title: "Saturday Adventure", timezone: "UTC", squad_id: squadId },
        request,
      )
    ).id,
    created.id,
  );
  const pid = String(created.id);
  let snapshot = (
    await db.query<{ s: any }>("select public.beacon_snapshot() s")
  ).rows[0].s;
  assert.equal(snapshot.plans.find((p: any) => p.id === pid).start_date, null);
  assert.equal(
    snapshot.activities.filter((a: any) => a.plan_id === pid).length,
    0,
  );
  await actor("bob");
  const idea = await action("add_plan_stop", {
    plan_id: pid,
    title: "Bowling?",
    details: "Or the arcade",
  });
  snapshot = (await db.query<{ s: any }>("select public.beacon_snapshot() s"))
    .rows[0].s;
  assert.equal(
    snapshot.plan_stops.find((s: any) => s.id === idea.id).approval,
    "pending",
  );
  await assert.rejects(
    action("review_plan_stop", {
      plan_id: pid,
      stop_id: idea.id,
      approval: "approved",
    }),
  );
  await actor("carol");
  await action("review_plan_stop", {
    plan_id: pid,
    stop_id: idea.id,
    approval: "approved",
  });
  await assert.rejects(
    action("update_living_plan", { plan_id: pid, title: "Not mine" }),
  );
  await actor("alice");
  await action("update_living_plan", { plan_id: pid, coowner_ids: [ids.bob] });
  await actor("bob");
  await action("edit_plan_stop", {
    plan_id: pid,
    stop_id: idea.id,
    title: "Arcade",
    details: "Bring quarters",
  });
  await assert.rejects(
    action("edit_plan_stop", {
      plan_id: pid,
      stop_id: idea.id,
      title: "Lost update",
      revision: 0,
    }),
  );
  const before = await action("create_activity", {
    ...beaconDraft("Dinner", "squad"),
    label: "Private meeting",
    online_url: "https://example.com/private-room",
    approval_required: true,
    audience_id: squadId,
  });
  const activityId = String(before.id);
  const original = (
    await db.query<{ a: any }>(
      "select to_jsonb(a) a from public.activities a where id=$1",
      [activityId],
    )
  ).rows[0].a;
  await action("add_plan_stop", { plan_id: pid, activity_id: activityId });
  const after = (
    await db.query<{ a: any }>(
      "select to_jsonb(a) a from public.activities a where id=$1",
      [activityId],
    )
  ).rows[0].a;
  assert.deepEqual(after, original);
  await assert.rejects(
    action("add_plan_stop", { plan_id: pid, activity_id: activityId }),
  );
  const privateBeacon = await action(
    "create_activity",
    beaconDraft("Private dinner", "private"),
  );
  await assert.rejects(
    action("add_plan_stop", { plan_id: pid, activity_id: privateBeacon.id }),
  );
  const second = await action("add_plan_stop", {
    plan_id: pid,
    title: "Dessert",
  });
  await action("move_plan_stop", {
    plan_id: pid,
    stop_id: second.id,
    position: 0,
  });
  assert.deepEqual(
    (
      await db.query<{ a: any }>(
        "select to_jsonb(a) a from public.activities a where id=$1",
        [activityId],
      )
    ).rows[0].a,
    original,
  );
  await action("save_living_plan_template", { plan_id: pid });
  await actor("alice");
  const pingDraft = {
    ...beaconDraft("After dinner", "squad"),
    audience_id: squadId,
    starts_at: isoAfter(10),
    ends_at: isoAfter(11),
  };
  const ping = await action("create_planning_thread", {
    kind: "ping",
    title: "After dinner?",
    body: "",
    audience: "squad",
    audience_id: squadId,
    deadline_at: isoAfter(2),
    payload: pingDraft,
    return_plan_id: pid,
  });
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.plan_stops where plan_id=$1 and thread_id=$2",
        [pid, ping.id],
      )
    ).rows[0].n,
    1,
  );
  await actor("bob");
  await action("join_plan", { plan_id: pid });
  assert.equal(
    (
      await db.query(
        "select * from public.rsvps where user_id=$1 and activity_id=$2",
        [ids.bob, activityId],
      )
    ).rows.length,
    0,
  );
  await action("respond_planning_ping", {
    thread_id: ping.id,
    response: "interested",
    auto_rsvp: false,
  });
  await actor("alice");
  const published = await action("publish_planning_beacon", {
    thread_id: ping.id,
    payload: pingDraft,
    confirmed: true,
  });
  assert.equal(
    (
      await db.query<{ activity_id: string }>(
        "select activity_id from public.plan_stops where plan_id=$1 and thread_id=$2",
        [pid, ping.id],
      )
    ).rows[0].activity_id,
    published.id,
  );
  assert.equal(
    (
      await action("publish_planning_beacon", {
        thread_id: ping.id,
        payload: pingDraft,
        confirmed: true,
      })
    ).id,
    published.id,
  );
  const shared = await action("send_group_message", {
    scope: "squad",
    squad_id: squadId,
    body: "An adventure",
    plan_id: pid,
  });
  assert.equal(
    (
      await db.query<{ plan_id: string }>(
        "select plan_id from public.group_messages where id=$1",
        [shared.id],
      )
    ).rows[0].plan_id,
    pid,
  );
  await assert.rejects(
    action("create_routine", {
      plan_id: pid,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      interval_weeks: 1,
    }),
  );
  await actor("bob");
  const repeat = await action("create_routine", {
    expected_actor_id: ids.bob,
    plan_id: pid,
    weekdays: [new Date(Date.now() + 86400000).getUTCDay() || 7],
    interval_weeks: 1,
    confirmed_source: true,
  });
  await root();
  const frozen = (
    await db.query<{ source: any }>(
      "select to_jsonb(s) source from private.plan_repeat_sources s where plan_id=$1",
      [pid],
    )
  ).rows[0].source;
  assert.ok(
    !JSON.stringify(frozen).includes("private-room"),
    "a readable Beacon must not disclose a protected meeting through a repeat source",
  );
  await actor("alice");
  assert.equal(
    (
      await action("create_routine", {
        plan_id: pid,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        interval_weeks: 1,
        confirmed_source: true,
        expected_actor_id: ids.alice,
      })
    ).id,
    repeat.id,
    "a new request cannot duplicate an active Plan Routine",
  );
  const run = await action("run_routine_now", { id: repeat.id });
  assert.ok(run.occurrence_plan_id);
  const occurrence = String(run.occurrence_plan_id);
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.activities where plan_id=$1",
        [occurrence],
      )
    ).rows[0].n,
    2,
  );
  await root();
  await db.query(
    "update public.activities set title='A new afternoon' where id=$1",
    [published.id],
  );
  await actor("alice");
  const oldSourceRun = await action("run_routine_now", { id: repeat.id });
  assert.ok(
    (
      await db.query<{ title: string }>(
        "select title from public.activities where plan_id=$1",
        [oldSourceRun.occurrence_plan_id],
      )
    ).rows.some((a) => a.title === "After dinner"),
  );
  await action("update_routine_source", {
    id: repeat.id,
    confirmed_source: true,
  });
  const fresh = await action("run_routine_now", { id: repeat.id });
  assert.ok(
    (
      await db.query<{ title: string }>(
        "select title from public.activities where plan_id=$1",
        [fresh.occurrence_plan_id],
      )
    ).rows.some((a) => a.title === "A new afternoon"),
  );
  assert.ok(
    (
      await db.query<{ title: string }>(
        "select title from public.activities where plan_id=$1",
        [occurrence],
      )
    ).rows.some((a) => a.title === "After dinner"),
  );
  const beforeSingle = (
    await db.query<{ n: number }>(
      "select count(*)::int n from public.activities",
    )
  ).rows[0].n;
  await root();
  await db.query(
    "update public.activities set status='completed' where id=$1",
    [published.id],
  );
  await actor("alice");
  const single = await action("repeat_beacon", {
    activity_id: published.id,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    interval_weeks: 1,
  });
  assert.ok(single.plan_id);
  assert.equal(
    (
      await action("repeat_beacon", {
        activity_id: published.id,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        interval_weeks: 1,
      })
    ).id,
    single.id,
    "ambiguous standalone setup retries reuse the active source",
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.activities",
      )
    ).rows[0].n,
    beforeSingle,
  );
  await action("pause_routine", { id: single.id });
  await action("resume_routine", { id: single.id });
  const nextDate = (
    await db.query<{ next_occurrence_on: string }>(
      "select next_occurrence_on from public.plan_routines where id=$1",
      [single.id],
    )
  ).rows[0].next_occurrence_on;
  const skipRequest = crypto.randomUUID(),
    skipPayload = { id: single.id, expected_occurrence_on: nextDate };
  const skipped = await action("skip_routine_next", skipPayload, skipRequest);
  assert.deepEqual(
    await action("skip_routine_next", skipPayload, skipRequest),
    skipped,
  );
  await assert.rejects(action("skip_routine_next", skipPayload), /changed/);
  await root();
  await db.query(
    "select set_config('request.jwt.claim.role','service_role',false),set_config('request.jwt.claim.sub','',false)",
  );
  await db.exec("set role service_role");
  const scheduled = (
    await db.query<{ n: number }>("select public.run_due_plan_routines(2) n")
  ).rows[0].n;
  assert.ok(
    scheduled >= 1,
    "the existing trusted runner generates reviewed occurrences",
  );
  assert.equal(
    (await db.query<{ id: string | null }>("select auth.uid() id")).rows[0].id,
    null,
    "generation restores the runner identity",
  );
  await root();
  await db.query(
    "select set_config('request.jwt.claim.role','authenticated',false)",
  );
  await actor("outsider");
  assert.equal(
    (await db.query("select * from public.plan_stops where plan_id=$1", [pid]))
      .rows.length,
    0,
  );
  await assert.rejects(
    action("add_plan_stop", { plan_id: pid, title: "Intruder" }),
  );
  await actor("alice");
  await action("update_living_plan", { plan_id: pid, cancel: true });
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.activities where id=$1",
        [activityId],
      )
    ).rows[0].status,
    "scheduled",
  );
  await db.close();
});
