import type { Activity, Data, Profile } from "@/src/shared/types";
import { friendIds, activityWhen } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  beaconCapacity,
  isApprovedGoing,
} from "@/src/features/beacons/permissions";
import { matchesSearch } from "@/src/shared/search";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { canReadBeaconMeetingDetails } from "./filtering";
import { isValidCoordinate, type Coordinate } from "@/src/shared/exploration";
import { withinMapBeaconWindow } from "./mapDiscovery";

export function beaconInterestMatch(
  data: Data,
  activity: Activity,
  viewerId: string,
) {
  return (
    data.profiles.find((row) => row.id === viewerId)?.interests ?? []
  ).some((interest) =>
    matchesSearch(
      interest,
      activity.title,
      activity.category,
      activity.description,
    ),
  );
}

/** Distance is only a presentation tie-breaker for authorized meeting details. */
export function beaconDiscoveryDistance(
  data: Data,
  activity: Activity,
  viewerId: string,
  origin?: Coordinate | null,
) {
  if (
    !origin ||
    !isValidCoordinate(origin) ||
    !canReadBeaconMeetingDetails(data, activity, viewerId)
  )
    return undefined;
  const place = data.places.find((row) => row.activity_id === activity.id);
  if (
    place?.latitude == null ||
    place.longitude == null ||
    place.online_url ||
    !isValidCoordinate({ latitude: place.latitude, longitude: place.longitude })
  )
    return undefined;
  const lat = ((place.latitude - origin.latitude) * Math.PI) / 180;
  const lng = ((place.longitude - origin.longitude) * Math.PI) / 180;
  const arc =
    Math.sin(lat / 2) ** 2 +
    Math.cos((origin.latitude * Math.PI) / 180) *
      Math.cos((place.latitude * Math.PI) / 180) *
      Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, arc))));
}

export function beaconDiscoveryTier(
  data: Data,
  activity: Activity,
  viewerId: string,
  now: number,
) {
  if (Date.parse(activity.ends_at) <= now) return 8;
  const response = data.rsvps.find(
    (row) => row.activity_id === activity.id && row.user_id === viewerId,
  );
  if (
    activity.owner_id === viewerId ||
    (response && isApprovedGoing(activity, response))
  )
    return 0;
  if (
    response?.status === "invited" ||
    response?.status === "requested" ||
    data.beacon_invitation_grants.some(
      (row) => row.activity_id === activity.id && row.user_id === viewerId,
    )
  )
    return 1;
  if (
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now
  )
    return 2;
  if (
    !activity.approval_required &&
    activity.mode !== "invite" &&
    !beaconCapacity(data, activity).closed
  )
    return 3;
  if (
    friendIds(data, viewerId).includes(activity.owner_id) ||
    activity.audience === "squad" ||
    activity.audience === "organization"
  )
    return 4;
  return beaconInterestMatch(data, activity, viewerId) ? 5 : 7;
}

/** Only rank readable rows; search never uses a hidden meeting place or profile. */
export function discoverBeacons(
  data: Data,
  viewerId: string,
  query: string,
  now: number,
  origin?: Coordinate | null,
) {
  if (data.viewer_id !== viewerId) return [];
  return data.activities
    .filter((activity) => {
      if (
        !canReadBeaconActivity(data, activity, viewerId) ||
        activity.mode === "solo" ||
        !withinMapBeaconWindow(activity, now)
      )
        return false;
      const owner = data.profiles.find((row) => row.id === activity.owner_id);
      const place = canReadBeaconMeetingDetails(data, activity, viewerId)
        ? data.places.find((row) => row.activity_id === activity.id)
        : undefined;
      return matchesSearch(
        query,
        activity.title,
        activity.category,
        activity.description,
        owner && canViewProfile(data, owner, viewerId) ? owner.name : "",
        place?.label,
      );
    })
    .sort(
      (a, b) =>
        beaconDiscoveryTier(data, a, viewerId, now) -
          beaconDiscoveryTier(data, b, viewerId, now) ||
        Math.floor(
          (beaconDiscoveryDistance(data, a, viewerId, origin) ?? Infinity) / 5,
        ) -
          Math.floor(
            (beaconDiscoveryDistance(data, b, viewerId, origin) ?? Infinity) /
              5,
          ) ||
        Number(beaconInterestMatch(data, b, viewerId)) -
          Number(beaconInterestMatch(data, a, viewerId)) ||
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.id.localeCompare(b.id),
    );
}

export function personDiscoveryReason(
  data: Data,
  profile: Profile,
  viewerId: string,
) {
  if (data.viewer_id !== viewerId || !canViewProfile(data, profile, viewerId))
    return "";
  if (profile.id === viewerId) return "You";
  const friends = friendIds(data, viewerId);
  if (friends.includes(profile.id)) return "Friend";
  const shared = selectPersonPreview(data, profile.id, viewerId)
    .sharedContexts[0];
  const mutual = friendIds(data, profile.id).filter(
    (id) => friends.includes(id) && canViewProfile(data, id, viewerId),
  ).length;
  const interests =
    data.profiles.find((row) => row.id === viewerId)?.interests ?? [];
  const interest = profile.interests?.find((tag) =>
    interests.some((wanted) => wanted.toLowerCase() === tag.toLowerCase()),
  );
  return [
    shared?.name ??
      (interest
        ? `Also into ${interest}`
        : (profile.interests?.[0] ?? "Public profile")),
    mutual ? `${mutual} mutual ${mutual === 1 ? "friend" : "friends"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function beaconPreviewWhen(
  activity: Pick<Activity, "starts_at" | "ends_at" | "timezone"> &
    Partial<Pick<Activity, "plan_step">>,
  now: number,
) {
  if (
    activity.plan_step?.end_mode === "manual" ||
    activity.plan_step?.start_mode === "manual"
  )
    return activityWhen(activity as Activity, new Date(now));
  if (Date.parse(activity.ends_at) <= now) {
    const minutes = Math.max(
      0,
      Math.floor((now - Date.parse(activity.ends_at)) / 60000),
    );
    return minutes < 1
      ? "Just ended"
      : `Ended ${minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`} ago`;
  }
  if (
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now
  ) {
    return `Now \u00b7 ${Math.max(1, Math.ceil((Date.parse(activity.ends_at) - now) / 60000))} min left`;
  }
  return activityWhen(activity as Activity, new Date(now));
}
