import type { Data, Profile } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import {
  canReadBeaconActivity,
  canUseBeaconModules,
} from "./beaconModules";
import { beaconCapacity, isApprovedGoing } from "./permissions";

function byId(left: Profile, right: Profile) {
  return left.id.localeCompare(right.id);
}

function isBlocked(data: Data, left: string, right: string) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === left && block.blocked_id === right) ||
      (block.blocker_id === right && block.blocked_id === left),
  );
}

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
      .filter(
        (row) =>
          row.activity_id === id &&
          isApprovedGoing(activity, row) &&
          !isBlocked(data, activity.owner_id, row.user_id),
      )
      .map((row) => row.user_id),
  ]);
  const friends = new Set(friendIds(data, viewer));
  const visible = data.profiles
    .filter(
      (person) =>
        accepted.has(person.id) && canViewProfile(data, person, viewer),
    )
    .sort(byId);
  const friendAttendees = visible
    .filter((person) => friends.has(person.id))
    .sort(byId);
  const rosterAllowed = canUseBeaconModules(data, activity, viewer);

  // Keep friend previews in the existing read-access path. General attendee
  // faces use the same module permission as the detail roster.
  const attendeeAvatars = rosterAllowed
    ? (() => {
        const host = visible.find((person) => person.id === activity.owner_id);
        const friendsToShow = friendAttendees.slice(
          0,
          viewer === activity.owner_id && host ? 2 : 3,
        );
        const selected = new Set(friendsToShow.map((person) => person.id));
        if (viewer === activity.owner_id && host) selected.add(host.id);
        const remainder = visible.filter((person) => !selected.has(person.id));
        return [
          ...friendsToShow,
          ...(viewer === activity.owner_id && host ? [host] : []),
          ...remainder,
        ].slice(0, 3);
      })()
    : [];

  return {
    host: visible.find((person) => person.id === activity.owner_id),
    friendAvatars: friendAttendees.slice(0, 3),
    friendCount: friendAttendees.length,
    friendRemainder: Math.max(0, friendAttendees.length - 3),
    attendeeAvatars,
    rosterAllowed,
    capacity: beaconCapacity(data, activity),
  };
}
