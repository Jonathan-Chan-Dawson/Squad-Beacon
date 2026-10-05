import test from "node:test";
import assert from "node:assert/strict";
import {
  addLocalDays,
  applyPlanRoutineDemo,
  isoWeekday,
  isLocalDate,
  makeRoutineDemo,
  nextRoutineOccurrence,
  validateRoutineSchedule,
} from "@/src/features/plans/routines";
import { emptyData } from "@/src/shared/types";

test("routine calendar helpers use ISO weekdays and anchored week intervals", () => {
  assert.equal(isoWeekday("2026-10-04"), 7);
  assert.equal(addLocalDays("2026-10-04", 5), "2026-10-09");
  assert.equal(isLocalDate("2026-02-29"), false);
  assert.equal(isLocalDate("2026-10-09"), true);
  assert.equal(
    nextRoutineOccurrence({
      anchor_date: "2026-10-09",
      weekdays: [5],
      interval_weeks: 1,
      after_date: "2026-10-08",
    }),
    "2026-10-09",
  );
  assert.equal(
    nextRoutineOccurrence({
      anchor_date: "2026-10-09",
      weekdays: [5],
      interval_weeks: 2,
      after_date: "2026-10-09",
    }),
    "2026-10-23",
  );
  assert.equal(
    nextRoutineOccurrence({
      anchor_date: "2026-10-09",
      weekdays: [1, 5],
      interval_weeks: 2,
      after_date: "2026-10-09",
      ends_on: "2026-10-20",
    }),
    "2026-10-19",
  );
  assert.equal(
    nextRoutineOccurrence({
      anchor_date: "2026-10-09",
      weekdays: [5],
      interval_weeks: 1,
      after_date: "2026-10-09",
      ends_on: "2026-10-15",
    }),
    null,
  );
});

test("routine schedule validation rejects malformed and duplicate weekdays", () => {
  const valid = { anchor_date: "2026-10-09", weekdays: [5], interval_weeks: 1, ends_on: null, reminder_minutes: 30 };
  assert.doesNotThrow(() => validateRoutineSchedule(valid));
  assert.throws(() => validateRoutineSchedule({ ...valid, weekdays: [] }), /weekday/i);
  assert.throws(() => validateRoutineSchedule({ ...valid, weekdays: [5, 5] }), /once/i);
  assert.throws(() => validateRoutineSchedule({ ...valid, weekdays: [8] }), /weekday/i);
  assert.throws(() => validateRoutineSchedule({ ...valid, interval_weeks: 0 }), /interval/i);
  assert.throws(() => validateRoutineSchedule({ ...valid, ends_on: "2026-10-08" }), /end date/i);
  assert.throws(() => validateRoutineSchedule({ ...valid, reminder_minutes: 0 }), /reminder/i);
  assert.throws(() => validateRoutineSchedule({ ...valid, reminder_minutes: 10081 }), /reminder/i);
});

test("demo helper provides a future Friday plan with three source Beacons", () => {
  const data = emptyData();
  const fixture = makeRoutineDemo(data, "demo-user", new Date("2026-10-04T12:00:00.000Z"));
  assert.equal(fixture.plan_routines.length, 1);
  assert.deepEqual(fixture.plan_routines[0].weekdays, [5]);
  assert.equal(fixture.plan_routines[0].next_occurrence_on, "2026-10-16");
  assert.equal(fixture.plans[0].start_date, "2026-10-09");
  assert.equal(fixture.activities.length, 3);
  assert.deepEqual(fixture.activities.map((activity) => activity.plan_step_index), [0, 1, 2]);
  assert.deepEqual(makeRoutineDemo({ ...data, plans: fixture.plans, plan_routines: fixture.plan_routines }, "demo-user").plans, []);
});

test("demo creation and run-once actions create new plans and retain virtual links", () => {
  const userId = "demo-owner";
  const fixture = makeRoutineDemo(emptyData(), userId, new Date("2026-10-04T12:00:00.000Z"));
  const base = {
    ...emptyData(),
    plans: fixture.plans,
    activities: fixture.activities,
    places: fixture.places.map((place, index) => index === 0 ? { ...place, online_url: "https://example.com/meet" } : place),
  };
  const created = applyPlanRoutineDemo(base, "create_routine", {
    plan_id: fixture.plans[0].id, weekdays: [5], interval_weeks: 1, ends_on: null, reminder_minutes: 30,
  }, userId, new Date("2026-10-04T12:00:00.000Z"));
  assert.equal(created.plan_routines[0].next_occurrence_on, "2026-10-09");
  const state = { ...base, plan_routines: created.plan_routines };
  const ran = applyPlanRoutineDemo(state, "run_routine_once", { id: created.plan_routines[0].id }, userId, new Date("2026-10-04T12:00:00.000Z"));
  assert.equal(ran.plans.length, 1);
  assert.equal(ran.activities.length, 3);
  assert.equal(ran.places[0].online_url, "https://example.com/meet");
  assert.equal(ran.plan_routines[0].next_occurrence_on, "2026-10-16");
});
