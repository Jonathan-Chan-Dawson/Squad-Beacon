import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoAction, DEMO_ID } from "../src/shared/demo";
import { planningInteraction } from "../src/features/planning/planningInteraction";

test("shared Ping controls change the canonical response without manufacturing participation", () => {
  let data = makeDemo(); const id = "demo-ping-jordan"; const now = Date.now();
  assert.ok(planningInteraction(data, DEMO_ID, id, now)?.eligible);
  data = demoAction(data, "respond_planning_ping", { thread_id: id, response: "interested", auto_rsvp: false });
  assert.equal(planningInteraction(data, DEMO_ID, id, now)?.responses.find(row => row.user_id === DEMO_ID)?.response, "interested");
  const before = structuredClone(data.rsvps);
  data = demoAction(data, "respond_planning_ping", { thread_id: id, response: "pass" });
  assert.equal(planningInteraction(data, DEMO_ID, id, now)?.responses.find(row => row.user_id === DEMO_ID)?.response, "pass");
  assert.deepEqual(data.rsvps, before);
  assert.equal(planningInteraction(data, DEMO_ID, id, now + 100 * 86400000)?.eligible, false);
});

test("approved options, vote changes, blocks and account boundaries use canonical permissions", () => {
  let data = makeDemo(); const id = "demo-vote-weekend"; const now = Date.now();
  const allowed = data.planning_proposals.find(row => row.thread_id === id && row.author_id === "maya")!;
  data.planning_proposals.push({ ...allowed, id: "second-authorized-option" });
  const state = planningInteraction(data, DEMO_ID, id, now)!;
  assert.ok(state.options.length >= 2);
  for (const option of state.options.slice(0, 2)) data = demoAction(data, "vote_council_proposal", { thread_id: id, proposal_id: option.id });
  assert.equal(planningInteraction(data, DEMO_ID, id, now)?.votes.filter(row => row.user_id === DEMO_ID).length, 1);
  assert.equal(planningInteraction(data, DEMO_ID, id, now)?.votes.find(row => row.user_id === DEMO_ID)?.proposal_id, state.options[1].id);
  const unauthorized = { ...state.options[0], id: "unapproved", approved: false }; data.planning_proposals.push(unauthorized);
  assert.ok(!planningInteraction(data, DEMO_ID, id, now)?.options.some(row => row.id === unauthorized.id));
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "maya", created_at: new Date(now).toISOString() });
  assert.equal(planningInteraction(data, DEMO_ID, id, now), null);
  data.viewer_id = "different-account"; assert.equal(planningInteraction(data, DEMO_ID, id, now), null);
});
