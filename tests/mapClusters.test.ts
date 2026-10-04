import assert from "node:assert/strict";
import test from "node:test";
import {
  clusterMapPoints,
  markerVisualSize,
} from "../src/features/maps/cluster";

const viewport = {
  centerLatitude: 41.885,
  centerLongitude: -87.642,
  zoom: 12,
  width: 390,
  height: 740,
};

test("clusters nearby Beacons and people in stable member order", () => {
  const points = [
    {
      id: "person:b",
      kind: "person" as const,
      latitude: 41.885,
      longitude: -87.642,
    },
    {
      id: "beacon:a",
      kind: "beacon" as const,
      latitude: 41.8852,
      longitude: -87.6421,
    },
  ];
  const first = clusterMapPoints(points, viewport);
  const reversed = clusterMapPoints([...points].reverse(), viewport);
  assert.equal(first.length, 1);
  assert.deepEqual(
    first[0].members.map((point) => point.id),
    ["beacon:a", "person:b"],
  );
  assert.equal(first[0].id, reversed[0].id);
});

test("screen-space groups split as zoom increases", () => {
  const points = [
    {
      id: "beacon:a",
      kind: "beacon" as const,
      latitude: 41.885,
      longitude: -87.642,
    },
    {
      id: "beacon:b",
      kind: "beacon" as const,
      latitude: 41.885,
      longitude: -87.6412,
    },
  ];
  assert.equal(clusterMapPoints(points, viewport)[0].members.length, 2);
  assert.equal(clusterMapPoints(points, { ...viewport, zoom: 17 }).length, 2);
});

test("projection wraps the date line and rejects invalid coordinates", () => {
  const points = [
    {
      id: "person:east",
      kind: "person" as const,
      latitude: 0,
      longitude: 179.999,
    },
    {
      id: "person:west",
      kind: "person" as const,
      latitude: 0,
      longitude: -179.999,
    },
    {
      id: "person:bad",
      kind: "person" as const,
      latitude: Number.NaN,
      longitude: 0,
    },
  ];
  const groups = clusterMapPoints(points, {
    centerLatitude: 0,
    centerLongitude: 180,
    zoom: 14,
    width: 390,
    height: 740,
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].members.length, 2);
});

test("marker visuals scale with zoom while keeping type hierarchy", () => {
  assert.deepEqual(
    [markerVisualSize("beacon", 12), markerVisualSize("beacon", 17)],
    [28, 36],
  );
  assert.deepEqual(
    [markerVisualSize("person", 12), markerVisualSize("person", 17)],
    [22, 30],
  );
  assert.ok(markerVisualSize("beacon", 15) > markerVisualSize("person", 15));
});
