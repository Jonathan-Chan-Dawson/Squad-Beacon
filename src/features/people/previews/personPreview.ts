import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { activeOrganizationRole } from "@/src/features/organizations/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import type { FriendAvailabilityState } from "@/src/shared/domain";
import {
  friendAvailabilityState,
  friendIds,
  locationIsFresh,
} from "@/src/shared/domain";
import { isValidCoordinate } from "@/src/shared/exploration";
import type {
  Activity,
  Data,
  ID,
  LocationSession,
  Profile,
} from "@/src/shared/types";

export type SharedContext = {
  id: ID;
  kind: "Squad" | "Organization";
  name: string;
};

export type PersonPreviewSelection = {
  canMessage: boolean;
  canViewFullProfile: boolean;
  profile?: Profile;
  starred: boolean;
  availability: FriendAvailabilityState;
  beacon?: Activity;
  sharedContexts: SharedContext[];
  canViewMap: boolean;
};

/** Beacon titles may be shared before its meeting place is available. */
export function canViewBeaconMeetingDetails(
  data: Data,
  beaconId: ID,
  viewerId: ID | null,
) {
  if (!viewerId || data.viewer_id !== viewerId) return false;
  const beacon = data.activities.find((item) => item.id === beaconId);
  if (!beacon || !canReadBeaconActivity(data, beacon, viewerId))
    return false;
  const rsvp = data.rsvps.find(
    (row) => row.activity_id === beacon.id && row.user_id === viewerId,
  );
  if (!beacon.approval_required && beacon.mode !== "invite") return true;
  return beacon.owner_id === viewerId || isApprovedGoing(beacon, rsvp);
}

/** Fresh location rows are only useful after current profile authorization too. */
export function selectFreshVisiblePersonLocation(
  data: Data,
  personId: ID,
  viewerId: ID | null,
  now = Date.now(),
): LocationSession | undefined {
  if (
    !viewerId ||
    data.viewer_id !== viewerId ||
    !canViewProfile(data, personId, viewerId)
  )
    return undefined;
  return data.locations.find(
    (location) =>
      location.owner_id === personId &&
      location.latitude != null &&
      location.longitude != null &&
      isValidCoordinate({
        latitude: location.latitude,
        longitude: location.longitude,
      }) &&
      locationIsFresh(location, new Date(now)),
  );
}

function isBlocked(data: Data, viewerId: ID, personId: ID) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === viewerId && block.blocked_id === personId) ||
      (block.blocker_id === personId && block.blocked_id === viewerId),
  );
}

function sharedContexts(data: Data, viewerId: ID, personId: ID) {
  const sharedSquads = data.squads
    .filter((squad) => {
      if (
        isBlocked(data, squad.owner_id, viewerId) ||
        isBlocked(data, squad.owner_id, personId)
      )
        return false;
      const members = data.squad_members.filter(
        (member) => member.squad_id === squad.id,
      );
      return (
        members.some((member) => member.user_id === viewerId) &&
        members.some((member) => member.user_id === personId)
      );
    })
    .map((squad) => ({
      id: squad.id,
      kind: "Squad" as const,
      name: squad.name,
    }));
  const sharedOrganizations = data.organizations
    .filter((organization) => {
      const active = (memberId: ID) =>
        !!activeOrganizationRole(
          organization,
          data.organization_members,
          memberId,
        ) &&
        !isBlocked(data, organization.owner_id, memberId) &&
        !data.organization_bans.some(
          (ban) =>
            ban.organization_id === organization.id && ban.user_id === memberId,
        );
      return active(viewerId) && active(personId);
    })
    .map((organization) => ({
      id: organization.id,
      kind: "Organization" as const,
      name: organization.name,
    }));
  return [...sharedSquads, ...sharedOrganizations]
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 2);
}

/** Re-resolves profile, Beacon, relationship, and location data from this viewer's snapshot. */
export function selectPersonPreview(
  data: Data,
  personId: ID,
  viewerId: ID | null,
  now = Date.now(),
): PersonPreviewSelection {
  const snapshotMatches = !!viewerId && data.viewer_id === viewerId;
  const blocked = !!viewerId && isBlocked(data, viewerId, personId);
  const isFriend =
    snapshotMatches && friendIds(data, viewerId).includes(personId);
  const canMessage = !!(snapshotMatches && isFriend && !blocked);
  const candidate = data.profiles.find((profile) => profile.id === personId);
  const canViewFullProfile = !!(
    snapshotMatches &&
    !blocked &&
    candidate &&
    canViewProfile(data, candidate, viewerId)
  );
  if (!canViewFullProfile || !candidate || !viewerId) {
    return {
      canMessage,
      canViewFullProfile: false,
      starred:
        canMessage &&
        data.favorites.some(
          (favorite) =>
            favorite.owner_id === viewerId &&
            favorite.kind === "friend" &&
            favorite.target_id === personId,
        ),
      availability: "unknown",
      sharedContexts: [],
      canViewMap: false,
    };
  }

  const accessibleUpcoming = data.activities
    .filter(
      (activity) =>
        (activity.owner_id === personId ||
          isApprovedGoing(
            activity,
            data.rsvps.find(
              (rsvp) =>
                rsvp.activity_id === activity.id && rsvp.user_id === personId,
            ),
          )) &&
        activity.status === "scheduled" &&
        Number.isFinite(Date.parse(activity.starts_at)) &&
        Number.isFinite(Date.parse(activity.ends_at)) &&
        Date.parse(activity.ends_at) > now &&
        canReadBeaconActivity(data, activity, viewerId),
    )
    .sort((left, right) => {
      const leftLive = Date.parse(left.starts_at) <= now;
      const rightLive = Date.parse(right.starts_at) <= now;
      if (leftLive !== rightLive) return leftLive ? -1 : 1;
      const leftOwned = left.owner_id === personId;
      const rightOwned = right.owner_id === personId;
      if (leftOwned !== rightOwned) return leftOwned ? -1 : 1;
      return left.starts_at.localeCompare(right.starts_at);
    });
  const beacon = accessibleUpcoming[0];
  const activeAvailability = accessibleUpcoming.find(
    (activity) =>
      activity.owner_id === personId &&
      activity.mode === "solo" &&
      Date.parse(activity.starts_at) <= now &&
      Date.parse(activity.ends_at) > now,
  );
  const location = selectFreshVisiblePersonLocation(
    data,
    personId,
    viewerId,
    now,
  );

  return {
    canMessage,
    canViewFullProfile: true,
    profile: candidate,
    starred: canMessage && data.favorites.some(
      (favorite) =>
        favorite.owner_id === viewerId &&
        favorite.kind === "friend" &&
        favorite.target_id === personId,
    ),
    availability: friendAvailabilityState(activeAvailability, now),
    beacon,
    sharedContexts: sharedContexts(data, viewerId, personId),
    canViewMap: !!location,
  };
}
