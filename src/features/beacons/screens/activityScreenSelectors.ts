import type { Activity } from "@/src/shared/types";

export type ActivityPeriods = { active: Activity[]; upcoming: Activity[] };

export function initialHistoryExpanded(hasCurrentOrUpcoming: boolean, storeLoading: boolean) {
  return !storeLoading && !hasCurrentOrUpcoming;
}

export function showHistoryForSearch(expanded: boolean, query: string) {
  return expanded || !!query.trim();
}

/** Split confirmed activities into valid scheduled periods and omit unstarted Plan children. */
export function selectActivityPeriods(activities: readonly Activity[], now: number): ActivityPeriods {
  const active: Activity[] = [];
  const upcoming: Activity[] = [];
  for (const activity of activities) {
    if (
      activity.status !== "scheduled" ||
      !Number.isFinite(Date.parse(activity.starts_at)) ||
      !Number.isFinite(Date.parse(activity.ends_at)) ||
      Date.parse(activity.ends_at) <= now ||
      (activity.plan_id != null && activity.plan_step != null && activity.plan_started_at == null)
    ) continue;
    if (Date.parse(activity.starts_at) <= now) active.push(activity);
    else upcoming.push(activity);
  }
  const byStart = (left: Activity, right: Activity) =>
    Date.parse(left.starts_at) - Date.parse(right.starts_at) || left.id.localeCompare(right.id);
  active.sort(byStart);
  upcoming.sort(byStart);
  return { active, upcoming };
}

export function historyStatusLabel(label: "cancelled" | "completed" | "ended") {
  return label === "cancelled" ? "Cancelled" : label === "completed" ? "Completed" : "Ended";
}
