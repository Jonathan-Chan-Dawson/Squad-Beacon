import assert from "node:assert/strict";
import test from "node:test";
import {
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
for (const count of [2, 5, 6, 10, 11, 25])
  test(`${count} petals share a fixed contained circle on both renderers`, () => {
    const layout = clusterLayout(count);
    assert.equal(layout.size, count < 6 ? 72 : 88);
    for (let i = 0; i < Math.min(count, 10); i++) {
      const offset = clusterPetalOffset(i, Math.min(count, 10));
      assert.deepEqual(
        nativePetalOffset(i, false, Math.min(count, 10)),
        offset,
      );
      assert.ok(Math.hypot(offset.x, offset.y) + 16 <= layout.size / 2);
    }
    assert.deepEqual(clusterPetalOffset(0, count), { x: 0, y: 0 });
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
