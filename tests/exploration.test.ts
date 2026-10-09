import assert from "node:assert/strict";
import test from "node:test";
import {
  boundsCenter,
  matchesExplorationArea,
  viewportDiffersFromTarget,
  type ExplorationArea,
  type MapViewport,
} from "../src/shared/exploration";
import {
  mapAdvancedFilterCount,
  matchesSelectedCategories,
  includeSelectedActivity,
  shouldSearchNewViewport,
} from "../src/features/maps/mapUIselectors";
import {
  activeSonarSession,
  getRecentMapSearchQueries,
  locationShareExpiry,
  rememberMapSearchQuery,
  sonarLocationIsFresh,
  sonarMinutesRemaining,
} from "../src/features/maps/sessionHelpers";
import type { LocationSession } from "../src/shared/types";

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

test("Search this area uses a quarter of the visible viewport as its threshold", () => {
  const previous: MapViewport = {
    center: { latitude: 41.88, longitude: -87.64 },
    zoom: 12,
    bounds: { north: 42.38, south: 41.38, east: -87.14, west: -88.14 },
  };
  const smallPan: MapViewport = {
    ...previous,
    center: { latitude: 41.88, longitude: -87.515 },
  };
  const quarterPan: MapViewport = {
    ...previous,
    center: { latitude: 41.88, longitude: -87.39 },
  };
  assert.equal(shouldSearchNewViewport(null, previous), false);
  assert.equal(shouldSearchNewViewport(previous, smallPan), false);
  assert.equal(shouldSearchNewViewport(previous, quarterPan), true);
  assert.equal(
    shouldSearchNewViewport(previous, {
      ...previous,
      bounds: { north: 42.6, south: 41.16, east: -86.92, west: -88.36 },
    }),
    true,
  );
});

test("multi-category choices count as removable filters and match any selected category", () => {
  const filters = {
    audience: "Friends",
    category: "All categories",
    time: "All",
    planId: null,
    join: "Open",
  } as const;
  assert.equal(mapAdvancedFilterCount(filters, ["Fitness", "Study"]), 4);
  assert.equal(matchesSelectedCategories("Fitness", ["Fitness", "Study"]), true);
  assert.equal(matchesSelectedCategories("Gaming", ["Fitness", "Study"]), false);
  assert.equal(matchesSelectedCategories("Gaming", []), true);
});

test("a readable selected Beacon remains in synchronized map results exactly once", () => {
  const first = { id: "first" };
  const selected = { id: "outside-query" };
  assert.deepEqual(includeSelectedActivity([first], selected), [first, selected]);
  assert.deepEqual(includeSelectedActivity([first, selected], selected), [first, selected]);
  assert.deepEqual(includeSelectedActivity([first], null), [first]);
});

test("Sonar remains active until expiry while stale or missing points are not shown to friends", () => {
  const now = Date.parse("2026-10-07T18:00:00.000Z");
  const fresh: LocationSession = {
    id: "session",
    owner_id: "viewer",
    expires_at: "2026-10-07T18:42:00.000Z",
    latitude: 41.88,
    longitude: -87.64,
    updated_at: "2026-10-07T17:58:00.000Z",
  };
  assert.equal(activeSonarSession([fresh], "viewer", now), fresh);
  assert.equal(sonarLocationIsFresh(fresh, now), true);
  assert.equal(sonarMinutesRemaining(fresh.expires_at, now), 42);
  const stale = { ...fresh, updated_at: "2026-10-07T17:54:59.000Z" };
  assert.equal(activeSonarSession([stale], "viewer", now), stale);
  assert.equal(sonarLocationIsFresh(stale, now), false);
  assert.equal(activeSonarSession([{ ...fresh, expires_at: "2026-10-07T17:59:59.000Z" }], "viewer", now), undefined);
  const noPoint = { ...fresh, latitude: null };
  assert.equal(activeSonarSession([noPoint], "viewer", now), noPoint);
  assert.equal(sonarLocationIsFresh(noPoint, now), false);
});

test("Sonar extension adds the selected duration to the current expiry", () => {
  const now = Date.parse("2026-10-07T18:00:00.000Z");
  const activeExpiry = "2026-10-07T18:42:00.000Z";
  assert.equal(
    locationShareExpiry("15 minutes", now, activeExpiry),
    Date.parse("2026-10-07T18:57:00.000Z"),
  );
  assert.equal(
    locationShareExpiry("1 hour", now, activeExpiry),
    Date.parse("2026-10-07T19:42:00.000Z"),
  );
  assert.equal(
    locationShareExpiry("Until activity ends", now, activeExpiry, "2026-10-07T22:00:00.000Z"),
    Date.parse("2026-10-07T22:00:00.000Z"),
  );
  assert.equal(locationShareExpiry("Until activity ends", now, activeExpiry), undefined);
  assert.equal(
    locationShareExpiry("Until activity ends", now, activeExpiry, "2026-10-07T18:30:00.000Z"),
    undefined,
  );
  assert.equal(
    locationShareExpiry("1 hour", now, "2026-10-07T21:30:00.000Z"),
    Date.parse("2026-10-07T22:00:00.000Z"),
  );
  assert.equal(
    locationShareExpiry("15 minutes", now, "2026-10-07T21:59:00.000Z"),
    Date.parse("2026-10-07T22:00:00.000Z"),
  );
  assert.equal(locationShareExpiry("1 hour", now, "2026-10-07T22:00:00.000Z"), undefined);
  assert.equal(locationShareExpiry("15 minutes", now, "2026-10-07T22:01:00.000Z"), undefined);
  assert.equal(
    locationShareExpiry("Until activity ends", now, "2026-10-07T21:30:00.000Z", "2026-10-07T22:30:00.000Z"),
    Date.parse("2026-10-07T22:00:00.000Z"),
  );
});

test("submitted map search history stays private to its viewer for the app session", () => {
  rememberMapSearchQuery(" Coffee  near me ", "map-history-viewer-a");
  rememberMapSearchQuery("Coffee near me", "map-history-viewer-a");
  assert.deepEqual(getRecentMapSearchQueries("map-history-viewer-a"), ["Coffee near me"]);
  assert.deepEqual(getRecentMapSearchQueries("map-history-viewer-b"), []);
  assert.deepEqual(getRecentMapSearchQueries(null), []);
});
