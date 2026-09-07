import test from "node:test";
import assert from "node:assert/strict";
import {
  habitStats,
  featuredActivity,
  locationIsFresh,
  localDate,
  validateActivity,
} from "../src/domain";
import { makeDemo } from "../src/demo";
import type { Habit, Checkin } from "../src/types";
const habit: Habit = {
  id: "h",
  owner_id: "u",
  title: "Move",
  schedule: "days",
  weekdays: [1, 3, 5],
  weekly_target: 3,
  timezone: "America/Chicago",
  reminder_hour: null,
  goal_id: null,
  audience: "private",
  audience_id: null,
};
const checks = (dates: string[]): Checkin[] =>
  dates.map((local_date, i) => ({
    id: String(i),
    habit_id: "h",
    owner_id: "u",
    local_date,
  }));
test("rest days and unfinished today do not break a scheduled streak", () => {
  const stats = habitStats(
    habit,
    checks(["2026-03-02", "2026-03-04", "2026-03-06"]),
    new Date("2026-03-09T15:00:00Z"),
  );
  assert.equal(stats.streak, 3);
  assert.equal(stats.best, 3);
});
test("a missed scheduled day breaks current streak but preserves best", () => {
  const stats = habitStats(
    habit,
    checks(["2026-03-02", "2026-03-04", "2026-03-06"]),
    new Date("2026-03-10T15:00:00Z"),
  );
  assert.equal(stats.streak, 0);
  assert.equal(stats.best, 3);
});
test("weekly targets count successful weeks and ignore duplicate dates", () => {
  const stats = habitStats(
    { ...habit, schedule: "weekly" },
    checks([
      "2026-03-02",
      "2026-03-02",
      "2026-03-04",
      "2026-03-06",
      "2026-03-09",
    ]),
    new Date("2026-03-10T15:00:00Z"),
  );
  assert.equal(stats.streak, 1);
  assert.equal(stats.weekCount, 1);
});
test("day boundaries use the habit timezone across DST", () => {
  assert.equal(
    localDate(new Date("2026-03-09T04:30:00Z"), "America/Chicago"),
    "2026-03-08",
  );
  assert.equal(
    localDate(new Date("2026-11-02T05:30:00Z"), "America/Chicago"),
    "2026-11-01",
  );
});
test("expired and five-minute-old locations are not live", () => {
  const now = new Date("2026-09-07T12:00:00Z");
  assert.equal(
    locationIsFresh(
      {
        expires_at: "2026-09-07T13:00:00Z",
        updated_at: "2026-09-07T11:55:00Z",
      },
      now,
    ),
    false,
  );
  assert.equal(
    locationIsFresh(
      {
        expires_at: "2026-09-07T12:00:00Z",
        updated_at: "2026-09-07T11:59:00Z",
      },
      now,
    ),
    false,
  );
  assert.equal(
    locationIsFresh(
      {
        expires_at: "2026-09-07T13:00:00Z",
        updated_at: "2026-09-07T11:59:00Z",
      },
      now,
    ),
    true,
  );
});
test("featured activity cannot expose a pin absent from the authorized collection", () => {
  const d = makeDemo(),
    p = { ...d.profiles[0], featured_activity_id: "secret" };
  assert.equal(featuredActivity(p, []), undefined);
  assert.equal(
    featuredActivity({ ...p, hide_featured: true }, d.activities),
    undefined,
  );
});
test("activity validation rejects invalid time, links, and coordinates", () => {
  const valid = {
    title: "Boxing",
    starts_at: "2026-09-07T12:00:00Z",
    ends_at: "2026-09-07T13:00:00Z",
  };
  assert.doesNotThrow(() => validateActivity(valid));
  assert.throws(() => validateActivity({ ...valid, ends_at: valid.starts_at }));
  assert.throws(() =>
    validateActivity({ ...valid, online_url: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    validateActivity({ ...valid, latitude: 500, longitude: 10 }),
  );
});
