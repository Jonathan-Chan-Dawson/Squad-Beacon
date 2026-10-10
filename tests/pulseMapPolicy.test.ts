import assert from "node:assert/strict";
import test from "node:test";
import {
  collidePulseBadges,
  savedPulsePlace,
  summaryPulsePlace,
  pulseHasBeacon,
} from "../src/features/maps/pulseMapPolicy";
import { parseMapDevicePreferences } from "../src/features/maps/mapDevicePreferenceModel";
import type { PulseSummary } from "../src/features/pulse/types";
import { providerMapBounds } from "../src/features/maps/mapBounds";
const summary = (placeKey: string, importance = 1): PulseSummary => ({
  placeKey,
  lat: 41.88,
  lng: -87.63,
  category: "cafe",
  crowd: 2,
  conditions: [],
  recentCount: 2,
  confirmCount: 0,
  updatedAt: 100,
  freshness: 1,
  importance,
});
test("separate collisions retain ranked updates and reject invalid/offscreen points", () => {
  const points = [
    { summary: summary("lower", 0.2), x: 30, y: 30, satellite: false },
    { summary: summary("higher"), x: 35, y: 35, satellite: false },
    { summary: summary("separate"), x: 100, y: 100, satellite: false },
    { summary: summary("invalid"), x: NaN, y: 40, satellite: false },
  ];
  assert.deepEqual(
    collidePulseBadges(points, 200, 200).map((point) => point.summary.placeKey),
    ["higher", "separate"],
  );
});
test("nearby name mapping preserves summary mutation identity and category", () => {
  const result = summaryPulsePlace(summary("provider-venue"), [
    {
      placeKey: "saved-venue",
      name: "A Cafe",
      lat: 41.88,
      lng: -87.63,
      category: "unknown",
    },
  ]);
  assert.equal(result.name, "A Cafe");
  assert.equal(result.placeKey, "provider-venue");
  assert.equal(result.category, "cafe");
});
test("named saved places in one area cell remain distinct; only authorized inputs can produce satellites", () => {
  const base = {
    activity_id: "readable",
    label: "North Cafe",
    latitude: 41.88,
    longitude: -87.63,
    online_url: null,
  };
  assert.notEqual(
    savedPulsePlace(base)?.placeKey,
    savedPulsePlace({ ...base, label: "South Cafe" })?.placeKey,
  );
  assert.equal(pulseHasBeacon(summary("place"), []), false);
  assert.equal(pulseHasBeacon(summary("place"), [base]), true);
  assert.equal(
    pulseHasBeacon(summary("place"), [
      { ...base, online_url: "https://example.com" },
    ]),
    false,
  );
});
test("camera preferences reject malformed values while preserving dateline exploration and explicit off", () => {
  assert.equal(
    parseMapDevicePreferences({ camera: { zoom: 10 }, hintsSeen: Infinity })
      .camera,
    undefined,
  );
  assert.equal(parseMapDevicePreferences({ hintsSeen: Infinity }).hintsSeen, 0);
  const camera = {
    center: { latitude: 0, longitude: 179 },
    zoom: 13,
    bounds: { north: 2, south: -2, west: 178, east: -178 },
  };
  const result = parseMapDevicePreferences({ liveUpdates: false, camera });
  assert.equal(result.liveUpdates, false);
  assert.deepEqual(result.camera, camera);
});
test("map provider bounds preserve dateline crossings and whole-world views", () => {
  assert.deepEqual(providerMapBounds(95, -95, 182, 178), {
    north: 90,
    south: -90,
    east: -178,
    west: 178,
  });
  assert.deepEqual(providerMapBounds(40, -40, 220, -220), {
    north: 40,
    south: -40,
    east: 180,
    west: -180,
  });
});
