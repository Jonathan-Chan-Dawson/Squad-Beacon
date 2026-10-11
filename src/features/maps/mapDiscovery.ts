import type { Activity, Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  beaconCapacity,
  isApprovedGoing,
} from "@/src/features/beacons/permissions";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { canViewProfile } from "@/src/features/profile/privacy";

export function beaconHasSquadParticipant(
  data: Data,
  activity: Activity,
  squadId: string,
  viewerId: string,
) {
  if (!canOpenSquadProfile(data, squadId, viewerId)) return false;
  return data.squad_members.some(
    (member) =>
      member.squad_id === squadId &&
      canViewProfile(data, member.user_id, viewerId) &&
      (activity.owner_id === member.user_id ||
        data.rsvps.some(
          (row) =>
            row.activity_id === activity.id &&
            row.user_id === member.user_id &&
            isApprovedGoing(activity, row),
        )),
  );
}

export function showBeaconOnMap(
  data: Data,
  activity: Activity,
  viewerId: string,
  selection: {
    beaconId?: string | null;
    personId?: string | null;
    squadId?: string | null;
  } = {},
  now = Date.now(),
) {
  if (
    data.viewer_id !== viewerId ||
    !canReadBeaconActivity(data, activity, viewerId)
  )
    return false;
  if (selection.beaconId === activity.id) return true;
  if (activity.status !== "scheduled" || Date.parse(activity.ends_at) <= now)
    return false;
  const involved = new Set([
    activity.owner_id,
    ...data.rsvps
      .filter(
        (row) =>
          row.activity_id === activity.id && isApprovedGoing(activity, row),
      )
      .map((row) => row.user_id),
  ]);
  if (
    selection.personId &&
    involved.has(selection.personId) &&
    canViewProfile(data, selection.personId, viewerId)
  )
    return true;
  if (
    selection.squadId &&
    canOpenSquadProfile(data, selection.squadId, viewerId) &&
    data.squad_members.some(
      (row) =>
        row.squad_id === selection.squadId &&
        involved.has(row.user_id) &&
        canViewProfile(data, row.user_id, viewerId),
    )
  )
    return true;
  const capacity = beaconCapacity(data, activity);
  if (activity.mode === "solo" || capacity.closed) return false;
  if (activity.mode === "invite" && activity.owner_id !== viewerId) {
    const rsvp = data.rsvps.find(
      (row) => row.activity_id === activity.id && row.user_id === viewerId,
    );
    return (
      (!!rsvp &&
        (rsvp.status === "invited" ||
          rsvp.status === "requested" ||
          isApprovedGoing(activity, rsvp))) ||
      data.beacon_invitation_grants.some(
        (row) => row.activity_id === activity.id && row.user_id === viewerId,
      )
    );
  }
  return true;
}

export function clusterPeople(
  data: Data,
  beaconIds: readonly string[],
  markerPersonIds: readonly string[],
  viewerId: string | null,
) {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  const readable = data.activities.filter(
    (activity) =>
      beaconIds.includes(activity.id) &&
      canReadBeaconActivity(data, activity, viewerId),
  );
  const ids = new Set(markerPersonIds);
  for (const activity of readable) {
    ids.add(activity.owner_id);
    for (const rsvp of data.rsvps)
      if (rsvp.activity_id === activity.id && isApprovedGoing(activity, rsvp))
        ids.add(rsvp.user_id);
  }
  return data.profiles.filter(
    (profile) => ids.has(profile.id) && canViewProfile(data, profile, viewerId),
  );
}
