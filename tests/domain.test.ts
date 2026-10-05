import test from "node:test";
import assert from "node:assert/strict";
import {
  habitStats,
  featuredActivity,
  locationIsFresh,
  friendAvailabilityState,
  localDate,
  activityWhen,
  validateActivity,
} from "@/src/shared/domain";
import { makeDemo } from "@/src/shared/demo";
import type { Activity, Habit, Checkin } from "@/src/shared/types";
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
test("friend availability uses only explicit live solo status and a 30-minute threshold", () => {
  const now = Date.parse("2026-10-03T18:00:00Z");
  const liveSolo = (available: boolean, remainingMinutes: number) =>
    ({
      status: "scheduled",
      mode: "solo",
      available,
      starts_at: new Date(now - 10 * 60000).toISOString(),
      ends_at: new Date(now + remainingMinutes * 60000).toISOString(),
    }) as Activity;

  assert.equal(friendAvailabilityState(liveSolo(true, 31), now), "available");
  assert.equal(friendAvailabilityState(liveSolo(true, 30), now), "ending-soon");
  assert.equal(friendAvailabilityState(liveSolo(false, 20), now), "unavailable");
  assert.equal(
    friendAvailabilityState({ ...liveSolo(true, 20), mode: "squad" }, now),
    "unknown",
  );
  assert.equal(friendAvailabilityState(undefined, now), "unknown");
  assert.equal(
    friendAvailabilityState(
      { ...liveSolo(false, 20), starts_at: new Date(now + 1).toISOString() },
      now,
    ),
    "unknown",
  );
});
test("beacon time labels stay relative nearby and readable across days", () => {
  const now = new Date(2026, 9, 1, 12, 0);
  const event = (startsAt: Date) =>
    ({
      status: "scheduled",
      starts_at: startsAt.toISOString(),
      ends_at: new Date(+startsAt + 60 * 60 * 1000).toISOString(),
    }) as import("@/src/shared/types").Activity;

  assert.equal(
    activityWhen(event(new Date(+now + 20 * 60000)), now),
    "Starts in 20 min",
  );
  assert.equal(
    activityWhen(event(new Date(+now - 5 * 60000)), now),
    "Ends in 55 min",
  );
  assert.match(activityWhen(event(new Date(2026, 9, 1, 19)), now), /^Today/);
  assert.match(activityWhen(event(new Date(2026, 9, 2, 16, 30)), now), /^Tomorrow/);
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
test("featured activity honors the privacy-filtered projection without automatic fallback", () => {
  const d = makeDemo(),
    p = d.profiles.find((profile) => profile.id === "demo-you")!;
  assert.equal(
    featuredActivity(
      {
        ...p,
        viewer_can_view_full_profile: true,
        viewer_featured_activity_id: d.activities[0].id,
        featured_activity_id: null,
      },
      d.activities,
    )?.id,
    d.activities[0].id,
  );
  assert.equal(
    featuredActivity(
      {
        ...p,
        viewer_can_view_full_profile: true,
        viewer_featured_activity_id: null,
        featured_activity_id: d.activities[0].id,
        hide_featured: false,
      },
      d.activities,
    ),
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

test("repeat suggestions use only your completed activities and rank repeats first", async () => {
  const { repeatSuggestions } = await import("../src/shared/templates");
  const data = makeDemo();
  const base = data.activities[0];
  const completed = { ...base, owner_id: "me", status: "completed" as const };
  const suggestions = repeatSuggestions(
    [
      { ...completed, id: "one", title: "Coffee" },
      { ...completed, id: "two", title: "coffee" },
      { ...completed, id: "three", title: "Walk" },
      { ...completed, owner_id: "other", title: "Not mine" },
      { ...completed, status: "cancelled", title: "Cancelled" },
    ],
    "me",
  );
  assert.equal(suggestions.length, 2);
  assert.match(suggestions[0].label, /^Your usual:/);
});

test("testing neighborhood has friends, social growth fixtures, and expiring locations", () => {
  const d = makeDemo();
  assert.equal(d.profiles.length, 70);
  assert.equal(d.friendships.filter((f) => f.status === "accepted").length, 23);
  assert.equal(
    d.profiles.filter(
      (p) =>
        p.id !== "demo-you" &&
        !d.friendships.some((f) => f.recipient_id === p.id),
    ).length,
    46,
  );
  assert.ok(d.activities.some((a) => a.available && a.mode === "solo"));
  assert.ok(
    d.locations.every(
      (l) => Date.parse(l.expires_at) > Date.now() && locationIsFresh(l),
    ),
  );
});
