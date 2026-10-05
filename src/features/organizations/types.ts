import type { ID } from "@/src/shared/types";
import type {
  Discoverability,
  InvitePolicy,
  JoinMode,
  OrganizationSpace,
} from "@/src/features/social/types";

export type OrganizationRole = "owner" | "coowner" | "admin" | "elder" | "member";
export type OrganizationMemberRole = Exclude<OrganizationRole, "owner">;

export interface Organization {
  id: ID;
  owner_id: ID;
  name: string;
  description: string;
  created_at: string;
  member_count?: number;
  discoverability?: Discoverability;
  join_mode?: JoinMode;
  invite_policy?: InvitePolicy;
  archived_at?: string | null;
}

/** The owner remains organizations.owner_id; member rows never grant that role. */
export interface OrganizationMember {
  organization_id: ID;
  user_id: ID;
  role: OrganizationMemberRole;
  status: "invited" | "requested" | "active";
  invited_by: ID | null;
  created_at: string;
}

export interface OrganizationSquad {
  organization_id: ID;
  squad_id: ID;
  added_by: ID | null;
  created_at: string;
}

export interface OrganizationBan {
  organization_id: ID;
  user_id: ID;
  banned_by: ID | null;
  reason: string;
  former_role: OrganizationMemberRole;
  created_at: string;
}

export type GroupMessageScope = "squad" | "organization";
export interface GroupMessage {
  id: ID;
  scope: GroupMessageScope;
  scope_id: ID;
  organization_id: ID | null;
  squad_id: ID | null;
  author_id: ID;
  body: string;
  created_at: string;
}

export interface GroupMessageRead {
  scope: GroupMessageScope;
  scope_id: ID;
  organization_id: ID | null;
  squad_id: ID | null;
  user_id: ID;
  last_read_at: string;
}

export interface OrganizationData {
  organizations: Organization[];
  organization_members: OrganizationMember[];
  organization_squads: OrganizationSquad[];
  organization_spaces: OrganizationSpace[];
  organization_bans: OrganizationBan[];
  group_messages: GroupMessage[];
  group_message_reads: GroupMessageRead[];
}

export type OrganizationAction =
  | { type: "create_organization"; input: { name: string; description: string } }
  | { type: "update_organization"; input: { organization_id: ID; name: string; description: string } }
  | { type: "invite_organization_member"; input: { organization_id: ID; user_id: ID; role?: OrganizationMemberRole } }
  | { type: "respond_organization_invite"; input: { organization_id: ID; accept: boolean } }
  | { type: "set_organization_member_role"; input: { organization_id: ID; user_id: ID; role: OrganizationMemberRole } }
  | { type: "remove_organization_member"; input: { organization_id: ID; user_id: ID } }
  | { type: "ban_organization_member"; input: { organization_id: ID; user_id: ID; reason?: string } }
  | { type: "unban_organization_member"; input: { organization_id: ID; user_id: ID } }
  | { type: "leave_organization"; input: { organization_id: ID } }
  | { type: "attach_organization_squad"; input: { organization_id: ID; squad_id: ID } }
  | { type: "detach_organization_squad"; input: { organization_id: ID; squad_id: ID } }
  | { type: "attach_organization_space"; input: { organization_id: ID; space_id: ID } }
  | { type: "detach_organization_space"; input: { organization_id: ID; space_id: ID } }
  | { type: "transfer_organization_ownership"; input: { organization_id: ID; user_id: ID } }
  | { type: "archive_organization"; input: { organization_id: ID } }
  | { type: "send_group_message"; input: { scope: GroupMessageScope; organization_id?: ID; squad_id?: ID; body: string } }
  | { type: "mark_group_chat_read"; input: { scope: GroupMessageScope; organization_id?: ID; squad_id?: ID } };
