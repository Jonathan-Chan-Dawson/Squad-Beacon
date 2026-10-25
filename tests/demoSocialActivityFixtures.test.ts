import assert from "node:assert/strict";
import test from "node:test";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { addDemoSocialActivityFixtures } from "../src/shared/demoSocialActivityFixtures";
import { currentActivity } from "../src/features/beacons/livingActivity";
import { socialFriends } from "../src/features/beacons/socialFriends";
import { selectPersonPreview } from "../src/features/people/previews/personPreview";

test("thirty demo friends share real current activities and explicit availability", () => {
  const data = makeDemo(),
    now = Date.now();
  const presences = data.presence.filter((row) =>
    row.current_activity?.id.startsWith("demo-social-map-friend-"),
  );
  assert.equal(presences.length, 30);
  assert.equal(new Set(presences.map((row) => row.owner_id)).size, 30);
  const friends = socialFriends(data, DEMO_ID, now);
  let beacons = 0,
    notes = 0;
  for (const presence of presences) {
    const current = currentActivity(data, presence.owner_id, DEMO_ID, now);
    assert.ok(current);
    assert.equal(current.activity.id, presence.current_activity?.id);
    if (current.type === "beacon") {
      beacons++;
      assert.equal(current.role, "hosting");
      assert.ok(
        friends.find((friend) => friend.id === presence.owner_id)?.beacon,
      );
      assert.ok(
        data.places.some((place) => place.activity_id === current.activity.id),
      );
    } else notes++;
    assert.notEqual(
      selectPersonPreview(data, presence.owner_id, DEMO_ID, now).availability,
      "unknown",
    );
  }
  assert.equal(beacons, 12);
  assert.equal(notes, 18);
  const newStatuses = data.activities.filter((activity) =>
    activity.id.startsWith("demo-social-status-"),
  );
  assert.equal(newStatuses.length, 10);
  assert.ok(newStatuses.some((activity) => activity.available));
  assert.ok(newStatuses.some((activity) => !activity.available));
});

test("social demo examples retain normal sharing, blocking and expiry behavior", () => {
  const data = makeDemo(),
    now = Date.now();
  const presence = data.presence.find((row) =>
    row.current_activity?.id.startsWith("demo-social-map-friend-"),
  )!;
  assert.ok(currentActivity(data, presence.owner_id, DEMO_ID, now));
  presence.sharing = false;
  assert.equal(currentActivity(data, presence.owner_id, DEMO_ID, now), null);
  presence.sharing = true;
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: presence.owner_id });
  assert.equal(currentActivity(data, presence.owner_id, DEMO_ID, now), null);
  data.blocks = [];
  assert.equal(
    currentActivity(data, presence.owner_id, DEMO_ID, now + 8 * 3_600_000),
    null,
  );
  assert.equal(
    selectPersonPreview(data, presence.owner_id, DEMO_ID, now + 8 * 3_600_000)
      .availability,
    "unknown",
  );
});

test("social fixtures never add examples to a connected account", () => {
  const data = makeDemo();
  data.is_demo = false;
  const before = structuredClone(data);
  addDemoSocialActivityFixtures(data, DEMO_ID, Date.now());
  assert.deepEqual(data, before);
});
