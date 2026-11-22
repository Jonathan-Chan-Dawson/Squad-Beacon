import test from "node:test";
import assert from "node:assert/strict";
import {
  localDateTimeField,
  parseLocalDateTimeField,
  timingMinutes,
} from "@/src/shared/dateTime";
import {
  creationPresetStart,
  creationScheduleSummary,
  fixedHalfHourStart,
  resolveActivityEndAt,
  resolveCreationStartAt,
} from "@/src/features/beacons/createTiming";

test("shared date fields round-trip an ISO instant in the requested timezone exactly once", () => {
  const instant = "2026-10-27T23:30:00.000Z";
  const wall = localDateTimeField(instant, "America/Chicago");
  assert.equal(wall, "2026-10-27T18:30");
  assert.equal(parseLocalDateTimeField(wall, "America/Chicago"), instant);
  assert.equal(localDateTimeField("not-a-date", "America/Chicago"), "");
});

test("creation presets honor the tap instant, the end of the local day, and DST", () => {
  const timezone = "America/Chicago";
  const now = Date.parse("2026-03-08T05:30:00.000Z");
  assert.equal(creationPresetStart("Now", now, timezone), now);
  assert.equal(
    creationPresetStart("In 30 min", now, timezone),
    now + 30 * 60000,
  );
  assert.equal(
    creationPresetStart("Later today", now, timezone),
    Date.parse("2026-03-08T05:59:00.000Z"),
  );
  assert.equal(
    creationPresetStart("Later today", now + 14 * 60000, timezone),
    Date.parse("2026-03-08T05:59:00.000Z"),
  );
  assert.equal(
    creationPresetStart("Later today", now + 14 * 60000 + 1, timezone),
    null,
  );
  assert.equal(
    creationPresetStart("Tomorrow", now, timezone),
    Date.parse("2026-03-08T22:00:00.000Z"),
  );
  const summary = creationScheduleSummary(
    now,
    "2026-03-08T06:30:00Z",
    timezone,
  );
  assert.match(summary, /Mar 7.*Mar 8/);
  assert.match(
    creationScheduleSummary(now, "2026-03-08T06:30:00Z", timezone, now),
    /Today.*Tomorrow/,
  );
});

test("invalid wall times and DST gaps cannot silently become valid picker edits", () => {
  assert.throws(() => parseLocalDateTimeField("", "America/Chicago"));
  assert.throws(() =>
    parseLocalDateTimeField("2026-03-08T02:30", "America/Chicago"),
  );
  assert.equal(
    timingMinutes("2026-10-28T04:30:00Z", "2026-10-28T06:00:00Z"),
    90,
  );
});

test("a selected start stays fixed while duration changes or time passes", () => {
  const tappedAt = Date.parse("2026-11-22T23:00:00Z");
  const selected = new Date(creationPresetStart("In 30 min", tappedAt, "America/Chicago")!).toISOString();
  const later = tappedAt + 12 * 60000;
  const start = resolveCreationStartAt(fixedHalfHourStart, selected, later);
  assert.equal(start, Date.parse("2026-11-22T23:30:00Z"));
  assert.equal(resolveActivityEndAt(start, "2 hours", ""), "2026-11-23T01:30:00.000Z");
  assert.equal(resolveActivityEndAt(start, "75 min", ""), "2026-11-23T00:45:00.000Z");
  assert.equal(resolveCreationStartAt("Now", selected, later), later);
  assert.equal(resolveCreationStartAt("In 30 min", selected, later), later + 30 * 60000);
});
