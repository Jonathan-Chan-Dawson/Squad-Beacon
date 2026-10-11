import test from "node:test";
import assert from "node:assert/strict";
import { demoAction, makeDemo, DEMO_ID } from "@/src/shared/demo";
import { buildPlanSchedule, stepsFromPlan } from "@/src/features/plans/domain";
import type { PlanStep } from "@/src/shared/types";

const step = (patch: Partial<PlanStep> = {}): PlanStep => ({
  title: "Dinner",
  description: "",
  category: "Social",
  location_name: "Table",
  lat: null,
  lng: null,
  day_offset: 0,
  start_time: "18:30",
  duration_minutes: 60,
  aspiration_ids: [],
  ...patch,
});
const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

test("relative Plan timing crosses midnight and specific ends follow local timezone rules", () => {
  const schedule = buildPlanSchedule("2026-10-10", "America/Chicago", [
    step({ start_time: "23:30" }),
    step({
      start_mode: "after_previous",
      end_mode: "specific",
      end_time: "02:00",
    }),
  ]);
  assert.equal(schedule[1].starts_at, schedule[0].ends_at);
  assert.equal(schedule[1].step.day_offset, 1);
  assert.equal(schedule[1].step.start_time, "00:30");
  assert.equal(schedule[1].step.duration_minutes, 90);
  assert.throws(
    () =>
      buildPlanSchedule(date, "UTC", [step({ start_mode: "after_previous" })]),
    /first Beacon/i,
  );
  assert.throws(
    () =>
      buildPlanSchedule(date, "UTC", [
        step({ end_mode: "specific", end_time: "25:00" }),
      ]),
    /end time/i,
  );
});

test("manual Plan execution preserves the reusable itinerary and advances a duration chain", () => {
  const source = makeDemo();
  const data = demoAction(source, "create_plan", {
    title: "Friday test",
    description: "",
    timezone: "UTC",
    start_date: date,
    steps: [
      step({ start_mode: "manual", end_mode: "manual" }),
      step({
        title: "Bowling",
        start_time: "19:30",
        start_mode: "after_previous",
      }),
      step({
        title: "Hangout",
        start_time: "20:30",
        start_mode: "after_previous",
      }),
    ],
  });
  const plan = data.plans.find(
    (item) => !source.plans.some((old) => old.id === item.id),
  )!;
  const beacons = data.activities.filter((item) => item.plan_id === plan.id);
  assert.equal(beacons[0].plan_started_at, null);
  assert.equal(beacons[1].plan_started_at, null);
  assert.throws(
    () => demoAction(data, "start_plan_beacon", { id: beacons[1].id }),
    /previous Beacon/i,
  );
  const started = demoAction(data, "start_plan_beacon", { id: beacons[0].id });
  const ended = demoAction(started, "end_plan_beacon", { id: beacons[0].id });
  const actual = ended.activities.filter((item) => item.plan_id === plan.id);
  assert.equal(actual[1].starts_at, actual[0].ends_at);
  assert.equal(actual[2].starts_at, actual[1].ends_at);
  assert.equal(
    stepsFromPlan(plan, ended.activities, ended.places)[0].start_time,
    "18:30",
  );
  const reusable = demoAction(ended, "create_routine", {
    plan_id: plan.id,
    weekdays: [5],
    interval_weeks: 1,
    run_mode: "manual",
  });
  const routine = reusable.plan_routines.find(
    (item) => item.plan_id === plan.id,
  )!;
  assert.equal(routine.next_occurrence_on, null);
  assert.equal(routine.run_mode, "manual");
  const run = demoAction(reusable, "run_routine_now", { id: routine.id });
  const freshPlan = run.plans.find(
    (item) => !reusable.plans.some((old) => old.id === item.id),
  )!;
  const fresh = run.activities.filter((item) => item.plan_id === freshPlan.id);
  assert.equal(fresh.length, 3);
  assert.equal(fresh[0].plan_started_at, null);
  assert.equal(fresh[0].plan_step?.start_mode, "manual");
  assert.equal(
    run.plan_routines.find((item) => item.id === routine.id)
      ?.next_occurrence_on,
    null,
  );
  const scheduled = demoAction(reusable, "edit_routine", {
    id: routine.id,
    run_mode: "scheduled",
    weekdays: [5],
    interval_weeks: 1,
    ends_on: null,
    reminder_minutes: null,
  });
  const repeated = demoAction(scheduled, "run_routine_once", {
    id: routine.id,
  });
  const repeatedPlan = repeated.plans.find(
    (item) => !scheduled.plans.some((old) => old.id === item.id),
  )!;
  assert.equal(
    repeated.activities.find((item) => item.plan_id === repeatedPlan.id)
      ?.plan_started_at,
    null,
    "manual start resets on every scheduled reuse, even after the source was started",
  );
});

test("adding a Beacon to an existing Plan keeps ordering, audience and overlap checks", () => {
  const source = makeDemo();
  const data = demoAction(source, "create_plan", {
    title: "Insert test",
    description: "",
    timezone: "UTC",
    start_date: date,
    steps: [step()],
  });
  const plan = data.plans.find(
    (item) => !source.plans.some((old) => old.id === item.id),
  )!;
  const payload = {
    plan_id: plan.id,
    position: 0,
    title: "Coffee",
    category: "Social",
    starts_at: `${date}T20:00:00Z`,
    ends_at: `${date}T21:00:00Z`,
    timezone: "UTC",
    audience: "private",
    audience_id: null,
    mode: "squad",
    approval_required: false,
  };
  const result = demoAction(data, "create_plan_beacon", payload);
  const beacons = result.activities
    .filter((item) => item.plan_id === plan.id)
    .sort((a, b) => (a.plan_step_index ?? 0) - (b.plan_step_index ?? 0));
  assert.equal(beacons[0].title, "Coffee");
  assert.equal(beacons[1].title, "Dinner");
  assert.equal(beacons[0].owner_id, DEMO_ID);
  assert.throws(
    () =>
      demoAction(data, "create_plan_beacon", {
        ...payload,
        audience: "friends",
      }),
    /Plan audience/i,
  );
  assert.throws(
    () => demoAction(data, "create_plan_beacon", { ...payload, position: 3 }),
    /position/i,
  );
  assert.throws(
    () => demoAction(result, "create_plan_beacon", { ...payload, position: 2 }),
    /overlap/i,
  );
});
