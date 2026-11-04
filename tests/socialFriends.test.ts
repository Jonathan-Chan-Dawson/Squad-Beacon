import test from "node:test";
import { resolveBeaconIcon } from "../src/features/beacons/beaconIcon";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  socialFriends,
  filterSocialFriends,
  availabilityLabel,
} from "../src/features/beacons/socialFriends";
import { parseViewerDeviceDefaults } from "../src/features/profile/settings/beaconDefaults";
import {
  quickStatusDraft,
  validQuickStatus,
} from "../src/features/beacons/quickStatus";
import {
  clearOwnStatuses,
  saveOwnStatus,
} from "../src/features/beacons/components/feed/statusActions";
import {
  planningSelection,
  setPlanningSelection,
  startPlanningDraft,
  completePlanningDraft,
  planningDraftObject,
} from "../src/features/beacons/socialPlanningSession";
const now = Date.parse("2026-10-16T16:00:00Z");
function fixture() {
  const data = makeDemo();
  const base = data.activities[0];
  data.activities = [
    {
      ...base,
      id: "busy",
      owner_id: "jordan",
      mode: "solo",
      status: "scheduled",
      available: false,
      audience: "friends",
      audience_id: null,
      title: "Finishing my book",
      starts_at: new Date(now - 60000).toISOString(),
      ends_at: new Date(now + 3600000).toISOString(),
    },
    {
      ...base,
      id: "beacon",
      owner_id: "jordan",
      mode: "squad",
      status: "scheduled",
      audience: "friends",
      audience_id: null,
      title: "Quiet reading",
      starts_at: new Date(now - 60000).toISOString(),
      ends_at: new Date(now + 3600000).toISOString(),
    },
  ];
  return data;
}
test("Beacon decoration uses an existing custom icon, then category, then a safe default", () => {
  assert.deepEqual(resolveBeaconIcon("☕", "Study"), {
    kind: "emoji",
    emoji: "☕",
  });
  assert.deepEqual(resolveBeaconIcon(null, "Study"), {
    kind: "category",
    category: "Study",
  });
  assert.deepEqual(resolveBeaconIcon("invalid custom text", "Fitness"), {
    kind: "category",
    category: "Fitness",
  });
  assert.deepEqual(resolveBeaconIcon(null, null), { kind: "default" });
  assert.deepEqual(resolveBeaconIcon(null, "unknown"), { kind: "default" });
});

test("availability stays busy independently of visible attendance; revoked content is removed", () => {
  const data = fixture();
  data.presence = [
    {
      owner_id: "jordan",
      availability: "busy",
      availability_until: new Date(now + 3600000).toISOString(),
      sharing: true,
      show_current_beacon: true,
      current_beacon_id: "beacon",
      current_activity: null,
      current_audience: "friends",
      current_audience_id: null,
    },
  ];
  data.beacon_attendance = [
    {
      activity_id: "beacon",
      user_id: "jordan",
      state: "present",
      updated_at: new Date(now).toISOString(),
    },
  ];
  data.activities.find(
    (activity) => activity.id === "beacon",
  )!.decoration_emoji = "🌿";
  const jordan = socialFriends(data, DEMO_ID, now).find(
    (friend) => friend.id === "jordan",
  )!;
  assert.equal(jordan.availability, "unavailable");
  assert.equal(jordan.beacon?.label, "Present");
  assert.equal(jordan.beacon?.emoji, "🌿");
  assert.equal(jordan.beacon?.goingCount, 1);
  assert.equal(jordan.note?.title, "Finishing my book");
  data.activities.forEach((activity) => {
    activity.audience = "private";
  });
  const revoked = socialFriends(data, DEMO_ID, now).find(
    (friend) => friend.id === "jordan",
  )!;
  assert.equal(revoked.note, undefined);
  assert.equal(revoked.beacon, undefined);
  data.blocks.push({ blocker_id: "jordan", blocked_id: DEMO_ID });
  assert.ok(
    !socialFriends(data, DEMO_ID, now).some((friend) => friend.id === "jordan"),
  );
  assert.deepEqual(socialFriends(data, "another-viewer", now), []);
});
test("future availability is not free now and expired notes disappear", () => {
  const data = fixture();
  data.activities = [
    {
      ...data.activities[0],
      available: true,
      starts_at: new Date(now + 60000).toISOString(),
    },
  ];
  const future = socialFriends(data, DEMO_ID, now).find(
    (friend) => friend.id === "jordan",
  )!;
  assert.equal(future.availability, "unknown");
  assert.match(availabilityLabel(future, now), /^Available from/);
  assert.equal(
    socialFriends(data, DEMO_ID, now + 7200000).find(
      (friend) => friend.id === "jordan",
    )?.note,
    undefined,
  );
});
test("500-friend search reaches older rows; private lists narrow eligible candidates only", () => {
  const data = fixture();
  const base = data.profiles.find((profile) => profile.id === "jordan")!;
  data.friendships = [];
  for (let index = 0; index < 500; index++) {
    const id = `friend-${index}`;
    data.profiles.push({ ...base, id, name: `Friend ${index}` });
    data.friendships.push({
      id: `relationship-${index}`,
      sender_id: DEMO_ID,
      recipient_id: id,
      status: "accepted",
    });
  }
  data.friendships.push(data.friendships[0]);
  const friends = socialFriends(data, DEMO_ID, now);
  assert.equal(friends.length, 500);
  assert.equal(
    filterSocialFriends(friends, data, DEMO_ID, {
      query: "Friend 499",
      filter: "All",
      listId: null,
    })[0]?.id,
    "friend-499",
  );
  data.lists.push({
    id: "private-test",
    owner_id: DEMO_ID,
    name: "Close friends",
  });
  data.list_members.push(
    { list_id: "private-test", user_id: "friend-499" },
    { list_id: "private-test", user_id: "stranger" },
  );
  assert.equal(
    filterSocialFriends(friends, data, DEMO_ID, {
      query: "",
      filter: "All",
      listId: "private-test",
    }).length,
    1,
  );
});
test("quick defaults are validated and current audience, text and timing survive a quick update", () => {
  const data = fixture();
  assert.deepEqual(
    parseViewerDeviceDefaults({
      quickStatus: { audience: "friends", audienceId: null, minutes: 60 },
    }).quickStatus,
    { audience: "friends", audienceId: null, minutes: 60 },
  );
  assert.equal(
    parseViewerDeviceDefaults({
      quickStatus: { audience: "public", minutes: 60 },
    }).quickStatus,
    undefined,
  );
  assert.equal(validQuickStatus(data, DEMO_ID, undefined), false);
  assert.equal(
    validQuickStatus(data, DEMO_ID, {
      audience: "list",
      audienceId: "deleted",
      minutes: 60,
    }),
    false,
  );
  const source = { ...data.activities[0], audience: "private" as const };
  const draft = quickStatusDraft(source, "friends", null, 120, now);
  assert.equal(draft.audience, "private");
  assert.equal(draft.title, source.title);
  assert.equal(draft.endsAt, new Date(now + 7200000).toISOString());
  const future = quickStatusDraft(
    undefined,
    "friends",
    null,
    60,
    now,
    new Date(now + 3600000).toISOString(),
    new Date(now + 7200000).toISOString(),
  );
  assert.equal(future.startsAt, new Date(now + 3600000).toISOString());
  assert.throws(() =>
    quickStatusDraft(undefined, "friends", null, 60, now, "invalid"),
  );
});
test("scheduled notes clear and replace through existing owner-only actions", async () => {
  const data = fixture();
  const source = {
    ...data.activities[0],
    owner_id: DEMO_ID,
    starts_at: new Date(now + 60000).toISOString(),
  };
  data.activities = [source];
  const calls: string[] = [];
  await clearOwnStatuses(
    data,
    DEMO_ID,
    async (action, payload) => {
      calls.push(action);
      assert.equal(payload?.id, source.id);
      return {};
    },
    now,
    source.id,
  );
  assert.deepEqual(calls, ["activity_status"]);
  calls.length = 0;
  await saveOwnStatus(
    data,
    DEMO_ID,
    {
      sourceId: source.id,
      title: source.title,
      available: true,
      startsAt: source.starts_at,
      endsAt: source.ends_at,
    },
    async (action) => {
      calls.push(action);
      return { id: "new", event: "save_status_note", cleared_count: 0 };
    },
    now,
  );
  assert.deepEqual(calls, ["save_status_note", "activity_status"]);
  const partial = await saveOwnStatus(
    data,
    DEMO_ID,
    {
      sourceId: source.id,
      title: source.title,
      available: true,
      startsAt: source.starts_at,
      endsAt: source.ends_at,
    },
    async (action) => {
      if (action === "activity_status") throw new Error("Connection lost");
      return { id: "replacement", event: "save_status_note", cleared_count: 0 };
    },
    now,
  );
  assert.equal(partial.savedId, "replacement");
  assert.deepEqual(partial.failedIds, [source.id]);
  assert.match(partial.message, /new status was saved/);
});
test("selection and unfinished publication attempt survive navigation and isolate accounts", () => {
  setPlanningSelection("test-owner", ["a", "b", "a"]);
  const token = startPlanningDraft("test-owner");
  const attempt = planningDraftObject(
    "test-owner",
    token,
    "invitationSession",
    () => ({ requestId: "retry-once" }),
  );
  assert.deepEqual(planningSelection("test-owner"), ["a", "b"]);
  assert.deepEqual(planningSelection("other-owner"), []);
  assert.equal(
    planningDraftObject("test-owner", token, "invitationSession", () => null),
    attempt,
  );
  completePlanningDraft("test-owner", "wrong-token");
  assert.equal(planningSelection("test-owner").length, 2);
  completePlanningDraft("test-owner", token);
  assert.deepEqual(planningSelection("test-owner"), []);
});

test("scope counts do not inherit directory query or availability filters", () => {
  const data = fixture();
  data.favorites = [{ owner_id: DEMO_ID, kind: "friend", target_id: "jordan" }];
  const friends = socialFriends(data, DEMO_ID, now);
  const scope = filterSocialFriends(friends, data, DEMO_ID, {
    scope: "favorites",
    query: "",
    filter: "All",
  });
  assert.deepEqual(
    scope.map((row) => row.id),
    ["jordan"],
  );
  assert.equal(
    filterSocialFriends(friends, data, DEMO_ID, {
      scope: "favorites",
      query: "missing",
      filter: "Available",
    }).length,
    0,
  );
  assert.deepEqual(
    filterSocialFriends(friends, data, DEMO_ID, {
      scope: "custom:deleted",
      query: "",
      filter: "All",
    }),
    [],
  );
});

test("genuine notes stay independent of shared current Beacon and availability", () => {
  const data = fixture();
  data.presence = [
    {
      owner_id: "jordan",
      availability: "available",
      availability_until: new Date(now + 3600000).toISOString(),
      show_current_beacon: true,
      current_beacon_id: "beacon",
      current_activity: null,
      current_audience: "friends",
      current_audience_id: null,
      sharing: true,
    },
  ];
  const friend = socialFriends(data, DEMO_ID, now).find(
    (row) => row.id === "jordan",
  )!;
  assert.ok(["available", "ending-soon"].includes(friend.availability));
  assert.equal(friend.statusText, "Finishing my book");
  assert.equal(friend.currentBeacon?.activity.title, "Quiet reading");
  const found = filterSocialFriends([friend], data, DEMO_ID, {
    scope: "friends",
    query: "Quiet reading",
    filter: "All",
  });
  assert.equal(found.length, 1);
  data.activities[0].status_note_hidden = true;
  const hidden = socialFriends(data, DEMO_ID, now).find(
    (row) => row.id === "jordan",
  )!;
  assert.equal(hidden.statusText, "");
  assert.equal(
    filterSocialFriends([hidden], data, DEMO_ID, {
      query: "Finishing my book",
      filter: "All",
    }).length,
    0,
  );
  data.presence[0].availability_until = null;
  const unlimited = socialFriends(data, DEMO_ID, now).find(
    (row) => row.id === "jordan",
  )!;
  assert.equal(availabilityLabel(unlimited, now), "Available now");
  data.presence[0].availability = null;
  const unknown = socialFriends(data, DEMO_ID, now).find(
    (row) => row.id === "jordan",
  )!;
  assert.equal(unknown.availability, "unknown");
  assert.ok(unknown.currentBeacon);
});

test("no-friend and empty scope results never manufacture availability or actionable people", () => {
  const data = fixture();
  data.friendships = [];
  assert.deepEqual(socialFriends(data, DEMO_ID, now), []);
  assert.deepEqual(
    filterSocialFriends([], data, DEMO_ID, {
      scope: "favorites",
      query: "",
      filter: "All",
    }),
    [],
  );
  assert.deepEqual(
    filterSocialFriends([], data, DEMO_ID, {
      scope: "custom:empty",
      query: "",
      filter: "Available",
    }),
    [],
  );
});
