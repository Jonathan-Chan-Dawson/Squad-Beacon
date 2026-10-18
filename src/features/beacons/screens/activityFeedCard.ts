import type { BeaconFeedCardProps } from "@/src/features/beacons/components/BeaconFeedCard";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import { canViewProfile } from "@/src/features/profile/privacy";
import { activityWhen, friendIds } from "@/src/shared/domain";
import {
  beaconCapacity,
  beaconSeatCount,
  isApprovedGoing,
} from "@/src/features/beacons/permissions";
import type { Activity, Data } from "@/src/shared/types";
import { router } from "expo-router";

export type ActivityFeedHandlers = {
  onOpen: () => void;
  onMap?: () => void;
  onRSVP: BeaconFeedCardProps["onRSVP"];
  onChangeRSVP?: BeaconFeedCardProps["onChangeRSVP"];
  onSave: BeaconFeedCardProps["onSave"];
  onShare: BeaconFeedCardProps["onShare"];
};

/** Build a compact card from the viewer-filtered snapshot, omitting private fields. */
export function activityFeedCardProps(
  data: Data,
  activity: Activity,
  userId: string,
  now: number,
  handlers: ActivityFeedHandlers,
): BeaconFeedCardProps {
  const hostCandidate = data.profiles.find(
    (profile) => profile.id === activity.owner_id,
  );
  const host =
    data.viewer_id === userId &&
    hostCandidate &&
    canViewProfile(data, hostCandidate, userId)
      ? hostCandidate
      : undefined;
  const canReadMeeting =
    data.viewer_id === userId &&
    canViewBeaconMeetingDetails(data, activity.id, userId);
  const place = canReadMeeting
    ? data.places.find((row) => row.activity_id === activity.id)
    : undefined;
  const rsvp = data.rsvps.find(
    (row) => row.activity_id === activity.id && row.user_id === userId,
  );
  const capacity = beaconCapacity(data, activity);
  const liveOrUpcoming =
    activity.status === "scheduled" && Date.parse(activity.ends_at) > now;
  const friendHost = friendIds(data, userId).includes(activity.owner_id);
  const saved = data.beacon_favorites.some(
    (favorite) =>
      favorite.owner_id === userId && favorite.activity_id === activity.id,
  );

  return {
    activityId: activity.id,
    title: activity.title,
    category: activity.category,
    decorationEmoji: activity.decoration_emoji,
    activityMode: activity.mode,
    startsAt: activity.starts_at,
    endsAt: activity.ends_at,
    activityStatus: activity.status,
    whenLabel: activityWhen(activity, new Date(now)),
    hostName:
      activity.owner_id === userId ? "You" : (host?.name ?? "Beacon host"),
    hostAvatarUri: null,
    location: place
      ? place.online_url
        ? { label: "Online", kind: "online" }
        : { label: place.label || "Place to be decided", kind: "physical" }
      : null,
    goingAvatars: [],
    goingCount: beaconSeatCount(data, activity),
    target: activity.target_count ?? null,
    capacityRemaining:
      activity.capacity_limit == null
        ? null
        : Math.max(
            0,
            activity.capacity_limit - beaconSeatCount(data, activity),
          ),
    rsvpStatus: rsvp?.status ?? null,
    approved: isApprovedGoing(activity, rsvp),
    joinApprovalGranted: rsvp?.approved === true,
    approvalRequired: activity.approval_required || activity.mode === "invite",
    isHost: activity.owner_id === userId,
    isFull: capacity.full,
    isClosed: capacity.closed || !liveOrUpcoming,
    isPast: !liveOrUpcoming,
    saved,
    ...handlers,
    onMap:
      handlers.onMap ??
      (place && !place.online_url
        ? () =>
            router.push({
              pathname: "/(tabs)",
              params: { beacon: activity.id },
            })
        : undefined),
    onChat:
      canUseBeaconModules(data, activity, userId) &&
      activity.enable_chat !== false
        ? () => {
            router.push({
              pathname: "/activity/[id]",
              params: { id: activity.id, tab: "chat" },
            });
          }
        : friendHost
          ? () => {
              router.push({
                pathname: "/messages/[id]",
                params: { id: activity.owner_id },
              });
            }
          : undefined,
  };
}
