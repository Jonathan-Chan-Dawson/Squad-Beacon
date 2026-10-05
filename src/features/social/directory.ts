import type { Data, ID } from "@/src/shared/types";
import { socialDirectoryAction, isSocialDirectoryVisible } from "./domain";
import type {
  SocialDirectorySummary,
  SocialEntityType,
  SocialMembershipStatus,
} from "./types";

export interface SocialDirectoryQuery {
  query: string;
  entityType?: "all" | SocialEntityType;
  pageSize?: number;
  pageOffset?: number;
  parentType?: "space" | "organization";
  parentId?: ID;
}

export function normalizeSocialDirectoryQuery(
  input: SocialDirectoryQuery,
): SocialDirectoryQuery | null {
  if (!input || typeof input.query !== "string") return null;
  const query = input.query.trim();
  if (query.length === 1 || query.length > 80) return null;
  const entityType = input.entityType ?? "all";
  if (entityType !== "all" && entityType !== "squad" && entityType !== "space" && entityType !== "organization") return null;
  if (!!input.parentType !== !!input.parentId) return null;
  if (input.parentType && input.parentType !== "space" && input.parentType !== "organization") return null;
  if (input.parentId && (typeof input.parentId !== "string" || input.parentId.length > 100)) return null;
  const pageSize = Number.isFinite(input.pageSize)
    ? Math.min(50, Math.max(1, Math.trunc(input.pageSize!)))
    : 20;
  const pageOffset = Number.isFinite(input.pageOffset)
    ? Math.min(5000, Math.max(0, Math.trunc(input.pageOffset!)))
    : 0;
  return { ...input, query, entityType, pageSize, pageOffset };
}

function blocked(data: Data, first: ID, second: ID) {
  return data.blocks.some(
    (row) =>
      (row.blocker_id === first && row.blocked_id === second) ||
      (row.blocker_id === second && row.blocked_id === first),
  );
}

function activeOrganization(data: Data, organizationId: ID, userId: ID) {
  const organization = data.organizations.find((row) => row.id === organizationId);
  if (!organization || organization.archived_at || blocked(data, organization.owner_id, userId)) return false;
  if (data.organization_bans.some((row) => row.organization_id === organizationId && row.user_id === userId)) return false;
  return organization.owner_id === userId || data.organization_members.some(
    (row) => row.organization_id === organizationId && row.user_id === userId && row.status === "active",
  );
}

function activeSpace(data: Data, spaceId: ID, userId: ID) {
  const space = data.spaces.find((row) => row.id === spaceId);
  if (!space || space.archived_at || blocked(data, space.owner_id, userId)) return false;
  if (data.space_bans.some((row) => row.space_id === spaceId && row.user_id === userId)) return false;
  return data.space_members.some(
    (row) => row.space_id === spaceId && row.user_id === userId && row.status === "active",
  );
}

function memberStatus(data: Data, type: SocialEntityType, id: ID, userId: ID): SocialMembershipStatus | null {
  if (type === "organization")
    return data.organization_members.find((row) => row.organization_id === id && row.user_id === userId)?.status ??
      (data.organizations.find((row) => row.id === id)?.owner_id === userId ? "active" : null);
  if (type === "space")
    return data.space_members.find((row) => row.space_id === id && row.user_id === userId)?.status ?? null;
  if (data.squad_members.some((row) => row.squad_id === id && row.user_id === userId)) return "active";
  if (data.squad_invites.some((row) => row.squad_id === id && row.recipient_id === userId)) return "invited";
  return data.squad_join_requests.some((row) => row.squad_id === id && row.user_id === userId) ? "requested" : null;
}

function parentEligible(data: Data, type: SocialEntityType, id: ID, userId: ID) {
  if (type === "organization") return false;
  if (type === "space")
    return data.organization_spaces.some((row) => row.space_id === id && activeOrganization(data, row.organization_id, userId));
  const fromSpace = data.space_squads.some((row) => row.squad_id === id && activeSpace(data, row.space_id, userId));
  const fromOrganization = data.organization_squads.some((row) => row.squad_id === id && activeOrganization(data, row.organization_id, userId));
  const throughSpace = data.space_squads.some((row) =>
    row.squad_id === id && activeSpace(data, row.space_id, userId) && data.organization_spaces.some((link) =>
      link.space_id === row.space_id && activeOrganization(data, link.organization_id, userId),
    ),
  );
  return fromSpace || fromOrganization || throughSpace;
}

function entityVisible(data: Data, type: SocialEntityType, id: ID, userId: ID) {
  const organization = type === "organization" ? data.organizations.find((row) => row.id === id) : undefined;
  const space = type === "space" ? data.spaces.find((row) => row.id === id) : undefined;
  const squad = type === "squad" ? data.squads.find((row) => row.id === id) : undefined;
  const entity = organization ?? space ?? squad;
  if (!entity || entity.archived_at || blocked(data, entity.owner_id, userId)) return false;
  if (type === "organization" && data.organization_bans.some((row) => row.organization_id === id && row.user_id === userId)) return false;
  if (type === "space" && data.space_bans.some((row) => row.space_id === id && row.user_id === userId)) return false;
  if (type === "squad" && data.squad_bans.some((row) => row.squad_id === id && row.user_id === userId)) return false;
  if (memberStatus(data, type, id, userId) === "active" || memberStatus(data, type, id, userId) === "invited") return true;
  return isSocialDirectoryVisible(entity.discoverability ?? "private", parentEligible(data, type, id, userId));
}

function safeParent(data: Data, type: SocialEntityType, id: ID, userId: ID) {
  if (type === "organization") return null;
  if (type === "space") {
    const link = data.organization_spaces.find((row) => row.space_id === id && entityVisible(data, "organization", row.organization_id, userId));
    const parent = link && data.organizations.find((row) => row.id === link.organization_id);
    return parent ? { parent_type: "organization" as const, parent_id: parent.id, parent_name: parent.name } : null;
  }
  for (const link of data.space_squads.filter((row) => row.squad_id === id)) {
    if (entityVisible(data, "space", link.space_id, userId)) {
      const parent = data.spaces.find((row) => row.id === link.space_id);
      if (parent) return { parent_type: "space" as const, parent_id: parent.id, parent_name: parent.name };
    }
  }
  for (const link of data.organization_squads.filter((row) => row.squad_id === id)) {
    if (entityVisible(data, "organization", link.organization_id, userId)) {
      const parent = data.organizations.find((row) => row.id === link.organization_id);
      if (parent) return { parent_type: "organization" as const, parent_id: parent.id, parent_name: parent.name };
    }
  }
  return null;
}

function counts(data: Data, type: SocialEntityType, id: ID, ownerId: ID, userId: ID) {
  const memberCount = type === "organization"
    ? 1 +
      data.organization_members.filter((row) => row.organization_id === id && row.status === "active" && row.user_id !== ownerId).length
    : type === "space"
      ? data.space_members.filter((row) => row.space_id === id && row.status === "active").length
      : data.squad_members.filter((row) => row.squad_id === id).length;
  const childCount = type === "organization"
    ? new Set([
        ...data.organization_spaces.filter((row) => row.organization_id === id && entityVisible(data, "space", row.space_id, userId)).map((row) => `space:${row.space_id}`),
        ...data.organization_squads.filter((row) => row.organization_id === id && entityVisible(data, "squad", row.squad_id, userId)).map((row) => `squad:${row.squad_id}`),
        ...data.organization_spaces.filter((row) => row.organization_id === id && entityVisible(data, "space", row.space_id, userId)).flatMap((link) =>
          data.space_squads.filter((squad) => squad.space_id === link.space_id && entityVisible(data, "squad", squad.squad_id, userId)).map((squad) => `squad:${squad.squad_id}`),
        ),
      ]).size
    : type === "space"
      ? new Set(data.space_squads.filter((row) => row.space_id === id && entityVisible(data, "squad", row.squad_id, userId)).map((row) => row.squad_id)).size
      : 0;
  return { memberCount, childCount };
}

function selectedByParent(data: Data, type: SocialEntityType, id: ID, parentType: "space" | "organization" | undefined, parentId: ID | undefined, viewerId: ID) {
  if (!parentType || !parentId) return true;
  if (parentType === "space") return type === "squad" && data.space_squads.some((row) => row.space_id === parentId && row.squad_id === id);
  if (type === "space") return data.organization_spaces.some((row) => row.organization_id === parentId && row.space_id === id);
  if (type !== "squad") return false;
  return data.organization_squads.some((row) => row.organization_id === parentId && row.squad_id === id) ||
    data.organization_spaces.some((link) => link.organization_id === parentId && entityVisible(data, "space", link.space_id, viewerId) && data.space_squads.some((row) => row.space_id === link.space_id && row.squad_id === id));
}

export function searchSocialDirectoryInData(
  data: Data,
  viewerId: ID | null,
  input: SocialDirectoryQuery,
): SocialDirectorySummary[] {
  const normalized = normalizeSocialDirectoryQuery(input);
  const query = normalized?.query.toLocaleLowerCase() ?? "";
  if (!normalized || !viewerId || data.viewer_id !== viewerId) return [];
  if (normalized.parentId && (!normalized.parentType || !entityVisible(data, normalized.parentType, normalized.parentId, viewerId))) return [];
  const pageSize = normalized.pageSize ?? 20;
  const pageOffset = normalized.pageOffset ?? 0;
  const entityTypes: SocialEntityType[] = normalized.entityType && normalized.entityType !== "all"
    ? [normalized.entityType]
    : ["organization", "space", "squad"];
  const rows: SocialDirectorySummary[] = [];
  const add = (type: SocialEntityType, entity: { id: ID; owner_id: ID; name: string; description: string; discoverability?: "public" | "community" | "private"; join_mode?: "open" | "request" | "invite" }) => {
    if (!entityVisible(data, type, entity.id, viewerId)) return;
    if (!selectedByParent(data, type, entity.id, input.parentType, input.parentId, viewerId)) return;
    if (!(entity.name.toLocaleLowerCase().includes(query) || entity.description.toLocaleLowerCase().includes(query))) return;
    const joinMode = entity.join_mode ?? "invite";
    const membershipStatus = memberStatus(data, type, entity.id, viewerId);
    const parent = safeParent(data, type, entity.id, viewerId);
    const { memberCount, childCount } = counts(data, type, entity.id, entity.owner_id, viewerId);
    rows.push({
      entity_type: type,
      entity_id: entity.id,
      name: entity.name,
      description: entity.description,
      discoverability: entity.discoverability ?? "private",
      join_mode: joinMode,
      member_count: memberCount,
      child_count: childCount,
      membership_status: membershipStatus,
      action: socialDirectoryAction(membershipStatus, joinMode),
      parent_type: parent?.parent_type ?? null,
      parent_id: parent?.parent_id ?? null,
      parent_name: parent?.parent_name ?? null,
    });
  };
  if (entityTypes.includes("organization"))
    data.organizations.forEach((row) => add("organization", row));
  if (entityTypes.includes("space"))
    data.spaces.forEach((row) => add("space", row));
  if (entityTypes.includes("squad"))
    data.squads.forEach((row) => add("squad", row));
  return rows.sort((a, b) => {
    const prefixOrder = Number(!a.name.toLocaleLowerCase().startsWith(query)) - Number(!b.name.toLocaleLowerCase().startsWith(query));
    return prefixOrder || a.name.localeCompare(b.name) || a.entity_type.localeCompare(b.entity_type) || a.entity_id.localeCompare(b.entity_id);
  }).slice(pageOffset, pageOffset + pageSize);
}

export function canReadUnjoinedSquadSummary(
  data: Data,
  squadId: ID,
  viewerId: ID | null,
): { id: ID; name: string; description: string } | null {
  if (!viewerId || data.viewer_id !== viewerId || !entityVisible(data, "squad", squadId, viewerId)) return null;
  const squad = data.squads.find((row) => row.id === squadId);
  return squad ? { id: squad.id, name: squad.name, description: squad.description } : null;
}
