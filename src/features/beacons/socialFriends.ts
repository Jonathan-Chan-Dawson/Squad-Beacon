import type { Category, Data } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { visibleSoloActivity } from "@/src/features/maps/soloActivity";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { canReadBeaconActivity } from "./beaconModules";
import { beaconSeatCount, isApprovedGoing } from "./permissions";
import type { SafeFriendNowRow } from "./components/feed/FriendsNow";
import { matchesSearch } from "@/src/shared/search";

export type SocialFriend = SafeFriendNowRow & {
  note?: ReturnType<typeof visibleSoloActivity>;
  beacon?: { id: string; title: string; label: string; category: Category; emoji?: string | null; goingCount: number };
  ping?: { id: string; title: string };
};

/** Every preview is rebuilt from the current authorized snapshot, including open details. */
export function socialFriends(
  data: Data,
  viewer: string | null,
  now: number,
): SocialFriend[] {
  if (!viewer || data.viewer_id !== viewer) return [];
  return [...new Set(friendIds(data, viewer))]
    .flatMap((id): SocialFriend[] => {
      const preview = selectPersonPreview(data, id, viewer, now);
      if (!preview.canMessage) return [];
      const note = preview.canViewFullProfile
        ? (visibleSoloActivity(data, id, viewer, now) ??
          data.activities
            .filter(
              (item) =>
                item.owner_id === id &&
                item.mode === "solo" &&
                item.status === "scheduled" &&
                Date.parse(item.starts_at) > now &&
                Date.parse(item.ends_at) > Date.parse(item.starts_at) &&
                canReadBeaconActivity(data, item, viewer),
            )
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0])
        : undefined;
      const activity = preview.canViewFullProfile
        ? data.activities.find(
            (item) =>
              item.mode !== "solo" &&
              item.status === "scheduled" &&
              Date.parse(item.starts_at) <= now &&
              Date.parse(item.ends_at) > now &&
              (item.owner_id === id ||
                isApprovedGoing(
                  item,
                  data.rsvps.find(
                    (rsvp) =>
                      rsvp.activity_id === item.id && rsvp.user_id === id,
                  ),
                )) &&
              canReadBeaconActivity(data, item, viewer),
          )
        : undefined;
      const attendance =
        activity &&
        data.beacon_attendance.find(
          (item) => item.activity_id === activity.id && item.user_id === id,
        );
      const ping = preview.canViewFullProfile
        ? data.planning_threads.find(
            (thread) =>
              thread.owner_id === id &&
              thread.kind === "ping" &&
              thread.status === "open" &&
              Date.parse(thread.deadline_at) > now &&
              canReadPlanningThread(data, thread, viewer),
          )
        : undefined;
      return [
        {
          id,
          name: preview.profile?.name ?? "Friend",
          profile: preview.profile,
          availability: preview.availability,
          statusText: note?.title ?? "",
          until: note?.ends_at,
          starred: preview.starred,
          hasFreshSharedLocation: false,
          note,
          ...(activity
            ? {
                activeBeaconId: activity.id,
                beacon: {
                  id: activity.id,
                  title: activity.title,
                  category: activity.category,
                  emoji: activity.decoration_emoji,
                  goingCount: beaconSeatCount(data, activity),
                  label:
                    attendance?.state === "present"
                      ? "Present"
                      : attendance?.state === "arriving"
                        ? "Arriving"
                        : activity.owner_id === id
                          ? "Hosting"
                          : "Going",
                },
              }
            : {}),
          ...(ping ? { ping: { id: ping.id, title: ping.title } } : {}),
        },
      ];
    })
    .sort((a, b) => {
      const rank = (friend: SocialFriend) =>
        friend.availability === "available" ||
        friend.availability === "ending-soon"
          ? 4
          : friend.beacon || friend.ping
            ? 3
            : friend.note
              ? 2
              : 0;
      return (
        rank(b) - rank(a) ||
        Number(b.starred) - Number(a.starred) ||
        a.name.localeCompare(b.name)
      );
    });
}

export function availabilityLabel(friend: SocialFriend, now = Date.now()) {
  const time = friend.until
    ? new Date(friend.until).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  if (
    friend.availability === "available" ||
    friend.availability === "ending-soon"
  )
    return time ? `Available until ${time}` : "Available now";
  if (friend.availability === "unavailable")
    return time ? `Busy until ${time}` : "Busy";
  if (
    friend.note?.available === true &&
    Date.parse(friend.note.starts_at) > now
  )
    return `Available from ${new Date(friend.note.starts_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  return "No availability shared";
}

export function filterSocialFriends(
  friends: SocialFriend[],
  data: Data,
  viewer: string | null,
  options: { query: string; filter: string; listId: string | null },
) {
  if (!viewer || data.viewer_id !== viewer) return [];
  const { query, filter, listId } = options;
  const members =
    listId &&
    data.lists.some((list) => list.id === listId && list.owner_id === viewer)
      ? new Set(
          data.list_members
            .filter((member) => member.list_id === listId)
            .map((member) => member.user_id),
        )
      : null;
  return friends.filter(
    (friend) =>
      matchesSearch(query, friend.name, friend.note?.title ?? "") &&
      (filter === "All" ||
        (filter === "Available" &&
          ["available", "ending-soon"].includes(friend.availability)) ||
        (filter === "In a Beacon" && !!friend.beacon) ||
        (filter === "Favorites" && friend.starred)) &&
      (!listId || !!members?.has(friend.id)),
  );
}
