import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import type { Activity, Data, Plan } from "@/src/shared/types";
import { canReadBeaconActivity } from "../beaconModules";
import {
  planStops,
  stopActivity,
  stopThread,
} from "@/src/features/plans/livingPlans";

export function readablePlanStopPosition(
  data: Data,
  activity: Activity,
  plan: Plan,
  viewer: string,
) {
  const stops = planStops(data, plan, viewer).flatMap((stop) => {
    if (stop.state !== "active" || stop.approval !== "approved") return [];
    const linkedActivity = stopActivity(data, stop, viewer);
    if (stop.activity_id) return linkedActivity ? [linkedActivity.id] : [];
    if (stop.thread_id && !stopThread(data, stop, viewer)) return [];
    return [linkedActivity?.id ?? null];
  });
  const index = stops.indexOf(activity.id);
  return index < 0 ? undefined : { position: index + 1, total: stops.length };
}

/** Returns only the concrete Plan explicitly linked to this readable Beacon. */
export function readablePlanForActivity(
  data: Data,
  activity: Activity,
  viewerId: string,
): Plan | undefined {
  if (
    data.viewer_id !== viewerId ||
    !canReadBeaconActivity(data, activity, viewerId)
  )
    return undefined;
  if (activity.plan_id) {
    const plan = data.plans.find((row) => row.id === activity.plan_id);
    return plan && canReadMapPlan(data, plan, viewerId) ? plan : undefined;
  }
  const linkedPlanIds = new Set(
    data.plan_stops
      ?.filter(
        (stop) =>
          stop.activity_id === activity.id &&
          stop.approval === "approved" &&
          stop.state === "active",
      )
      .map((stop) => stop.plan_id),
  );
  const matches = data.plans.filter(
    (plan) =>
      linkedPlanIds.has(plan.id) &&
      readablePlanStopPosition(data, activity, plan, viewerId),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
