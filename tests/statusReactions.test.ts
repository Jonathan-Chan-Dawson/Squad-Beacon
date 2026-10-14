import test from "node:test";
import assert from "node:assert/strict";
import { STATUS_REACTIONS, QUICK_STATUS_REACTIONS, searchStatusReactions, statusReactionEmoji } from "../src/features/beacons/statusReactions";
import { DEMO_ID, makeDemo, demoAction } from "../src/shared/demo";

test("named catalog exposes supported quick choices and normalized search", () => {
  assert.equal(STATUS_REACTIONS.length, 24);
  assert.equal(new Set(STATUS_REACTIONS.map((item) => item.emoji)).size, 24);
  assert.deepEqual(QUICK_STATUS_REACTIONS.map((item) => item.emoji), ["🙌", "❤️", "👍", "🔥", "😂"]);
  assert.equal(searchStatusReactions("  HEART ").length, 2);
  assert.equal(searchStatusReactions("🏀")[0].name, "Basketball");
  assert.equal(statusReactionEmoji(undefined), "🙌");
  assert.throws(() => statusReactionEmoji("unknown"), /supported/);
});
test("demo status replacement/removal preserves activity and RSVP state", () => {
  let data = makeDemo();
  const source = data.activities[0];
  data.activities = [{ ...source, id: "status-reaction-test", owner_id: DEMO_ID, mode: "solo", audience: "private", audience_id: null,
    status: "scheduled", starts_at: new Date(Date.now()-1000).toISOString(), ends_at: new Date(Date.now()+3600000).toISOString(), enable_reactions: true }];
  const count = data.rsvps.length;
  for (const item of STATUS_REACTIONS) { data = demoAction(data, "react_status", { id: "status-reaction-test", emoji: item.emoji }); assert.equal(data.reactions.find((row) => row.activity_id === "status-reaction-test")?.emoji, item.emoji); }
  assert.throws(() => demoAction(data, "react_status", { id: "status-reaction-test", emoji: "unknown" }), /supported/);
  data = demoAction(data, "react_status", { id: "status-reaction-test", remove: true });
  assert.equal(data.reactions.filter((row) => row.activity_id === "status-reaction-test").length, 0);
  assert.equal(data.rsvps.length, count); assert.equal(data.activities.length, 1);
});

test("demo ordinary Beacon reactions retain the legacy choice and explicit status action rejects them", () => {
  const data = makeDemo();
  const activity = data.activities.find((item) => item.owner_id === DEMO_ID && item.mode !== "solo")!;
  assert.ok(activity);
  const reacted = demoAction(data, "react", { id: activity.id, emoji: STATUS_REACTIONS[3].emoji });
  assert.equal(reacted.reactions.find((row) => row.activity_id === activity.id && row.user_id === DEMO_ID)?.emoji, STATUS_REACTIONS[0].emoji);
  assert.throws(() => demoAction(data, "react_status", { id: activity.id, emoji: STATUS_REACTIONS[3].emoji }), /solo status/);
});
