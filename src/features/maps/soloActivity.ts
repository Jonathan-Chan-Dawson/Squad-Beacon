import type { Activity, Data } from "@/src/shared/types";
import { canReadActivityPreview } from "@/src/features/beacons/beaconModules";

export function visibleSoloActivity(
  data: Data,
  personId: string,
  viewerId: string | null,
  now: number,
): Activity | undefined {
  if (!viewerId || data.viewer_id !== viewerId || viewerId !== personId && data.presence?.some(p=>p.owner_id===personId&&!p.sharing)) return undefined;
  return data.activities
    .filter(
      (activity) =>
        activity.owner_id === personId &&
        activity.mode === "solo" && activity.solo_purpose !== "activity_note" &&
        activity.status === "scheduled" &&
        Date.parse(activity.starts_at) <= now &&
        Date.parse(activity.ends_at) > now &&
        canReadActivityPreview(data, activity, viewerId),
    )
    .sort((left, right) => right.starts_at.localeCompare(left.starts_at))[0];
}

export function canReactToSoloActivity(
  data: Data,
  activity: Activity,
  viewerId: string | null,
  now = Date.now(),
) {
  return (
    !!viewerId &&
    data.viewer_id === viewerId &&
    activity.mode === "solo" && activity.solo_purpose !== "activity_note" &&
    activity.status_sharing !== false &&
    !activity.status_note_hidden &&
    activity.status === "scheduled" &&
    activity.enable_reactions !== false &&
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now &&
    canReadActivityPreview(data, activity, viewerId)
  );
}
