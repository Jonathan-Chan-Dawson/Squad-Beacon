import assert from "node:assert/strict";
import test from "node:test";
import {
  boundsCenter,
  matchesExplorationArea,
  viewportDiffersFromTarget,
  type ExplorationArea,
  type MapViewport,
} from "../src/shared/exploration";

test("selected viewport filters physical locations by its settled bounds", () => {
  const area: ExplorationArea = {
    kind: "viewport",
    label: "Selected area",
    coordinate: { latitude: 41.88, longitude: -87.64 },
    zoom: 12,
    bounds: { north: 42, south: 41.7, east: -87.4, west: -87.9 },
  };
  assert.equal(
    matchesExplorationArea(area, { latitude: 41.9, longitude: -87.6 }),
    true,
  );
  assert.equal(
    matchesExplorationArea(area, { latitude: 40, longitude: -87.6 }),
    false,
  );
  assert.equal(matchesExplorationArea(area, null), true);
});

test("saved-place radius is zoom-derived and near-me without GPS never filters", () => {
  const area: ExplorationArea = {
    kind: "place",
    label: "Saved cafe",
    coordinate: { latitude: 41.88, longitude: -87.64 },
    zoom: 15,
    source: "saved",
  };
  assert.equal(
    matchesExplorationArea(area, { latitude: 41.8801, longitude: -87.6401 }),
    true,
  );
  assert.equal(
    matchesExplorationArea(area, { latitude: 42, longitude: -87.64 }),
    false,
  );
  assert.equal(
    matchesExplorationArea(
      { kind: "near-me", label: "Near me" },
      { latitude: 0, longitude: 0 },
    ),
    true,
  );
});

test("viewport bounds and movement comparisons wrap correctly across the dateline", () => {
  assert.deepEqual(
    boundsCenter({ north: 90, south: -90, west: -180, east: 180 }),
    { latitude: 0, longitude: 0 },
  );
  assert.equal(
    matchesExplorationArea(
      {
        kind: "place",
        label: "Polar area",
        source: "saved",
        coordinate: { latitude: 85, longitude: 0 },
        zoom: 1,
      },
      { latitude: 80, longitude: 150 },
    ),
    true,
  );
  assert.deepEqual(
    boundsCenter({ north: 10, south: -10, west: 170, east: -170 }),
    { latitude: 0, longitude: -180 },
  );
  const viewport: MapViewport = {
    center: { latitude: 0, longitude: -179.999 },
    zoom: 10,
    bounds: { north: 1, south: -1, west: 179, east: -179 },
  };
  assert.equal(
    matchesExplorationArea(
      {
        kind: "viewport",
        label: "Dateline",
        coordinate: { latitude: 0, longitude: -180 },
        zoom: 10,
        bounds: viewport.bounds,
      },
      { latitude: 0, longitude: 179.5 },
    ),
    true,
  );
  assert.equal(
    viewportDiffersFromTarget(viewport, {
      center: { latitude: 0, longitude: 179.999 },
      zoom: 10,
      revision: 1,
    }),
    false,
  );
});
