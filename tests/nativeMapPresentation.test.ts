import assert from "node:assert/strict";
import test from "node:test";
import {
  nativeMapMode,
  nativeMapPresentations,
  nativePresentation,
  nativeStackOpensExplorer,
  nativePetalOffset,
  nativePointOffset,
  nativeAtmosphereRadius,
} from "../src/features/maps/nativeMapPresentation";
import type { ClusterPoint, MapPointGroup } from "../src/features/maps/cluster";

const viewport = {
  centerLatitude: 41.885,
  centerLongitude: -87.642,
  zoom: 17,
  width: 390,
  height: 740,
};
function points(
  count: number,
  kind: "beacon" | "person" = "beacon",
): ClusterPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${kind}:${String(index).padStart(3, "0")}`,
    kind,
    latitude: viewport.centerLatitude,
    longitude: viewport.centerLongitude,
    category: "Social",
  }));
}
function group(members: ClusterPoint[]): MapPointGroup {
  return {
    id: "test",
    latitude: viewport.centerLatitude,
    longitude: viewport.centerLongitude,
    members,
  };
}

for (const count of [1, 2, 5, 6, 10, 11, 25]) {
  test(`${count} coincident items retain membership, preview capacity and correct tap policy`, () => {
    const original = points(count);
    const snapshot = structuredClone(original);
    const [item] = nativeMapPresentations(original, viewport, "stack");
    assert.equal(item.group.members.length, count);
    assert.equal(item.visible.length, Math.min(count, 10));
    assert.equal(item.overflow, Math.max(0, count - 10));
    assert.equal(nativeStackOpensExplorer(count), count >= 6);
    assert.equal(item.mode, "stack");
    assert.deepEqual(original, snapshot);
    assert.deepEqual(
      item.group.members.map((p) => [p.latitude, p.longitude]),
      original.map((p) => [p.latitude, p.longitude]),
    );
  });
}

test("deduplication counts entity IDs, not owners or coordinates", () => {
  const input = [...points(10), ...points(10), ...points(3, "person")];
  const [item] = nativeMapPresentations(input, viewport, "stack");
  assert.equal(item.group.members.length, 13);
  assert.equal(item.overflow, 3);
  assert.deepEqual(
    nativeMapPresentations([...input].reverse(), viewport, "stack"),
    [item],
  );
});

test("priority puts selected first, ownership next, friends next, then existing relevance", () => {
  const members = [...points(14), ...points(2, "person")];
  const priorities = { "beacon:013": { tier: -3 }, "beacon:012": { tier: 0 } };
  const result = nativePresentation(
    group(members),
    "stack",
    priorities,
    new Set(["beacon:011"]),
  );
  assert.deepEqual(
    result.visible.slice(0, 4).map((p) => p.id),
    ["beacon:013", "beacon:011", "person:000", "person:001"],
  );
  assert.equal(result.owned[0].id, "beacon:011");
  assert.equal(result.overflow, 6);
  assert.deepEqual(
    nativePresentation(
      group([...members].reverse()),
      "stack",
      priorities,
      new Set(["beacon:011"]),
    ).visible,
    result.visible,
  );
});

test("zoom transitions retain modes in both hysteresis buffers", () => {
  assert.equal(nativeMapMode(16), "stack");
  assert.equal(nativeMapMode(12), "swarm");
  assert.equal(nativeMapMode(11), "atmosphere");
  assert.equal(nativeMapMode(15.7, "stack"), "stack");
  assert.equal(nativeMapMode(15.6, "stack"), "swarm");
  assert.equal(nativeMapMode(16.3, "swarm"), "swarm");
  assert.equal(nativeMapMode(16.4, "swarm"), "stack");
  assert.equal(nativeMapMode(11.7, "swarm"), "swarm");
  assert.equal(nativeMapMode(11.6, "swarm"), "atmosphere");
  assert.equal(nativeMapMode(12.3, "atmosphere"), "atmosphere");
  assert.equal(nativeMapMode(12.4, "atmosphere"), "swarm");
});

test("sparse groups remain stacks; six Beacons qualify for geographic summaries", () => {
  for (const mode of ["swarm", "atmosphere"] as const) {
    assert.equal(
      nativeMapPresentations(points(5), { ...viewport, zoom: 11 }, mode)[0]
        .mode,
      "stack",
    );
    assert.equal(
      nativeMapPresentations(points(6), { ...viewport, zoom: 11 }, mode)[0]
        .mode,
      mode,
    );
    const mixed = nativeMapPresentations(
      [...points(5), ...points(30, "person")],
      { ...viewport, zoom: 11 },
      mode,
    );
    assert.ok(mixed.every((item) => item.mode === "stack"));
  }
});

test("friend positions never change Beacon density geometry or membership", () => {
  const beacons = points(7);
  const base = nativeMapPresentations(
    beacons,
    { ...viewport, zoom: 11 },
    "atmosphere",
  );
  const mixed = nativeMapPresentations(
    [...beacons, ...points(20, "person")],
    { ...viewport, zoom: 11 },
    "atmosphere",
  );
  assert.deepEqual(
    mixed.filter((item) => item.mode === "atmosphere"),
    base,
  );
  assert.ok(
    mixed
      .filter((item) => item.group.members.some((p) => p.kind === "person"))
      .every((item) => item.mode === "stack"),
  );
});

test("only supplied eligible points contribute; removing an entity updates count and ownership", () => {
  const eligible = points(12);
  const ownedIds = new Set(["beacon:011"]);
  const [before] = nativeMapPresentations(
    eligible,
    viewport,
    "stack",
    {},
    ownedIds,
  );
  const [after] = nativeMapPresentations(
    eligible.slice(0, 5),
    viewport,
    "stack",
    {},
    ownedIds,
  );
  assert.equal(before.overflow, 2);
  assert.equal(before.owned.length, 1);
  assert.equal(after.overflow, 0);
  assert.equal(after.owned.length, 0);
  assert.equal(nativeMapPresentations([], viewport, "atmosphere").length, 0);
});

test("expanded petals provide nonoverlapping 58 by 56 touch rectangles", () => {
  const offsets = Array.from({ length: 5 }, (_, index) =>
    nativePetalOffset(index, true),
  );
  for (let a = 0; a < offsets.length; a++)
    for (let b = a + 1; b < offsets.length; b++)
      assert.ok(
        Math.abs(offsets[a].x - offsets[b].x) >= 58 ||
          Math.abs(offsets[a].y - offsets[b].y) >= 56,
      );
  assert.deepEqual(nativePetalOffset(1), nativePetalOffset(1));
});

test("swarm offsets follow real distribution and wrap the date line", () => {
  const center = { ...group([]), latitude: 0, longitude: 179.99 };
  const point = { ...points(1)[0], latitude: 0, longitude: -179.99 };
  assert.ok(nativePointOffset(point, center, 12).x > 0);
  assert.ok(nativePointOffset(point, center, 12).x < 100);
  assert.equal(nativePointOffset(point, center, 12).y, 0);
  assert.ok(nativeAtmosphereRadius({ ...center, members: [point] }) < 3000);
});

test("native feature budget includes feather layers and ownership anchors", () => {
  const input = Array.from({ length: 2400 }, (_, index) => ({
    ...points(1)[0],
    id: `beacon:${index}`,
    latitude: 38 + (index % 40) * 0.2,
    longitude: -92 + Math.floor(index / 40) * 0.2,
  }));
  const originalIds = new Set(input.map((point) => point.id));
  const result = nativeMapPresentations(
    input,
    { ...viewport, zoom: 5, width: 2000, height: 2000 },
    "atmosphere",
    {},
    originalIds,
  );
  assert.ok(result.reduce((sum, item) => sum + item.featureCost, 0) <= 150);
  assert.deepEqual(
    new Set(result.flatMap((item) => item.group.members.map((p) => p.id))),
    originalIds,
  );
});

test("small pans and unrelated changes preserve a stack's visible representatives", () => {
  const input = points(14);
  const [before] = nativeMapPresentations(input, viewport, "stack");
  const [after] = nativeMapPresentations(
    [...input].reverse(),
    {
      ...viewport,
      centerLongitude: viewport.centerLongitude + 0.00001,
    },
    "stack",
  );
  assert.equal(before.group.id, after.group.id);
  assert.deepEqual(
    before.visible.map((p) => p.id),
    after.visible.map((p) => p.id),
  );
});

test("selected markers retain exact coordinates and invalid or offscreen selections are excluded", () => {
  const input = points(3);
  const priority = { "beacon:001": { tier: -3 } };
  const result = nativeMapPresentations(input, viewport, "stack", priority);
  const selected = result.find(
    (item) => item.group.members[0].id === "beacon:001",
  );
  assert.equal(selected?.group.members.length, 1);
  assert.equal(selected?.group.latitude, input[1].latitude);
  assert.equal(selected?.group.longitude, input[1].longitude);
  assert.equal(
    nativeMapPresentations(
      [{ ...input[1], latitude: NaN }],
      viewport,
      "stack",
      priority,
    ).length,
    0,
  );
  assert.equal(
    nativeMapPresentations(
      [{ ...input[1], latitude: 0 }],
      viewport,
      "stack",
      priority,
    ).length,
    0,
  );
});

test("budget pressure permits close-zoom swarms without dropping any items", () => {
  const input = Array.from({ length: 180 }, (_, index) => ({
    ...points(1)[0],
    id: `beacon:${index}`,
    latitude: viewport.centerLatitude + Math.floor(index / 15) * 0.00008,
    longitude: viewport.centerLongitude + (index % 15) * 0.00008,
  }));
  const result = nativeMapPresentations(
    input,
    viewport,
    "stack",
    {},
    new Set(),
    10,
  );
  assert.ok(result.reduce((sum, item) => sum + item.featureCost, 0) <= 10);
  assert.ok(result.some((item) => item.mode === "swarm"));
  assert.equal(
    result.flatMap((item) => item.group.members).length,
    input.length,
  );
});
