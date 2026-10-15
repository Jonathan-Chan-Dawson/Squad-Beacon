import type { Activity, Data } from "@/src/shared/types";
import { canReadBeaconActivity, canReadBeaconModuleEntry, canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { isApprovedGoing, isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
import { browseBeacons, type Period, type SortOrder } from "@/src/shared/browsing";
import type { BeaconToolId } from "./activityToolEntry";

/** Confirmed means hosting or approved attendance, never a pending request. */
export function confirmedHubActivities(data: Data, userId: string | null) {
  if (!userId || data.viewer_id !== userId) return [];
  return data.activities.filter((activity) => activity.mode !== "solo" &&
    canReadBeaconActivity(data, activity, userId) &&
    (activity.owner_id === userId || isApprovedGoing(activity,
      data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === userId))));
}

export function nearestHubActivity(activities: Activity[], now: number) {
  return activities.filter((activity) => activity.status === "scheduled" &&
    Number.isFinite(Date.parse(activity.starts_at)) && Date.parse(activity.ends_at) > now &&
    isHubActivityStarted(activity))
    .sort((left, right) => Number(Date.parse(left.starts_at) > now) - Number(Date.parse(right.starts_at) > now) ||
      Date.parse(left.starts_at) - Date.parse(right.starts_at) || left.id.localeCompare(right.id))[0];
}

/** Plan children waiting for a manual start or a prior step have placeholder dates. */
export function isHubActivityStarted(activity: Activity) {
  return !(activity.plan_id && activity.plan_step && activity.plan_started_at == null);
}

export function toggleHubFriend(selected: string[], id: string) {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

/** Reject the whole selection when eligibility changes; never silently prune it. */
export function hubInviteeParams(selected: string[], eligibleIds: string[]) {
  if (!selected.length) throw new Error("Select friends to plan with.");
  const eligible = new Set(eligibleIds);
  if (selected.some((id) => !eligible.has(id))) {
    throw new Error("A selected friend is no longer available. Review your selection before continuing.");
  }
  return { inviteeIds: JSON.stringify([...new Set(selected)]) };
}

/** Personal attendance is independent of discovery query, audience, area and category preferences. */
export function confirmedHubPeriodActivities(data: Data, userId: string | null, period: Period, sort: SortOrder, now: number) {
  if (!userId || data.viewer_id !== userId) return [];
  const confirmed = new Set(confirmedHubActivities(data, userId).map((activity) => activity.id));
  return browseBeacons(data, userId, { period, sort, query: "", category: "All categories", audience: "Everyone", joined: false }, now)
    .filter((activity) => confirmed.has(activity.id));
}

export function hubToolShortcuts(data: Data, activity: Activity, userId: string | null): { tool: BeaconToolId; label: string }[] {
  if (!userId || data.viewer_id !== userId || !canUseBeaconModules(data, activity, userId)) return [];
  const shortcuts: { tool: BeaconToolId; label: string }[] = [];
  if (isBeaconModuleEnabled(activity, "chat")) shortcuts.push({ tool: "chat", label: "Chat" });
  if (isBeaconModuleEnabled(activity, "checklist")) {
    const items = data.beacon_checklist_items.filter((item) => item.activity_id === activity.id && canReadBeaconModuleEntry(data, activity, item.author_id, userId));
    shortcuts.push({ tool: "checklist", label: `Checklist ${items.filter((item) => item.completed).length}/${items.length}` });
  }
  if (isBeaconModuleEnabled(activity, "focus")) shortcuts.push({ tool: "focus", label: "Timer" });
  return shortcuts;
}
