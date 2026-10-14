import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { resolveActivityToolEntry } from "../src/features/beacons/activityToolEntry";

test("tool links open only known enabled modules for authorized current viewers", () => {
  const data = makeDemo();
  const activity = { ...data.activities[0], owner_id: DEMO_ID, enable_checklist: true, enable_focus: false };
  data.activities = [activity];
  assert.deepEqual(resolveActivityToolEntry(data, activity, DEMO_ID, "tools", "checklist"), { tab: "Tools", tool: "checklist" });
  assert.deepEqual(resolveActivityToolEntry(data, activity, DEMO_ID, "tools", "focus"), { tab: "Overview", tool: null });
  assert.deepEqual(resolveActivityToolEntry(data, activity, DEMO_ID, "tools", "unknown"), { tab: "Overview", tool: null });
  assert.deepEqual(resolveActivityToolEntry(data, activity, DEMO_ID, "tools", ["checklist"]), { tab: "Overview", tool: null });
  assert.deepEqual(resolveActivityToolEntry(data, activity, "another-viewer", "tools", "checklist"), { tab: "Overview", tool: null });
  data.viewer_id = "another-viewer";
  assert.deepEqual(resolveActivityToolEntry(data, activity, DEMO_ID, "tools", "checklist"), { tab: "Overview", tool: null });
});

test("readable activity access alone never grants tools to an unapproved attendee", () => {
  const data = makeDemo();
  const activity = { ...data.activities[0], id: "invite", owner_id: "jordan", mode: "invite" as const, audience: "friends" as const, approval_required: true, enable_checklist: true };
  data.activities = [activity];
  data.rsvps = [{ activity_id: activity.id, user_id: DEMO_ID, status: "going", approved: false }];
  assert.deepEqual(resolveActivityToolEntry(data, activity, DEMO_ID, "tools", "checklist"), { tab: "Overview", tool: null });
  data.rsvps[0].approved = true;
  assert.deepEqual(resolveActivityToolEntry(data, activity, DEMO_ID, "tools", "checklist"), { tab: "Tools", tool: "checklist" });
});
