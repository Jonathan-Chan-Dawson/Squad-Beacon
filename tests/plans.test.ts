import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "@/src/shared/demo";
import { normalizeData } from "@/src/shared/types";
import {
  buildPlanSchedule,
  detectPlanStepOverlaps,
  planLocalDateTimeToISO,
  suggestPlanConflicts,
  validatePlanSteps,
} from "@/src/features/plans/domain";
import type { PlanStep } from "@/src/shared/types";

const step = (overrides: Partial<PlanStep> = {}): PlanStep => ({
  title: "Morning run",
  description: "",
  category: "Fitness",
  location_name: "",
  lat: null,
  lng: null,
  day_offset: 0,
  start_time: "09:00",
  duration_minutes: 60,
  aspiration_ids: [],
  ...overrides,
});

test("local plan times follow IANA timezone DST rules and reject skipped times", () => {
  assert.equal(
    planLocalDateTimeToISO("2026-03-07", "09:00", "America/Chicago"),
    "2026-03-07T15:00:00.000Z",
  );
  assert.equal(
    planLocalDateTimeToISO("2026-03-09", "09:00", "America/Chicago"),
    "2026-03-09T14:00:00.000Z",
  );
  // During fall-back, use the later (standard-time) copy of 1:30 AM.
  assert.equal(
    planLocalDateTimeToISO("2026-11-01", "01:30", "America/Chicago"),
    "2026-11-01T07:30:00.000Z",
  );
  assert.throws(() =>
    planLocalDateTimeToISO("2026-03-08", "02:30", "America/Chicago"),
  );
  assert.throws(() =>
    planLocalDateTimeToISO("2026-02-30", "09:00", "America/Chicago"),
  );
  assert.throws(() =>
    planLocalDateTimeToISO("2026-03-07", "09:00", "Mars/Olympus"),
  );
});

test("plan steps enforce count, duration, local time, and complete coordinates", () => {
  assert.doesNotThrow(() => validatePlanSteps([step()]));
  assert.throws(() => validatePlanSteps([]), /between 1 and 30/);
  assert.throws(() => validatePlanSteps(Array.from({ length: 31 }, () => step())));
  assert.throws(() => validatePlanSteps([step({ start_time: "24:00" })]));
  assert.throws(() => validatePlanSteps([step({ duration_minutes: 1441 })]));
  assert.throws(() => validatePlanSteps([step({ lat: 41.8, lng: null })]));
  assert.throws(() => validatePlanSteps([step({ day_offset: 366 })]));
});

test("plan schedule applies date offsets in local time across a DST boundary", () => {
  const scheduled = buildPlanSchedule("2026-03-07", "America/Chicago", [
    step({ start_time: "10:00", duration_minutes: 90 }),
    step({ title: "Coffee", day_offset: 2, start_time: "10:00" }),
  ]);
  assert.deepEqual(
    scheduled.map(({ starts_at, ends_at }) => [starts_at, ends_at]),
    [
      ["2026-03-07T16:00:00.000Z", "2026-03-07T17:30:00.000Z"],
      ["2026-03-09T15:00:00.000Z", "2026-03-09T16:00:00.000Z"],
    ],
  );
});

test("overlap detection catches internal plan conflicts and suggests a free time", () => {
  const scheduled = buildPlanSchedule("2026-03-09", "America/Chicago", [
    step({ start_time: "10:00", duration_minutes: 60 }),
    step({ title: "Study", start_time: "10:30", duration_minutes: 60 }),
  ]);
  assert.deepEqual(detectPlanStepOverlaps(scheduled), [
    { first_step_index: 0, second_step_index: 1 },
  ]);

  const data = makeDemo(),
    other = {
      ...data.activities[0],
      id: "existing-conflict",
      owner_id: "plan-owner",
      starts_at: "2026-03-09T15:15:00.000Z",
      ends_at: "2026-03-09T15:45:00.000Z",
      status: "scheduled" as const,
    },
    stranger = { ...other, id: "stranger-conflict", owner_id: "someone-else" },
    plan = buildPlanSchedule("2026-03-09", "America/Chicago", [
      step({ start_time: "10:00", duration_minutes: 60 }),
      step({ title: "Study", start_time: "11:00", duration_minutes: 60 }),
    ]);
  const suggestions = suggestPlanConflicts(
    plan,
    [other, stranger],
    "plan-owner",
    "America/Chicago",
  );
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].step_index, 0);
  assert.equal(suggestions[0].activity.id, "existing-conflict");
  assert.equal(suggestions[0].suggested_start_time, "12:00");
  assert.equal(suggestions[0].suggested_starts_at, "2026-03-09T17:00:00.000Z");
});

test("snapshot normalization is idempotent and lets pre-survey profiles continue", () => {
  const demo = makeDemo(),
    legacy = normalizeData({
      profiles: [
        {
          ...demo.profiles[0],
          identity_tags: undefined as never,
          aspiration_goals: undefined as never,
          onboarding_survey_status: undefined as never,
        },
      ],
      activities: [
        {
          ...demo.activities[0],
          plan_id: undefined as never,
          plan_step_index: undefined as never,
          aspiration_ids: undefined as never,
        },
      ],
    });
  assert.equal(legacy.profiles[0].onboarding_survey_status, "skipped");
  assert.deepEqual(legacy.profiles[0].identity_tags, []);
  assert.deepEqual(legacy.profiles[0].aspiration_goals, []);
  assert.equal(legacy.activities[0].plan_id, null);
  assert.deepEqual(legacy.activities[0].aspiration_ids, []);
  assert.deepEqual(normalizeData(legacy), legacy);
});
