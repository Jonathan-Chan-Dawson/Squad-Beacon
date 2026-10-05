import type { ID } from "@/src/shared/types";
import type {
  Discoverability,
  InvitePolicy,
  JoinMode,
  SocialMemberRole,
  SocialRole,
} from "@/src/features/social/types";

export type SpaceRole = SocialRole;
export type SpaceMemberRole = Exclude<SpaceRole, "owner">;

export interface Space {
  id: ID;
  owner_id: ID;
  name: string;
  description: string;
  created_at: string;
  space_type?: "club" | "academic" | "sports" | "residence" | "interest" | "local_community" | "professional" | "other";
  discoverability?: Discoverability;
  join_mode?: JoinMode;
  invite_policy?: InvitePolicy;
  archived_at?: string | null;
}

/** The Space owner is represented by an active owner row in this table. */
export interface SpaceMember {
  space_id: ID;
  user_id: ID;
  role: SpaceRole;
  status: "invited" | "requested" | "active";
  invited_by: ID | null;
  created_at: string;
}

/** A link records organization only; it never grants access to its Squad. */
export interface SpaceSquad {
  space_id: ID;
  squad_id: ID;
  added_by: ID | null;
  created_at: string;
}

export interface SpaceBan {
  space_id: ID;
  user_id: ID;
  banned_by: ID | null;
  reason: string;
  former_role: SocialMemberRole;
  created_at: string;
}

export type SpaceAction =
  | { type: "create_space"; input: { name: string; description: string; space_type?: Space["space_type"]; discoverability?: Discoverability; join_mode?: JoinMode; invite_policy?: InvitePolicy } }
  | { type: "update_space"; input: { space_id: ID; name: string; description: string } }
  | { type: "invite_space_member"; input: { space_id: ID; user_id: ID; role?: SpaceMemberRole } }
  | { type: "respond_space_invite"; input: { space_id: ID; accept: boolean } }
  | { type: "set_space_member_role"; input: { space_id: ID; user_id: ID; role: SpaceMemberRole } }
  | { type: "remove_space_member"; input: { space_id: ID; user_id: ID } }
  | { type: "leave_space"; input: { space_id: ID } }
  | { type: "attach_space_squad"; input: { space_id: ID; squad_id: ID } }
  | { type: "detach_space_squad"; input: { space_id: ID; squad_id: ID } };
