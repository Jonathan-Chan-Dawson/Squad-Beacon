import assert from "node:assert/strict";
import { bloomGeometry } from "../src/features/maps/clusterBloom";
import test from "node:test";
import {
  presentationOpensExplorer,
  presentationArtworkPoints,
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
    assert.equal(item.visible.length, count <= 5 ? count : count <= 10 ? 6 : 7);
    assert.equal(
      item.overflow,
      count - (count <= 5 ? count : count <= 10 ? 6 : 7),
    );
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
  assert.equal(item.overflow, 4);
  assert.equal(item.people.length, 3);
  assert.deepEqual(
    nativeMapPresentations([...input].reverse(), viewport, "stack"),
    [item],
  );
});

test("priority puts selected, owned and joined Beacons before category variety and separate satellites", () => {
  const members = [...points(14), ...points(2, "person")];
  const priorities = { "beacon:013": { tier: -3 }, "beacon:012": { tier: 0 } };
  const result = nativePresentation(
    group(members),
    "stack",
    priorities,
    new Set(["beacon:011"]),
  );
  assert.deepEqual(
    result.visible.slice(0, 3).map((p) => p.id),
    ["beacon:013", "beacon:011", "beacon:012"],
  );
  assert.equal(result.owned[0].id, "beacon:011");
  assert.equal(result.overflow, 7);
  assert.equal(result.satellites.length, 0);
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
  assert.equal(nativeMapMode(8), "micro");
  assert.equal(nativeMapMode(8.7, "atmosphere"), "atmosphere");
  assert.equal(nativeMapMode(8.6, "atmosphere"), "micro");
  assert.equal(nativeMapMode(9.3, "micro"), "micro");
  assert.equal(nativeMapMode(9.4, "micro"), "atmosphere");
  assert.equal(nativeMapMode(15.7, "stack"), "stack");
  assert.equal(nativeMapMode(15.6, "stack"), "swarm");
  assert.equal(nativeMapMode(16.3, "swarm"), "swarm");
  assert.equal(nativeMapMode(16.4, "swarm"), "stack");
  assert.equal(nativeMapMode(11.7, "swarm"), "swarm");
  assert.equal(nativeMapMode(11.6, "swarm"), "atmosphere");
  assert.equal(nativeMapMode(12.3, "atmosphere"), "atmosphere");
  assert.equal(nativeMapMode(12.4, "atmosphere"), "swarm");
});

test("all groups use their requested zoom tier and actual nearby friends never move a Beacon anchor", () => {
  for (const [mode, zoom, visible] of [
    ["swarm", 14, 5],
    ["atmosphere", 10, 3],
    ["micro", 7, 2],
  ] as const) {
    const camera = { ...viewport, zoom };
    const [base] = nativeMapPresentations(points(5), camera, mode);
    const input = [...points(5), ...points(11, "person")];
    const snapshot = structuredClone(input);
    const [mixed] = nativeMapPresentations(input, camera, mode);
    assert.equal(mixed.mode, mode);
    assert.equal(mixed.beacons.length, 5);
    assert.equal(
      mixed.visible.filter((p) => p.kind === "beacon").length,
      visible,
    );
    assert.equal(mixed.overflow, 5 - visible);
    assert.equal(mixed.people.length, 11);
    assert.ok(
      mixed.satellites.length <=
        (mode === "micro" ? 1 : mode === "atmosphere" ? 3 : 5),
    );
    assert.equal(mixed.friendOverflow, 11 - mixed.satellites.length);
    assert.equal(mixed.group.latitude, base.group.latitude);
    assert.equal(mixed.group.longitude, base.group.longitude);
    assert.equal(mixed.group.id, base.group.id);
    assert.deepEqual(input, snapshot);
    assert.equal(presentationOpensExplorer(mixed), true);
  }
});

test("20 Beacons and 11 friends show seven petals and one combined total with no satellites", () => {
  const [item] = nativeMapPresentations(
    [...points(20), ...points(11, "person")],
    { ...viewport, zoom: 14 },
    "swarm",
  );
  assert.equal(item.overflow, 13);
  assert.equal(item.people.length, 11);
  assert.equal(item.satellites.length, 0);
  assert.equal(bloomGeometry(item).countBadge?.text, "👥 11 · ✦ 20");
  assert.equal(item.friendOverflow, 11);
  assert.equal(item.featureCost, 8);
  assert.equal(item.visible.filter((p) => p.kind === "beacon").length, 7);
  assert.equal(presentationOpensExplorer(item), true);
});

test("friends outside collision distance stay separate; Friends filter only changes prominence", () => {
  const input = [
    ...points(3),
    ...points(4, "person").map((p) => ({
      ...p,
      longitude: p.longitude + 0.01,
    })),
  ];
  const camera = { ...viewport, zoom: 14 };
  const regular = nativeMapPresentations(input, camera, "swarm");
  const prominent = nativeMapPresentations(
    input,
    camera,
    "swarm",
    {},
    new Set(),
    150,
    true,
  );
  assert.ok(
    regular.some(
      (item) => item.beacons.length === 3 && item.people.length === 0,
    ),
  );
  assert.ok(
    regular.some(
      (item) => item.beacons.length === 0 && item.people.length === 4,
    ),
  );
  assert.deepEqual(
    regular.map((item) => item.group),
    prominent.map((item) => item.group),
  );
});

test("friend-only groups use mini petals for two to four and compact totals for five or more", () => {
  for (const count of [2, 3, 4, 5, 11]) {
    const [item] = nativeMapPresentations(
      points(count, "person"),
      viewport,
      "swarm",
    );
    assert.equal(item.beacons.length, 0);
    assert.equal(item.people.length, count);
    assert.equal(item.overflow, 0);
    assert.equal(item.friendOverflow, count >= 5 ? count : 0);
    assert.equal(item.visible.length, count < 5 ? count : 0);
    assert.equal(presentationOpensExplorer(item), true);
  }
});

test("compact far-zoom groups retain all IDs while drawing only their previews", () => {
  const beaconItem = nativePresentation(
    group([...points(5), ...points(11, "person")]),
    "micro",
    {},
    new Set(),
  );
  assert.equal(
    beaconItem.visible.filter((point) => point.kind === "beacon").length,
    2,
  );
  assert.equal(
    presentationArtworkPoints(beaconItem).filter(
      (point) => point.kind === "beacon",
    ).length,
    2,
  );
  const friendItem = nativePresentation(
    group(points(4, "person")),
    "micro",
    {},
    new Set(),
  );
  assert.equal(friendItem.visible.length, 0);
  assert.equal(presentationArtworkPoints(friendItem).length, 0);
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
  assert.equal(before.overflow, 5);
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

test("feature budget includes petals, satellites and separate count badges", () => {
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

test("dense neighboring blooms reserve friend decorations while a separate friend group stays independent", () => {
  const unit = 360 / (256 * 2 ** 17);
  const beacon = (id: string, x: number): ClusterPoint => ({
    id: `beacon:${id}`,
    kind: "beacon",
    latitude: 0,
    longitude: x * unit,
  });
  const person = (id: string, x: number, y = 0): ClusterPoint => ({
    id: `person:${id}`,
    kind: "person",
    latitude: -y * unit,
    longitude: x * unit,
  });
  const input = [
    ...Array.from({ length: 6 }, (_, i) => beacon(`left${i}`, -100)),
    ...Array.from({ length: 6 }, (_, i) => beacon(`right${i}`, 0)),
    ...Array.from({ length: 7 }, (_, i) => person(`left${i}`, -100)),
    ...Array.from({ length: 7 }, (_, i) => person(`right${i}`, 0)),
    ...Array.from({ length: 8 }, (_, i) => person(`separate${i}`, 120, 120)),
  ];
  const snapshot = structuredClone(input);
  const result = nativeMapPresentations(
    input,
    {
      centerLatitude: 0,
      centerLongitude: 0,
      zoom: 17,
      width: 375,
      height: 812,
    },
    "stack",
  );
  assert.equal(result.length, 3);
  assert.equal(
    result.filter(
      (item) => item.beacons.length === 0 && item.people.length === 8,
    ).length,
    1,
  );
  for (const item of result.filter((item) => item.beacons.length > 0)) {
    const geometry = bloomGeometry(item);
    assert.ok(item.decorationObstacles?.length);
    const marks = geometry.satelliteOffsets.map((point) => ({
      ...point,
      width: geometry.satelliteSize,
      height: geometry.satelliteSize,
    }));
    if (geometry.countBadge)
      marks.push({
        ...geometry.countBadge.offset,
        width: geometry.countBadge.width,
        height: geometry.countBadge.height,
      });
    for (const mark of marks)
      for (const obstacle of item.decorationObstacles!)
        assert.ok(
          Math.abs(mark.x - obstacle.x) >=
            (mark.width + obstacle.width) / 2 + 2 - 1e-7 ||
            Math.abs(mark.y - obstacle.y) >=
              (mark.height + obstacle.height) / 2 + 2 - 1e-7,
        );
  }
  assert.deepEqual(input, snapshot);
});

test("far tiers group loose Beacons, retain every authorized member, and never render friend rings", () => {
  const camera = {
    centerLatitude: 0,
    centerLongitude: 0,
    zoom: 10,
    width: 375,
    height: 740,
  };
  const input: ClusterPoint[] = [
    {
      id: "beacon:a",
      kind: "beacon",
      latitude: 0,
      longitude: (-54 * 360) / (256 * 2 ** 10),
    },
    {
      id: "beacon:b",
      kind: "beacon",
      latitude: 0,
      longitude: (54 * 360) / (256 * 2 ** 10),
    },
  ];
  const grouped = nativeMapPresentations(input, camera, "atmosphere");
  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped.map(item => item.group.longitude).sort(), input.map(point => point.longitude).sort());
  const selected = nativeMapPresentations(input, camera, "atmosphere", {
    "beacon:a": { tier: -3 },
  });
  assert.equal(
    selected.find((item) => item.group.members[0].id === "beacon:a")?.scale,
    "close",
  );
  for (const mode of ["atmosphere", "micro"] as const) {
    const item = nativePresentation(
      group([...points(20), ...points(3, "person")]),
      mode,
      {},
      new Set(),
    );
    const geometry = bloomGeometry(item);
    assert.equal(geometry.satellites.length, 0);
    assert.equal(geometry.countBadge?.peopleCount, 3);
    assert.equal(geometry.countBadge?.beaconTotal, 20);
    const friends = nativePresentation(
      group(points(3, "person")),
      mode,
      {},
      new Set(),
    );
    assert.equal(friends.visible.length, 0);
    assert.equal(presentationArtworkPoints(friends).length, 0);
    assert.equal(presentationOpensExplorer(friends), true);
  }
});
