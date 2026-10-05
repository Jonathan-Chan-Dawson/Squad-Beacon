import test from "node:test";
import assert from "node:assert/strict";
import {
  parseWorldwidePlaces,
  validatePlaceQuery,
} from "@/src/features/maps/placeSearch";

test("worldwide queries are explicit, trimmed and bounded", () => {
  assert.equal(validatePlaceQuery("  Auckland  "), "Auckland");
  assert.throws(() => validatePlaceQuery("a"));
  assert.throws(() => validatePlaceQuery("a".repeat(161)));
});
test("place responses fail closed for bad coordinates and unsafe links", () => {
  const places = parseWorldwidePlaces({
    places: [
      {
        id: "zero",
        name: { text: "Equator" },
        location: { latitude: 0, longitude: 0 },
        attributions: [
          { provider: "Provider", providerUri: "javascript:bad()" },
        ],
        googleMapsUri: "https://maps.google.com/",
      },
      {
        id: "bad",
        name: { text: "Bad" },
        location: { latitude: 91, longitude: 10 },
      },
      { id: "missing", name: { text: "Missing" } },
    ],
  });
  assert.equal(places.length, 1);
  assert.deepEqual(places[0].coordinate, { latitude: 0, longitude: 0 });
  assert.equal(places[0].attributions[0].uri, undefined);
  assert.equal(parseWorldwidePlaces(null).length, 0);
});
