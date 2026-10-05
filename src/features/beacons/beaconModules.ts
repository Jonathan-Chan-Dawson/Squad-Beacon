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
    data.activity_exclusions.some(
      (entry) => entry.activity_id === activity.id && entry.user_id === userId,
    )
  )
    return false;
  if (activity.audience === "organization") {
    const organization = data.organizations.find(
      (item) => item.id === activity.audience_id,
    );
    if (!organization || isBlocked(data, organization.owner_id, userId))
      return false;
    const isActiveMember = (memberId: string) =>
      organization.owner_id === memberId ||
      (data.organization_members.some(
        (member) =>
          member.organization_id === organization.id &&
          member.user_id === memberId &&
          member.status === "active",
      ) &&
        !data.organization_bans.some(
          (ban) => ban.organization_id === organization.id && ban.user_id === memberId,
        ));
    return isActiveMember(activity.owner_id) && isActiveMember(userId);
  }
  if (
    data.rsvps.some(
      (rsvp) =>
        rsvp.activity_id === activity.id &&
        rsvp.user_id === userId &&
        rsvp.approved,
    )
  )
    return true;
  if (
    data.beacon_invitation_grants.some(
      (grant) => grant.activity_id === activity.id && grant.user_id === userId,
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
  if (activity.status !== "scheduled" || !canUseBeaconModules(data, activity, userId))
    return false;
  if (activity.checklist_edit_policy !== "managers") return true;
  return activity.owner_id === userId || data.beacon_roles.some(
    (role) =>
      role.activity_id === activity.id &&
      role.user_id === userId &&
      (role.role === "coowner" || role.role === "admin"),
  );
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

/** Private Beacon Notes are only readable by their author, even from stale demo data. */
export function canReadBeaconNote(
  data: Data,
  note: Data["beacon_notes"][number],
  userId: string,
) {
  if (data.viewer_id != null && data.viewer_id !== userId) return false;
  const current = data.beacon_notes.find((item) => item.id === note.id);
  if (!current || current.author_id !== note.author_id) return false;
  if (current.visibility === "private") return current.author_id === userId;
  if (!current.activity_id) return current.author_id === userId;
  const activity = data.activities.find((item) => item.id === current.activity_id);
  return !!(
    activity &&
    canReadBeaconModuleEntry(data, activity, current.author_id, userId)
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
