import { canChat } from "@/src/shared/browsing";
import type { Activity, Data } from "@/src/shared/types";

function isBlocked(data: Data, left: string, right: string) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === left && block.blocked_id === right) ||
      (block.blocker_id === right && block.blocked_id === left),
  );
}

/** Mirrors current activity visibility so stale local RSVPs cannot keep granting tools. */
export function canReadBeaconActivity(
  data: Data,
  activity: Activity,
  userId: string,
) {
  if (data.is_demo === true && data.viewer_id !== userId) return false;
  if (data.viewer_id != null && data.is_demo !== true) {
    if (data.viewer_id !== userId) return false;
    const currentActivity = data.activities.find(
      (item) => item.id === activity.id,
    );
    return currentActivity?.viewer_can_access === true;
  }
  if (activity.owner_id === userId) return true;
  if (isBlocked(data, activity.owner_id, userId)) return false;
  if (
    data.rsvps.some(
      (rsvp) =>
        rsvp.activity_id === activity.id &&
        rsvp.user_id === userId &&
        rsvp.approved,
    )
  )
    return true;

  const isFriend = data.friendships.some(
    (friendship) =>
      friendship.status === "accepted" &&
      ((friendship.sender_id === activity.owner_id &&
        friendship.recipient_id === userId) ||
        (friendship.recipient_id === activity.owner_id &&
          friendship.sender_id === userId)),
  );
  if (activity.audience === "friends") return isFriend;
  if (activity.audience === "list")
    return (
      isFriend &&
      data.lists.some(
        (list) =>
          list.id === activity.audience_id &&
          list.owner_id === activity.owner_id,
      ) &&
      data.list_members.some(
        (member) =>
          member.list_id === activity.audience_id && member.user_id === userId,
      )
    );
  if (activity.audience === "squad") {
    const squad = data.squads.find(
      (item) => item.id === activity.audience_id,
    );
    return !!(
      squad &&
      !isBlocked(data, squad.owner_id, userId) &&
      data.squad_members.some(
        (member) =>
          member.squad_id === squad.id && member.user_id === userId,
      ) &&
      data.squad_members.some(
        (member) =>
          member.squad_id === squad.id && member.user_id === activity.owner_id,
      )
    );
  }
  return false;
}

/** Whether the user is an approved participant who may open beacon modules. */
export function canUseBeaconModules(
  data: Data,
  activity: Activity,
  userId: string,
) {
  return (
    canChat(data, activity, userId) &&
    canReadBeaconActivity(data, activity, userId) &&
    !isBlocked(data, activity.owner_id, userId)
  );
}

/** Checklist entries are editable only while the beacon is scheduled. */
export function canEditBeaconChecklist(
  data: Data,
  activity: Activity,
  userId: string,
) {
  return activity.status === "scheduled" && canUseBeaconModules(data, activity, userId);
}

/** Completed beacons can keep collecting memory notes; cancelled ones cannot. */
export function canAddBeaconNote(
  data: Data,
  activity: Activity,
  userId: string,
) {
  return activity.status !== "cancelled" && canUseBeaconModules(data, activity, userId);
}

/** Blocked participants' module content stays hidden even in stale local data. */
export function canReadBeaconModuleEntry(
  data: Data,
  activity: Activity,
  authorId: string,
  userId: string,
) {
  return (
    canUseBeaconModules(data, activity, userId) &&
    !isBlocked(data, authorId, userId)
  );
}

/** Hosts can moderate entries; otherwise only their author can delete them. */
export function canDeleteBeaconModuleEntry(
  data: Data,
  activity: Activity,
  authorId: string,
  userId: string,
) {
  return (
    activity.status !== "cancelled" &&
    canReadBeaconModuleEntry(data, activity, authorId, userId) &&
    (activity.owner_id === userId || authorId === userId)
  );
}
