import type { RoutineCalendarRow } from "../src/features/beacons/calendarRoutineProjection";
import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { calendarMonthDates, calendarScheduleStart, calendarWeekDates, selectCalendarItems, selectCalendarWeekItems } from "../src/features/beacons/calendarSelectors";
import type { Activity, Plan } from "../src/shared/types";
import type { PlanRoutine } from "../src/features/plans/routines";

const now = Date.parse("2026-10-13T16:23:00Z"), timezone = "America/Chicago";
function fixture() {
  const data = makeDemo();
  const plan: Plan = { id: "calendar-plan", owner_id: DEMO_ID, squad_id: null, title: "Friday Plan", description: "", timezone,
    start_date: "2026-10-09", status: "scheduled", created_at: "2026-10-01T16:00:00Z" };
  const activity: Activity = { ...data.activities[0], id: "source", owner_id: DEMO_ID, mode: "squad", audience: "friends", audience_id: null,
    plan_id: plan.id, plan_step_index: 0, plan_started_at: "2026-10-09T17:00:00Z", status: "scheduled", starts_at: "2026-10-09T17:00:00Z", ends_at: "2026-10-09T18:00:00Z", timezone };
  const routine: PlanRoutine = { id: "calendar-routine", plan_id: plan.id, owner_id: DEMO_ID, weekdays: [5], interval_weeks: 1,
    anchor_date: "2026-10-09", ends_on: null, reminder_minutes: 30, status: "active", next_occurrence_on: "2026-10-16", created_at: "2026-10-01T16:00:00Z", updated_at: "2026-10-01T16:00:00Z" };
  data.plans = [plan]; data.activities = [activity]; data.plan_routines = [routine];
  return { data, plan, activity, routine };
}

test("calendar commitments respect approval, visibility and timezone midnight boundaries", () => {
  const { data, activity } = fixture();
  data.plans = []; data.plan_routines = [];
  data.activities = [
    { ...activity, id: "midnight", plan_id: null, starts_at: "2026-10-14T04:00:00Z", ends_at: "2026-10-14T05:00:00Z" },
    { ...activity, id: "approved", plan_id: null, owner_id: "jordan", mode: "invite", approval_required: true },
    { ...activity, id: "pending", plan_id: null, owner_id: "jordan", mode: "invite", approval_required: true },
    { ...activity, id: "solo", plan_id: null, mode: "solo" },
    { ...activity, id: "cancelled", plan_id: null, status: "cancelled" },
  ];
  data.rsvps = [
    { activity_id: "approved", user_id: DEMO_ID, status: "going", approved: true },
    { activity_id: "pending", user_id: DEMO_ID, status: "going", approved: false },
  ];
  const items = selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now);
  assert.equal(items.find((row) => row.id === "midnight")?.date, "2026-10-13");
  assert.equal(items.filter((row) => row.id === "midnight").length, 1, "exclusive midnight end belongs only to the preceding day");
  assert.ok(items.some((row) => row.id === "approved"));
  assert.ok(!items.some((row) => ["pending", "solo", "cancelled"].includes(row.id)));
  assert.deepEqual(selectCalendarItems(data, "wrong-viewer", "2026-10", timezone, now), []);
});

test("Routine rows come from bounded authorized projection, with paused/ended/manual/cancelled and outside-month rows omitted", () => {
  const { data, routine, plan } = fixture();
  const projected: RoutineCalendarRow[]=[{routineId:routine.id,planId:plan.id,date:"2026-10-16",state:"projected"}];
  let rows = selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected).filter((row) => row.kind === "routine");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-10-16");
  assert.equal(rows[0].startsAt, undefined);
  assert.equal(rows[0].timezone, timezone);
  projected[0].date = "2026-10-23"; // The server omitted a skipped occurrence.
  rows = selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected).filter((row) => row.kind === "routine");
  assert.deepEqual(rows.map((row) => row.date), ["2026-10-23"]);
  assert.equal(selectCalendarItems(data, DEMO_ID, "2026-11", timezone, now, projected).filter((row) => row.kind === "routine").length, 0);
  for (const status of ["paused", "ended"] as const) {
    routine.status = status;
    assert.equal(selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected).filter((row) => row.kind === "routine").length, 0);
  }
  routine.status = "active"; routine.run_mode = "manual";
  assert.equal(selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected).filter((row) => row.kind === "routine").length, 0);
  routine.run_mode = "scheduled"; plan.status = "cancelled";
  assert.equal(selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected).filter((row) => row.kind !== "beacon").length, 0);
});

test("already-published source occurrence does not also show as a projected Routine", () => {
  const { data, activity, routine, plan } = fixture();
  const projected: RoutineCalendarRow[]=[{routineId:routine.id,planId:plan.id,date:"2026-10-16",state:"projected"}];
  activity.starts_at = "2026-10-16T17:00:00Z"; activity.ends_at = "2026-10-16T18:00:00Z";
  const rows = selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected);
  assert.ok(rows.some((row) => row.kind === "beacon"));
  assert.ok(!rows.some((row) => row.kind === "routine"));
});

test("Plan membership does not grant Beacon attendance or fabricate timing from inaccessible preceding stops", () => {
  const { data, plan, activity, routine } = fixture();
  const projected: RoutineCalendarRow[]=[{routineId:routine.id,planId:plan.id,date:"2026-10-16",state:"projected"}];
  plan.owner_id = "jordan"; plan.squad_id = "boxing";
  data.plan_members = [{ plan_id: plan.id, user_id: DEMO_ID, joined_at: "2026-10-01T16:00:00Z" }];
  data.activities = [
    { ...activity, id: "hidden-first", owner_id: "jordan", audience: "private", plan_step_index: 0 },
    { ...activity, id: "visible-second", owner_id: "jordan", audience: "friends", plan_step_index: 1, starts_at: "2026-10-09T19:00:00Z", ends_at: "2026-10-09T20:00:00Z" },
  ];
  const rows = selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected);
  assert.ok(!rows.some((row) => row.kind === "beacon"));
  const preview = rows.find((row) => row.kind === "routine");
  assert.ok(preview);
  assert.equal(preview.startsAt, undefined);
  assert.equal(preview.date, "2026-10-16");
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "jordan" });
  assert.deepEqual(selectCalendarItems(data, DEMO_ID, "2026-10", timezone, now, projected), []);
});

test("date grids handle leap months and week boundaries, scheduling reuses timezone-aware DST conversion", () => {
  assert.equal(calendarMonthDates("2028-02").days.length, 29);
  assert.deepEqual(calendarWeekDates("2026-11-01"), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  assert.equal(calendarScheduleStart("2026-10-13", now, timezone), new Date(now).toISOString());
  assert.equal(calendarScheduleStart("2026-11-02", now, timezone), "2026-11-02T17:23:00.000Z");
  assert.throws(() => calendarScheduleStart("2026-10-12", now, timezone), /future/);
  assert.throws(() => calendarMonthDates("2026-13"), /valid/);
  assert.throws(() => calendarScheduleStart("2027-03-14", Date.parse("2026-10-13T07:30:00Z"), timezone), /clock change/);
});

test("week view includes agenda dots on both sides of a month boundary", () => {
  const { data, activity } = fixture();
  data.activities = [
    { ...activity, id: "october", plan_id: null, starts_at: "2026-10-26T17:00:00Z", ends_at: "2026-10-26T18:00:00Z" },
    { ...activity, id: "november", plan_id: null, starts_at: "2026-11-01T17:00:00Z", ends_at: "2026-11-01T18:00:00Z" },
    { ...activity, id: "outside", plan_id: null, starts_at: "2026-11-02T17:00:00Z", ends_at: "2026-11-02T18:00:00Z" },
  ];
  data.plans = []; data.plan_routines = [];
  assert.deepEqual(selectCalendarWeekItems(data, DEMO_ID, "2026-10-31", timezone, now).map((row) => row.id), ["october", "november"]);
});
