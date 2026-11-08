import { premiumCatalog } from "../src/shared/entitlements";
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

test("Premium verified grants, quotas and recurring Plan enforcement", async () => {
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

  const snap = async () =>
    (await db.query<{ s: any }>("select public.beacon_snapshot() s")).rows[0].s;
  const grant = async (tier: string) => {
    await root();
    await db.query(
      "insert into private.premium_grants(owner_id,tier) values($1,$2) on conflict(owner_id) do update set tier=excluded.tier,revoked_at=null,valid_until=null",
      [ids.alice, tier],
    );
    await actor("alice");
  };
  await actor("alice");
  assert.equal((await snap()).premium.tier, "free");
  await assert.rejects(
    db.exec(
      "insert into private.premium_grants(owner_id,tier) values(auth.uid(),'pro')",
    ),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select private.premium_tier($1)", [ids.bob]),
    /permission denied/,
  );
  await assert.rejects(
    action("save_template", {
      expected_actor_id: ids.bob,
      name: "Forged",
      title: "No",
      minutes: 30,
    }),
    /account changed/,
  );
  const template = {
    name: "Personal",
    title: "Walk",
    minutes: 30,
    category: "Social",
    label: "",
    description: "",
    approval_required: false,
  };
  const request = crypto.randomUUID();
  const first = await action("save_template", template, request);
  assert.deepEqual(await action("save_template", template, request), first);
  for (let i = 1; i < 9; i++)
    await action("save_template", { ...template, name: `Free ${i}` });
  const competing = await Promise.allSettled([
    action("save_template", { ...template, name: "Last slot A" }),
    action("save_template", { ...template, name: "Last slot B" }),
  ]);
  assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(competing.filter((r) => r.status === "rejected").length, 1);
  await assert.rejects(
    action("save_template", {
      ...template,
      tier: "pro",
      demo_premium_tier: "pro",
    }),
    /PREMIUM_QUOTA: 10\/10/,
  );
  const existing = (await snap()).templates[0];
  await action("save_template", { ...existing, name: "Still editable" });
  await grant("plus");
  assert.equal((await snap()).premium.tier, "plus");
  for (let i = 10; i < 50; i++)
    await action("save_template", { ...template, name: `Plus ${i}` });
  await assert.rejects(
    action("save_template", template),
    /PREMIUM_QUOTA: 50\/50/,
  );
  await grant("pro");
  await action("save_template", template);
  const steps = [
    {
      title: "Coffee",
      description: "",
      category: "Social",
      location_name: "",
      lat: null,
      lng: null,
      day_offset: 0,
      start_time: "18:00",
      duration_minutes: 30,
      aspiration_ids: [],
    },
  ];
  const planTemplate = {
    title: "Saved plan",
    description: "",
    timezone: "UTC",
    steps,
  };
  await root();
  for (const tier of ["free", "plus", "pro"] as const) {
    const limits = (
      await db.query<{ limits: any }>(
        "select private.premium_limits($1) limits",
        [tier],
      )
    ).rows[0].limits;
    const entry = premiumCatalog[tier];
    const expected = [
      entry.beaconTemplates,
      entry.planTemplates,
      entry.squadBoosts,
    ];
    assert.deepEqual(
      [limits.beacon_templates, limits.plan_templates, limits.squad_boosts],
      expected,
    );
  }
  await db.query(
    "update private.premium_grants set revoked_at=now() where owner_id=$1",
    [ids.alice],
  );
  await actor("alice");
  assert.equal((await snap()).templates.length, 51);
  await assert.rejects(action("save_template", template), /PREMIUM_QUOTA/);
  await action("save_template", { ...existing, name: "Downgrade edit" });
  const crew = await action("create_squad", { name: "Template crew" });
  const squadId = String(crew.squad_id ?? crew.id);
  for (let i = 0; i < 4; i++)
    await action("save_plan_template", { ...planTemplate, squad_id: squadId });
  const pt1 = await action("save_plan_template", planTemplate);
  await action("save_plan_template", planTemplate);
  await assert.rejects(
    action("save_plan_template", planTemplate),
    /PREMIUM_QUOTA: 2\/2/,
  );
  await action("save_plan_template", {
    ...planTemplate,
    id: pt1.id,
    title: "Updated",
  });
  const living = await action("create_living_plan", {
    title: "Tentative",
    timezone: "UTC",
  });
  await assert.rejects(
    action("save_living_plan_template", { plan_id: living.id }),
    /PREMIUM_QUOTA/,
  );
  const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const single = await action("create_plan", {
    title: "Single",
    timezone: "UTC",
    start_date: start,
    steps,
  });
  const schedule = {
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    interval_weeks: 1,
    reminder_minutes: 30,
    confirmed_source: true,
  };
  const sr = await action("create_routine", {
    ...schedule,
    plan_id: single.id,
  });
  const extra = await action("create_activity", beaconDraft("An extra stop"));
  await action("add_plan_stop", { plan_id: single.id, activity_id: extra.id });
  await assert.rejects(
    action("update_routine_source", { id: sr.id, confirmed_source: true }),
    /PREMIUM_REQUIRED/,
  );
  await assert.rejects(
    db.query(
      "select private.repeatable_plan_action('update_routine_source',$1::jsonb,gen_random_uuid())",
      [JSON.stringify({ id: sr.id, confirmed_source: true })],
    ),
    /PREMIUM_REQUIRED/,
  );
  const multi = await action("create_plan", {
    title: "Multi",
    timezone: "UTC",
    start_date: start,
    steps: [...steps, { ...steps[0], title: "Walk", start_time: "19:00" }],
  });
  await assert.rejects(
    action("create_routine", { ...schedule, plan_id: multi.id }),
    /PREMIUM_REQUIRED/,
  );
  // Ordinary multi-stop Plans are still created on Free; manual reuse stays Free.
  const manual = await action("create_routine", {
    ...schedule,
    plan_id: multi.id,
    run_mode: "manual",
  });
  await action("end_routine", { id: manual.id });
  await grant("plus");
  for (let i = 2; i < 10; i++) await action("save_plan_template", planTemplate);
  await assert.rejects(
    action("save_plan_template", planTemplate),
    /PREMIUM_QUOTA: 10\/10/,
  );
  const mr = await action("create_routine", { ...schedule, plan_id: multi.id });
  await root();
  await db.query(
    "insert into private.premium_grants(owner_id,tier) values($1,'pro')",
    [ids.outsider],
  );
  await actor("outsider");
  await assert.rejects(
    action("pause_routine", { id: mr.id }),
    /Routine|unavailable|owner/i,
  );
  await grant("pro");
  await action("save_plan_template", planTemplate);
  await root();
  await db.query(
    "update private.premium_grants set valid_until=now()-interval '1 minute',verified_at=now()-interval '1 day' where owner_id=$1",
    [ids.alice],
  );
  await actor("alice");
  const down = await snap();
  assert.equal(down.premium.tier, "free");
  assert.equal(down.plan_templates.filter((t: any) => !t.squad_id).length, 11);
  assert.equal(
    down.plan_routines.find((r: any) => r.id === mr.id).status,
    "paused",
  );
  assert.equal(
    down.plan_routines.find((r: any) => r.id === mr.id).premium_pause_reason,
    "plus_required",
  );
  assert.equal(
    down.plan_routines.find((r: any) => r.id === sr.id).status,
    "active",
  );
  await assert.rejects(
    action("resume_routine", { id: mr.id }),
    /PREMIUM_REQUIRED/,
  );
  await assert.rejects(
    action("run_routine_now", { id: mr.id }),
    /PREMIUM_REQUIRED/,
  );
  await grant("plus");
  assert.equal(
    (await snap()).plan_routines.find((r: any) => r.id === mr.id).status,
    "paused",
  );
  await action("resume_routine", { id: mr.id });
  assert.equal(
    (await snap()).plan_routines.find((r: any) => r.id === mr.id)
      .premium_pause_reason,
    null,
  );
  // Expiry without opening the app is handled before inaccessible-source ending.
  await root();
  await db.query(
    "update private.premium_grants set revoked_at=now() where owner_id=$1",
    [ids.alice],
  );
  await db.exec(
    "select set_config('request.jwt.claim.role','service_role',false)",
  );
  await db.query("select public.run_due_plan_routines(2)");
  const rows = (
    await db.query<{ id: string; status: string }>(
      "select id,status from public.plan_routines",
    )
  ).rows;
  assert.equal(rows.find((r) => r.id === mr.id)?.status, "paused");
  assert.equal(rows.find((r) => r.id === sr.id)?.status, "active");
  await db.close();
});
