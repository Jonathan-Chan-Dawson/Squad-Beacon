import test from "node:test";
import assert from "node:assert/strict";
import { demoAction, makeDemo, DEMO_ID } from "@/src/shared/demo";
import { canReadPlanningThread } from "../src/features/planning/domain";
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

test("demo creates organization-audience Pings and restricts them to current organization members", () => {
  const initial = makeDemo(),
    organization = initial.organizations[0];
  assert.ok(organization);
  const payload = beaconDraft("Lakefront organization loop");
  payload.audience = "organization";
  payload.audience_id = organization.id;
  const data = demoAction(initial, "create_planning_thread", {
    id: "demo-organization-ping",
    kind: "ping",
    title: "Anyone free for a lakefront walk?",
    body: "Bring a warm layer.",
    audience: "organization",
    audience_id: organization.id,
    deadline_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    coowner_ids: ["jordan"],
    payload,
  });
  const created = data.planning_threads.find((thread) => thread.id === "demo-organization-ping");
  assert.equal(created?.audience, "organization");
  assert.equal(created?.audience_id, organization.id);
  assert.equal(canReadPlanningThread(data, created!, "jordan"), true);
  assert.equal(canReadPlanningThread(data, created!, "alex"), false);
  const revoked = structuredClone(data);
  revoked.organization_members = revoked.organization_members.filter(
    (member) => member.user_id !== "jordan" || member.organization_id !== organization.id,
  );
  assert.equal(canReadPlanningThread(revoked, created!, "jordan"), false);
});

test("demo creates Squad Pings only for current unblocked Squad members", () => {
  const initial = makeDemo();
  const payload = beaconDraft("Boxing crew session");
  payload.audience = "squad";
  payload.audience_id = "boxing";
  const request = {
    kind: "ping",
    title: "Who is free to train?",
    body: "",
    audience: "squad",
    audience_id: "boxing",
    deadline_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    coowner_ids: [],
    payload,
  };
  const data = demoAction(initial, "create_planning_thread", request);
  const created = data.planning_threads.at(-1)!;
  assert.equal(created.audience, "squad");
  assert.equal(created.audience_id, "boxing");
  assert.equal(canReadPlanningThread(data, created, "jordan"), true);

  const removed = structuredClone(initial);
  removed.squad_members = removed.squad_members.filter(
    (member) => member.squad_id !== "boxing" || member.user_id !== DEMO_ID,
  );
  assert.throws(
    () => demoAction(removed, "create_planning_thread", request),
    /current Squad members/,
  );

  const blocked = structuredClone(initial);
  blocked.blocks.push({
    blocker_id: DEMO_ID,
    blocked_id: blocked.squads.find((squad) => squad.id === "boxing")!.owner_id,
  });
  assert.throws(
    () => demoAction(blocked, "create_planning_thread", request),
    /current Squad members/,
  );
});
