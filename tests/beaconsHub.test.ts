import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, makeDemo } from "../src/shared/demo";
import { confirmedHubActivities, confirmedHubPeriodActivities, hubInviteeParams, hubToolShortcuts, nearestHubActivity, toggleHubFriend } from "../src/features/beacons/hubSelectors";
import { browseBeacons } from "../src/shared/browsing";

test("hub includes hosting and approved going, excluding solo, pending and inaccessible attendance", () => {
  const data = makeDemo();
  const base = data.activities.find((activity) => activity.mode !== "solo")!;
  data.activities = [
    { ...base, id: "hosted", owner_id: DEMO_ID },
    { ...base, id: "solo", owner_id: DEMO_ID, mode: "solo" },
    { ...base, id: "approved", owner_id: "jordan", mode: "squad", audience: "friends", approval_required: true },
    { ...base, id: "pending", owner_id: "jordan", mode: "squad", audience: "friends", approval_required: true },
    { ...base, id: "private", owner_id: "jordan", mode: "squad", audience: "private", approval_required: true },
  ];
  data.rsvps = ["approved", "pending", "private"].map((activity_id) => ({ activity_id, user_id: DEMO_ID, status: "going", approved: activity_id !== "pending" }));
  data.activity_exclusions.push({ activity_id: "private", user_id: DEMO_ID });
  assert.deepEqual(confirmedHubActivities(data, DEMO_ID).map((activity) => activity.id), ["hosted", "approved"]);
  assert.deepEqual(confirmedHubActivities(data, "another-viewer"), []);
});

test("nearest confirmed activity prefers active, then nearest future, omitting ended and cancelled", () => {
  const data = makeDemo();
  const base = data.activities[0];
  const now = Date.parse("2026-10-13T16:00:00Z");
  const activities = [
    { ...base, id: "later", status: "scheduled" as const, starts_at: "2026-10-13T18:00:00Z", ends_at: "2026-10-13T19:00:00Z" },
    { ...base, id: "active", status: "scheduled" as const, starts_at: "2026-10-13T15:00:00Z", ends_at: "2026-10-13T17:00:00Z" },
    { ...base, id: "ended", status: "scheduled" as const, starts_at: "2026-10-13T14:00:00Z", ends_at: "2026-10-13T16:00:00Z" },
    { ...base, id: "cancelled", status: "cancelled" as const, starts_at: "2026-10-13T15:00:00Z", ends_at: "2026-10-13T17:00:00Z" },
  ];
  assert.equal(nearestHubActivity(activities, now)?.id, "active");
  assert.equal(nearestHubActivity(activities.filter((activity) => activity.id !== "active"), now)?.id, "later");
});

test("selection survives search and invalid eligibility; deselection is explicit", () => {
  const selected = toggleHubFriend(toggleHubFriend([], "jordan"), "sam");
  const original = [...selected];
  assert.throws(() => hubInviteeParams(selected, ["sam"]), /no longer available/);
  assert.deepEqual(selected, original);
  assert.deepEqual(toggleHubFriend(selected, "jordan"), ["sam"]);
  assert.deepEqual(hubInviteeParams(selected, ["sam", "jordan"]), { inviteeIds: '["jordan","sam"]' });
  assert.throws(() => hubInviteeParams([], []), /Select friends/);
});

test("confirmed period browsing retains personal attendance when discovery search/audience/category hide it", () => {
  const data = makeDemo();
  const now = Date.parse("2026-10-13T16:00:00Z");
  const base = data.activities[0];
  data.activities = [
    { ...base, id: "mine", owner_id: DEMO_ID, mode: "squad", category: "Fitness", starts_at: "2026-10-14T16:00:00Z", ends_at: "2026-10-14T17:00:00Z", status: "scheduled" },
    { ...base, id: "later", owner_id: DEMO_ID, mode: "squad", category: "Study", starts_at: "2026-10-15T16:00:00Z", ends_at: "2026-10-15T17:00:00Z", status: "scheduled" },
  ];
  data.places = [{ activity_id: "mine", label: "Far outside my discovery area", latitude: -33.8, longitude: 151.2, online_url: null }];
  assert.deepEqual(browseBeacons(data, DEMO_ID, { period: "Upcoming", sort: "Soonest", query: "unmatched", category: "Gaming", audience: "Friends", joined: false }, now), []);
  assert.deepEqual(confirmedHubPeriodActivities(data, DEMO_ID, "Upcoming", "Soonest", now).map((activity) => activity.id), ["mine", "later"]);
  assert.deepEqual(confirmedHubPeriodActivities(data, DEMO_ID, "Upcoming", "Latest first", now).map((activity) => activity.id), ["later", "mine"]);
  assert.deepEqual(confirmedHubPeriodActivities(data, DEMO_ID, "Active", "Soonest", now), []);
});

test("tool shortcuts use real readable checklist totals and omit disabled or unauthorized modules", () => {
  const data = makeDemo();
  const activity = { ...data.activities[0], id: "tools", owner_id: DEMO_ID, mode: "squad" as const, enable_chat: true, enable_checklist: true, enable_focus: true };
  data.activities = [activity];
  const item = { activity_id: activity.id, author_id: DEMO_ID, text: "Task", section_id: null, assignee_id: null, created_at: "2026-10-13T16:00:00Z", updated_at: "2026-10-13T16:00:00Z" };
  data.beacon_checklist_items = [{ ...item, id: "one", completed: true }, { ...item, id: "two", completed: false }, { ...item, id: "hidden", author_id: "jordan", completed: true }];
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "jordan" });
  assert.deepEqual(hubToolShortcuts(data, activity, DEMO_ID).map((shortcut) => shortcut.label), ["Chat", "Checklist 1/2", "Timer"]);
  activity.enable_focus = false;
  assert.ok(!hubToolShortcuts(data, activity, DEMO_ID).some((shortcut) => shortcut.tool === "focus"));
  assert.deepEqual(hubToolShortcuts(data, activity, "another-viewer"), []);
});
