import test from "node:test";
import assert from "node:assert/strict";
import { aggregatePulse } from "@/src/features/pulse/aggregatePulse";
import { agePulseSummary } from "@/src/features/pulse/aging";
import {
  requirePulseReceipt,
  pulseAreaCenter,
} from "@/src/features/pulse/validation";
import {
  confirmPulseReport,
  pulseTTL,
  pulseWeight,
} from "@/src/features/pulse/expiry";
import { pulseLayerPolicy } from "@/src/features/pulse/pulseLayerPolicy";
import { pulseReadout } from "@/src/features/pulse/wording";
import {
  parsePulseSummaries,
  pulseAreaKey,
  validatePulseDraft,
} from "@/src/features/pulse/validation";
import type { PulseReport } from "@/src/features/pulse/reports";
const now = 1800000000000;
function report(id: string, value: number, age = 0): PulseReport {
  return {
    id,
    placeKey: "cafe",
    lat: 41.8,
    lng: -87.6,
    category: "cafe",
    kind: "crowd",
    value,
    createdAt: now - age * 60000,
    expiresAt: now + 60000,
    confirmCount: 0,
  };
}
test("weighted conflicts decay and half ties select only floor/ceil toward newest report", () => {
  assert.equal(pulseWeight(report("old", 3, 20), now), 0.5);
  assert.equal(
    aggregatePulse([report("old", 3, 20), report("new", 0)], now).crowd,
    1,
  );
  assert.equal(aggregatePulse([report("a", 0), report("b", 3)], now).crowd, 2);
  assert.equal(aggregatePulse([report("z", 0), report("a", 3)], now).crowd, 1);
});
test("expiry is exclusive at exact boundary and below-threshold kinds disappear", () => {
  const expired = { ...report("expired", 3), expiresAt: now };
  assert.equal(aggregatePulse([expired], now).recentCount, 0);
  assert.equal(aggregatePulse([expired], now).crowd, undefined);
  assert.equal(aggregatePulse([report("old", 3, 80)], now).crowd, undefined);
});
test("closures need independent condition rows; confirmation never adds another reporter", () => {
  const closed: PulseReport = {
    ...report("one", 0),
    category: "trail",
    kind: "condition",
    value: "blocked_closed",
  };
  assert.equal(
    aggregatePulse([confirmPulseReport(closed, now)], now).conditions[0]
      .strength,
    "reported",
  );
  assert.match(
    pulseReadout(aggregatePulse([closed], now)).join(),
    /may be closed/,
  );
  assert.equal(
    aggregatePulse([closed, { ...closed, id: "other" }], now).conditions[0]
      .strength,
    "likely",
  );
  assert.equal(
    aggregatePulse(
      [closed, { ...closed, id: "fake", kind: "availability" }],
      now,
    ).recentCount,
    1,
  );
});
test("confirmations extend expiry at most one original TTL and cannot revive expired rows", () => {
  const original = {
    ...report("row", 2),
    expiresAt: now + pulseTTL("crowd", 2),
  };
  const later = now + 80 * 60000;
  const once = confirmPulseReport(original, later),
    again = confirmPulseReport(once, later + 60 * 60000);
  assert.equal(again.expiresAt, original.createdAt + 2 * pulseTTL("crowd", 2));
  assert.equal(
    confirmPulseReport({ ...original, expiresAt: now }, now).confirmCount,
    0,
  );
});
test("wording confidence is per kind and projection strips all reporter fields", () => {
  const reports = [
    report("one", 2),
    { ...report("wait", 2), kind: "wait" as const },
  ];
  const summary = aggregatePulse(reports, now);
  assert.match(pulseReadout(summary)[0], /^Reported/);
  assert.match(pulseReadout(summary)[1], /^Likely/);
  const parsed = parsePulseSummaries([
    { ...summary, reporterId: "private", reports, arbitrary: "secret" },
  ])[0];
  assert.ok(!JSON.stringify(parsed).includes("private"));
  assert.ok(!("reports" in parsed));
  assert.ok(!("arbitrary" in parsed));
});
test("layer policy enforces tiers/caps, freshness, viewport and dateline", () => {
  const base = aggregatePulse([report("one", 3)], now);
  const summaries = Array.from({ length: 30 }, (_, i) => ({
    ...base,
    placeKey: String(i),
  }));
  const bounds = { north: 42, south: 41, east: -87, west: -88 };
  assert.equal(pulseLayerPolicy(11, bounds, summaries).badges.length, 0);
  assert.equal(pulseLayerPolicy(13, bounds, summaries).halos.length, 12);
  assert.equal(pulseLayerPolicy(15, bounds, summaries).badges.length, 20);
  assert.equal(pulseLayerPolicy(15, bounds, summaries).collapsedCount, 10);
  assert.equal(
    pulseLayerPolicy(15, bounds, [
      { ...base, crowd: 0, conditions: [] },
      { ...base, freshness: 0.349 },
    ]).badges.length,
    0,
  );
  assert.equal(
    pulseLayerPolicy(15, { north: 42, south: 41, west: 170, east: -170 }, [
      { ...base, lng: 179 },
    ]).badges.length,
    1,
  );
});
test("category/area validation prevents unsupported fields and no geography asks for GPS", () => {
  const place = {
    placeKey: pulseAreaKey(41.8, -87.6),
    name: "Area",
    lat: 41.8,
    lng: -87.6,
    category: "area" as const,
  };
  assert.deepEqual(
    validatePulseDraft({ place, answers: { crowd: 2 }, note: " hello " }).note,
    "hello",
  );
  assert.throws(() => validatePulseDraft({ place, answers: { wait: 2 } }));
  assert.throws(() =>
    validatePulseDraft({
      place: { ...place, placeKey: "area:invalid" },
      answers: { crowd: 2 },
    }),
  );
});

test("idle aging decays without requests and drops a kind at its first contributor expiry", () => {
  const original = aggregatePulse(
    [
      { ...report("one", 3), expiresAt: now + 30 * 60000 },
      { ...report("two", 2), expiresAt: now + 60 * 60000 },
    ],
    now,
  );
  assert.equal(agePulseSummary(original, now + 20 * 60000).freshness, 0.5);
  assert.equal(agePulseSummary(original, now + 30 * 60000).crowd, undefined);
  assert.equal(agePulseSummary(original, now + 30 * 60000).recentCount, 0);
  assert.equal(original.crowd, 2);
  assert.ok(!JSON.stringify(original.signals).includes("one"));
});
test("mutation receipt validation rejects malformed and mismatched place acknowledgements", () => {
  const expected = {
    placeKey: "cafe",
    lat: 41.8,
    lng: -87.6,
    category: "cafe" as const,
  };
  const summary = aggregatePulse([report("one", 2)], now);
  assert.equal(requirePulseReceipt(summary, expected).placeKey, "cafe");
  assert.throws(() => requirePulseReceipt(null, expected));
  assert.throws(() =>
    requirePulseReceipt({ ...summary, placeKey: "other" }, expected),
  );
  assert.throws(() => requirePulseReceipt({ ...summary, lat: 42 }, expected));
  assert.throws(() =>
    requirePulseReceipt({ ...summary, recentCount: 0 }, expected),
  );
});
test("Area Update positions in the same geohash cell normalize to one coarse center", () => {
  const key = pulseAreaKey(41.8, -87.6),
    center = pulseAreaCenter(key);
  const place = {
    placeKey: key,
    name: "Area",
    category: "area" as const,
    ...center,
  };
  const nearby = {
    ...place,
    lat: center.lat + 0.0002,
    lng: center.lng + 0.0002,
  };
  assert.equal(pulseAreaKey(nearby.lat, nearby.lng), key);
  const first = validatePulseDraft({ place, answers: { crowd: 1 } }),
    second = validatePulseDraft({ place: nearby, answers: { crowd: 2 } });
  assert.equal(first.place.lat, second.place.lat);
  assert.equal(first.place.lng, second.place.lng);
});
