import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import type { Activity, Data, Plan } from "@/src/shared/types";

/** Returns only the concrete Plan explicitly linked to this readable Beacon. */
export function readablePlanForActivity(
  data: Data,
  activity: Activity,
  viewerId: string,
): Plan | undefined {
  if (!activity.plan_id || data.viewer_id !== viewerId) return undefined;
  const plan = data.plans.find((row) => row.id === activity.plan_id);
  return plan && canReadMapPlan(data, plan, viewerId) ? plan : undefined;
}
