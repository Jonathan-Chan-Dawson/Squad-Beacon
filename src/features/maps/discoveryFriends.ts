import type { Activity, Data } from "@/src/shared/types";
import type { ExplorationFilters } from "@/src/shared/exploration";
import { selectListPeople } from "@/src/features/people/privateLists";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { isBeaconLive } from "@/src/features/beacons/beaconLive";
import { wantsHappeningNow } from "@/src/shared/explorationFilters";

/** Only projected, readable participation may establish a social discovery match. */
export function prepareDiscoveryFriends(
  data: Data,
  viewerId: string | null,
  scope: ExplorationFilters["friendScope"],
) {
  const people = selectListPeople(data, viewerId, scope ?? "friends");
  const visiblePeople = new Set(
    [...people].filter((id) => canViewProfile(data, id, viewerId)),
  );
  const activities = new Map(data.activities.map((row) => [row.id, row]));
  const attending = new Set<string>();
  if (viewerId && data.viewer_id === viewerId)
    for (const rsvp of data.rsvps) {
      const activity = activities.get(rsvp.activity_id);
      if (
        activity &&
        visiblePeople.has(rsvp.user_id) &&
        isApprovedGoing(activity, rsvp) &&
        canReadBeaconActivity(data, activity, viewerId) &&
        !data.blocks.some(
          (row) =>
            (row.blocker_id === activity.owner_id &&
              row.blocked_id === rsvp.user_id) ||
            (row.blocked_id === activity.owner_id &&
              row.blocker_id === rsvp.user_id),
        )
      )
        attending.add(activity.id);
    }
  return { viewerId, people, visiblePeople, attending };
}

export function matchesDiscoveryFriends(
  activity: Activity,
  index: ReturnType<typeof prepareDiscoveryFriends>,
) {
  return (
    index.visiblePeople.has(activity.owner_id) ||
    index.attending.has(activity.id)
  );
}

export function discoveryFriendScopeLabel(
  data: Data,
  viewerId: string | null,
  scope: ExplorationFilters["friendScope"],
) {
  if (!scope) return "";
  if (scope === "friends") return "All Friends";
  if (scope === "favorites") return "Starred Friends";
  return data.viewer_id === viewerId
    ? (data.lists.find(
        (list) => list.id === scope.slice(7) && list.owner_id === viewerId,
      )?.name ?? "Private List unavailable")
    : "Private List unavailable";
}

/** A summary alone cannot prove private relationships or a Plan's actual start. */
export function matchesKnownDiscoveryContext(
  id: string,
  filters: ExplorationFilters,
  context?: {
    data: Data;
    viewerId: string | null;
    now: number;
    friends?: ReturnType<typeof prepareDiscoveryFriends>;
  },
) {
  if (!filters.friendScope && !wantsHappeningNow(filters)) return true;
  if (!context?.viewerId || context.data.viewer_id !== context.viewerId)
    return false;
  const { data, viewerId } = context;
  const activity = data.activities.find((row) => row.id === id);
  if (
    !activity ||
    !canReadBeaconActivity(data, activity, viewerId) ||
    data.activity_exclusions.some(
      (row) => row.activity_id === id && row.user_id === viewerId,
    ) ||
    data.blocks.some(
      (row) =>
        (row.blocker_id === viewerId && row.blocked_id === activity.owner_id) ||
        (row.blocked_id === viewerId && row.blocker_id === activity.owner_id),
    )
  )
    return false;
  return (
    (!wantsHappeningNow(filters) || isBeaconLive(activity, context.now)) &&
    (!filters.friendScope ||
      matchesDiscoveryFriends(
        activity,
        context.friends ??
          prepareDiscoveryFriends(data, viewerId, filters.friendScope),
      ))
  );
}
