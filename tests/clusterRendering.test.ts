import assert from "node:assert/strict";
import test from "node:test";
import {
  friendSatelliteLimit,
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

test("badge totals, satellite collapse, and micro Friends mode are independent of preview overflow", () => {
  const make = (
    beacons: number,
    people: number,
    mode: "stack" | "swarm" | "atmosphere" | "micro" = "swarm",
    friendsProminent = false,
  ) =>
    nativePresentation(
      {
        id: "totals",
        latitude: 0,
        longitude: 0,
        members: [
          ...Array.from({ length: beacons }, (_, i) => ({
            id: `beacon:${i}`,
            kind: "beacon" as const,
            latitude: 0,
            longitude: 0,
          })),
          ...Array.from({ length: people }, (_, i) => ({
            id: `person:${i}`,
            kind: "person" as const,
            latitude: Math.sin(i) * 0.0001,
            longitude: Math.cos(i) * 0.0001,
          })),
        ],
      },
      mode,
      {},
      new Set(),
      friendsProminent,
    );
  const dense = make(40, 60),
    badge = bloomGeometry(dense).countBadge!;
  assert.equal(dense.overflow, 33);
  assert.equal(badge.beaconTotal, 40);
  assert.equal(badge.peopleCount, 60);
  assert.equal(badge.text, "👥 60 · ✦ 40");
  assert.deepEqual(badge.parts, [
    { kind: "friends", count: 60 },
    { kind: "beacons", count: 40 },
  ]);
  assert.equal(badge.activation, "cluster");
  assert.equal(dense.satellites.length, 0);
  const fitting = make(20, 5);
  assert.equal(fitting.satellites.length, 0);
  assert.deepEqual(bloomGeometry(fitting).countBadge?.parts, [
    { kind: "friends", count: 5 },
    { kind: "beacons", count: 20 },
  ]);
  assert.equal(bloomGeometry(make(40, 0)).countBadge?.text, "✦ 40");
  assert.equal(bloomGeometry(make(1, 0)).countBadge, undefined);
  assert.equal(bloomGeometry(make(2, 2)).countBadge, undefined);
  assert.equal(make(2, 2).satellites.length, 2);
  assert.equal(bloomGeometry(make(2, 25)).countBadge?.activation, "friends");
  const micro = bloomGeometry(make(40, 60, "micro")).countBadge!;
  assert.deepEqual(micro.parts, [{ kind: "beacons", count: 40 }]);
  assert.equal(micro.peopleCount, 60);
  assert.equal(micro.fontSize, 8);
  assert.equal(micro.height, 14);
  assert.deepEqual(
    bloomGeometry(make(40, 60, "micro", true)).countBadge?.parts,
    badge.parts,
  );
  assert.equal(
    bloomGeometry(make(2, 25, "micro")).countBadge?.activation,
    "expand",
  );
});

test("adaptive friend previews preserve Beacon geometry and keep totals when space is limited", () => {
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
      assert.ok(
        geometry.satellites.length <=
          friendSatelliteLimit(geometry.primary.length, item.scale),
      );
      assert.equal(
        geometry.satelliteOffsets.length,
        geometry.satellites.length,
      );
      assert.ok(
        geometry.satellites.length === 0 ||
          geometry.satellites.length === friends,
      );
      if (!geometry.satellites.length) {
        assert.ok(geometry.countBadge);
        assert.equal(geometry.countBadge.peopleCount, friends);
      } else assert.equal(geometry.countBadge?.peopleCount ?? 0, 0);
      for (const offset of geometry.satelliteOffsets) {
        if (geometry.countBadge) {
          const badge = geometry.countBadge;
          assert.ok(
            Math.abs(offset.x - badge.offset.x) >=
              (geometry.satelliteSize + badge.width) / 2 + 2 ||
              Math.abs(offset.y - badge.offset.y) >=
                (geometry.satelliteSize + badge.height) / 2 + 2,
          );
        }
      }
      for (let i = 0; i < geometry.satelliteOffsets.length; i++)
        for (let j = i + 1; j < geometry.satelliteOffsets.length; j++)
          assert.ok(
            Math.hypot(
              geometry.satelliteOffsets[i].x - geometry.satelliteOffsets[j].x,
              geometry.satelliteOffsets[i].y - geometry.satelliteOffsets[j].y,
            ) >=
              geometry.satelliteSize + 4,
          );
    }
});

test("unified totals stay bottom-right regardless of the friend bearing", () => {
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
    ).countBadge!;
  assert.deepEqual(badge(0.001), badge(-0.001));
  const combined = badge(0.001);
  assert.equal(combined.offset.x + combined.width / 2, 36);
  assert.ok(combined.offset.y > 0);
  assert.equal(combined.peopleCount, 25);
  assert.equal(combined.text, "👥 25 · ✦ 2");
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

test("satellite capacities follow 3/5/7 petals and disappear at distant zooms", () => {
  for (const [petals, limit] of [
    [1, 3],
    [2, 3],
    [3, 5],
    [5, 5],
    [6, 7],
    [7, 7],
  ]) {
    assert.equal(friendSatelliteLimit(petals, "close"), limit);
    assert.equal(friendSatelliteLimit(petals, "medium"), limit);
    assert.equal(friendSatelliteLimit(petals, "far"), 0);
    assert.equal(friendSatelliteLimit(petals, "micro"), 0);
  }
});
test("small Beacon shadows follow artwork rather than the empty cluster footprint", () => {
  for (const count of [1, 2])
    for (const mode of ["stack", "swarm", "atmosphere", "micro"] as const) {
      const members: ClusterPoint[] = Array.from({ length: count }, (_, i) => ({
        id: `beacon:${i}`,
        kind: "beacon",
        latitude: 0,
        longitude: 0,
      }));
      const presentation = nativePresentation(
        { id: "shadow", latitude: 0, longitude: 0, members },
        mode,
        {},
        new Set(),
      );
      const geometry = bloomGeometry(presentation);
      assert.ok(
        geometry.shadowSize <=
          clusterLayout(count, presentation.scale).shadowSize,
      );
      if (count === 1 || presentation.scale !== "micro")
        assert.ok(
          geometry.shadowSize <
            clusterLayout(count, presentation.scale).shadowSize,
        );
      assert.equal(
        geometry.shadowLeft + geometry.shadowSize / 2,
        geometry.center,
      );
      assert.equal(
        geometry.shadowTop + geometry.shadowSize / 2,
        geometry.center + 2,
      );
      assert.equal(bloomGeometry(presentation), geometry);
    }
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
  assert.ok(after.satellites.length < before.satellites.length);
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

test("satellite thresholds switch the entire friend set to a total, not just overflow", () => {
  for (const [beacons, limit] of [
    [2, 3],
    [3, 5],
    [6, 7],
  ])
    for (const people of [limit - 1, limit, limit + 1]) {
      const members: ClusterPoint[] = [
        ...Array.from({ length: beacons }, (_, i) => ({
          id: `beacon:${i}`,
          kind: "beacon" as const,
          latitude: 0,
          longitude: 0,
        })),
        ...Array.from({ length: people }, (_, i) => ({
          id: `person:${i}`,
          kind: "person" as const,
          latitude: Math.sin(i * 2.4) * 0.001,
          longitude: Math.cos(i * 2.4) * 0.001,
        })),
      ];
      const item = nativePresentation(
        { id: "threshold", latitude: 0, longitude: 0, members },
        "stack",
        {},
        new Set(),
      );
      const geometry = bloomGeometry(item);
      if (people <= limit) {
        assert.equal(
          geometry.satellites.length,
          people,
          `${beacons} Beacons / ${people} friends`,
        );
        assert.equal(geometry.countBadge, undefined);
      } else {
        assert.equal(geometry.satellites.length, 0);
        assert.equal(geometry.countBadge?.peopleCount, people);
        assert.equal(geometry.countBadge?.text, `👥 ${people} · ✦ ${beacons}`);
      }
    }
});
