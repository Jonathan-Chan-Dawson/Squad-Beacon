import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clusterPreviewOverflow,
  clusterMapPoints,
  clusterCategoryMix,
  clusterBounds,
  markerVisualSize,
  rankClusterMembers,
} from "../src/features/maps/cluster";
import { physicalDirectionsUrl } from "../src/features/maps/directions";
import { deriveMapPointPriorities } from "../src/features/maps/relevance";
import { makeDemo } from "@/src/shared/demo";

const viewport = {
  centerLatitude: 41.885,
  centerLongitude: -87.642,
  zoom: 12,
  width: 390,
  height: 740,
};

test("native MapView receives current padding only after onMapReady", () => {
  const source = readFileSync(
    new URL(
      "../src/features/maps/components/BeaconMap.native.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const mapViewTag = source.match(/^\s*<MapView\s*\n[\s\S]*?^\s*>/m)?.[0];
  assert.ok(mapViewTag, "native MapView JSX is present");
  assert.match(source, /const \[ready, setReady\] = useState\(false\);/);
  assert.match(mapViewTag, /onMapReady=\{\(\) => setReady\(true\)\}/);
  assert.match(mapViewTag, /\{\.\.\.\(ready \? \{ mapPadding \} : \{\}\)\}/);
  assert.doesNotMatch(mapViewTag, /\bmapPadding\s*=/);

  const paddingCalculation = source.match(
    /const mapPadding = \{([\s\S]*?)\n  \};/,
  )?.[1];
  assert.ok(
    paddingCalculation,
    "map padding is derived from live render props",
  );
  assert.match(paddingCalculation, /top:\s*viewportInsets\?\.top/);
  assert.match(paddingCalculation, /right:\s*viewportInsets\?\.right/);
  assert.match(paddingCalculation, /bottom:\s*viewportInsets\?\.bottom/);
  assert.match(paddingCalculation, /left:\s*viewportInsets\?\.left/);
});

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

test("date-line view returns both separated singleton points", () => {
  const groups = clusterMapPoints(
    [
      {
        id: "beacon:east",
        kind: "beacon",
        latitude: 0,
        longitude: 179.95,
      },
      {
        id: "beacon:west",
        kind: "beacon",
        latitude: 0,
        longitude: -179.95,
      },
    ],
    {
      centerLatitude: 0,
      centerLongitude: 180,
      zoom: 11,
      width: 390,
      height: 740,
    },
  );
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.flatMap((group) => group.members.map((member) => member.id)).sort(),
    ["beacon:east", "beacon:west"],
  );
});

test("map clustering returns only points inside the visible bounds", () => {
  const groups = clusterMapPoints(
    [
      { id: "beacon:visible", kind: "beacon", latitude: 0, longitude: 0 },
      { id: "beacon:outside", kind: "beacon", latitude: 0, longitude: 1 },
    ],
    {
      centerLatitude: 0,
      centerLongitude: 0,
      zoom: 10,
      width: 390,
      height: 740,
    },
  );
  assert.deepEqual(
    groups.flatMap((group) => group.members.map((member) => member.id)),
    ["beacon:visible"],
  );
});

test("marker visuals keep the fixed activity and friend sizes", () => {
  assert.deepEqual(
    [markerVisualSize("beacon", 12), markerVisualSize("beacon", 17)],
    [40, 40],
  );
  assert.deepEqual(
    [markerVisualSize("person", 12), markerVisualSize("person", 17)],
    [36, 36],
  );
  assert.ok(markerVisualSize("beacon", 15) > markerVisualSize("person", 15));
});

test("Supercluster caps rendered groups while retaining all visible members", () => {
  const points = Array.from({ length: 420 }, (_, index) => ({
    id: `beacon:${index}`,
    kind: "beacon" as const,
    latitude: -78 + (index % 20) * 8.2,
    longitude: -179 + (Math.floor(index / 20) % 21) * 17.8,
    category: (
      ["Fitness", "Study", "Gaming", "Creative", "Social", "Other"] as const
    )[index % 6],
  }));
  const groups = clusterMapPoints(points, {
    centerLatitude: 0,
    centerLongitude: 0,
    zoom: 0,
    width: 1400,
    height: 1000,
  });
  assert.ok(groups.length <= 150);
  assert.equal(
    groups.reduce((count, group) => count + group.members.length, 0),
    points.length,
  );
  assert.equal(
    new Set(groups.flatMap((group) => group.members.map((point) => point.id)))
      .size,
    points.length,
  );
});

test("cluster mix counts Beacon categories and people as separate ring segments", () => {
  const mix = clusterCategoryMix([
    {
      id: "beacon:a",
      kind: "beacon",
      latitude: 0,
      longitude: 0,
      category: "Fitness",
    },
    {
      id: "beacon:b",
      kind: "beacon",
      latitude: 0,
      longitude: 0,
      category: "Fitness",
    },
    {
      id: "beacon:c",
      kind: "beacon",
      latitude: 0,
      longitude: 0,
      category: "Study",
    },
    { id: "person:d", kind: "person", latitude: 0, longitude: 0 },
  ]);
  assert.deepEqual(mix, [
    { category: "Fitness", count: 2 },
    { category: "Study", count: 1 },
    { category: "People", count: 1 },
  ]);
});

test("cluster bounds use the narrow arc across the antimeridian", () => {
  const bounds = clusterBounds([
    { id: "beacon:east", kind: "beacon", latitude: 1, longitude: 179.99 },
    { id: "beacon:west", kind: "beacon", latitude: 2, longitude: -179.99 },
  ]);
  assert.ok(bounds);
  assert.ok(bounds.longitudeSpan < 0.03);
  assert.ok(Math.abs(Math.abs(bounds.centerLongitude) - 180) < 0.02);
});

test("cluster previews rank real items by relevance and report overflow", () => {
  const members = [
    { id: "beacon:other", kind: "beacon" as const, latitude: 0, longitude: 0 },
    {
      id: "person:starred",
      kind: "person" as const,
      latitude: 0,
      longitude: 0,
    },
    { id: "beacon:joined", kind: "beacon" as const, latitude: 0, longitude: 0 },
    { id: "beacon:busy", kind: "beacon" as const, latitude: 0, longitude: 0 },
  ];
  const priorities = {
    "beacon:joined": { tier: 0, attendance: 2 },
    "person:starred": { tier: 1, attendance: 0 },
    "beacon:busy": { tier: 4, attendance: 18 },
    "beacon:other": { tier: 7, attendance: 1 },
  };
  assert.deepEqual(
    rankClusterMembers(members, priorities).map((member) => member.id),
    ["beacon:joined", "person:starred", "beacon:busy", "beacon:other"],
  );
  assert.equal(clusterPreviewOverflow(2), 0);
  assert.equal(clusterPreviewOverflow(4), 1);
});

test("map relevance derives joined, starred, available, and nearby ranks centrally", () => {
  const data = makeDemo();
  const viewer = data.viewer_id ?? "demo-you";
  const now = Date.now();
  const future = new Date(now + 30 * 60 * 1000).toISOString();
  data.activities = data.activities.map((activity, index) =>
    index === 0 ? { ...activity, id: "joined", starts_at: future } : activity,
  );
  data.rsvps.push({
    activity_id: "joined",
    user_id: viewer,
    status: "going",
    approved: true,
  });
  const priorities = deriveMapPointPriorities(
    data,
    viewer,
    data.activities.map((activity) => activity.id),
    ["neighbor-4", "sam"],
    now,
  );
  assert.equal(priorities["beacon:joined"].tier, 0);
  assert.equal(priorities["person:neighbor-4"].tier, 1);
  assert.ok(priorities["person:sam"].tier <= 6);
});

test("directions URL rejects virtual or invalid coordinates", () => {
  assert.equal(physicalDirectionsUrl(null, null), null);
  assert.equal(physicalDirectionsUrl(91, 0), null);
  assert.equal(
    physicalDirectionsUrl(41.8, -87.6),
    "https://www.google.com/maps/dir/?api=1&destination=41.8%2C-87.6",
  );
  assert.equal(
    physicalDirectionsUrl(0, 0),
    "https://www.google.com/maps/dir/?api=1&destination=0%2C0",
  );
});
