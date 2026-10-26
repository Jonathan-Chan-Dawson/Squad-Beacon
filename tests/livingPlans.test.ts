import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoAction } from "@/src/shared/demo";
import { normalizeData } from "@/src/shared/types";
import { applyDemoLivingPlan } from "@/src/features/plans/demoLivingPlans";
import {
  planPermissions,
  planStops,
  planSuggestedStart,
} from "@/src/features/plans/livingPlans";
import { selectCalendarItems } from "@/src/features/beacons/calendarSelectors";

test("tentative Plans persist without activities and reject stale edits", () => {
  const base = normalizeData(makeDemo());
  const viewer = base.viewer_id!;
  let data = applyDemoLivingPlan(base, viewer, "create_living_plan", {
    title: "Small adventure",
    timezone: "UTC",
  })!;
  const plan = data.plans.at(-1)!;
  assert.equal(plan.start_date, null);
  assert.equal(
    planSuggestedStart(
      { ...plan, start_date: "2026-11-01", timezone: "America/New_York" },
      undefined,
      Date.parse("2026-10-25T00:00:00Z"),
    ),
    "2026-11-01T23:00:00.000Z",
  );
  assert.equal(
    planSuggestedStart(
      { ...plan, start_date: "2026-10-01" },
      undefined,
      Date.parse("2026-10-25T00:00:00Z"),
    ),
    undefined,
  );
  assert.equal(data.activities.length, base.activities.length);
  assert.equal(planStops(data, plan, viewer).length, 0);
  data = applyDemoLivingPlan(data, viewer, "add_plan_stop", {
    plan_id: plan.id,
    title: "A cafe",
    revision: 0,
  })!;
  assert.equal(planStops(data, plan, viewer)[0].title, "A cafe");
  assert.throws(
    () =>
      applyDemoLivingPlan(data, viewer, "add_plan_stop", {
        plan_id: plan.id,
        title: "Stale",
        revision: 0,
      }),
    /changed/,
  );
  assert.equal(planPermissions(data, plan, "outsider").readable, false);
  assert.equal(normalizeData(data).plan_stops?.length, 1);
});

test("Plan ordering and cancellation never rewrite a linked Beacon", () => {
  let data = normalizeData(makeDemo());
  const viewer = data.viewer_id!;
  data = applyDemoLivingPlan(data, viewer, "create_living_plan", {
    title: "A favorite",
    timezone: "UTC",
  })!;
  const plan = data.plans.at(-1)!;
  const activity = data.activities.find((a) => a.owner_id === viewer)!;
  const original = structuredClone(activity);
  data = applyDemoLivingPlan(data, viewer, "add_plan_stop", {
    plan_id: plan.id,
    activity_id: activity.id,
  })!;
  data = applyDemoLivingPlan(data, viewer, "add_plan_stop", {
    plan_id: plan.id,
    title: "Maybe dessert",
  })!;
  const idea = data.plan_stops!.at(-1)!;
  data = applyDemoLivingPlan(data, viewer, "move_plan_stop", {
    plan_id: plan.id,
    stop_id: idea.id,
    position: 0,
  })!;
  data = applyDemoLivingPlan(data, viewer, "update_living_plan", {
    plan_id: plan.id,
    title: "An evolving adventure",
    cancel: true,
  })!;
  assert.deepEqual(
    data.activities.find((a) => a.id === activity.id),
    original,
  );
});

test("a recurring Beacon uses a reviewed source and preserves each occurrence", () => {
  let data = normalizeData(makeDemo());
  const activity = data.activities.find(
    (a) =>
      a.owner_id === data.viewer_id &&
      a.mode !== "solo" &&
      a.status === "scheduled",
  )!;
  assert.ok(activity);
  const original = structuredClone(activity),
    count = data.activities.length;
  data = demoAction(data, "repeat_beacon", {
    activity_id: activity.id,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    interval_weeks: 1,
  });
  const routine = data.plan_routines.at(-1)!;
  assert.equal(data.activities.length, count);
  assert.deepEqual(
    data.activities.find((a) => a.id === activity.id),
    original,
  );
  data.activities.find((a) => a.id === activity.id)!.title = "Edited original";
  data = demoAction(data, "run_routine_now", { id: routine.id });
  const first = data.plans.at(-1)!;
  assert.equal(
    data.activities.find((a) => a.plan_id === first.id)?.title,
    original.title,
  );
  data = demoAction(data, "update_routine_source", {
    id: routine.id,
    confirmed_source: true,
  });
  data = demoAction(data, "run_routine_now", { id: routine.id });
  assert.equal(
    data.activities.find((a) => a.plan_id === data.plans.at(-1)!.id)?.title,
    "Edited original",
  );
  assert.equal(
    data.activities.find((a) => a.plan_id === first.id)?.title,
    original.title,
  );
});

test("Calendar groups linked activities once and labels dated tentative Plans", () => {
  let data = normalizeData(makeDemo());
  const viewer = data.viewer_id!;
  const activity = data.activities.find(
    (a) =>
      a.owner_id === viewer && a.mode !== "solo" && a.status === "scheduled",
  )!;
  const date = activity.starts_at.slice(0, 10),
    month = date.slice(0, 7);
  data = demoAction(data, "create_living_plan", {
    title: "A grouped afternoon",
    timezone: "UTC",
    start_date: date,
  });
  const plan = data.plans.at(-1)!;
  data = demoAction(data, "add_plan_stop", {
    plan_id: plan.id,
    activity_id: activity.id,
  });
  data = demoAction(data, "create_living_plan", {
    title: "A tentative afternoon",
    timezone: "UTC",
    start_date: date,
  });
  const rows = selectCalendarItems(data, viewer, month, "UTC", Date.now());
  assert.equal(rows.filter((r) => r.id === activity.id).length, 0);
  assert.equal(
    rows.filter((r) => r.activities?.some((a) => a.id === activity.id)).length,
    1,
  );
  assert.ok(
    rows.some((r) => r.title === "A tentative afternoon" && r.tentative),
  );
});

test("removing a legacy association does not resurrect its Beacon or change its identity", () => {
  let data = normalizeData(makeDemo());
  const plan = data.plans.find(
    (p) =>
      p.owner_id === data.viewer_id &&
      data.activities.some((a) => a.plan_id === p.id),
  )!;
  const stop = planStops(data, plan, data.viewer_id)[0];
  const original = structuredClone(
    data.activities.find((a) => a.id === stop.activity_id),
  );
  data = demoAction(data, "remove_plan_stop", {
    plan_id: plan.id,
    stop_id: stop.id,
  });
  assert.ok(
    !planStops(
      data,
      data.plans.find((p) => p.id === plan.id)!,
      data.viewer_id,
    ).some((s) => s.activity_id === stop.activity_id),
  );
  assert.deepEqual(
    data.activities.find((a) => a.id === stop.activity_id),
    original,
  );
});
