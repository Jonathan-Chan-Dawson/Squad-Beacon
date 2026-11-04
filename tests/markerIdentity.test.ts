import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  markerIdentity,
  prepareMapIdentity,
  beaconMarkerState,
  markerStateLabel,
  EMPTY_MARKER_STATE,
} from "../src/features/maps/markerIdentity";
import { isBeaconLive } from "../src/features/beacons/beaconLive";
import { ClusterArtworkCache } from "../src/features/maps/clusterArtwork";
import type { Activity } from "../src/shared/types";

test("marker identity fails closed across viewer snapshots", () => {
  const data = makeDemo();
  assert.equal(
    markerIdentity(data, data.activities[0], "another-viewer"),
    null,
  );
  assert.equal(markerIdentity(data, data.activities[0], null), null);
});
test("community hosting identity remains independent of the Beacon audience", () => {
  const data = makeDemo();
  const activity = data.activities.find(
    (row) => row.owner_id === DEMO_ID && row.mode !== "solo",
  )!;
  assert.ok(activity);
  activity.audience = "friends";
  data.activity_social_links = [
    {
      activity_id: activity.id,
      entity_type: "space",
      entity_id: "network",
      created_by: DEMO_ID,
      created_at: new Date().toISOString(),
    },
  ];
  assert.equal(markerIdentity(data, activity, DEMO_ID)?.label, "Organization");
  data.activity_social_links[0].entity_type = "organization";
  assert.equal(markerIdentity(data, activity, DEMO_ID)?.label, "Network");
});

function fixture() {
  const data = makeDemo();
  const now = Date.parse("2026-11-03T12:00:00Z");
  const activity: Activity = {
    ...data.activities.find((a) => a.mode !== "solo")!,
    id: "marker-test",
    owner_id: "marker-friend",
    mode: "open",
    audience: "friends",
    status: "scheduled",
    starts_at: new Date(now - 1000).toISOString(),
    ends_at: new Date(now + 60_000).toISOString(),
    plan_id: null,
    plan_step: undefined,
  };
  data.activities.push(activity);
  data.rsvps.push({
    ...data.rsvps[0],
    activity_id: activity.id,
    user_id: DEMO_ID,
    status: "going",
    approved: true,
  });
  data.friendships.push({
    sender_id: DEMO_ID,
    recipient_id: activity.owner_id,
    status: "accepted",
  } as (typeof data.friendships)[number]);
  data.beacon_favorites.push({
    owner_id: DEMO_ID,
    activity_id: activity.id,
    created_at: new Date(now).toISOString(),
  });
  return { data, activity, now };
}

test("marker states coexist independently of community hosting and expose accessible descriptions", () => {
  const { data, activity, now } = fixture();
  data.activity_social_links.push({
    activity_id: activity.id,
    entity_type: "space",
    entity_id: "community",
    created_by: DEMO_ID,
    created_at: new Date(now).toISOString(),
  });
  const state = beaconMarkerState(
    data,
    activity,
    prepareMapIdentity(data, DEMO_ID),
    now,
  );
  assert.deepEqual(state, {
    owned: false,
    saved: true,
    friendHosted: true,
    live: true,
  });
  assert.equal(markerStateLabel(state), "Saved, Friend-hosted, Live");
  activity.owner_id = DEMO_ID;
  const owned = beaconMarkerState(
    data,
    activity,
    prepareMapIdentity(data, DEMO_ID),
    now,
  );
  assert.equal(owned.owned, true);
  assert.equal(owned.saved, true); // Saved state survives; rendering suppresses its redundant badge.
  assert.match(markerStateLabel(owned), /Your Beacon, Saved/);
});

test("marker lookups fail closed across accounts, unreadable Beacons and blocked hosts", () => {
  const { data, activity, now } = fixture();
  assert.deepEqual(
    beaconMarkerState(data, activity, prepareMapIdentity(data, null), now),
    EMPTY_MARKER_STATE,
  );
  assert.deepEqual(
    beaconMarkerState(data, activity, prepareMapIdentity(data, "another"), now),
    EMPTY_MARKER_STATE,
  );
  const oldLookup = prepareMapIdentity(data, DEMO_ID);
  data.viewer_id = "another";
  assert.deepEqual(
    beaconMarkerState(data, activity, oldLookup, now),
    EMPTY_MARKER_STATE,
  );
  data.viewer_id = DEMO_ID;
  data.blocks.push({
    blocker_id: DEMO_ID,
    blocked_id: activity.owner_id,
  } as (typeof data.blocks)[number]);
  assert.deepEqual(
    beaconMarkerState(data, activity, prepareMapIdentity(data, DEMO_ID), now),
    EMPTY_MARKER_STATE,
  );
  data.blocks = [];
  data.rsvps = [];
  activity.mode = "invite";
  data.friendships = [];
  assert.deepEqual(
    beaconMarkerState(data, activity, prepareMapIdentity(data, DEMO_ID), now),
    EMPTY_MARKER_STATE,
  );
});

test("local blocks and exclusions suppress identity before a hosted snapshot refresh", () => {
  const { data, activity, now } = fixture();
  data.is_demo = false;
  activity.viewer_can_access = true;
  const state = () =>
    beaconMarkerState(data, activity, prepareMapIdentity(data, DEMO_ID), now);
  assert.equal(state().saved, true);
  data.blocks.push({
    blocker_id: activity.owner_id,
    blocked_id: DEMO_ID,
  } as (typeof data.blocks)[number]);
  assert.deepEqual(state(), EMPTY_MARKER_STATE);
  data.blocks = [];
  data.activity_exclusions.push({
    activity_id: activity.id,
    user_id: DEMO_ID,
  } as (typeof data.activity_exclusions)[number]);
  assert.deepEqual(state(), EMPTY_MARKER_STATE);
});

test("canonical live predicate respects time boundaries and explicit Plan lifecycle", () => {
  const { activity, now } = fixture();
  assert.equal(isBeaconLive(activity, now), true);
  assert.equal(
    isBeaconLive(activity, Date.parse(activity.starts_at) - 1),
    false,
  );
  assert.equal(isBeaconLive(activity, Date.parse(activity.starts_at)), true);
  assert.equal(isBeaconLive(activity, Date.parse(activity.ends_at)), false);
  for (const status of ["cancelled", "completed"] as const)
    assert.equal(isBeaconLive({ ...activity, status }, now), false);
  assert.equal(isBeaconLive({ ...activity, mode: "solo" }, now), false);
  assert.equal(isBeaconLive({ ...activity, starts_at: "invalid" }, now), false);
  assert.equal(isBeaconLive({ ...activity, ends_at: "invalid" }, now), false);
  for (const start_mode of ["manual", "after_previous"] as const) {
    const child = {
      ...activity,
      plan_id: "plan",
      plan_step: { start_mode, end_mode: "manual" },
      plan_started_at: null,
    } as Activity;
    assert.equal(isBeaconLive(child, now), false);
    child.plan_started_at = child.starts_at;
    assert.equal(isBeaconLive(child, now), true);
    child.status = "completed";
    assert.equal(isBeaconLive(child, now), false);
  }
});

test("cluster artwork revisions change on identity changes, reuse stable updates and clear on viewer switch", () => {
  const { data, activity, now } = fixture();
  const cache = new ClusterArtworkCache();
  const points = [
    {
      id: `beacon:${activity.id}`,
      kind: "beacon" as const,
      latitude: 41.88,
      longitude: -87.64,
    },
  ];
  const build = (clock = now, viewer = DEMO_ID) =>
    cache
      .build(points, data.activities, [], [], [], data, viewer, clock)
      .get(points[0].id)!;
  const first = build();
  assert.equal(build(now + 1000), first);
  data.beacon_favorites = [];
  const unsaved = build();
  assert.notEqual(unsaved.visualRevision, first.visualRevision);
  assert.equal(unsaved.markerState.saved, false);
  data.friendships = [];
  const unfriended = build();
  assert.notEqual(unfriended.visualRevision, unsaved.visualRevision);
  assert.equal(unfriended.markerState.friendHosted, false);
  assert.equal(build(Date.parse(activity.ends_at)).markerState.live, false);
  assert.deepEqual(build(now, "another").markerState, EMPTY_MARKER_STATE);
});
