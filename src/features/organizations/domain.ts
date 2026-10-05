import type { Data, ID } from "@/src/shared/types";
import type {
  Organization,
  OrganizationMember,
  OrganizationMemberRole,
  OrganizationRole,
} from "./types";
import { canInviteWithPolicy, SOCIAL_ROLE_RANK } from "@/src/features/social/domain";

const rank = SOCIAL_ROLE_RANK;

function isBlocked(data: Data, left: ID, right: ID) {
  return data.blocks.some((block) =>
    (block.blocker_id === left && block.blocked_id === right) ||
    (block.blocker_id === right && block.blocked_id === left),
  );
}

/** Basic profile visibility; it never grants roster, chat, or child access. */
export function canReadOrganization(data: Data, organizationId: ID, userId: ID | null) {
  if (!userId || data.viewer_id !== userId) return false;
  const organization = data.organizations.find((row) => row.id === organizationId);
  if (!organization || organization.archived_at || isBlocked(data, organization.owner_id, userId)) return false;
  if (data.organization_bans.some((row) => row.organization_id === organizationId && row.user_id === userId)) return false;
  const membership = data.organization_members.find((row) => row.organization_id === organizationId && row.user_id === userId);
  if (organization.owner_id === userId || membership?.status === "active" || membership?.status === "invited") return true;
  return organization.discoverability === "public";
}

/** Member-only projections stay behind this stricter check. */
export function canReadOrganizationMembers(data: Data, organizationId: ID, userId: ID | null) {
  if (!canReadOrganization(data, organizationId, userId) || !userId) return false;
  const organization = data.organizations.find((row) => row.id === organizationId)!;
  return organization.owner_id === userId || data.organization_members.some(
    (row) => row.organization_id === organizationId && row.user_id === userId && row.status === "active",
  );
}

export function activeOrganizationRole(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
): OrganizationRole | null {
  if (organization.owner_id === userId) return "owner";
  const member = members.find(
    (row) =>
      row.organization_id === organization.id &&
      row.user_id === userId &&
      row.status === "active",
  );
  return member?.role ?? null;
}

export function canManageOrganization(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
) {
  const role = activeOrganizationRole(organization, members, userId);
  return role === "owner" || role === "coowner" || role === "admin";
}

export function canManageOrganizationSquads(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
) {
  const role = activeOrganizationRole(organization, members, userId);
  return role !== null && rank[role] >= rank.elder;
}

export function canInviteOrganizationRole(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
  invitedRole: OrganizationMemberRole,
) {
  const actorRole = activeOrganizationRole(organization, members, userId);
  if (!actorRole) return false;
  return (
    canInviteWithPolicy(actorRole, organization.invite_policy) &&
    (rank[actorRole] > rank[invitedRole] ||
      (actorRole === "member" && invitedRole === "member" && organization.invite_policy === "members"))
  );
}

function organizationMember(
  organization: Organization,
  members: readonly OrganizationMember[],
  targetUserId: ID,
) {
  return members.find(
    (row) => row.organization_id === organization.id && row.user_id === targetUserId,
  );
}

export function canManageOrganizationMember(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
  targetUserId: ID,
) {
  if (targetUserId === organization.owner_id || targetUserId === userId) return false;
  const actorRole = activeOrganizationRole(organization, members, userId);
  const target = organizationMember(organization, members, targetUserId);
  if (!actorRole || rank[actorRole] < rank.admin || !target) return false;
  return rank[actorRole] > rank[target.role];
}

export function canChangeOrganizationMemberRole(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
  targetUserId: ID,
  nextRole?: OrganizationMemberRole,
) {
  if (targetUserId === organization.owner_id || targetUserId === userId) return false;
  const actorRole = activeOrganizationRole(organization, members, userId);
  const target = organizationMember(organization, members, targetUserId);
  if (!actorRole || rank[actorRole] < rank.admin || !target) return false;
  const targetRank = rank[target.role];
  if (actorRole !== "owner" && rank[actorRole] <= targetRank) return false;
  if (!nextRole) return actorRole === "owner";
  return rank[actorRole] > rank[nextRole];
}

export function canLeaveOrganization(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
) {
  return (
    userId !== organization.owner_id &&
    activeOrganizationRole(organization, members, userId) !== null
  );
}

export function organizationSizeLabel(activeMemberCount: number):
  | "Very Small"
  | "Small"
  | "Large"
  | "Very Large"
  | "Mega" {
  if (activeMemberCount < 100) return "Very Small";
  if (activeMemberCount < 1_000) return "Small";
  if (activeMemberCount < 10_000) return "Large";
  if (activeMemberCount < 100_000) return "Very Large";
  return "Mega";
}

export function organizationActiveMemberCount(
  organizationId: ID,
  organizationOwnerId: ID,
  members: readonly OrganizationMember[],
) {
  return (
    1 +
    members.filter(
      (row) => row.organization_id === organizationId && row.status === "active",
    ).length -
    Number(members.some((row) => row.organization_id === organizationId && row.user_id === organizationOwnerId && row.status === "active"))
  );
}

export function groupChatScopeId(input: {
  scope: "organization" | "squad";
  organization_id?: ID | null;
  squad_id?: ID | null;
}) {
  return input.scope === "organization"
    ? input.organization_id ?? null
    : input.squad_id ?? null;
}
