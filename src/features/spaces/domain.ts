import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import type { Data, ID, Squad } from "@/src/shared/types";
import type { Space, SpaceMember, SpaceRole } from "./types";
import { canInviteWithPolicy, SOCIAL_ROLE_RANK } from "@/src/features/social/domain";
import { activeOrganizationRole } from "@/src/features/organizations/domain";

function isBlocked(data: Data, left: ID, right: ID) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === left && block.blocked_id === right) ||
      (block.blocker_id === right && block.blocked_id === left),
  );
}

function currentMember(
  data: Data,
  spaceId: ID,
  userId: ID,
): SpaceMember | undefined {
  return data.space_members.find(
    (member) => member.space_id === spaceId && member.user_id === userId,
  );
}

export function activeSpaceRole(
  space: Space,
  members: readonly SpaceMember[],
  userId: ID,
): SpaceRole | null {
  const member = members.find(
    (row) => row.space_id === space.id && row.user_id === userId,
  );
  if (member?.status !== "active") return null;
  if (userId === space.owner_id) return member.role === "owner" ? "owner" : null;
  return member.role === "owner" ? null : member.role;
}

function eligibleParentMember(data: Data, spaceId: ID, viewerId: ID) {
  return data.organization_spaces.some((link) => {
    if (link.space_id !== spaceId) return false;
    const organization = data.organizations.find(
      (item) => item.id === link.organization_id,
    );
    return !!organization && !organization.archived_at &&
      !isBlocked(data, organization.owner_id, viewerId) &&
      !data.organization_bans.some(
        (ban) => ban.organization_id === organization.id && ban.user_id === viewerId,
      ) &&
      activeOrganizationRole(organization, data.organization_members, viewerId) !== null;
  });
}

/** Pending invitees may see Space basics, but not its roster or Squad links. */
export function canReadSpace(
  data: Data,
  spaceId: ID,
  viewerId: ID | null,
): boolean {
  if (!viewerId || data.viewer_id !== viewerId) return false;
  const space = data.spaces.find((item) => item.id === spaceId);
  if (!space || isBlocked(data, space.owner_id, viewerId) ||
      space.archived_at || data.space_bans.some(
        (ban) => ban.space_id === spaceId && ban.user_id === viewerId,
      )) return false;
  const member = currentMember(data, spaceId, viewerId);
  if (viewerId === space.owner_id) return member?.status === "active" && member.role === "owner";
  if (member?.status === "active") return true;
  if (member?.status === "invited") return true;
  if (space.discoverability === "public") return true;
  return space.discoverability === "community" &&
    eligibleParentMember(data, spaceId, viewerId);
}

export function canManageSpace(
  data: Data,
  spaceId: ID,
  viewerId: ID | null,
): boolean {
  if (!viewerId || !canReadSpace(data, spaceId, viewerId)) return false;
  const space = data.spaces.find((item) => item.id === spaceId)!;
  const role = activeSpaceRole(space, data.space_members, viewerId);
  return role !== null && SOCIAL_ROLE_RANK[role] >= SOCIAL_ROLE_RANK.admin;
}

export function canManageSpaceMember(
  data: Data,
  spaceId: ID,
  viewerId: ID | null,
  targetId: ID,
): boolean {
  if (!viewerId || targetId === viewerId || !canManageSpace(data, spaceId, viewerId))
    return false;
  const space = data.spaces.find((item) => item.id === spaceId)!;
  if (targetId === space.owner_id) return false;
  const target = currentMember(data, spaceId, targetId);
  const actorRole = activeSpaceRole(space, data.space_members, viewerId);
  return !!target && !!actorRole && SOCIAL_ROLE_RANK[actorRole] > SOCIAL_ROLE_RANK[target.role];
}

export function canInviteSpaceMember(
  data: Data,
  spaceId: ID,
  viewerId: ID | null,
  targetId: ID,
  role: Exclude<SpaceRole, "owner"> = "member",
): boolean {
  if (!viewerId || data.viewer_id !== viewerId || targetId === viewerId || !canReadSpace(data, spaceId, viewerId))
    return false;
  const space = data.spaces.find((item) => item.id === spaceId)!;
  const targetProfile = data.profiles.find((profile) => profile.id === targetId);
  if (
    !targetProfile ||
    targetId === space.owner_id ||
    isBlocked(data, viewerId, targetId) ||
    isBlocked(data, space.owner_id, targetId) ||
    data.space_bans.some((ban) => ban.space_id === spaceId && ban.user_id === targetId)
  )
    return false;
  const isFriend = data.friendships.some(
    (friendship) =>
      friendship.status === "accepted" &&
      ((friendship.sender_id === viewerId && friendship.recipient_id === targetId) ||
        (friendship.recipient_id === viewerId && friendship.sender_id === targetId)),
  );
  const actorRole = activeSpaceRole(space, data.space_members, viewerId);
  const oldInvite = currentMember(data, spaceId, targetId);
  if (!isFriend || oldInvite?.status === "active" || !actorRole ||
      !canInviteWithPolicy(actorRole, data.spaces.find((item) => item.id === spaceId)?.invite_policy)) return false;
  const canIssueRole = SOCIAL_ROLE_RANK[actorRole] > SOCIAL_ROLE_RANK[role] ||
    (role === "member" && actorRole === "member" && data.spaces.find((item) => item.id === spaceId)?.invite_policy === "members");
  return canIssueRole && (!oldInvite || SOCIAL_ROLE_RANK[actorRole] > SOCIAL_ROLE_RANK[oldInvite.role]);
}

export function canLeaveSpace(
  data: Data,
  spaceId: ID,
  viewerId: ID | null,
): boolean {
  if (!viewerId || !canReadSpace(data, spaceId, viewerId)) return false;
  const space = data.spaces.find((item) => item.id === spaceId)!;
  return viewerId !== space.owner_id &&
    activeSpaceRole(space, data.space_members, viewerId) !== null;
}

/** Returns linked Squads only when the viewer independently has Squad access. */
export function visibleSpaceSquads(
  data: Data,
  spaceId: ID,
  viewerId: ID | null,
): Squad[] {
  if (!viewerId || !canReadSpace(data, spaceId, viewerId)) return [];
  const member = currentMember(data, spaceId, viewerId);
  if (member?.status !== "active") return [];
  const seen = new Set<ID>();
  const visible: Squad[] = [];
  for (const link of data.space_squads) {
    if (link.space_id !== spaceId || seen.has(link.squad_id)) continue;
    const squad = data.squads.find((item) => item.id === link.squad_id);
    if (!squad || !canOpenSquadProfile(data, squad.id, viewerId)) continue;
    seen.add(squad.id);
    visible.push(squad);
  }
  return visible;
}

/** Returns one connected Space only when the viewer independently belongs to both entities. */
export function visibleSquadSpace(
  data: Data,
  squadId: ID,
  viewerId: ID | null,
) {
  if (!viewerId || !canOpenSquadProfile(data, squadId, viewerId)) return undefined;
  return data.space_squads
    .filter((link) => link.squad_id === squadId)
    .map((link) => data.spaces.find((item) => item.id === link.space_id))
    .find((space) =>
      !!space &&
      canReadSpace(data, space.id, viewerId) &&
      activeSpaceRole(space, data.space_members, viewerId) !== null,
    );
}
