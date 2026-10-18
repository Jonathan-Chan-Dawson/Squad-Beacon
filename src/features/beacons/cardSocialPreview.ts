import type { Data } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canReadBeaconActivity } from "./beaconModules";
import { beaconCapacity, isApprovedGoing } from "./permissions";

export function cardSocialPreview(
  data: Data,
  viewer: string | null,
  id: string,
) {
  const activity = data.activities.find((row) => row.id === id);
  if (
    !viewer ||
    data.viewer_id !== viewer ||
    !activity ||
    !canReadBeaconActivity(data, activity, viewer)
  )
    return null;
  const accepted = new Set([
    activity.owner_id,
    ...data.rsvps
      .filter((row) => row.activity_id === id && isApprovedGoing(activity, row))
      .map((row) => row.user_id),
  ]);
  const friends = new Set(friendIds(data, viewer));
  const visible = data.profiles.filter(
    (person) => accepted.has(person.id) && canViewProfile(data, person, viewer),
  );
  const friendAttendees = visible.filter((person) => friends.has(person.id));
  return {
    host: visible.find((person) => person.id === activity.owner_id),
    friendAvatars: friendAttendees.slice(0, 3),
    friendCount: friendAttendees.length,
    friendRemainder: Math.max(0, friendAttendees.length - 3),
    capacity: beaconCapacity(data, activity),
  };
}
