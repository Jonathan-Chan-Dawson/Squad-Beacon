import type { ID } from "@/src/shared/types";
import type { Organization, OrganizationMember } from "./types";

export function activeOrganizationRole(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
): "owner" | "admin" | "member" | null {
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
  return role === "owner" || role === "admin";
}

export function canInviteOrganizationRole(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
  invitedRole: "admin" | "member",
) {
  const actorRole = activeOrganizationRole(organization, members, userId);
  return actorRole === "owner" || (actorRole === "admin" && invitedRole === "member");
}

export function canManageOrganizationMember(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
  targetUserId: ID,
) {
  if (targetUserId === organization.owner_id || targetUserId === userId) return false;
  const actorRole = activeOrganizationRole(organization, members, userId);
  if (actorRole === "owner") return true;
  if (actorRole !== "admin") return false;
  const target = members.find(
    (row) =>
      row.organization_id === organization.id && row.user_id === targetUserId,
  );
  if (!target) return false;
  return target?.role === "member";
}

export function canChangeOrganizationMemberRole(
  organization: Organization,
  members: readonly OrganizationMember[],
  userId: ID,
  targetUserId: ID,
) {
  if (userId !== organization.owner_id || targetUserId === organization.owner_id)
    return false;
  return members.some(
    (row) =>
      row.organization_id === organization.id &&
      row.user_id === targetUserId &&
      row.status === "active",
  );
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
