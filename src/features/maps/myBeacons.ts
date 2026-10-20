import type { Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { isApprovedGoing } from "@/src/features/beacons/permissions";

export function selectMyMapBeacons(
  data: Data,
  viewerId: string | null,
  now: number,
) {
  if (!viewerId || data.viewer_id !== viewerId)
    return { hosting: [], joined: [] };
  const eligible = data.activities.filter(
    (activity) =>
      activity.status === "scheduled" &&
      Date.parse(activity.ends_at) > now &&
      canReadBeaconActivity(data, activity, viewerId),
  );
  const sort = (a: (typeof eligible)[number], b: (typeof eligible)[number]) =>
    Number(Date.parse(b.starts_at) <= now) -
      Number(Date.parse(a.starts_at) <= now) ||
    Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
    a.id.localeCompare(b.id);
  return {
    hosting: eligible
      .filter((activity) => activity.owner_id === viewerId)
      .sort(sort),
    joined: eligible
      .filter(
        (activity) =>
          activity.owner_id !== viewerId &&
          data.rsvps.some(
            (row) =>
              row.activity_id === activity.id &&
              row.user_id === viewerId &&
              isApprovedGoing(activity, row),
          ),
      )
      .sort(sort),
  };
}
