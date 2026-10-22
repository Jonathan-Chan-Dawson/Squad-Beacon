import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  ownsMapBeacon,
  friendLocationLabel,
  visibleFriendLabels,
} from "../src/features/maps/markerIdentity";
import { selectMyMapBeacons } from "../src/features/maps/myBeacons";
import {
  clusterAreaSummary,
  mapClusterGroups,
} from "../src/features/maps/mapClusterPolicy";
import { deriveMapPointPriorities } from "../src/features/maps/relevance";
import { rankClusterMembers } from "../src/features/maps/cluster";
import { resolveMapContext } from "../src/features/maps/contextFilters";
import {
  addShownRecipients,
  recipientCategory,
  selectableSocialGroups,
  undoShownRecipients,
} from "../src/features/people/socialSelection";

test("ownership is independent of attendance and requires the current authorized viewer", () => {
  const data = makeDemo();
  const owned = data.activities.find((row) => row.owner_id === DEMO_ID)!;
  assert.equal(ownsMapBeacon(data, owned, DEMO_ID), true);
  assert.equal(ownsMapBeacon(data, owned, null), false);
  assert.equal(ownsMapBeacon(data, owned, "another-viewer"), false);
  const other = data.activities.find((row) => row.owner_id !== DEMO_ID)!;
  assert.equal(ownsMapBeacon(data, other, DEMO_ID), false);
});

test("friend labels use first names and deterministic collisions without removing pins", () => {
  assert.equal(friendLocationLabel("Avery Smith", "6m"), "Avery · 6m");
  assert.equal(
    friendLocationLabel("Alexanderthegreat Jones", "2h"),
    "Alexander… · 2h",
  );
  const points = [
    { id: "a", latitude: 41.88, longitude: -87.64 },
    { id: "b", latitude: 41.88, longitude: -87.63 },
  ];
  assert.equal(visibleFriendLabels(points, 12).size, 1);
  assert.equal(visibleFriendLabels(points, 16).size, 2);
  assert.equal(points.length, 2);
});

test("My Beacons separates hosting and approved attendance, orders live first and omits expired entries", () => {
  const data = makeDemo();
  const now = Date.now();
  const seed = data.activities.find((row) => row.owner_id === DEMO_ID)!;
  const live = {
    ...seed,
    id: "mine-live",
    status: "scheduled" as const,
    starts_at: new Date(now - 1000).toISOString(),
    ends_at: new Date(now + 100000).toISOString(),
  };
  const future = {
    ...live,
    id: "mine-future",
    starts_at: new Date(now + 1000).toISOString(),
  };
  data.activities = [
    future,
    { ...live, id: "expired", ends_at: new Date(now - 1).toISOString() },
    live,
  ];
  assert.deepEqual(
    selectMyMapBeacons(data, DEMO_ID, now).hosting.map((row) => row.id),
    [live.id, future.id],
  );
  const row = data.rsvps[0];
  const joined = {
    ...live,
    id: "joined",
    owner_id: "other",
    audience: "public" as const,
    mode: "open" as const,
    approval_required: true,
  };
  data.activities.push(joined);
  data.rsvps = [
    {
      ...row,
      activity_id: joined.id,
      user_id: DEMO_ID,
      status: "going",
      approved: false,
    },
  ];
  assert.equal(selectMyMapBeacons(data, DEMO_ID, now).joined.length, 0);
  data.rsvps[0].approved = true;
  assert.deepEqual(
    selectMyMapBeacons(data, DEMO_ID, now).joined.map((row) => row.id),
    [joined.id],
  );
  assert.deepEqual(selectMyMapBeacons(data, "wrong-viewer", now), {
    hosting: [],
    joined: [],
  });
});

test("owned previews remain clustered and area summaries include total and owned counts", () => {
  const data = makeDemo();
  const now = Date.now();
  const seed = data.activities.find((row) => row.owner_id === DEMO_ID)!;
  data.activities = [0, 1, 2, 3].map((i) => ({
    ...seed,
    id: `mine-${i}`,
    status: "scheduled",
    starts_at: new Date(now - 1000).toISOString(),
    ends_at: new Date(now + 100000).toISOString(),
  }));
  const points = data.activities.map((row) => ({
    id: `beacon:${row.id}`,
    kind: "beacon" as const,
    latitude: 41.88,
    longitude: -87.64,
  }));
  const priorities = deriveMapPointPriorities(
    data,
    DEMO_ID,
    data.activities.map((row) => row.id),
    [],
    now,
  );
  const groups = mapClusterGroups(
    points,
    {
      centerLatitude: 41.88,
      centerLongitude: -87.64,
      width: 375,
      height: 800,
      zoom: 13,
    },
    priorities,
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 4);
  const summary = clusterAreaSummary(
    groups[0],
    data.activities,
    [],
    now,
    "Downtown",
    DEMO_ID,
  );
  assert.equal(summary.ownedCount, 4);
  assert.equal(summary.reason, "4 Beacons · 4 live");
  const other = { ...data.activities[0], id: "joined-only", owner_id: "other", audience: "public" as const, mode: "open" as const, approval_required: false };
  data.activities.push(other);
  data.rsvps.push({ ...data.rsvps[0], activity_id: other.id, user_id: DEMO_ID, status: "going", approved: true });
  const mixed = [...points, { id: `beacon:${other.id}`, kind: "beacon" as const, latitude: 41.88, longitude: -87.64 }];
  const mixedPriorities = deriveMapPointPriorities(data, DEMO_ID, data.activities.map(row => row.id), [], now);
  assert.equal(mixedPriorities[`beacon:${other.id}`].tier, 0);
  assert.ok(rankClusterMembers(mixed, mixedPriorities).slice(0, 3).every(point => point.id.startsWith("beacon:mine-")));
  assert.equal(ownsMapBeacon(data, other, DEMO_ID), false);
});

test("explicit Beacon context bypasses preferences but rechecks access", () => {
  const data = makeDemo();
  const activity = data.activities.find((row) => row.owner_id === DEMO_ID)!;
  const view = resolveMapContext(data, DEMO_ID, {
    kind: "beacon",
    id: activity.id,
  });
  assert.equal(view?.activities[0].id, activity.id);
  assert.equal(
    resolveMapContext(data, "wrong-viewer", {
      kind: "beacon",
      id: activity.id,
    }),
    null,
  );
});

test("bulk selection deduplicates and undo preserves previous and later selections", () => {
  const initial = [
    { kind: "friend" as const, id: "a" },
    { kind: "squad" as const, id: "s" },
  ];
  const added = addShownRecipients(initial, [
    { kind: "friend", id: "a" },
    { kind: "friend", id: "b" },
    { kind: "friend", id: "b" },
  ]);
  assert.equal(added.selected.length, 3);
  assert.deepEqual(
    undoShownRecipients(
      [...added.selected, { kind: "friend", id: "c" }],
      added.addedKeys,
    ),
    [...initial, { kind: "friend", id: "c" }],
  );
  assert.equal(recipientCategory.space, "Organizations");
  assert.equal(recipientCategory.organization, "Networks");
  assert.deepEqual(selectableSocialGroups(makeDemo(), "wrong-viewer"), []);
});
