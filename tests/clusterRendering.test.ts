import assert from "node:assert/strict";
import test from "node:test";
import {
  beaconPetalLimit,
  clusterLayout,
  clusterPetalOffset,
  CLUSTER_OWNERSHIP_ANCHOR,
} from "../src/features/maps/clusterLayout";
import { KeyedMapLayers } from "../src/features/maps/keyedMapLayers";
import {
  MapPresentationCache,
  nativePetalOffset,
} from "../src/features/maps/nativeMapPresentation";
import type { ClusterPoint } from "../src/features/maps/cluster";
import {
  bloomGeometry,
  stellarDiameter,
  petalBookmarkVisible,
} from "../src/features/maps/clusterBloom";
import { nativePresentation } from "../src/features/maps/nativeMapPresentation";

test("mixed pills retain both totals at every zoom, including when peeks fit", () => {
  const anchor = { latitude: 41.885, longitude: -87.642 };
  const members: ClusterPoint[] = [
    { ...anchor, id: "beacon:coffee", kind: "beacon", category: "Social" },
    ...Array.from({ length: 12 }, (_, index) => ({ ...anchor, id: `person:${index}`, kind: "person" as const })),
  ];
  for (const mode of ["stack", "swarm", "atmosphere", "micro"] as const) {
    const item = nativePresentation({ ...anchor, id: "mixed", members }, mode, {}, new Set());
    const geometry = bloomGeometry(item);
    assert.equal(geometry.countBadge?.text, "👥 12 · ✦ 1");
    assert.equal(geometry.countBadge?.activation, "cluster");
    assert.equal(geometry.satellites.length, geometry.distant ? 0 : 2);
    if (geometry.distant) {
      assert.equal(geometry.primary.length, 0);
      assert.equal(geometry.shadowSize, 0);
    }
    const singleton = nativePresentation({ ...anchor, id: "single", members: members.slice(0, 1) }, mode, {}, new Set());
    assert.equal(bloomGeometry(singleton).countBadge, undefined);
  }
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

test("city and regional constellations use stable integrated facet budgets", () => {
  const anchor = { latitude: 41.885, longitude: -87.642 };
  const categories = ["Social", "Social", "Creative", "Fitness", "Study"] as const;
  const members: ClusterPoint[] = categories.map((category, index) => ({
    ...anchor, category, id: `beacon:${index}`, kind: "beacon",
  }));
  const render = (mode: "micro" | "atmosphere", input: ClusterPoint[]) =>
    bloomGeometry(nativePresentation({ ...anchor, id: "constellation", members: input }, mode, {}, new Set())).signal;
  assert.equal(render("atmosphere", members)?.facets, 3);
  assert.equal(render("micro", members)?.facets, 2);
  assert.deepEqual(render("atmosphere", members.map((point, index) => ({
    ...point, longitude: point.longitude + index * 0.01,
  })).reverse()), render("atmosphere", members));
});

test("stellar sizes grow smoothly within the footprint cap", () => {
  const sizes = [2, 5, 15, 30, 100, 500, 1000, 10000].map(stellarDiameter);
  assert.equal(sizes[0], 18);
  assert.equal(sizes.at(-1), 56);
  assert.ok(sizes.every((size, index) => !index || size >= sizes[index - 1]));
});
test("city adapts small mixed groups between petals and a star", () => {
  const anchor = { latitude: 0, longitude: 0 };
  const members: ClusterPoint[] = [
    { ...anchor, id: "beacon:1", kind: "beacon" },
    { ...anchor, id: "beacon:2", kind: "beacon" },
    { ...anchor, id: "person:1", kind: "person" },
  ];
  const base = nativePresentation({ ...anchor, id: "city", members }, "atmosphere", {}, new Set());
  const petals = bloomGeometry({ ...base, allowCityPetals: true });
  assert.equal(petals.primary.length, 2);
  assert.ok(petals.satellites.length <= 1);
  assert.equal(petals.signal, undefined);
  const stellar = bloomGeometry({ ...base, allowCityPetals: false });
  assert.equal(stellar.primary.length, 0);
  assert.ok(stellar.signal);
  assert.equal(stellar.countBadge?.text, petals.countBadge?.text);
  const crowded = bloomGeometry({
    ...base,
    allowCityPetals: true,
    decorationObstacles: [{ x: 0, y: 0, width: 64, height: 20 }],
  });
  assert.equal(crowded.distant, true);
  assert.equal(crowded.countBadge?.text, petals.countBadge?.text);
});

test("nearby artwork reduces satellites without shifting petals or mutating authorized locations", () => {
  const members: ClusterPoint[] = [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `beacon:${i}`,
      kind: "beacon" as const,
      latitude: 0,
      longitude: 0,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `person:${i}`,
      kind: "person" as const,
      latitude: 0,
      longitude: 0,
    })),
  ];
  const snapshot = structuredClone(members),
    item = nativePresentation(
      { id: "tight", latitude: 0, longitude: 0, members },
      "stack",
      {},
      new Set(),
    );
  const before = bloomGeometry(item);
  item.decorationObstacles = [
    { x: 0, y: -44, width: 130, height: 24 },
    { x: -44, y: 0, width: 24, height: 130 },
    { x: 44, y: 0, width: 24, height: 130 },
  ];
  const after = bloomGeometry(item);
  assert.notEqual(before, after);
  assert.deepEqual(before.offsets, after.offsets);
  assert.ok(after.satellites.length <= before.satellites.length);
  assert.ok(after.countBadge);
  for (const point of after.satelliteOffsets)
    for (const obstacle of item.decorationObstacles)
      assert.ok(
        Math.abs(point.x - obstacle.x) >=
          (after.satelliteSize + obstacle.width) / 2 + 2 ||
          Math.abs(point.y - obstacle.y) >=
            (after.satelliteSize + obstacle.height) / 2 + 2,
      );
  assert.deepEqual(members, snapshot);
});

test("saved petal decorations yield to crowded artwork without changing the cluster footprint", () => {
  const base = {
    id: "readability",
    latitude: 41.88,
    longitude: -87.64,
    members: [
      {
        id: "beacon:one",
        kind: "beacon" as const,
        latitude: 41.88,
        longitude: -87.64,
      },
    ],
  };
  const geometry = bloomGeometry(
    nativePresentation(base, "stack", {}, new Set()),
  );
  const before = structuredClone(geometry);
  assert.equal(petalBookmarkVisible(geometry, 0), true);
  assert.equal(petalBookmarkVisible({ ...geometry, markerSize: 18 }, 0), false);
  // A neighboring category face or friend satellite occupies the Bookmark corner.
  const corner = {
    x: geometry.offsets[0].x + geometry.markerSize * 0.4,
    y: geometry.offsets[0].y - geometry.markerSize * 0.35,
  };
  assert.equal(
    petalBookmarkVisible(
      { ...geometry, offsets: [...geometry.offsets, corner] },
      0,
    ),
    false,
  );
  assert.equal(
    petalBookmarkVisible(
      { ...geometry, satelliteOffsets: [corner], satelliteSize: 10 },
      0,
    ),
    false,
  );
  assert.deepEqual(geometry, before);
});
