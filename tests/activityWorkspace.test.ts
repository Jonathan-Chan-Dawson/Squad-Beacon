import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "@/src/shared/demo";
import { normalizeData } from "@/src/shared/types";
import { applyDemoLivingPlan } from "@/src/features/plans/demoLivingPlans";
import {
  continuePlanning,
  hasUnfinishedPlanWork,
} from "@/src/features/plans/planWorkspaceSelectors";

function fixture() {
  let data = normalizeData(makeDemo());
  const viewer = data.viewer_id!;
  data = applyDemoLivingPlan(data, viewer, "create_living_plan", {
    title: "Unfinished",
    timezone: "UTC",
  })!;
  return { data, viewer, plan: data.plans.at(-1)! };
}
test("Continue Planning includes saved empty Plans, bounded to three, and excludes cancelled/private/stale snapshots", () => {
  const { data, viewer, plan } = fixture();
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), true);
  assert.equal(
    hasUnfinishedPlanWork(
      data,
      { ...plan, status: "cancelled" },
      viewer,
      Date.now(),
    ),
    false,
  );
  assert.equal(
    hasUnfinishedPlanWork(data, plan, "outsider", Date.now()),
    false,
  );
  assert.equal(
    hasUnfinishedPlanWork(
      { ...data, viewer_id: "other" },
      plan,
      viewer,
      Date.now(),
    ),
    false,
  );
  data.plans = Array.from({ length: 5 }, (_, i) => ({
    ...plan,
    id: `test-${i}`,
    created_at: `2026-10-2${i}T00:00:00Z`,
  }));
  assert.deepEqual(
    continuePlanning(data, viewer, Date.now()).map((p) => p.id),
    ["test-4", "test-3", "test-2"],
  );
});
test("historical itineraries and unavailable, skipped, dismissed stops do not manufacture unfinished work", () => {
  let { data, viewer, plan } = fixture();
  data = applyDemoLivingPlan(data, viewer, "add_plan_stop", {
    plan_id: plan.id,
    title: "Idea",
    revision: 0,
  })!;
  plan = data.plans.find((p) => p.id === plan.id)!;
  const stop = data.plan_stops!.find((s) => s.plan_id === plan.id)!;
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), true);
  stop.activity_id = "missing";
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), false);
  stop.activity_id = null;
  stop.state = "skipped";
  assert.equal(
    hasUnfinishedPlanWork(
      data,
      { ...plan, status: "scheduled" },
      viewer,
      Date.now(),
    ),
    false,
  );
  stop.state = "active";
  stop.approval = "dismissed";
  assert.equal(
    hasUnfinishedPlanWork(
      data,
      { ...plan, status: "scheduled" },
      viewer,
      Date.now(),
    ),
    false,
  );
});
test("completed historical Beacon itineraries are excluded even if stale plain ideas remain", () => {
  let { data, viewer, plan } = fixture();
  data = applyDemoLivingPlan(data, viewer, "add_plan_stop", {
    plan_id: plan.id,
    title: "Idea",
    revision: 0,
  })!;
  plan = data.plans.find((p) => p.id === plan.id)!;
  const stop = data.plan_stops!.find((s) => s.plan_id === plan.id)!;
  const activity = {
    ...data.activities.find((a) => a.owner_id === viewer)!,
    id: "historical",
    plan_id: plan.id,
    status: "completed" as const,
    starts_at: "2020-01-01T12:00:00Z",
    ends_at: "2020-01-01T13:00:00Z",
    plan_started_at: "2020-01-01T12:00:00Z",
  };
  data.activities.push(activity);
  data.plan_stops!.push({
    ...stop,
    id: "historic-stop",
    position: 1,
    activity_id: activity.id,
  });
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), false);
});

import {
  pendingPlanCreation,
  retainPlanCreation,
  clearPlanCreation,
} from "@/src/features/plans/planCreationRecovery";
test("uncertain creation retains its immutable request identity across route recovery and isolates accounts", () => {
  const attempt = {
    id: "original-request",
    payload: { title: "Plan", timezone: "UTC" },
  };
  retainPlanCreation("alice:1", attempt);
  assert.equal(pendingPlanCreation("alice:1"), attempt);
  assert.equal(pendingPlanCreation("bob:2"), undefined);
  const next = { id: "next-request", payload: { title: "Other" } };
  retainPlanCreation("bob:2", next);
  clearPlanCreation("alice:1");
  assert.equal(pendingPlanCreation("bob:2"), next);
  clearPlanCreation("bob:2");
});

test("decision continuation follows terminal lifecycle and missing references stay excluded", () => {
  let { data, viewer, plan } = fixture();
  data = applyDemoLivingPlan(data, viewer, "add_plan_stop", {
    plan_id: plan.id,
    title: "Decision",
    revision: 0,
  })!;
  plan = data.plans.find((p) => p.id === plan.id)!;
  const stop = data.plan_stops!.find((s) => s.plan_id === plan.id)!;
  const sample = data.planning_threads[0];
  const thread = {
    ...sample,
    id: "work-thread",
    owner_id: viewer,
    audience: "private" as const,
    audience_id: null,
    status: "open" as const,
    deadline_at: "2099-01-01T00:00:00Z",
    materialized_activity_id: null,
    not_organized_at: null,
    continuation_closed_at: null,
  };
  data.planning_threads.push(thread);
  stop.thread_id = thread.id;
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), true);
  data.planning_threads[data.planning_threads.length - 1] = {
    ...thread,
    status: "cancelled",
  };
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), false);
  data.planning_threads[data.planning_threads.length - 1] = {
    ...thread,
    status: "resolved",
    finalized_at: "2026-10-01T00:00:00Z",
  };
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), true);
  data.planning_threads[
    data.planning_threads.length - 1
  ].continuation_closed_at = "2026-10-02T00:00:00Z";
  assert.equal(hasUnfinishedPlanWork(data, plan, viewer, Date.now()), false);
});

import {
  planDateLabel,
  planListPresentation,
} from "@/src/features/plans/planWorkspaceSelectors";
test("Plan row dates are human-readable date-only labels without timezone shifts", () => {
  const now = Date.parse("2026-10-27T00:00:00Z");
  assert.match(planDateLabel("2026-10-30", now), /Oct.*30/);
  assert.match(planDateLabel("2025-10-30", now), /2025/);
  assert.equal(planDateLabel(null, now), "Date undecided");
  assert.equal(planDateLabel("2026-02-30", now), "Date undecided");
});
test("Plan summaries show only meaningful progress and retain private audience boundaries", () => {
  let { data, viewer, plan } = fixture();
  assert.equal(
    planListPresentation(data, plan, viewer, Date.now()).progress,
    "No stops yet",
  );
  data = applyDemoLivingPlan(data, viewer, "add_plan_stop", {
    plan_id: plan.id,
    title: "First idea",
    revision: 0,
  })!;
  plan = data.plans.find((p) => p.id === plan.id)!;
  const summary = planListPresentation(data, plan, viewer, Date.now());
  assert.equal(summary.progress, "1 idea");
  assert.equal(summary.context, "Personal");
  assert.equal(
    planListPresentation(
      { ...data, viewer_id: "other" },
      plan,
      viewer,
      Date.now(),
    ).date,
    "Date unavailable",
  );
  assert.equal(
    planListPresentation(
      data,
      { ...plan, squad_id: "missing-group" },
      viewer,
      Date.now(),
    ).context,
    "Plan unavailable",
  );
});
