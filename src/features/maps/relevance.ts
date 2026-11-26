import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { followedBeaconIds } from "@/src/features/discovery/beaconTopics";
import { beaconDiscoveryTier, beaconInterestMatch } from "./discoveryRanking";
import type { Data } from "@/src/shared/types";
import type { MapPointPriority } from "@/src/features/maps/cluster";

/** Central map-cluster ranking policy; lower tiers render first. */
export function deriveMapPointPriorities(
  data: Data,
  viewerId: string,
  activityIds: string[],
  personIds: string[],
  now: number,
  personalized = true,
): Record<string, MapPointPriority> {
  const priorities: Record<string, MapPointPriority> = {};
  const following = followedBeaconIds(data, viewerId, true);
  const activitiesById = new Map(
    data.activities.map((activity) => [activity.id, activity]),
  );
  const closeListIds = data.lists
    .filter(
      (list) =>
        list.owner_id === viewerId &&
        list.name.toLowerCase() === "close friends",
    )
    .map((list) => list.id);
  const closeFriendIds = new Set(
    data.list_members
      .filter((member) => closeListIds.includes(member.list_id))
      .map((member) => member.user_id),
  );
  const starredFriends = new Set(
    data.favorites
      .filter(
        (favorite) =>
          favorite.owner_id === viewerId && favorite.kind === "friend",
      )
      .map((favorite) => favorite.target_id),
  );
  const going = new Map<string, number>();
  for (const rsvp of data.rsvps) {
    const activity = activitiesById.get(rsvp.activity_id);
    if (activity && rsvp.user_id !== activity.owner_id && isApprovedGoing(activity, rsvp))
      going.set(rsvp.activity_id, (going.get(rsvp.activity_id) ?? 0) + 1);
  }
  for (const activityId of activityIds) {
    const activity = activitiesById.get(activityId);
    if (!activity) continue;
    const attendance =
      activity.accepted_seat_count ?? (going.get(activity.id) ?? 0) + 1;
    priorities[`beacon:${activity.id}`] = {
      tier: beaconDiscoveryTier(data, activity, viewerId, now, personalized),
      affinity:
        Number(personalized && beaconInterestMatch(data, activity, viewerId)) +
        (activity.owner_id === viewerId ? 100 : 0) +
        Number(following.has(activity.id)) * 0.5 +
        Number(personalized && (closeFriendIds.has(activity.owner_id) || starredFriends.has(activity.owner_id))),
      attendance,
    };
  }

  const availablePeople = new Set(
    data.activities
      .filter(
        (activity) =>
          activity.mode === "solo" &&
          activity.available === true &&
          activity.status === "scheduled" &&
          Date.parse(activity.starts_at) <= now &&
          Date.parse(activity.ends_at) > now,
      )
      .map((activity) => activity.owner_id),
  );
  for (const personId of personIds) {
    priorities[`person:${personId}`] = {
      tier:
        personId === viewerId
          ? -2
          : starredFriends.has(personId)
            ? 1
            : availablePeople.has(personId)
              ? 5
              : closeFriendIds.has(personId)
                ? 6
                : 7,
    };
  }
  return priorities;
}
