import type { Data } from "@/src/shared/types";
import { canReadBeaconActivity, canUseBeaconModules } from "./beaconModules";
import { beaconEngagement } from "./beaconEngagement";
import {
  canViewBeaconMeetingDetails,
  selectPersonPreview,
} from "@/src/features/people/previews/personPreview";

/** Current-snapshot authorization for shortcuts; a readable card is not module access. */
export function beaconCardShortcuts(
  data: Data,
  viewer: string | null,
  activityId: string,
) {
  if (!viewer || data.viewer_id !== viewer) return null;
  const activity = data.activities.find((row) => row.id === activityId);
  if (!activity || !canReadBeaconActivity(data, activity, viewer)) return null;
  const chat =
    canUseBeaconModules(data, activity, viewer) &&
    activity.enable_chat !== false
      ? "beacon"
      : selectPersonPreview(data, activity.owner_id, viewer).canMessage
        ? "host"
        : null;
  const canMap =
    canViewBeaconMeetingDetails(data, activity.id, viewer) &&
    data.places.some(
      (place) => place.activity_id === activity.id && !place.online_url,
    );
  return {
    activity,
    chat,
    canMap,
    engagement: beaconEngagement(data, viewer, activity.id),
  } as const;
}
