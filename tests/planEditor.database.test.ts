import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { recurrencePreview } from "../src/features/plans/recurrence";

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
test("Plan drafts, transactional scheduling and monthly recurrence preserve canonical privacy and replay", async () => {
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
  const snapshot = async () =>
    (await db.query<{ s: any }>("select public.beacon_snapshot() s")).rows[0].s;
  const starts = new Date(Date.now() + 12 * 3600000).toISOString(),
    ends = new Date(Date.now() + 13 * 3600000).toISOString();
  const beacon = {
    title: "Unpublished",
    description: "Secret editor details",
    category: "Social",
    mode: "squad",
    audience: "private",
    audience_id: null,
    starts_at: starts,
    ends_at: ends,
    timezone: "UTC",
    approval_required: false,
    target_count: null,
    label: "Secret place",
    online_url: null,
    latitude: null,
    longitude: null,
    aspiration_ids: [],
  };
  const stops = [
    { id: crypto.randomUUID(), kind: "idea", title: "An idea", details: "" },
    {
      id: crypto.randomUUID(),
      kind: "beacon",
      title: "Unpublished",
      details: "",
      beacon,
      include: true,
    },
    {
      id: crypto.randomUUID(),
      kind: "beacon",
      title: "Later",
      details: "",
      beacon: { ...beacon, title: "Later" },
      include: false,
    },
  ];
  const payload = {
    title: "Staged adventure",
    description: "",
    timezone: "UTC",
    start_date: "",
    squad_id: null,
    stops,
    removed_stop_ids: [],
  };
  const request = crypto.randomUUID();
  const saved = await action("save_plan_editor", payload, request);
  assert.deepEqual(await action("save_plan_editor", payload, request), saved);
  let snap = await snapshot();
  assert.equal(snap.activities.length, 0);
  assert.equal(snap.plan_beacon_drafts.length, 2);
  await actor("bob");
  assert.equal((await snapshot()).plan_beacon_drafts.length, 0);
  await assert.rejects(
    action("save_plan_editor", {
      ...payload,
      plan_id: saved.id,
      revision: saved.revision,
    }),
    /organizers/,
  );
  await assert.rejects(
    db.exec("select * from private.plan_editor_beacons"),
    /permission denied/,
  );
  await actor("alice");
  const squad = await action("create_squad", { name: "Draft privacy crew" });
  const squadId = squad.squad_id ?? squad.id;
  await root();
  await db.query(
    "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'member')",
    [squadId, ids.bob],
  );
  await actor("alice");
  const sharedStop = { ...stops[1], id: crypto.randomUUID() };
  const shared = await action("save_plan_editor", {
    ...payload,
    title: "Shared draft",
    squad_id: squadId,
    stops: [sharedStop],
  });
  await actor("bob");
  const memberView = await snapshot();
  assert.ok(memberView.plans.some((p: any) => p.id === shared.id));
  assert.ok(memberView.plan_stops.some((s: any) => s.id === sharedStop.id));
  assert.equal(memberView.plan_beacon_drafts.length, 0);
  assert.ok(!JSON.stringify(memberView).includes("Secret editor details"));
  await assert.rejects(
    action("schedule_plan_editor", {
      ...payload,
      plan_id: shared.id,
      revision: shared.revision,
      stops: [sharedStop],
    }),
    /organizers/,
  );
  await actor("alice");
  const template = await action("save_living_plan_template", {
    plan_id: shared.id,
  });
  const savedTemplate = (await snapshot()).plan_templates.find(
    (t: any) => t.id === template.id,
  );
  assert.equal(
    savedTemplate.stops[0].beacon.description,
    "Secret editor details",
  );
  assert.equal(savedTemplate.stops[0].beacon.starts_at, undefined);
  assert.equal(savedTemplate.stops[0].beacon.invitee_ids, undefined);
  await action("update_living_plan", { plan_id: shared.id, cancel: true });
  await assert.rejects(
    action("save_plan_editor", { ...payload, expected_actor_id: ids.bob }),
    /account changed/,
  );
  const bad = {
    ...payload,
    plan_id: saved.id,
    revision: saved.revision,
    stops: [
      stops[1],
      {
        ...stops[2],
        include: true,
        beacon: { ...beacon, title: "Invalid", ends_at: starts },
      },
    ],
  };
  await assert.rejects(action("schedule_plan_editor", bad));
  assert.equal((await snapshot()).activities.length, 0);
  const publishRequest = crypto.randomUUID();
  const published = await action(
    "schedule_plan_editor",
    { ...payload, plan_id: saved.id, revision: saved.revision },
    publishRequest,
  );
  assert.deepEqual(
    await action(
      "schedule_plan_editor",
      { ...payload, plan_id: saved.id, revision: saved.revision },
      publishRequest,
    ),
    published,
  );
  snap = await snapshot();
  assert.equal(snap.activities.length, 1);
  assert.equal(
    snap.plan_beacon_drafts.filter((d: any) =>
      stops.some((s) => s.id === d.stop_id),
    ).length,
    1,
  );
  assert.ok(published.publications[stops[1].id]);
  await assert.rejects(
    action("save_plan_editor", {
      ...payload,
      plan_id: saved.id,
      revision: saved.revision,
    }),
    /changed/,
  );
  const repeat = await action("create_routine", {
    plan_id: saved.id,
    confirmed_source: true,
    weekdays: [7],
    interval_weeks: 1,
    frequency: "monthly",
    interval_count: 1,
    month_day: 31,
    anchor_date: "2027-01-31",
  });
  assert.equal(repeat.next_occurrence_on, "2027-01-31");
  const upcoming = (
    await db.query<{ s: any }>("select public.routine_upcoming($1,3) s", [
      repeat.id,
    ])
  ).rows[0].s;
  assert.deepEqual(
    upcoming.rows
      .filter((r: any) => r.state === "projected")
      .map((r: any) => r.date),
    ["2027-01-31", "2027-02-28"],
  );
  assert.equal(upcoming.rows[0].state, "materialized");
  assert.equal(upcoming.rows[0].date, starts.slice(0, 10));
  assert.equal((await snapshot()).activities.length, 1);
  const cal = (
    await db.query<{ s: any }>(
      "select public.calendar_routine_occurrences('2027-02-01','2027-02-28') s",
    )
  ).rows[0].s;
  assert.deepEqual(
    cal.rows.map((r: any) => r.occurrence_on),
    ["2027-02-28"],
  );
  const skipped = await action("skip_routine_next", {id:repeat.id});
  assert.equal(skipped.next_occurrence_on, "2027-02-28");
  await action("pause_routine", {id:repeat.id});
  const resumed = await action("resume_routine", {id:repeat.id});
  assert.equal(resumed.next_occurrence_on, "2027-02-28");
  const generated = await action("run_routine_once", {id:repeat.id});
  assert.equal(generated.next_occurrence_on, "2027-03-31");
  assert.ok(generated.occurrence_plan_id);
  assert.equal((await snapshot()).activities.length, 2);
  await actor("outsider");
  await assert.rejects(
    db.query("select public.routine_upcoming($1,3)", [repeat.id]),
    /unavailable/,
  );
  await root();
  for (const frequency of ["daily", "weekly", "monthly"] as const) {
    const rule = {
      frequency,
      anchor_date: "2028-01-31",
      interval_count: 2,
      interval_weeks: 2,
      weekdays: [1, 5],
      month_day: 31,
      ends_on: "2029-02-28",
    };
    let after = "2028-01-30";
    for (const expected of recurrencePreview(rule, after, 10)) {
      const result = (
        await db.query<{ d: string }>(
          "select private.next_recurrence_date($1::date,$2,2,array[1,5]::smallint[],31,$3::date,'2029-02-28')::text d",
          [rule.anchor_date, frequency, after],
        )
      ).rows[0].d;
      assert.equal(
        result,
        expected,
        `${frequency}: SQL and editor preview agree`,
      );
      after = expected;
    }
  }
  assert.equal(
    (
      await db.query<{ d: string }>(
        "select private.next_recurrence_date('2028-01-31','monthly',1,array[1]::smallint[],31,'2028-01-31',null)::text d",
      )
    ).rows[0].d,
    "2028-02-29",
  );
  await db.close();
});
