import type { Activity, Data } from "@/src/shared/types";
import { mediaForActivity } from "./models";
import { canReadBeaconModuleEntry } from "./beaconModules";
import { canViewProfile } from "@/src/features/profile/privacy";

/** Pausing Experiences preserves readable historical photos; it never grants new access. */
export function selectPastMemoryPhotos(data: Data, activities: readonly Activity[], viewerId: string | null) {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  return activities.flatMap((activity) => {
    const photo = mediaForActivity(data, activity.id).find((memory) =>
      memory.media_type === "image" && !memory.object_path.startsWith("demo://") &&
      data.beacon_memories.some((current) => current.id === memory.id && current.activity_id === activity.id &&
        current.author_id === memory.author_id && current.object_path === memory.object_path) &&
      canViewProfile(data, memory.author_id, viewerId) &&
      canReadBeaconModuleEntry(data, activity, memory.author_id, viewerId),
    );
    return photo ? [{ activityId: activity.id, path: photo.object_path }] : [];
  });
}
