import test from "node:test";
import assert from "node:assert/strict";
import { demoAction, makeDemo, DEMO_ID } from "@/src/shared/demo";
import type { BeaconDraft } from "@/src/shared/types";

function beaconDraft(title: string): BeaconDraft {
  const start = Date.now() + 3 * 60 * 60 * 1000;
  return {
    title,
    description: "A demo planning beacon.",
    category: "Social",
    mode: "squad",
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + 60 * 60 * 1000).toISOString(),
    timezone: "America/Chicago",
    approval_required: false,
    audience: "friends",
    audience_id: null,
    target_count: null,
    label: "",
    online_url: null,
    latitude: null,
    longitude: null,
    aspiration_ids: [],
  };
}

test("demo includes a friend ping and supports a response", () => {
  const data = makeDemo(),
    ping = data.planning_threads.find((thread) => thread.id === "demo-ping-maya");
  assert.ok(ping);
  assert.equal(ping.owner_id, "maya");
  assert.equal(ping.audience, "friends");

  const next = demoAction(data, "respond_planning_ping", {
    thread_id: ping.id,
    response: "interested",
    auto_rsvp: true,
  });
  assert.deepEqual(next.planning_ping_responses[0], {
    thread_id: ping.id,
    user_id: DEMO_ID,
    response: "interested",
    auto_rsvp: true,
    created_at: next.planning_ping_responses[0].created_at,
    updated_at: next.planning_ping_responses[0].updated_at,
  });
});

test("demo has multiple incoming pings, a vote, and a resolved draw linked to its beacon", () => {
  const data = makeDemo();
  assert.ok(
    data.planning_threads.filter(
      (thread) => thread.kind === "ping" && thread.owner_id !== DEMO_ID,
    ).length >= 3,
  );
  const vote = data.planning_threads.find(
      (thread) => thread.id === "demo-vote-weekend",
    ),
    draw = data.planning_threads.find(
      (thread) => thread.id === "demo-draw-result",
    );
  assert.equal(vote?.kind, "vote");
  assert.ok(data.planning_proposals.some((proposal) => proposal.thread_id === vote?.id));
  assert.equal(draw?.status, "resolved");
  assert.ok(
    data.activities.some(
      (activity) => activity.id === draw?.materialized_activity_id,
    ),
  );
});

test("demo converts pings and resolves a vote council deterministically without votes", () => {
  const initial = makeDemo(),
    deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    pingDraft = beaconDraft("My Saturday walk");
  let data = demoAction(initial, "create_planning_thread", {
    id: "demo-own-ping",
    kind: "ping",
    title: "Anyone free?",
    body: "Let’s walk this weekend.",
    audience: "friends",
    audience_id: null,
    deadline_at: deadline,
    coowner_ids: [],
    payload: pingDraft,
  });
  data = demoAction(data, "convert_planning_ping", {
    thread_id: "demo-own-ping",
  });
  const converted = data.planning_threads.find((thread) => thread.id === "demo-own-ping");
  assert.equal(converted?.status, "resolved");
  assert.equal(converted?.materialized_activity_id, data.activities.at(-1)?.id);
  assert.equal(data.activities.at(-1)?.owner_id, DEMO_ID);

  data = demoAction(data, "create_planning_thread", {
    id: "demo-vote-council",
    kind: "vote",
    title: "Pick a plan",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: deadline,
    coowner_ids: [],
  });
  data = demoAction(data, "add_council_proposal", {
    id: "demo-option-a",
    thread_id: "demo-vote-council",
    payload: beaconDraft("First option"),
  });
  data = demoAction(data, "approve_council_proposal", {
    thread_id: "demo-vote-council",
    proposal_id: "demo-option-a",
    approved: true,
  });
  const council = data.planning_threads.find((thread) => thread.id === "demo-vote-council")!;
  council.deadline_at = new Date(Date.now() - 60 * 1000).toISOString();
  data = demoAction(data, "resolve_planning_thread", {
    thread_id: "demo-vote-council",
  });
  const resolvedCouncil = data.planning_threads.find(
    (thread) => thread.id === "demo-vote-council",
  )!;
  assert.equal(resolvedCouncil.status, "resolved");
  assert.equal(resolvedCouncil.winner_proposal_id, "demo-option-a");
  assert.equal(
    data.activities.find((activity) => activity.id === resolvedCouncil.materialized_activity_id)?.owner_id,
    DEMO_ID,
  );
});
