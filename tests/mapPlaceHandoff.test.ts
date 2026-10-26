import test from "node:test";
import assert from "node:assert/strict";
import { composerMapCoordinate } from "../src/features/planning/composerSession";
import { creationHandoffParams } from "../src/features/beacons/createHandoff";

test("Map handoffs preserve zero coordinates and labels through template-first creation", () => {
  const params = creationHandoffParams({
    fromMap: "yes",
    latitude: "0",
    longitude: "0",
    placeLabel: "Pinned location",
  });
  assert.deepEqual(composerMapCoordinate(params.latitude, params.longitude), {
    latitude: 0,
    longitude: 0,
  });
  assert.equal(params.placeLabel, "Pinned location");
  assert.equal(params.editor, undefined);
});
test("Ping rejects incomplete, nonfinite and out-of-range Map coordinates", () => {
  for (const pair of [
    [undefined, "1"],
    ["", "1"],
    [" ", "1"],
    ["1", undefined],
    ["NaN", "1"],
    ["1", "Infinity"],
    ["91", "1"],
    ["1", "-181"],
  ])
    assert.equal(composerMapCoordinate(pair[0], pair[1]), undefined);
  assert.deepEqual(composerMapCoordinate("-90", "180"), {
    latitude: -90,
    longitude: 180,
  });
});
