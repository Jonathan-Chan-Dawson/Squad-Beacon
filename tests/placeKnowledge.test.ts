import test from "node:test";
import assert from "node:assert/strict";
import { canSharePlaceKnowledge, parsePlaceKnowledge, placeInterests } from "@/src/features/pulse/placeKnowledge";
import { validPulseAnswer } from "@/src/features/pulse/pulseProfiles";

test("place knowledge boundary projects only safe facts and rejects malformed signals", () => {
  assert.deepEqual(parsePlaceKnowledge(null), { tips: [], interest: [], ownInterest: null });
  const value = parsePlaceKnowledge({
    tips: [{ id: "tip", text: "Tables upstairs", helpful: 12, accurateAt: Date.now(), author: "private", lat: 1 }],
    interest: [{ kind: "study", validUntil: Date.now() + 1000, people: ["private"], count: 5, lat: 1 }, { kind: "__proto__", validUntil: 3 }],
    ownInterest: "__proto__",
  });
  assert.equal(value.tips.length, 1);
  assert.equal(value.interest.length, 1);
  assert.equal(value.ownInterest, null);
  assert.ok(!JSON.stringify(value).includes("private"));
  assert.deepEqual(parsePlaceKnowledge({ tips: [{ id: "x", text: "x", helpful: -1, accurateAt: 1 }] }).tips, []);
});

test("contextual choices fit the venue and unnamed areas cannot collect tips", () => {
  assert.deepEqual(placeInterests.library, ["study"]);
  assert.deepEqual(placeInterests.court, ["pickup"]);
  assert.equal(validPulseAnswer("court", "crowd", 2), true);
  assert.equal(validPulseAnswer("court", "condition", "field_wet"), false);
  assert.equal(validPulseAnswer("field", "availability", "courts_open"), false);
  assert.equal(validPulseAnswer("field", "condition", "field_wet"), true);
  const place = { placeKey: "saved:venue", category: "unknown" as const, lat: 1, lng: 1, name: "Venue" };
  assert.equal(canSharePlaceKnowledge(place), true);
  assert.equal(canSharePlaceKnowledge({ ...place, placeKey: "area:1234567" }), false);
});
