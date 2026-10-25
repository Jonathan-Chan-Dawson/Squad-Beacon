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

test("connected Planning persistence and authorization", async () => {
  await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
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
  await db.query(
    "insert into public.friendships(sender_id,recipient_id,status) values($1,$2,'accepted'),($1,$3,'accepted')",
    [ids.alice, ids.bob, ids.carol],
  );

  const slots = [0, 1, 2].map((n) => ({
    id: crypto.randomUUID(),
    starts_at: isoAfter(24 + n * 24),
    ends_at: isoAfter(25 + n * 24),
    timezone: "America/Chicago",
  }));
  const makeTime = async () => {
    await actor("alice");
    return action("create_planning_thread", {
      kind: "time",
      title: "Find a time",
      body: "",
      audience: "friends",
      audience_id: null,
      deadline_at: isoAfter(2),
      payload: beaconDraft("Basketball"),
      slots,
    });
  };
  const time = await makeTime();
  const tid = String(time.id);
  await actor("outsider");
  await assert.rejects(
    action("save_planning_availability", {
      thread_id: tid,
      slots_revision: 1,
      answers: { [slots[0].id]: "yes" },
    }),
    /unavailable/i,
  );
  await actor("bob");
  await action("save_planning_availability", {
    thread_id: tid,
    slots_revision: 1,
    answers: { [slots[0].id]: "yes", [slots[1].id]: "maybe" },
  });
  const saved = await db.query<{ answers: any }>(
    "select answers from public.planning_availability where thread_id=$1",
    [tid],
  );
  assert.equal(saved.rows[0].answers[slots[2].id], undefined);
  await assert.rejects(
    action("save_planning_availability", {
      thread_id: tid,
      slots_revision: 0,
      answers: {},
    }),
    /changed/i,
  );
  await assert.rejects(
    action("finalize_planning_time", {
      thread_id: tid,
      slot_id: slots[0].id,
      slots_revision: 1,
      confirmed: true,
    }),
    /organizer/i,
  );
  await action("save_planning_organizer_message", {
    thread_id: tid,
    message: "Indoors please",
  });
  await actor("carol");
  assert.equal(
    (await db.query("select * from public.planning_organizer_messages")).rows
      .length,
    0,
  );
  await actor("alice");
  assert.equal(
    (await db.query("select * from public.planning_organizer_messages")).rows
      .length,
    1,
  );
  await action("finalize_planning_time", {
    thread_id: tid,
    slot_id: slots[0].id,
    slots_revision: 1,
    confirmed: true,
  });
  await actor("bob");
  await assert.rejects(
    action("save_planning_availability", {
      thread_id: tid,
      slots_revision: 1,
      answers: {},
    }),
    /closed/i,
  );
  await actor("alice");
  const zero = await action("create_planning_thread", {
    kind: "time",
    title: "Zero response",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: isoAfter(1),
    payload: beaconDraft("Walk"),
    slots: slots.map((x) => ({ ...x, id: crypto.randomUUID() })),
  });
  const zeroSlot = (
    await db.query<{ id: string }>(
      "select id from public.planning_slots where thread_id=$1",
      [zero.id],
    )
  ).rows[0].id;
  await assert.rejects(
    action("finalize_planning_time", {
      thread_id: zero.id,
      slot_id: zeroSlot,
      slots_revision: 1,
      confirmed: true,
    }),
    /saved response/i,
  );
  await makePast(String(zero.id));
  await actor("alice");
  await action("finalize_planning_time", {
    thread_id: zero.id,
    slot_id: zeroSlot,
    slots_revision: 1,
    confirmed: true,
  });
  const council = await createThread("alice", "vote");
  await action("add_council_proposal", {
    thread_id: council.id,
    payload: beaconDraft("Bowling"),
  });
  await action("add_council_proposal", {
    thread_id: council.id,
    payload: beaconDraft("Coffee"),
  });
  await root();
  await db.query(
    "update public.planning_threads set vote_method='approval' where id=$1",
    [council.id],
  );
  const proposals = (
    await db.query<{ id: string }>(
      "select id from public.planning_proposals where thread_id=$1",
      [council.id],
    )
  ).rows.map((x) => x.id);
  await db.query(
    "update public.planning_proposals set approved=true where thread_id=$1",
    [council.id],
  );
  await actor("bob");
  await action("save_council_approval_ballot", {
    thread_id: council.id,
    proposal_ids: proposals,
    none_work: false,
  });
  await assert.rejects(
    action("vote_council_proposal", {
      thread_id: council.id,
      proposal_id: proposals[0],
    }),
    /approval ballot/i,
  );
  await makePast(String(council.id));
  await actor("alice");
  await assert.rejects(
    action("resolve_planning_thread", {
      thread_id: council.id,
      confirmed: true,
    }),
    /Explicitly choose/i,
  );
  const resolved = await action("resolve_planning_thread", {
    thread_id: council.id,
    proposal_id: proposals[0],
    confirmed: true,
  });
  assert.ok(resolved.activity_id);
  const repeat = await action("resolve_planning_thread", {
    thread_id: council.id,
    proposal_id: proposals[1],
    confirmed: true,
  });
  assert.equal(repeat.activity_id, resolved.activity_id);
  await root();
  assert.equal(
    (
      await db.query("select * from public.rsvps where activity_id=$1", [
        resolved.activity_id,
      ])
    ).rows.length,
    0,
  );

  await actor("alice");
  const parent = await createThread("alice", "ping", {
    payload: beaconDraft("Connected walk"),
  });
  const child = await action("create_planning_thread", {
    kind: "time",
    title: "Walk times",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: isoAfter(1),
    payload: beaconDraft("Connected walk"),
    slots: slots.map((s) => ({ ...s, id: crypto.randomUUID() })),
    source_thread_id: parent.id,
  });
  await assert.rejects(
    action("create_planning_thread", {
      kind: "time",
      title: "Duplicate times",
      body: "",
      audience: "friends",
      audience_id: null,
      deadline_at: isoAfter(1),
      payload: beaconDraft("Connected walk"),
      slots: slots.map((s) => ({ ...s, id: crypto.randomUUID() })),
      source_thread_id: parent.id,
    }),
    /duplicate key/i,
  );
  const first = await action("convert_planning_ping", { thread_id: parent.id });
  const raced = await action("publish_planning_beacon", {
    thread_id: child.id,
    confirmed: true,
    payload: beaconDraft("Must not duplicate"),
  });
  assert.equal(raced.id, first.id);
  assert.equal(raced.already_published, true);
  await actor("alice");
  const backup = await createThread("alice", "ping", {
    payload: beaconDraft("Backup walk"),
  });
  await action("set_planning_backup", { thread_id: backup.id, enabled: true });
  await actor("bob");
  await assert.rejects(
    action("claim_planning_host", { thread_id: backup.id }),
    /not available/i,
  );
  await root();
  await db.query(
    "update public.planning_threads set deadline_at=now()-interval '12 hours' where id=$1",
    [backup.id],
  );
  await actor("bob");
  const lease = await action("claim_planning_host", { thread_id: backup.id });
  assert.ok(lease.claim_token);
  await actor("carol");
  await assert.rejects(
    action("claim_planning_host", { thread_id: backup.id }),
    /Another participant/i,
  );
  await actor("bob");
  const hosted = await action("publish_planning_beacon", {
    thread_id: backup.id,
    claim_token: lease.claim_token,
    confirmed: true,
    payload: { ...beaconDraft("Backup walk"), audience: "private" },
    invitee_ids: [ids.alice],
  });
  await root();
  const host = (
    await db.query<{ owner_id: string }>(
      "select owner_id from public.activities where id=$1",
      [hosted.id],
    )
  ).rows[0];
  assert.equal(host.owner_id, ids.bob);
  assert.equal(
    (
      await db.query(
        "select * from public.rsvps where activity_id=$1 and user_id=$2 and status='going'",
        [hosted.id, ids.alice],
      )
    ).rows.length,
    0,
  );
  await actor("alice");
  const original = await action("convert_planning_ping", {
    thread_id: backup.id,
  });
  assert.equal(original.id, hosted.id);
  await actor("alice");
  const amend = await action("create_planning_thread", {
    kind: "time",
    title: "Changed slots",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: isoAfter(1),
    payload: beaconDraft("Walk"),
    slots: slots.map((s) => ({ ...s, id: crypto.randomUUID() })),
  });
  const originalSlots = (
    await db.query<any>(
      "select * from public.planning_slots where thread_id=$1 order by starts_at",
      [amend.id],
    )
  ).rows;
  await actor("bob");
  await action("save_planning_availability", {
    thread_id: amend.id,
    slots_revision: 1,
    answers: { [originalSlots[0].id]: "yes" },
  });
  await actor("alice");
  const replacement = {
    ...originalSlots[0],
    id: crypto.randomUUID(),
    starts_at: isoAfter(40),
    ends_at: isoAfter(41),
  };
  await action("amend_planning_slots", {
    thread_id: amend.id,
    slots_revision: 1,
    slots: [replacement, ...originalSlots.slice(1)],
  });
  await actor("bob");
  await assert.rejects(
    action("save_planning_availability", {
      thread_id: amend.id,
      slots_revision: 1,
      answers: { [replacement.id]: "yes" },
    }),
    /changed/i,
  );
  const oldAnswers = (
    await db.query<{ answers: any }>(
      "select answers from public.planning_availability where thread_id=$1",
      [amend.id],
    )
  ).rows[0];
  assert.equal(oldAnswers.answers[replacement.id], undefined);
  assert.equal(oldAnswers.answers[originalSlots[0].id], "yes");
  await root();
  await db.query(
    "update public.planning_threads set deadline_at=now()-interval '1 minute' where id=$1",
    [amend.id],
  );
  await actor("alice");
  await action("close_planning_without_beacon", { thread_id: amend.id });
  await assert.rejects(
    action("finalize_planning_time", {
      thread_id: amend.id,
      slot_id: replacement.id,
      slots_revision: 2,
      confirmed: true,
    }),
    /closed/i,
  );

  await actor("alice");
  const timeBeacon = await action("publish_planning_beacon", {
    thread_id: zero.id,
    slot_id: zeroSlot,
    confirmed: true,
    payload: {
      ...beaconDraft("Confirmed schedule"),
      enable_chat: false,
      capacity_limit: 4,
      capacity_policy: "strict",
    },
  });
  await root();
  const settings = (
    await db.query<{ enable_chat: boolean; capacity_limit: number }>(
      "select enable_chat,capacity_limit from public.activities where id=$1",
      [timeBeacon.id],
    )
  ).rows[0];
  assert.equal(settings.enable_chat, false);
  assert.equal(settings.capacity_limit, 4);
  assert.equal(
    (
      await db.query("select * from public.rsvps where activity_id=$1", [
        timeBeacon.id,
      ])
    ).rows.length,
    0,
  );
  await actor("alice");
  const abandoned = await createThread("alice", "ping", {
    payload: beaconDraft("Abandoned review"),
  });
  await action("set_planning_backup", {
    thread_id: abandoned.id,
    enabled: true,
  });
  await root();
  await db.query(
    "update public.planning_threads set deadline_at=now()-interval '12 hours' where id=$1",
    [abandoned.id],
  );
  await actor("bob");
  const oldLease = await action("claim_planning_host", {
    thread_id: abandoned.id,
  });
  await root();
  await db.query(
    "update private.planning_claims set expires_at=now()-interval '1 second' where thread_id=$1",
    [abandoned.id],
  );
  await actor("bob");
  await assert.rejects(
    action("claim_planning_host", { thread_id: abandoned.id }),
    /previous hosting attempt expired/i,
  );
  await actor("carol");
  const newLease = await action("claim_planning_host", {
    thread_id: abandoned.id,
  });
  assert.notEqual(newLease.claim_token, oldLease.claim_token);
  await actor("alice");
  const won = await action("convert_planning_ping", {
    thread_id: abandoned.id,
  });
  await actor("carol");
  const late = await action("publish_planning_beacon", {
    thread_id: abandoned.id,
    claim_token: newLease.claim_token,
    confirmed: true,
    payload: beaconDraft("Do not duplicate"),
  });
  assert.equal(late.id, won.id);
  assert.equal(late.already_published, true);
  await actor("alice");
  const stale = await createThread("alice", "ping", {
    payload: beaconDraft("Not organized"),
  });
  await root();
  await db.query(
    "update public.planning_threads set deadline_at=now()-interval '2 hours',payload=payload||jsonb_build_object('starts_at',now()-interval '1 hour','ends_at',now()-interval '30 minutes') where id=$1",
    [stale.id],
  );
  await db.query("select public.beacon_maintenance()");
  assert.ok(
    (
      await db.query<{ not_organized_at: string }>(
        "select not_organized_at from public.planning_threads where id=$1",
        [stale.id],
      )
    ).rows[0].not_organized_at,
  );
  const privileges = await db.query<{ allowed: boolean }>(
    "select has_function_privilege('authenticated','private.apply_planning_action(text,jsonb)','execute') allowed",
  );
  assert.equal(privileges.rows[0].allowed, false);

  await actor("alice");
  const shared = await action("create_planning_thread", {
    kind: "vote",
    vote_method: "approval",
    title: "Co-organizer counts",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: isoAfter(1),
    coowner_ids: [ids.bob],
  });
  const sharedOptions = [];
  for (const title of ["Park", "Cafe"]) {
    const option = await action("add_council_proposal", {
      thread_id: shared.id,
      payload: beaconDraft(title),
    });
    sharedOptions.push(String(option.id));
    await action("approve_council_proposal", {
      thread_id: shared.id,
      proposal_id: option.id,
      approved: true,
    });
  }
  await actor("bob");
  await action("save_council_approval_ballot", {
    thread_id: shared.id,
    proposal_ids: [sharedOptions[0]],
    none_work: false,
  });
  await actor("carol");
  await action("save_council_approval_ballot", {
    thread_id: shared.id,
    proposal_ids: [sharedOptions[1]],
    none_work: false,
  });
  await actor("bob");
  const projected = (
    await db.query<{ data: any }>("select public.beacon_snapshot() data")
  ).rows[0].data;
  assert.ok(
    projected.planning_member_access.some(
      (m: any) => m.thread_id === shared.id && m.user_id === ids.carol,
    ),
  );
  assert.equal(
    projected.planning_option_counts.find(
      (c: any) => c.proposal_id === sharedOptions[0],
    ).total,
    1,
  );
  assert.equal(
    projected.planning_option_counts.find(
      (c: any) => c.proposal_id === sharedOptions[1],
    ).total,
    1,
  );
  await makePast(String(shared.id));
  await actor("bob");
  const managed = await action("resolve_planning_thread", {
    thread_id: shared.id,
    proposal_id: sharedOptions[0],
    confirmed: true,
  });
  await root();
  assert.equal(
    (
      await db.query<{ owner_id: string }>(
        "select owner_id from public.activities where id=$1",
        [managed.id],
      )
    ).rows[0].owner_id,
    ids.alice,
  );

  await actor("alice");
  const coTime = await action("create_planning_thread", {
    kind: "time",
    title: "Backup co-organizer",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: isoAfter(1),
    coowner_ids: [ids.bob],
    allow_backup_hosting: true,
    payload: beaconDraft("Co-host time"),
    slots: slots.map((s) => ({ ...s, id: crypto.randomUUID() })),
  });
  const coSlot = (
    await db.query<{ id: string }>(
      "select id from public.planning_slots where thread_id=$1 order by starts_at",
      [coTime.id],
    )
  ).rows[0].id;
  await root();
  await db.query(
    "update public.planning_threads set deadline_at=now()-interval '12 hours' where id=$1",
    [coTime.id],
  );
  await actor("bob");
  const coClaim = await action("claim_planning_host", { thread_id: coTime.id });
  const coPublished = await action("publish_planning_beacon", {
    thread_id: coTime.id,
    slot_id: coSlot,
    claim_token: coClaim.claim_token,
    confirmed: true,
    payload: { ...beaconDraft("Co-host time"), audience: "private" },
    invitee_ids: [],
  });
  await root();
  assert.equal(
    (
      await db.query<{ owner_id: string }>(
        "select owner_id from public.activities where id=$1",
        [coPublished.id],
      )
    ).rows[0].owner_id,
    ids.bob,
  );
  const resultSummary = (
    await db.query<{ result_summary: { support: number; tie_count: number } }>(
      "select result_summary from public.planning_threads where id=$1",
      [shared.id],
    )
  ).rows[0].result_summary;
  assert.equal(resultSummary.support, 1);
  assert.equal(resultSummary.tie_count, 2);
  await db.close();
});
