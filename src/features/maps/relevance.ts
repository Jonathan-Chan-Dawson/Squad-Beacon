import type { Data } from "@/src/shared/types";
import type { MapPointPriority } from "@/src/features/maps/cluster";

/** Central map-cluster ranking policy; lower tiers render first. */
export function deriveMapPointPriorities(
  data: Data,
  viewerId: string,
  activityIds: string[],
  personIds: string[],
  now: number,
): Record<string, MapPointPriority> {
  const priorities: Record<string, MapPointPriority> = {};
  for (const activityId of activityIds) {
    const activity = data.activities.find((item) => item.id === activityId);
    if (!activity) continue;
    const joined = data.rsvps.some(
      (rsvp) =>
        rsvp.activity_id === activity.id &&
        rsvp.user_id === viewerId &&
        rsvp.status === "going",
    );
    const startsAt = Date.parse(activity.starts_at);
    const live = startsAt <= now && Date.parse(activity.ends_at) > now;
    const attendance =
      activity.accepted_seat_count ??
      data.rsvps.filter(
        (rsvp) => rsvp.activity_id === activity.id && rsvp.status === "going",
      ).length + 1;
    priorities[`beacon:${activity.id}`] = {
      tier: joined
        ? 0
        : live
          ? 2
          : startsAt > now && startsAt <= now + 60 * 60 * 1000
            ? 3
            : attendance >= 4
              ? 4
              : 7,
      attendance,
    };
  }

  const closeListIds = data.lists
    .filter(
      (list) =>
        list.owner_id === viewerId && list.name.toLowerCase() === "close friends",
    )
    .map((list) => list.id);
  const closeFriendIds = new Set(
    data.list_members
      .filter((member) => closeListIds.includes(member.list_id))
      .map((member) => member.user_id),
  );
  for (const personId of personIds) {
    const starred = data.favorites.some(
      (favorite) =>
        favorite.owner_id === viewerId &&
        favorite.kind === "friend" &&
        favorite.target_id === personId,
    );
    const available = data.activities.some(
      (activity) =>
        activity.owner_id === personId &&
        activity.mode === "solo" &&
        activity.available === true &&
        activity.status === "scheduled" &&
        Date.parse(activity.starts_at) <= now &&
        Date.parse(activity.ends_at) > now,
    );
    priorities[`person:${personId}`] = {
      tier: starred
        ? 1
        : available
          ? 5
          : closeFriendIds.has(personId)
            ? 6
            : 7,
    };
  }
  return priorities;
}
