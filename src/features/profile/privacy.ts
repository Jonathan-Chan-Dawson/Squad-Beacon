import type { Activity, Data, ID, Profile } from "@/src/shared/types";

function isBlocked(data: Data, left: ID, right: ID) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === left && block.blocked_id === right) ||
      (block.blocker_id === right && block.blocked_id === left),
  );
}

function areFriends(data: Data, left: ID, right: ID) {
  return data.friendships.some(
    (friendship) =>
      friendship.status === "accepted" &&
      ((friendship.sender_id === left && friendship.recipient_id === right) ||
        (friendship.sender_id === right && friendship.recipient_id === left)),
  );
}

function inSquad(data: Data, squadId: ID, userId: ID) {
  return data.squad_members.some(
    (member) => member.squad_id === squadId && member.user_id === userId,
  );
}

function demoCanReadActivity(data: Data, activity: Activity, viewerId: ID) {
  // Match private.can_activity: a visible audience, an approved RSVP, or an
  // explicit invitation grant is enough. Keep these as OR-ed paths so a
  // private invite is not lost just because its base audience doesn't match.
  if (activity.owner_id === viewerId) return true;
  if (isBlocked(data, activity.owner_id, viewerId)) return false;
  if (
    data.activity_exclusions.some(
      (entry) => entry.activity_id === activity.id && entry.user_id === viewerId,
    )
  )
    return false;
  const audienceAllows =
    activity.audience === "friends"
      ? areFriends(data, activity.owner_id, viewerId)
      : activity.audience === "squad"
        ? !!activity.audience_id &&
          inSquad(data, activity.audience_id, activity.owner_id) &&
          inSquad(data, activity.audience_id, viewerId)
        : activity.audience === "list"
          ? !!activity.audience_id &&
            areFriends(data, activity.owner_id, viewerId) &&
            data.lists.some(
              (list) =>
                list.id === activity.audience_id &&
                list.owner_id === activity.owner_id,
            ) &&
            data.list_members.some(
              (member) =>
                member.list_id === activity.audience_id &&
                member.user_id === viewerId,
            )
          : false;
  const approvedRsvp = data.rsvps.some(
    (rsvp) =>
      rsvp.activity_id === activity.id &&
      rsvp.user_id === viewerId &&
      rsvp.approved,
  );
  const invitation = data.beacon_invitation_grants.some(
    (grant) =>
      grant.activity_id === activity.id && grant.user_id === viewerId,
  );
  return audienceAllows || approvedRsvp || invitation;
}

function demoLegacyProfileVisibility(data: Data, profileId: ID, viewerId: ID) {
  if (profileId === viewerId || areFriends(data, profileId, viewerId))
    return true;
  if (
    data.friendships.some(
      (friendship) =>
        friendship.sender_id === profileId &&
        friendship.recipient_id === viewerId &&
        friendship.status === "pending",
    )
  )
    return true;
  if (
    data.squad_members.some(
      (member) =>
        member.user_id === profileId && inSquad(data, member.squad_id, viewerId),
    )
  )
    return true;
  return data.activities.some(
    (activity) =>
      activity.owner_id === profileId &&
      demoCanReadActivity(data, activity, viewerId),
  );
}

function demoCustomAudienceAllows(
  data: Data,
  profileId: ID,
  viewerId: ID,
) {
  return data.profile_visibility_grants.some((grant) => {
    if (grant.owner_id !== profileId) return false;
    if (grant.kind === "person") return grant.target_id === viewerId;
    if (grant.kind === "squad")
      return (
        inSquad(data, grant.target_id, profileId) &&
        inSquad(data, grant.target_id, viewerId)
      );
    return (
      data.lists.some(
        (list) => list.id === grant.target_id && list.owner_id === profileId,
      ) &&
      data.list_members.some(
        (member) =>
          member.list_id === grant.target_id && member.user_id === viewerId,
      )
    );
  });
}

/**
 * Whether the current viewer may see a person's full profile, as opposed to
 * only the minimal identity needed for an already-authorized beacon interaction.
 * Always resolve against the current snapshot; callers cannot authorize stale objects.
 */
export function canViewProfile(
  data: Data,
  target: Profile | ID,
  viewerId: ID | null,
): boolean {
  if (!viewerId || data.viewer_id !== viewerId) return false;
  const targetId = typeof target === "string" ? target : target.id;
  const profile = data.profiles.find((item) => item.id === targetId);
  if (!profile) return false;
  if (isBlocked(data, targetId, viewerId)) return false;

  if (data.is_demo) {
    if (targetId === viewerId) return true;
    switch (profile.profile_visibility ?? "public") {
      case "public":
        return demoLegacyProfileVisibility(data, targetId, viewerId);
      case "friends":
        return areFriends(data, targetId, viewerId);
      case "custom":
        return demoCustomAudienceAllows(data, targetId, viewerId);
    }
  }

  return profile.viewer_can_view_full_profile === true;
}
