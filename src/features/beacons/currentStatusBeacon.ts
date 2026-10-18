import type { Activity, Data } from "@/src/shared/types";
import { canReadActivityPreview } from "./beaconModules";
import { beaconRoleFor, isApprovedGoing } from "./permissions";

export type CurrentBeaconRole = "hosting" | "cohosting" | "going";
export type VisibleCurrentBeacon = {
  activity: Activity;
  role: CurrentBeaconRole;
};

function locallyRevoked(data: Data, activity: Activity, viewerId: string) {
  return (
    data.blocks.some(
      (row) =>
        (row.blocker_id === viewerId && row.blocked_id === activity.owner_id) ||
        (row.blocked_id === viewerId && row.blocker_id === activity.owner_id),
    ) ||
    data.activity_exclusions.some(
      (row) => row.activity_id === activity.id && row.user_id === viewerId,
    )
  );
}

function isLivePublishedBeacon(activity: Activity, now: number) {
  return (
    activity.mode !== "solo" &&
    activity.status === "scheduled" &&
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now &&
    !(activity.plan_id && activity.plan_step && !activity.plan_started_at)
  );
}

function ownerRole(
  data: Data,
  activity: Activity,
  ownerId: string,
): CurrentBeaconRole | null {
  const role = beaconRoleFor(data, activity, ownerId);
  if (role === "owner") return "hosting";
  if (role === "coowner") return "cohosting";
  if (
    isApprovedGoing(
      activity,
      data.rsvps.find(
        (row) => row.activity_id === activity.id && row.user_id === ownerId,
      ),
    )
  )
    return "going";
  return null;
}

function eligibleForOwner(
  data: Data,
  ownerId: string,
  now: number,
): VisibleCurrentBeacon[] {
  if (!ownerId) return [];
  return data.activities
    .flatMap((activity) => {
      if (!isLivePublishedBeacon(activity, now)) return [];
      const role = ownerRole(data, activity, ownerId);
      if (!role || !canReadActivityPreview(data, activity, ownerId)) return [];
      return [{ activity, role }];
    })
    .sort((left, right) => {
      const rank = (role: CurrentBeaconRole) => (role === "going" ? 1 : 0);
      return (
        rank(left.role) - rank(right.role) ||
        Date.parse(right.activity.starts_at) -
          Date.parse(left.activity.starts_at) ||
        left.activity.id.localeCompare(right.activity.id)
      );
    });
}

/** Live group Beacons the signed-in owner may attach to their Status. */
export function eligibleCurrentBeacons(
  data: Data,
  ownerId: string | null,
  now: number,
): Activity[] {
  if (!ownerId || data.viewer_id !== ownerId) return [];
  return eligibleForOwner(data, ownerId, now).map(({ activity }) => activity);
}

function visibleSource(
  data: Data,
  sourceId: string,
  viewerId: string,
  now: number,
  role: CurrentBeaconRole,
): VisibleCurrentBeacon | null {
  const activity = data.activities.find((row) => row.id === sourceId);
  if (
    !activity ||
    !isLivePublishedBeacon(activity, now) ||
    locallyRevoked(data, activity, viewerId) ||
    !canReadActivityPreview(data, activity, viewerId)
  )
    return null;
  return { activity, role };
}

function projectedOwnerRelationshipIsCurrent(
  data: Data,
  status: Activity,
  source: Activity,
  role: CurrentBeaconRole,
): boolean {
  if (source.owner_id === status.owner_id) return role === "hosting";
  if (
    data.blocks.some(
      (row) =>
        (row.blocker_id === status.owner_id &&
          row.blocked_id === source.owner_id) ||
        (row.blocked_id === status.owner_id &&
          row.blocker_id === source.owner_id),
    )
  )
    return false;
  const rsvp = data.rsvps.find(
    (row) => row.activity_id === source.id && row.user_id === status.owner_id,
  );
  const beaconRole = data.beacon_roles.find(
    (row) => row.activity_id === source.id && row.user_id === status.owner_id,
  );
  // Hosted snapshots can omit another person's private RSVP or role rows. If
  // they are present, treat them as current local evidence and fail closed.
  if (!rsvp && !beaconRole) return true;
  const going = isApprovedGoing(source, rsvp);
  const currentRole = !going
    ? null
    : beaconRole?.role === "coowner"
      ? "cohosting"
      : "going";
  return currentRole === role;
}

/**
 * Resolve the live Beacon shown beside a Status. Hosted snapshots trust only
 * the server projection; demo data can resolve Auto from its full local view.
 */
export function visibleCurrentBeacon(
  data: Data,
  status: Activity | undefined,
  viewerId: string | null,
  now: number,
): VisibleCurrentBeacon | null {
  if (
    !status ||
    !viewerId ||
    data.viewer_id !== viewerId ||
    status.mode !== "solo" ||
    status.status !== "scheduled" ||
    Date.parse(status.starts_at) > now ||
    Date.parse(status.ends_at) <= now ||
    status.status_sharing === false ||
    locallyRevoked(data, status, viewerId) ||
    !canReadActivityPreview(data, status, viewerId)
  )
    return null;

  if (data.is_demo === true) {
    if (status.status_show_current_beacon !== true) return null;
    // Demo snapshots contain the owner-side relationships. Resolve the choice
    // there first, then re-check the chosen Beacon for this viewer below.
    const ownerView = { ...data, viewer_id: status.owner_id };
    const choices = eligibleForOwner(ownerView, status.owner_id, now);
    const selected =
      status.status_current_beacon_id == null
        ? choices[0]
        : choices.find(
            (row) => row.activity.id === status.status_current_beacon_id,
          );
    return selected
      ? visibleSource(data, selected.activity.id, viewerId, now, selected.role)
      : null;
  }

  if (data.capabilities?.status_current_beacon !== true) return null;
  const projection = status.status_current_beacon;
  if (
    !projection ||
    !["hosting", "cohosting", "going"].includes(projection.role)
  )
    return null;
  const visible = visibleSource(
    data,
    projection.id,
    viewerId,
    now,
    projection.role,
  );
  if (
    !visible ||
    !projectedOwnerRelationshipIsCurrent(
      data,
      status,
      visible.activity,
      projection.role,
    )
  )
    return null;
  if (status.owner_id === viewerId) {
    if (status.status_show_current_beacon !== true) return null;
    const ownerChoices = eligibleForOwner(data, viewerId, now);
    const selected =
      status.status_current_beacon_id == null
        ? ownerChoices[0]
        : ownerChoices.find(
            (row) => row.activity.id === status.status_current_beacon_id,
          );
    if (
      !selected ||
      selected.activity.id !== projection.id ||
      selected.role !== projection.role
    )
      return null;
  }
  return visible;
}
