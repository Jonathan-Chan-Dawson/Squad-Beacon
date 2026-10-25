import assert from "node:assert/strict";
import test from "node:test";
import {
  beaconPetalLimit,
  clusterLayout,
  clusterPetalOffset,
  CLUSTER_COUNT_ANCHOR,
  CLUSTER_OWNERSHIP_ANCHOR,
} from "../src/features/maps/clusterLayout";
import { KeyedMapLayers } from "../src/features/maps/keyedMapLayers";
import {
  MapPresentationCache,
  nativePetalOffset,
} from "../src/features/maps/nativeMapPresentation";
import type { ClusterPoint } from "../src/features/maps/cluster";
import { bloomGeometry } from "../src/features/maps/clusterBloom";
import { nativePresentation } from "../src/features/maps/nativeMapPresentation";

test("adaptive friends preserve Beacon geometry and never combine icons with a count badge", () => {
  for (const [beacons, friends] of [
    [2, 2],
    [2, 25],
    [7, 18],
    [20, 5],
    [40, 60],
    [2, 7],
  ])
    for (const mode of ["stack", "swarm", "atmosphere", "micro"] as const) {
      const beaconPoints: ClusterPoint[] = Array.from(
        { length: beacons },
        (_, i) => ({
          id: `beacon:${i}`,
          kind: "beacon",
          latitude: 0,
          longitude: 0,
        }),
      );
      const people: ClusterPoint[] = Array.from(
        { length: friends },
        (_, i) => ({
          id: `person:${i}`,
          kind: "person",
          latitude: Math.sin(i * 2.4) * 0.001,
          longitude: Math.cos(i * 2.4) * 0.001,
        }),
      );
      const base = bloomGeometry(
        nativePresentation(
          { id: "test", latitude: 0, longitude: 0, members: beaconPoints },
          mode,
          {},
          new Set(),
        ),
      );
      const item = nativePresentation(
        {
          id: "test",
          latitude: 0,
          longitude: 0,
          members: [...beaconPoints, ...people],
        },
        mode,
        {},
        new Set(),
      );
      const geometry = bloomGeometry(item);
      assert.deepEqual(geometry.offsets, base.offsets);
      assert.equal(geometry.shadowSize, base.shadowSize);
      assert.equal(
        geometry.shadowLeft - geometry.center,
        base.shadowLeft - base.center,
      );
      assert.equal(
        geometry.shadowTop - geometry.center,
        base.shadowTop - base.center,
      );
      assert.ok(!(geometry.satellites.length && geometry.friendBadge));
      if (mode === "micro") {
        assert.equal(geometry.friendBadge, undefined);
        assert.equal(geometry.satellites.length, Math.min(friends, 2));
      } else if (friends > 7) {
        assert.equal(geometry.satellites.length, 0);
        assert.ok(geometry.friendBadge);
      } else if (mode === "stack" || mode === "swarm")
        assert.equal(geometry.satellites.length, friends);
      for (let i = 0; i < geometry.satelliteOffsets.length; i++)
        for (let j = i + 1; j < geometry.satelliteOffsets.length; j++)
          assert.ok(
            Math.hypot(
              geometry.satelliteOffsets[i].x - geometry.satelliteOffsets[j].x,
              geometry.satelliteOffsets[i].y - geometry.satelliteOffsets[j].y,
            ) >=
              geometry.satelliteSize + 3,
          );
    }
});

test("friend badges choose the nearest free edge from geographic direction rather than a fixed crown", () => {
  const beacons: ClusterPoint[] = Array.from({ length: 2 }, (_, i) => ({
    id: `beacon:${i}`,
    kind: "beacon",
    latitude: 0,
    longitude: 0,
  }));
  const badge = (longitude: number) =>
    bloomGeometry(
      nativePresentation(
        {
          id: "same",
          latitude: 0,
          longitude: 0,
          members: [
            ...beacons,
            ...Array.from({ length: 25 }, (_, i) => ({
              id: `person:${i}`,
              kind: "person" as const,
              latitude: 0,
              longitude,
            })),
          ],
        },
        "swarm",
        {},
        new Set(),
      ),
    ).friendBadge!;
  assert.ok(badge(0.001).offset.x > 0);
  assert.ok(badge(-0.001).offset.x < 0);
});
for (const count of [2, 3, 4, 5, 6, 10, 11, 25])
  test(`${count} petals share a fixed contained circle on both renderers`, () => {
    const layout = clusterLayout(count);
    assert.equal(layout.size, count < 6 ? 72 : 88);
    for (let i = 0; i < beaconPetalLimit(count); i++) {
      const offset = clusterPetalOffset(i, beaconPetalLimit(count));
      assert.deepEqual(
        nativePetalOffset(i, false, beaconPetalLimit(count)),
        offset,
      );
      assert.ok(Math.hypot(offset.x, offset.y) + 16 <= layout.size / 2);
    }
    const offsets = Array.from({ length: beaconPetalLimit(count) }, (_, i) =>
      clusterPetalOffset(i, beaconPetalLimit(count)),
    );
    assert.ok(Math.abs(offsets.reduce((sum, p) => sum + p.x, 0)) < 1e-8);
    assert.ok(Math.abs(offsets.reduce((sum, p) => sum + p.y, 0)) < 1e-8);
    if (count === 2) assert.equal(offsets[0].x, -offsets[1].x);
    if (count === 3) assert.equal(new Set(offsets.map((p) => p.x)).size, 3);
    assert.equal(layout.shadowTop + layout.shadowSize, layout.size);
    assert.deepEqual(CLUSTER_COUNT_ANCHOR, { right: 0, bottom: 0 });
    assert.deepEqual(CLUSTER_OWNERSHIP_ANCHOR, { right: 0, top: 0 });
  });
test("keyed layers retain object identity and fresh callbacks, update only changed entries and remove filtered entities", () => {
  const cache = new KeyedMapLayers<object>(),
    removed: object[] = [],
    target = { removeLayer: (layer: object) => removed.push(layer) };
  let action = 0;
  cache.begin(target);
  const original = cache.use(
    "a",
    "v1",
    () => ({}),
    () => (action = 1),
  );
  const b = cache.use("b", "v1", () => ({}));
  cache.end();
  cache.begin(target);
  assert.equal(
    cache.use(
      "a",
      "v1",
      () => {
        throw Error("rebuilt");
      },
      () => (action = 2),
    ),
    original,
  );
  assert.equal(
    cache.use("b", "v1", () => ({})),
    b,
  );
  cache.end();
  cache.activate("a");
  assert.equal(action, 2);
  assert.equal(removed.length, 0);
  cache.begin(target);
  const changed = cache.use("a", "v2", () => ({}));
  cache.end();
  assert.notEqual(changed, original);
  assert.deepEqual(removed, [original, b]);
  cache.clear();
  assert.deepEqual(removed, [original, b, changed]);
});
test("spatial cache reuses grouping for reordered inputs and relevance changes but invalidates coordinates and eligibility", () => {
  const cache = new MapPresentationCache(),
    points: ClusterPoint[] = Array.from({ length: 10 }, (_, i) => ({
      id: `beacon:${i}`,
      kind: "beacon",
      category: "Social",
      latitude: 41.88,
      longitude: -87.64,
    }));
  const viewport = {
    centerLatitude: 41.88,
    centerLongitude: -87.64,
    zoom: 17,
    width: 390,
    height: 740,
  };
  const snapshot = structuredClone(points);
  const a = cache.select(points, viewport, "stack");
  assert.equal(cache.select([...points].reverse(), viewport, "stack"), a);
  assert.equal(cache.stats.spatialBuilds, 1);
  cache.select(points, viewport, "stack", { "beacon:1": { tier: 0 } });
  assert.equal(cache.stats.spatialBuilds, 1);
  cache.select(points.slice(1), viewport, "stack");
  assert.equal(cache.stats.spatialBuilds, 2);
  cache.select(
    points.map((p, i) => (i ? p : { ...p, latitude: 41.9 })),
    viewport,
    "stack",
  );
  assert.equal(cache.stats.spatialBuilds, 3);
  assert.deepEqual(points, snapshot);
});
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { ClusterArtworkCache } from "../src/features/maps/clusterArtwork";
test("artwork models remain stable for unrelated edits; name and clock changes do not dirty bitmaps", () => {
  const data = makeDemo(),
    now = Date.now(),
    cache = new ClusterArtworkCache();
  const profile = data.profiles[0],
    activity = data.activities[0];
  const points: ClusterPoint[] = [
    {
      id: `beacon:${activity.id}`,
      kind: "beacon",
      category: activity.category,
      latitude: 41.88,
      longitude: -87.64,
    },
    {
      id: `person:${profile.id}`,
      kind: "person",
      latitude: 41.88,
      longitude: -87.64,
    },
  ];
  const build = (
    activities = data.activities,
    profiles = data.profiles,
    clock = now,
  ) =>
    cache.build(
      points,
      activities,
      profiles,
      data.locations,
      data.activities,
      data,
      DEMO_ID,
      clock,
    );
  const first = build(),
    second = build();
  for (const point of points)
    assert.equal(first.get(point.id), second.get(point.id));
  const named = build(
    data.activities.map((a) =>
      a.id === activity.id ? { ...a, title: "Renamed" } : a,
    ),
  );
  assert.notEqual(named.get(points[0].id), first.get(points[0].id));
  assert.equal(
    named.get(points[0].id)?.visualRevision,
    first.get(points[0].id)?.visualRevision,
  );
  assert.equal(named.get(points[1].id), first.get(points[1].id));
  const avatar = build(
    undefined,
    data.profiles.map((p) =>
      p.id === profile.id ? { ...p, avatar_seed: (p.avatar_seed ?? 0) + 1 } : p,
    ),
  );
  assert.notEqual(
    avatar.get(points[1].id)?.visualRevision,
    first.get(points[1].id)?.visualRevision,
  );
});

test("shared clock changes update location accessibility without restarting bitmap tracking", () => {
  const data = makeDemo(),
    profile = data.profiles[0],
    now = Date.now();
  const points: ClusterPoint[] = [
    {
      id: `person:${profile.id}`,
      kind: "person",
      latitude: 41.88,
      longitude: -87.64,
    },
  ];
  const locations = [
    {
      ...data.locations[0],
      owner_id: profile.id,
      updated_at: new Date(now - 120_000).toISOString(),
    },
  ];
  const cache = new ClusterArtworkCache();
  const before = cache
    .build(points, [], [profile], locations, [], data, DEMO_ID, now)
    .get(points[0].id)!;
  const after = cache
    .build(points, [], [profile], locations, [], data, DEMO_ID, now + 60_000)
    .get(points[0].id)!;
  assert.notEqual(after.age, before.age);
  assert.notEqual(after.revision, before.revision);
  assert.equal(after.visualRevision, before.visualRevision);
});
