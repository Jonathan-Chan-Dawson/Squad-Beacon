import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import type { Activity, BeaconRole, Data, RSVP } from "@/src/shared/types";

export type BeaconRoleName = "owner" | "coowner" | "admin" | "attendee" | "none";
export type BeaconModuleName =
  | "chat"
  | "checklist"
  | "journal"
  | "experiences"
  | "comments"
  | "focus"
  | "reactions"
  | "scoreboard"
  | "music";

function isBlocked(data: Data, left: string, right: string) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === left && block.blocked_id === right) ||
      (block.blocker_id === right && block.blocked_id === left),
  );
}

export function isApprovedGoing(activity: Activity, rsvp: RSVP | undefined) {
  return !!(
    rsvp?.status === "going" &&
    (rsvp.approved || !(activity.approval_required || activity.mode === "invite"))
  );
}

export function activeGoingRsvp(data: Data, activityId: string, userId: string) {
  return data.rsvps.find(
    (rsvp) => rsvp.activity_id === activityId && rsvp.user_id === userId,
  );
}

export function beaconRoleFor(
  data: Data,
  activity: Activity,
  userId: string,
): BeaconRoleName {
  if (activity.owner_id === userId) return "owner";
  if (isBlocked(data, activity.owner_id, userId)) return "none";
  if (
    !isApprovedGoing(activity, activeGoingRsvp(data, activity.id, userId)) ||
    !canUseBeaconModules(data, activity, userId)
  )
    return "none";
  return (
    data.beacon_roles.find(
      (role) => role.activity_id === activity.id && role.user_id === userId,
    )?.role ?? "attendee"
  );
}

export function beaconSeatCount(data: Data, activity: Activity) {
  if (
    Number.isInteger(activity.accepted_seat_count) &&
    (activity.accepted_seat_count ?? 0) >= 0
  )
    return activity.accepted_seat_count ?? 0;
  const people = new Set<string>([activity.owner_id]);
  for (const rsvp of data.rsvps) {
    if (
      rsvp.activity_id === activity.id &&
      !isBlocked(data, activity.owner_id, rsvp.user_id) &&
      isApprovedGoing(activity, rsvp)
    )
      people.add(rsvp.user_id);
  }
  return people.size;
}

export function beaconCapacity(data: Data, activity: Activity) {
  const count = beaconSeatCount(data, activity),
    limit = activity.capacity_limit ?? null,
    strict = activity.capacity_policy === "strict",
    atLimit = strict && limit != null && count >= limit,
    manuallyClosed = activity.manual_closed === true;
  return {
    count,
    limit,
    remaining: limit == null ? null : Math.max(0, limit - count),
    strict,
    full: atLimit,
    closed: manuallyClosed || atLimit || activity.status !== "scheduled",
    manuallyClosed,
  };
}

function canUseManagement(data: Data, activity: Activity, userId: string) {
  return (
    activity.status === "scheduled" &&
    canUseBeaconModules(data, activity, userId) &&
    !isBlocked(data, activity.owner_id, userId)
  );
}

export function canManageBeacon(data: Data, activity: Activity, userId: string) {
  const role = beaconRoleFor(data, activity, userId);
  return canUseManagement(data, activity, userId) &&
    (role === "owner" || role === "coowner" || role === "admin");
}

export function canManageBeaconSettings(
  data: Data,
  activity: Activity,
  userId: string,
) {
  const role = beaconRoleFor(data, activity, userId);
  return canUseManagement(data, activity, userId) &&
    (role === "owner" || role === "coowner");
}

export function canAdmitBeaconParticipants(
  data: Data,
  activity: Activity,
  userId: string,
) {
  return canManageBeacon(data, activity, userId);
}

export function canAssignBeaconRole(
  data: Data,
  activity: Activity,
  actorId: string,
  targetId: string,
  role: BeaconRole["role"],
) {
  if (
    targetId === activity.owner_id ||
    targetId === actorId ||
    isBlocked(data, activity.owner_id, targetId) ||
    !isApprovedGoing(activity, activeGoingRsvp(data, activity.id, targetId))
  )
    return false;
  const actorRole = beaconRoleFor(data, activity, actorId);
  const existingTargetRole = data.beacon_roles.find(
    (item) => item.activity_id === activity.id && item.user_id === targetId,
  )?.role;
  return (
    canUseManagement(data, activity, actorId) &&
    !isBlocked(data, actorId, targetId) &&
    (actorRole === "owner" ||
      (role === "admin" &&
        actorRole === "coowner" &&
        existingTargetRole !== "coowner"))
  );
}

export function canRevokeBeaconRole(
  data: Data,
  activity: Activity,
  actorId: string,
  targetId: string,
) {
  const targetRole = data.beacon_roles.find(
    (role) => role.activity_id === activity.id && role.user_id === targetId,
  )?.role;
  if (!targetRole || targetId === actorId) return false;
  const actorRole = beaconRoleFor(data, activity, actorId);
  return (
    canUseManagement(data, activity, actorId) &&
    (actorRole === "owner" ||
      (actorRole === "coowner" && targetRole === "admin"))
  );
}

export function canRemoveBeaconParticipant(
  data: Data,
  activity: Activity,
  actorId: string,
  targetId: string,
) {
  if (
    targetId === actorId ||
    targetId === activity.owner_id ||
    !data.rsvps.some(
      (rsvp) => rsvp.activity_id === activity.id && rsvp.user_id === targetId,
    )
  )
    return false;
  const actorRole = beaconRoleFor(data, activity, actorId),
    targetRole = data.beacon_roles.find(
      (role) => role.activity_id === activity.id && role.user_id === targetId,
    )?.role;
  if (!canUseManagement(data, activity, actorId)) return false;
  if (actorRole === "owner") return true;
  if (actorRole === "coowner") return targetRole !== "coowner";
  return actorRole === "admin" && targetRole == null;
}

export function isBeaconModuleEnabled(
  activity: Activity,
  module: BeaconModuleName,
) {
  if (module === "scoreboard") return activity.enable_scoreboard === true;
  if (module === "music")
    return activity.enable_music ?? !!activity.music_url;
  const property: Record<Exclude<BeaconModuleName, "scoreboard" | "music">, keyof Activity> = {
    chat: "enable_chat",
    checklist: "enable_checklist",
    journal: "enable_journal",
    experiences: "enable_experiences",
    comments: "enable_comments",
    focus: "enable_focus",
    reactions: "enable_reactions",
  };
  return activity[property[module]] !== false;
}

/** Writes pause when a module is off; existing authorized history remains readable. */
export function canWriteBeaconModule(
  data: Data,
  activity: Activity,
  userId: string,
  module: BeaconModuleName,
) {
  return (
    activity.status !== "cancelled" &&
    isBeaconModuleEnabled(activity, module) &&
    canUseBeaconModules(data, activity, userId)
  );
}

export function canSetArrivalState(
  data: Data,
  activity: Activity,
  actorId: string,
  targetId: string,
  state: "none" | "arriving" | "present",
  now = Date.now(),
) {
  if (
    activity.status === "cancelled" ||
    actorId !== targetId ||
    isBlocked(data, activity.owner_id, actorId) ||
    !canUseBeaconModules(data, activity, actorId) ||
    (activity.owner_id !== actorId &&
      !isApprovedGoing(activity, activeGoingRsvp(data, activity.id, actorId)))
  )
    return false;
  if (activity.status === "completed") {
    const current = data.beacon_attendance.find(
      (arrival) => arrival.activity_id === activity.id && arrival.user_id === actorId,
    )?.state ?? "none";
    return state === current;
  }
  if (state === "present")
    return (
      activity.status === "scheduled" &&
      Date.parse(activity.starts_at) <= now &&
      Date.parse(activity.ends_at) > now
    );
  if (state === "arriving") return Date.parse(activity.ends_at) > now;
  return activity.status === "scheduled";
}
