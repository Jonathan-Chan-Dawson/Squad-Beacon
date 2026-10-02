import test from "node:test";
import assert from "node:assert/strict";
import {
  copyAspirationGoalsForSurvey,
  getAspirationProgress,
} from "@/src/features/profile/aspirations";
import type { Activity, AspirationGoal } from "@/src/shared/types";

const aspiration: AspirationGoal = {
  id: "goal-run",
  title: "Go for a run",
  category: "Fitness",
  target_per_week: 1,
};

function activity(
  id: string,
  owner_id: string,
  starts_at: string,
  aspiration_ids: string[],
  status: Activity["status"] = "completed",
): Activity {
  return {
    id,
    owner_id,
    title: id,
    category: "Fitness",
    mode: "solo",
    starts_at,
    ends_at: new Date(Date.parse(starts_at) + 60 * 60 * 1000).toISOString(),
    timezone: "America/Chicago",
    approval_required: false,
    status,
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids,
    audience: "private",
    audience_id: null,
  };
}

test("weekly boundaries use the profile timezone across the spring DST shift", () => {
  const progress = getAspirationProgress(
    aspiration,
    [
      // Sunday 23:59 in Chicago, despite already being Monday in UTC.
      activity("sunday", "owner", "2026-03-09T04:59:00.000Z", [aspiration.id]),
      // Monday 00:01 in Chicago, after the spring clock change.
      activity("monday", "owner", "2026-03-09T05:01:00.000Z", [aspiration.id]),
    ],
    "owner",
    "America/Chicago",
    new Date("2026-03-09T05:30:00.000Z"),
  );

  assert.deepEqual(progress, { count: 1, streak: 2 });
});

test("only completed beacons by the owner linked to this aspiration count", () => {
  const progress = getAspirationProgress(
    aspiration,
    [
      activity("valid", "owner", "2026-04-06T15:00:00.000Z", [aspiration.id]),
      activity("other-owner", "friend", "2026-04-06T15:00:00.000Z", [aspiration.id]),
      activity("other-goal", "owner", "2026-04-06T15:00:00.000Z", ["goal-study"]),
      activity(
        "unfinished",
        "owner",
        "2026-04-06T15:00:00.000Z",
        [aspiration.id],
        "scheduled",
      ),
    ],
    "owner",
    "America/Chicago",
    new Date("2026-04-08T15:00:00.000Z"),
  );

  assert.deepEqual(progress, { count: 1, streak: 1 });
});

test("an unfinished current week keeps the prior completed-week streak", () => {
  const twiceWeekly = { ...aspiration, target_per_week: 2 };
  const progress = getAspirationProgress(
    twiceWeekly,
    [
      activity("current-1", "owner", "2026-04-20T15:00:00.000Z", [aspiration.id]),
      activity("last-1", "owner", "2026-04-13T15:00:00.000Z", [aspiration.id]),
      activity("last-2", "owner", "2026-04-14T15:00:00.000Z", [aspiration.id]),
      activity("prior-1", "owner", "2026-04-06T15:00:00.000Z", [aspiration.id]),
      activity("prior-2", "owner", "2026-04-07T15:00:00.000Z", [aspiration.id]),
    ],
    "owner",
    "America/Chicago",
    new Date("2026-04-22T15:00:00.000Z"),
  );

  assert.deepEqual(progress, { count: 1, streak: 2 });
});

test("retake prefill copies saved aspirations without changing their link IDs", () => {
  const saved = [{ ...aspiration, id: "stable-link-id" }];
  const prefilled = copyAspirationGoalsForSurvey(saved);

  assert.notEqual(prefilled, saved);
  assert.notEqual(prefilled[0], saved[0]);
  assert.equal(prefilled[0].id, "stable-link-id");
  assert.deepEqual(prefilled, saved);
  assert.deepEqual(copyAspirationGoalsForSurvey(undefined), []);
});
