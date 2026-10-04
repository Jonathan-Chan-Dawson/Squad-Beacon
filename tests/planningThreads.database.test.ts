import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("planning migration enforces visibility, eligibility, one vote, safe resolution, and retries", async () => {
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
  ])
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

  await test("ping conversion preserves host and approval-aware opt-in", async () => {
    const pingPayload = beaconDraft("Saturday walk");
    pingPayload.approval_required = true;
    await actor("alice");
    const missingCategory = { ...pingPayload, category: null };
    await assert.rejects(
      action("create_planning_thread", {
        kind: "ping",
        title: "Bad ping",
        body: "",
        audience: "friends",
        audience_id: null,
        deadline_at: isoAfter(1),
        payload: missingCategory,
      }),
      /valid beacon category/i,
    );
    await assert.rejects(
      action("create_planning_thread", {
        kind: "ping",
        title: "Infinite ping",
        body: "",
        audience: "friends",
        audience_id: null,
        deadline_at: isoAfter(1),
        payload: { ...pingPayload, ends_at: "infinity" },
      }),
      /finite beacon start and end/i,
    );
    const ping = await createThread("alice", "ping", { payload: pingPayload });
    await actor("bob");
    await action("respond_planning_ping", {
      thread_id: ping.id,
      response: "interested",
      auto_rsvp: true,
    });
    await actor("alice");
    const converted = await action("convert_planning_ping", {
      thread_id: ping.id,
    });
    assert.ok(converted.activity_id);
    const activity = (
      await db.query("select owner_id from public.activities where id=$1", [
        converted.activity_id,
      ])
    ).rows[0];
    assert.equal(activity.owner_id, ids.alice);
    const rsvp = (
      await db.query(
        "select status,approved from public.rsvps where activity_id=$1 and user_id=$2",
        [converted.activity_id, ids.bob],
      )
    ).rows[0];
    assert.deepEqual(rsvp, { status: "requested", approved: false });
    await actor("alice");
    const retry = await action("convert_planning_ping", {
      thread_id: ping.id,
    });
    assert.equal(retry.activity_id, converted.activity_id);
  });

  await test("vote council hides nonmembers, allows one changed vote, and resolves as thread owner", async () => {
    const council = await createThread("alice", "vote", {
      coowners: [ids.bob],
    });
    await actor("carol");
    const optionA = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("Option A"),
    });
    const optionB = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("Option B"),
    });
    await actor("alice");
    await action("approve_council_proposal", {
      thread_id: council.id,
      proposal_id: optionA.id,
      approved: true,
    });
    await action("approve_council_proposal", {
      thread_id: council.id,
      proposal_id: optionB.id,
      approved: true,
    });
    await actor("carol");
    await action("vote_council_proposal", {
      thread_id: council.id,
      proposal_id: optionA.id,
    });
    await action("vote_council_proposal", {
      thread_id: council.id,
      proposal_id: optionB.id,
    });
    await actor("bob");
    await action("vote_council_proposal", {
      thread_id: council.id,
      proposal_id: optionA.id,
    });
    await actor("outsider");
    const outsiderSnapshot = await db.query<{ data: any }>(
      "select public.beacon_snapshot() data",
    );
    assert.equal(
      outsiderSnapshot.rows[0].data.planning_threads.some(
        (row: any) => row.id === council.id,
      ),
      false,
    );
    await assert.rejects(
      action("vote_council_proposal", {
        thread_id: council.id,
        proposal_id: optionA.id,
      }),
      /no longer open|unavailable|approved option/i,
    );
    await root();
    const changedVote = (
      await db.query(
        "select proposal_id from public.planning_votes where thread_id=$1 and user_id=$2",
        [council.id, ids.carol],
      )
    ).rows[0];
    assert.equal(changedVote.proposal_id, optionB.id);
    assert.equal(
      (
        await db.query("select count(*)::int n from public.planning_votes where thread_id=$1", [
          council.id,
        ])
      ).rows[0].n,
      2,
    );
    await makePast(council.id);
    await actor("bob");
    const resolved = await action("resolve_planning_thread", {
      thread_id: council.id,
    });
    const winner = (
      await db.query(
        "select p.id from public.planning_proposals p join public.planning_votes v on v.thread_id=p.thread_id and v.proposal_id=p.id where p.thread_id=$1 and p.approved and p.disqualified_at is null and p.payload->>'starts_at' > now()::text group by p.id,p.created_at order by count(*) filter(where v.user_id<>$2) desc,p.created_at,p.id limit 1",
        [council.id, ids.carol],
      )
    ).rows[0];
    assert.ok(winner);
    assert.equal(resolved.winner_proposal_id, optionA.id);
    const owner = (
      await db.query("select owner_id from public.activities where id=$1", [
        resolved.activity_id,
      ])
    ).rows[0].owner_id;
    assert.equal(owner, ids.alice);
    await actor("alice");
    const retry = await action("resolve_planning_thread", {
      thread_id: council.id,
    });
    assert.equal(retry.activity_id, resolved.activity_id);
  });

  await test("draw resolves without entries, stores one random winner, and retries return that activity", async () => {
    const council = await createThread("alice", "draw", {
      coowners: [ids.bob],
    });
    await actor("carol");
    const first = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("Draw one"),
    });
    const second = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("Draw two"),
    });
    await actor("alice");
    for (const proposal of [first, second])
      await action("approve_council_proposal", {
        thread_id: council.id,
        proposal_id: proposal.id,
        approved: true,
      });
    await makePast(council.id);
    await actor("bob");
    const result = await action("resolve_planning_thread", {
      thread_id: council.id,
    });
    assert.ok([first.id, second.id].includes(result.winner_proposal_id));
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.planning_votes where thread_id=$1",
          [council.id],
        )
      ).rows[0].n,
      0,
    );
    await actor("alice");
    const retry = await action("resolve_planning_thread", {
      thread_id: council.id,
    });
    assert.equal(retry.activity_id, result.activity_id);
    assert.equal(
      (
        await db.query("select owner_id from public.activities where id=$1", [
          result.activity_id,
        ])
      ).rows[0].owner_id,
      ids.alice,
    );
  });

  await test("replacement confirms the prior winner, preserves attendees, notifies, and tolerates stale retries", async () => {
    const council = await createThread("alice", "vote", {
      coowners: [ids.bob],
    });
    await actor("alice");
    const first = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("First choice"),
    });
    await actor("bob");
    const next = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("Next choice"),
    });
    await actor("alice");
    for (const proposal of [first, next])
      await action("approve_council_proposal", {
        thread_id: council.id,
        proposal_id: proposal.id,
        approved: true,
      });
    await action("vote_council_proposal", {
      thread_id: council.id,
      proposal_id: next.id,
    });
    await actor("bob");
    for (const voter of ["bob", "carol"] as const) {
      await actor(voter);
      await action("vote_council_proposal", {
        thread_id: council.id,
        proposal_id: first.id,
      });
    }
    await makePast(council.id);
    await actor("bob");
    const initial = await action("resolve_planning_thread", {
      thread_id: council.id,
    });
    assert.equal(initial.winner_proposal_id, first.id);
    await actor("carol");
    await action("rsvp", { id: initial.activity_id, status: "going" });
    await actor("bob");
    const replaced = await action("replace_council_winner", {
      thread_id: council.id,
      expected_winner_proposal_id: initial.winner_proposal_id,
      confirm_cancel_previous: true,
    });
    assert.equal(replaced.winner_proposal_id, next.id);
    const old = (
      await db.query("select status from public.activities where id=$1", [
        initial.activity_id,
      ])
    ).rows[0];
    assert.equal(old.status, "cancelled");
    assert.equal(
      (
        await db.query(
          "select status from public.rsvps where activity_id=$1 and user_id=$2",
          [initial.activity_id, ids.carol],
        )
      ).rows[0].status,
      "going",
    );
    await actor("carol");
    const replacementNotices = await db.query(
      "select recipient_id,actor_id,activity_id,body from public.notices where recipient_id=$1",
      [ids.carol],
    );
    assert.equal(
      replacementNotices.rows.filter(
        (notice: any) => notice.activity_id === initial.activity_id,
      ).length,
      1,
      JSON.stringify(replacementNotices.rows),
    );
    await actor("alice");
    const staleRetry = await action("replace_council_winner", {
      thread_id: council.id,
      expected_winner_proposal_id: initial.winner_proposal_id,
      confirm_cancel_previous: true,
    });
    assert.equal(staleRetry.activity_id, replaced.activity_id);
  });

  await test("revoked votes and co-owners are rechecked, and expired options never materialize", async () => {
    const council = await createThread("alice", "vote", {
      coowners: [ids.bob],
    });
    const optionA = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("Earliest fallback option"),
    });
    const optionB = await action("add_council_proposal", {
      thread_id: council.id,
      payload: beaconDraft("Later blocked vote option"),
    });
    await action("approve_council_proposal", {
      thread_id: council.id,
      proposal_id: optionA.id,
      approved: true,
    });
    await action("approve_council_proposal", {
      thread_id: council.id,
      proposal_id: optionB.id,
      approved: true,
    });
    await actor("carol");
    await action("vote_council_proposal", {
      thread_id: council.id,
      proposal_id: optionB.id,
    });
    await root();
    await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [
      ids.alice,
      ids.carol,
    ]);
    await makePast(council.id);
    await actor("bob");
    const resolvedWithoutVisibleVotes = await action("resolve_planning_thread", {
      thread_id: council.id,
    });
    assert.equal(resolvedWithoutVisibleVotes.status, "resolved");
    assert.equal(resolvedWithoutVisibleVotes.winner_proposal_id, optionA.id);

    await root();
    await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [
      ids.alice,
      ids.carol,
    ]);
    const expired = await createThread("alice", "draw", {
      coowners: [ids.bob],
    });
    const lateDraft = beaconDraft("Expired option");
    const late = await action("add_council_proposal", {
      thread_id: expired.id,
      payload: lateDraft,
    });
    await action("approve_council_proposal", {
      thread_id: expired.id,
      proposal_id: late.id,
      approved: true,
    });
    await root();
    const starts_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const ends_at = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await db.query(
      "update public.planning_proposals set payload=jsonb_set(jsonb_set(payload,'{starts_at}',to_jsonb($2::text)),'{ends_at}',to_jsonb($3::text)) where id=$1",
      [late.id, starts_at, ends_at],
    );
    await makePast(expired.id);
    await actor("bob");
    const expiredResult = await action("resolve_planning_thread", {
      thread_id: expired.id,
    });
    assert.equal(expiredResult.status, "expired");
    assert.equal(expiredResult.activity_id, null);

    const peerBlock = await createThread("alice", "vote", {
      coowners: [ids.bob],
    });
    await actor("bob");
    const peerOption = await action("add_council_proposal", {
      thread_id: peerBlock.id,
      payload: beaconDraft("Blocked creator option"),
    });
    await actor("alice");
    await action("approve_council_proposal", {
      thread_id: peerBlock.id,
      proposal_id: peerOption.id,
      approved: true,
    });
    await root();
    await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [
      ids.carol,
      ids.bob,
    ]);
    await actor("carol");
    const peerHidden = await db.query<{ data: any }>(
      "select public.beacon_snapshot() data",
    );
    assert.equal(
      peerHidden.rows[0].data.planning_proposals.some(
        (row: any) => row.id === peerOption.id,
      ),
      false,
    );
    await assert.rejects(
      action("vote_council_proposal", {
        thread_id: peerBlock.id,
        proposal_id: peerOption.id,
      }),
      /approved option/i,
    );
    await root();
    await db.query("delete from public.blocks where blocker_id=$1 and blocked_id=$2", [
      ids.carol,
      ids.bob,
    ]);

    const blockedCoowner = await createThread("alice", "draw", {
      coowners: [ids.bob],
    });
    await makePast(blockedCoowner.id);
    await root();
    await db.query("insert into public.blocks(blocker_id,blocked_id) values($1,$2)", [
      ids.alice,
      ids.bob,
    ]);
    await actor("bob");
    await assert.rejects(
      action("resolve_planning_thread", { thread_id: blockedCoowner.id }),
      /current council manager/i,
    );
  });
});
