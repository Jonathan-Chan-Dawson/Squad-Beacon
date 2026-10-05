import type { ID } from "@/src/shared/types";
import { socialDirectoryAction } from "./domain";

export type SocialEntityType = "squad" | "space" | "organization";
export type SocialRole = "owner" | "coowner" | "admin" | "elder" | "member";
export type SocialMemberRole = Exclude<SocialRole, "owner">;
export type Discoverability = "public" | "community" | "private";
export type JoinMode = "open" | "request" | "invite";
export type InvitePolicy = "admins" | "elders" | "members";
export type SocialMembershipStatus = "invited" | "requested" | "active";

/** Legacy entities retain private, invitation-only behavior after normalization. */
export const LEGACY_SOCIAL_DEFAULTS = {
  discoverability: "private",
  join_mode: "invite",
  invite_policy: "admins",
} as const satisfies {
  discoverability: Discoverability;
  join_mode: JoinMode;
  invite_policy: InvitePolicy;
};

export interface SocialDirectorySummary {
  entity_type: SocialEntityType;
  entity_id: ID;
  name: string;
  description: string;
  discoverability: Discoverability;
  join_mode: JoinMode;
  member_count: number;
  child_count: number;
  membership_status: SocialMembershipStatus | null;
  action: "joined" | "invited" | "requested" | "join" | "request" | "invite_required";
  parent_type: "space" | "organization" | null;
  parent_id: ID | null;
  parent_name: string | null;
}

export function parseSocialDirectoryRows(value: unknown): SocialDirectorySummary[] {
  if (!Array.isArray(value) || value.length > 50) return [];
  const result: SocialDirectorySummary[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if ((item.entity_type !== "squad" && item.entity_type !== "space" && item.entity_type !== "organization") ||
        (item.discoverability !== "public" && item.discoverability !== "community" && item.discoverability !== "private") ||
        (item.join_mode !== "open" && item.join_mode !== "request" && item.join_mode !== "invite") ||
        (item.membership_status !== null && item.membership_status !== "invited" && item.membership_status !== "requested" && item.membership_status !== "active") ||
        typeof item.entity_id !== "string" || !item.entity_id || item.entity_id.length > 100 ||
        typeof item.name !== "string" || !item.name || item.name.length > 120 ||
        typeof item.description !== "string" || item.description.length > 500 ||
        !Number.isSafeInteger(item.member_count) || (item.member_count as number) < 0 ||
        !Number.isSafeInteger(item.child_count) || (item.child_count as number) < 0 ||
        !(item.parent_type === null || item.parent_type === "space" || item.parent_type === "organization") ||
        !(item.parent_id === null || (typeof item.parent_id === "string" && item.parent_id.length > 0 && item.parent_id.length <= 100)) ||
        !(item.parent_name === null || (typeof item.parent_name === "string" && item.parent_name.length > 0 && item.parent_name.length <= 120))) continue;
    const membershipStatus = item.membership_status as SocialMembershipStatus | null;
    if (item.action !== socialDirectoryAction(membershipStatus, item.join_mode as JoinMode)) continue;
    const hasParentType = item.parent_type !== null;
    const hasParentId = item.parent_id !== null;
    const hasParentName = item.parent_name !== null;
    if (hasParentType !== hasParentId || hasParentId !== hasParentName) continue;
    if ((item.entity_type === "organization" && hasParentType) ||
        (item.entity_type === "space" && hasParentType && item.parent_type !== "organization")) continue;
    result.push({
      entity_type: item.entity_type as SocialEntityType,
      entity_id: item.entity_id,
      name: item.name,
      description: item.description,
      discoverability: item.discoverability as Discoverability,
      join_mode: item.join_mode as JoinMode,
      member_count: item.member_count as number,
      child_count: item.child_count as number,
      membership_status: membershipStatus,
      action: item.action as SocialDirectorySummary["action"],
      parent_type: item.parent_type as SocialDirectorySummary["parent_type"],
      parent_id: item.parent_id as ID | null,
      parent_name: item.parent_name as string | null,
    });
  }
  return result;
}

export interface OrganizationSpace {
  organization_id: ID;
  space_id: ID;
  added_by: ID | null;
  created_at: string;
}

export interface SquadJoinRequest {
  squad_id: ID;
  user_id: ID;
  created_at: string;
}

export interface SquadBan {
  squad_id: ID;
  user_id: ID;
  banned_by: ID | null;
  reason: string;
  former_role: SocialMemberRole;
  created_at: string;
}

/** Optional association metadata does not change the Beacon's audience ACL. */
export interface ActivitySocialLink {
  activity_id: ID;
  entity_type: SocialEntityType;
  entity_id: ID;
  created_by: ID | null;
  created_at: string;
}

export type SocialMembershipAction =
  | { type: "join_squad"; input: { squad_id: ID } }
  | { type: "request_squad_join"; input: { squad_id: ID } }
  | { type: "cancel_squad_join_request"; input: { squad_id: ID } }
  | { type: "approve_squad_join_request"; input: { squad_id: ID; user_id: ID } }
  | { type: "deny_squad_join_request"; input: { squad_id: ID; user_id: ID } }
  | { type: "join_space"; input: { space_id: ID } }
  | { type: "request_space_join"; input: { space_id: ID } }
  | { type: "cancel_space_join_request"; input: { space_id: ID } }
  | { type: "approve_space_join_request"; input: { space_id: ID; user_id: ID } }
  | { type: "deny_space_join_request"; input: { space_id: ID; user_id: ID } }
  | { type: "join_organization"; input: { organization_id: ID } }
  | { type: "request_organization_join"; input: { organization_id: ID } }
  | { type: "cancel_organization_join_request"; input: { organization_id: ID } }
  | { type: "approve_organization_join_request"; input: { organization_id: ID; user_id: ID } }
  | { type: "deny_organization_join_request"; input: { organization_id: ID; user_id: ID } }
  | { type: "set_social_policy"; input: { entity_type: SocialEntityType; entity_id: ID; discoverability: Discoverability; join_mode: JoinMode; invite_policy: InvitePolicy } }
  | { type: "set_squad_member_role"; input: { squad_id: ID; user_id: ID; role: SocialMemberRole } }
  | { type: "set_space_member_role"; input: { space_id: ID; user_id: ID; role: SocialMemberRole } };
