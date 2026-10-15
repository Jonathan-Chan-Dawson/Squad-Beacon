import assert from "node:assert/strict";
import test from "node:test";
import type { Activity } from "../src/shared/types";
import {
  historyStatusLabel,
  initialHistoryExpanded,
  selectActivityPeriods,
  showHistoryForSearch,
} from "../src/features/beacons/screens/activityScreenSelectors";

const now = Date.parse("2026-10-14T12:00:00.000Z");

function activity(
  id: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<Activity> = {},
): Activity {
  return {
    id,
    owner_id: "viewer",
    title: id,
    category: "Social",
    mode: "squad",
    starts_at: startsAt,
    ends_at: endsAt,
    timezone: "UTC",
    approval_required: false,
    status: "scheduled",
    audience: "friends",
    audience_id: null,
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    ...extra,
  };
}

test("personal activity periods include live and upcoming, omit ended and unresolved Plan children", () => {
  const result = selectActivityPeriods([
    activity("later", "2026-10-15T12:00:00Z", "2026-10-15T13:00:00Z"),
    activity("live", "2026-10-14T11:00:00Z", "2026-10-14T13:00:00Z"),
    activity("past", "2026-10-14T09:00:00Z", "2026-10-14T10:00:00Z"),
    activity("cancelled", "2026-10-14T11:00:00Z", "2026-10-14T13:00:00Z", { status: "cancelled" }),
    activity("unstarted-plan-step", "2026-10-15T14:00:00Z", "2026-10-15T15:00:00Z", {
      plan_id: "plan",
      plan_step: { title: "Step", description: "", category: "Social", location_name: "", lat: null, lng: null, day_offset: 0, start_time: "12:00", duration_minutes: 60 },
      plan_started_at: null,
    }),
  ], now);

  assert.deepEqual(result.active.map((row) => row.id), ["live"]);
  assert.deepEqual(result.upcoming.map((row) => row.id), ["later"]);
});

test("history disclosure adapts to current activity and search opens collapsed history", () => {
  assert.equal(initialHistoryExpanded(true, false), false);
  assert.equal(initialHistoryExpanded(false, false), true);
  assert.equal(initialHistoryExpanded(false, true), false);
  assert.equal(showHistoryForSearch(false, "  pottery  "), true);
  assert.equal(showHistoryForSearch(false, "   "), false);
});

test("history labels distinguish cancelled, completed, and elapsed Beacons", () => {
  assert.equal(historyStatusLabel("cancelled"), "Cancelled");
  assert.equal(historyStatusLabel("completed"), "Completed");
  assert.equal(historyStatusLabel("ended"), "Ended");
});
