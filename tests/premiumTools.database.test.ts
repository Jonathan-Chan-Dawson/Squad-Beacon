import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { premiumFeatures } from "../src/shared/premiumFeatures";

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
test("Premium tools and Boost lifecycle use authorized writes, preservation, paging and replay", async () => {
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
  for (const [feature, definition] of Object.entries(premiumFeatures)) {
    assert.equal(
      (
        await db.query<{ tier: string }>(
          "select private.feature_required_tier($1) tier",
          [feature],
        )
      ).rows[0].tier,
      definition.tier,
      feature,
    );
  }
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
  await assert.rejects(
    action("create_activity", {
      ...beacon,
      premium_appearance: { style: "ocean" },
      tier: "pro",
    }),
    /PREMIUM_REQUIRED/,
  );
  const made = await action("create_activity", {
    ...beacon,
    enable_checklist: true,
    enable_journal: true,
    enable_experiences: true,
  });
  const aid = made.id;
  for (let n = 0; n < 55; n++)
    await action("add_checklist_item", {
      activity_id: aid,
      text: `Task ${n}`,
      id: crypto.randomUUID(),
    });
  for (let n = 0; n < 32; n++)
    await action("add_checklist_section", {
      activity_id: aid,
      title: `Section ${n}`,
      id: crypto.randomUUID(),
    });
  let snap = await snapshot();
  assert.equal(snap.beacon_checklist_items.length, 55);
  assert.equal(snap.beacon_checklist_sections.length, 32);
  const item = snap.beacon_checklist_items[0];
  await root();
  await db.query(
    "insert into public.beacon_checklist_items(activity_id,author_id,text) select $1,$2,'Paged task '||n from generate_series(1,170) n",
    [aid, ids.alice],
  );
  await actor("alice");
  assert.equal((await snapshot()).beacon_checklist_items.length, 200);
  const firstPage = (
    await db.query<{ p: any }>("select public.checklist_page($1) p", [aid])
  ).rows[0].p;
  assert.equal(firstPage.total, 225);
  assert.equal(firstPage.rows.length, 100);
  assert.ok(firstPage.has_more);
  const secondPage = (
    await db.query<{ p: any }>(
      "select public.checklist_page($1,'items',$2) p",
      [aid, firstPage.rows.at(-1).id],
    )
  ).rows[0].p;
  assert.equal(secondPage.rows.length, 100);
  assert.ok(
    !secondPage.rows.some((i: any) =>
      firstPage.rows.some((j: any) => i.id === j.id),
    ),
  );

  await assert.rejects(
    action("edit_checklist_item", {
      id: item.id,
      text: item.text,
      assignee_id: ids.alice,
    }),
    /PREMIUM_REQUIRED/,
  );
  await assert.rejects(
    action("edit_checklist_item", {
      id: item.id,
      text: item.text,
      due_on: "2028-01-31",
      tier: "pro",
    }),
    /PREMIUM_REQUIRED/,
  );
  await assert.rejects(
    action("ensure_saved_checklist_copy", { activity_id: aid }),
    /PREMIUM_REQUIRED/,
  );
  await root();
  await db.query(
    "insert into private.premium_grants(owner_id,tier) values($1,'plus')",
    [ids.alice],
  );
  await actor("alice");
  const request = crypto.randomUUID();
  const edit = {
    id: item.id,
    text: item.text,
    assignee_id: ids.alice,
    due_at: new Date(Date.now() + 300000).toISOString(),
    reminder_minutes: 10,
  };
  const saved = await action("edit_checklist_item", edit, request);
  assert.deepEqual(await action("edit_checklist_item", edit, request), saved);
  snap = await snapshot();
  assert.equal(
    snap.beacon_checklist_items.find((i: any) => i.id === item.id)
      .reminder_minutes,
    10,
  );
  const focus = {
    steps: [
      { label: "Work", minutes: 25 },
      { label: "Rest", minutes: 5 },
    ],
  };
  const configRequest = crypto.randomUUID();
  const configPayload = {
    activity_id: aid,
    kind: "focus",
    settings: focus,
    revision: -1,
  };
  const configured = await action(
    "save_tool_config",
    configPayload,
    configRequest,
  );
  assert.deepEqual(
    await action("save_tool_config", configPayload, configRequest),
    configured,
  );
  await assert.rejects(
    action("save_tool_config", {
      ...configPayload,
      settings: { ...focus, group: "Study" },
      revision: 0,
    }),
    /PREMIUM_REQUIRED/,
  );
  await assert.rejects(
    action("save_tool_preset", {
      id: crypto.randomUUID(),
      kind: "focus",
      title: "Forged people",
      settings: { ...focus, invitee_ids: [ids.bob] },
    }),
    /Unsupported/,
  );
  await action("save_tool_preset", {
    id: crypto.randomUUID(),
    kind: "focus",
    title: "Work and rest",
    settings: focus,
  });
  const note = await action("save_beacon_note", {
    id: crypto.randomUUID(),
    activity_id: aid,
    body: "A private reflection",
    section_heading: "Reflection",
    visibility: "private",
  });
  await action("save_journal_details", {
    note_id: note.id,
    format: "markdown",
    tags: ["weekend"],
    linked_note_ids: [],
  });

  await root();
  await db.query(
    "update private.premium_grants set tier='pro' where owner_id=$1",
    [ids.alice],
  );
  const memoryId = crypto.randomUUID();
  await db.query(
    "insert into public.beacon_memories(id,activity_id,author_id,object_path,media_type,caption) values($1,$2,$3,$4,'image','A shared moment')",
    [memoryId, aid, ids.alice, `${aid}/${ids.alice}/test.jpg`],
  );
  await actor("alice");
  await action("save_tool_config", {
    activity_id: aid,
    kind: "memories",
    settings: {
      title: "Weekend highlights",
      memory_ids: [memoryId],
      highlights: [memoryId],
    },
    revision: -1,
  });
  const recap = await action("save_memory_recap", {
    id: crypto.randomUUID(),
    activity_id: aid,
    title: "A day together",
    introduction: "A small adventure",
    memory_ids: [memoryId],
    revision: -1,
  });
  assert.equal((await snapshot()).memory_recaps[0].memory_ids[0], memoryId);
  await action("save_tool_config", {
    activity_id: aid,
    kind: "teams",
    settings: {
      team_names: ["Blue", "Gold"],
      score_steps: [{ label: "Goal", points: 3 }],
      rotation: true,
    },
    revision: -1,
  });
  await action("set_beacon_controls", { id: aid, enable_scoreboard: true });
  const team = await action("create_beacon_team", {
    id: crypto.randomUUID(),
    activity_id: aid,
    name: "Blue",
  });
  await action("adjust_beacon_team_score", { team_id: team.id, delta: 3 });
  assert.equal(
    (await snapshot()).beacon_teams.find((t: any) => t.id === team.id).score,
    3,
  );
  const council = await action("create_planning_thread", {
    kind: "vote",
    title: "Weekend options",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: new Date(Date.now() + 3600000 * 24).toISOString(),
    coowner_ids: [],
  });
  await action("save_tool_config", {
    thread_id: council.id,
    kind: "council",
    settings: {
      groups: ["Outside", "Inside"],
      explanations: true,
      readiness: true,
    },
    revision: -1,
  });
  await action("save_council_explanation", {
    thread_id: council.id,
    body: "An outdoor option would be nice.",
  });
  assert.equal((await snapshot()).council_explanations.length, 1);
  await actor("bob");
  assert.equal((await snapshot()).premium_tool_configs.length, 0);
  assert.equal((await snapshot()).journal_details.length, 0);
  await assert.rejects(action("save_tool_config", configPayload), /organizers/);
  await actor("alice");
  await root();
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select private.send_checklist_reminders() n",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query<{ n: number }>(
        "select private.send_checklist_reminders() n",
      )
    ).rows[0].n,
    0,
  );
  await db.query(
    "update private.premium_grants set revoked_at=now() where owner_id=$1",
    [ids.alice],
  );
  await actor("alice");
  await action("toggle_checklist_item", { id: item.id, completed: true });
  assert.equal((await snapshot()).memory_recaps.length, 1);
  await action("delete_memory_recap", { id: recap.id });
  await action("edit_checklist_item", {
    id: item.id,
    text: "Kept after downgrade",
    assignee_id: null,
    due_at: null,
    due_on: null,
    reminder_minutes: null,
  });
  await actor("bob");
  await assert.rejects(
    action("edit_checklist_item", { id: item.id, text: "Unauthorized" }),
  );
  await assert.rejects(
    db.exec("select * from private.checklist_reminders"),
    /permission denied/,
  );

  await root();
  for (const owner of [ids.bob, ids.carol])
    await db.query(
      "insert into private.premium_grants(owner_id,tier) values($1,'plus')",
      [owner],
    );
  await db.query(
    "insert into private.premium_grants(owner_id,tier) values($1,'pro')",
    [ids.outsider],
  );
  await actor("alice");
  const squad = await action("create_squad", { name: "Boost crew" });
  const sid = squad.squad_id ?? squad.id;
  await root();
  await db.query(
    "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'member'),($1,$3,'member')",
    [sid, ids.bob, ids.carol],
  );
  await actor("bob");
  const boostRequest = crypto.randomUUID();
  const first = await action("assign_boost", { squad_id: sid }, boostRequest);
  assert.deepEqual(
    await action("assign_boost", { squad_id: sid }, boostRequest),
    first,
  );
  await action("assign_boost", { squad_id: sid });
  assert.equal(
    (await snapshot()).squad_premium.find((s: any) => s.squad_id === sid).tier,
    "plus",
  );
  await assert.rejects(
    action("assign_boost", { squad_id: sid }),
    /No Boost slots/,
  );
  await actor("carol");
  const third = await action("assign_boost", { squad_id: sid });
  await action("assign_boost", { squad_id: sid });
  await actor("alice");
  assert.equal(
    (await snapshot()).squad_premium.find((s: any) => s.squad_id === sid).tier,
    "pro",
  );
  const sharedBeacon = await action("create_activity", {
    ...beacon,
    audience: "squad",
    audience_id: sid,
    enable_checklist: true,
    enable_focus: true,
    premium_appearance: { style: "ocean", layout: "session" },
  });
  const sharedSecond = await action("create_activity", {
    ...beacon,
    title: "Second session",
    audience: "squad",
    audience_id: sid,
  });
  await action("save_tool_config", {
    activity_id: sharedBeacon.id,
    kind: "focus",
    settings: { ...focus, group: "Crew sessions" },
    revision: -1,
  });
  await assert.rejects(
    action("save_tool_config", {
      activity_id: aid,
      kind: "focus",
      settings: focus,
      revision: 0,
    }),
    /PREMIUM_REQUIRED/,
  );
  const planned = await action("create_living_plan", {
    title: "Shared repeat",
    timezone: "UTC",
    squad_id: sid,
  });
  await action("add_plan_stop", {
    plan_id: planned.id,
    activity_id: sharedBeacon.id,
  });
  await action("add_plan_stop", {
    plan_id: planned.id,
    activity_id: sharedSecond.id,
  });
  const routine = await action("create_routine", {
    plan_id: planned.id,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    interval_weeks: 1,
    confirmed_source: true,
  });
  await actor("outsider");
  await assert.rejects(
    action("save_tool_config", {
      activity_id: sharedBeacon.id,
      kind: "focus",
      settings: focus,
      revision: 0,
    }),
    /organizers/,
  );
  await assert.rejects(
    action("assign_boost", { squad_id: sid }),
    /Join this Squad/,
  );
  await assert.rejects(
    db.exec("select * from private.boost_allocations"),
    /permission denied/,
  );
  await actor("bob");
  await action("withdraw_boost", { id: first.id });
  const grace = (await snapshot()).squad_premium.find(
    (s: any) => s.squad_id === sid,
  );
  assert.equal(grace.tier, "pro");
  assert.equal(grace.source, "grace");
  await actor("carol");
  await action("withdraw_boost", { id: third.id });
  const later = (await snapshot()).squad_premium.find(
    (s: any) => s.squad_id === sid,
  );
  assert.equal(later.grace_until, grace.grace_until);
  await actor("bob");
  await assert.rejects(action("assign_boost", { squad_id: sid }), /72-hour/);
  await root();
  await db.query(
    "update private.squad_boost_state set grace_until=now()-interval '1 second' where squad_id=$1",
    [sid],
  );
  await actor("alice");
  let downgraded = await snapshot();
  assert.equal(
    downgraded.squad_premium.find((s: any) => s.squad_id === sid).tier,
    "plus",
  );
  await actor("carol");
  const remaining = (await snapshot()).boost_allocations.find(
    (b: any) => !b.released_at,
  );
  await action("withdraw_boost", { id: remaining.id });
  await root();
  await db.query(
    "update private.squad_boost_state set grace_until=now()-interval '1 second' where squad_id=$1",
    [sid],
  );
  await actor("alice");
  downgraded = await snapshot();
  assert.equal(
    downgraded.plan_routines.find((r: any) => r.id === routine.id).status,
    "paused",
  );
  await root();
  await db.query(
    "insert into public.squad_members(squad_id,user_id,role) values($1,$2,'member')",
    [sid, ids.outsider],
  );
  await actor("outsider");
  for (let n = 0; n < 3; n++) await action("assign_boost", { squad_id: sid });
  await actor("alice");
  assert.equal(
    (await snapshot()).plan_routines.find((r: any) => r.id === routine.id)
      .status,
    "paused",
  );
  await action("resume_routine", { id: routine.id });
  assert.equal(
    (await snapshot()).plan_routines.find((r: any) => r.id === routine.id)
      .status,
    "active",
  );
  // A delayed maintenance visit must use the actual grant expiry, not visit time.
  await root();
  await db.query(
    "update private.boost_allocations set assigned_at=now()-interval '3 hours' where squad_id=$1 and released_at is null",
    [sid],
  );
  await db.query(
    "update private.squad_boost_state set last_event_at=now()-interval '2 hours',grace_until=null where squad_id=$1",
    [sid],
  );
  await db.query(
    "update private.premium_grants set verified_at=now()-interval '4 hours',valid_until=now()-interval '1 hour' where owner_id=$1",
    [ids.outsider],
  );
  const expiry = (
    await db.query<{ seconds: number }>(
      "select extract(epoch from (s.grace_until-g.valid_until))::float8 seconds from private.squad_boost_state s,private.premium_grants g where s.squad_id=$1 and g.owner_id=$2",
      [sid, ids.outsider],
    )
  ).rows[0];
  assert.equal(expiry.seconds, 72 * 3600);
  const expiryGrace = (
    await db.query<{ grace_until: string }>(
      "select grace_until::text from private.squad_boost_state where squad_id=$1",
      [sid],
    )
  ).rows[0].grace_until;
  await db.query(
    "delete from public.squad_members where squad_id=$1 and user_id=$2",
    [sid, ids.bob],
  );
  assert.equal(
    (
      await db.query<{ grace_until: string }>(
        "select grace_until::text from private.squad_boost_state where squad_id=$1",
        [sid],
      )
    ).rows[0].grace_until,
    expiryGrace,
  );
  await actor("alice");
  assert.equal(
    (await snapshot()).squad_premium.find((s: any) => s.squad_id === sid).tier,
    "pro",
  );
  await db.close();
});
