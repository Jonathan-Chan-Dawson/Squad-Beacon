import type { Activity } from "@/src/shared/types";

/** Published group Beacon lifecycle; Plan placeholder dates do not imply a start. */
export function isBeaconLive(activity: Activity, now: number): boolean {
  const start = Date.parse(activity.starts_at);
  const end = Date.parse(activity.ends_at);
  return (
    activity.mode !== "solo" &&
    activity.status === "scheduled" &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start <= now &&
    end > now &&
    !(activity.plan_id && activity.plan_step && !activity.plan_started_at)
  );
}
