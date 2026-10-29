import test from "node:test";
import assert from "node:assert/strict";
import {
  localDateTimeField,
  parseLocalDateTimeField,
  timingMinutes,
} from "@/src/shared/dateTime";

test("shared date fields round-trip an ISO instant in the requested timezone exactly once", () => {
  const instant = "2026-10-27T23:30:00.000Z";
  const wall = localDateTimeField(instant, "America/Chicago");
  assert.equal(wall, "2026-10-27T18:30");
  assert.equal(parseLocalDateTimeField(wall, "America/Chicago"), instant);
  assert.equal(localDateTimeField("not-a-date", "America/Chicago"), "");
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
