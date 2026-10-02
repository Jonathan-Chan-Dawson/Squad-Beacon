import type { ID } from "@/src/shared/types";

export interface Organization {
  id: ID;
  owner_id: ID;
  name: string;
  description: string;
  created_at: string;
}

/** The owner is represented by Organization.owner_id and has no writable row. */
export interface OrganizationMember {
  organization_id: ID;
  user_id: ID;
  role: "admin" | "member";
  status: "invited" | "active";
  invited_by: ID;
  created_at: string;
}

export interface OrganizationData {
  organizations: Organization[];
  organization_members: OrganizationMember[];
}

export type OrganizationAction =
  | { type: "create_organization"; input: { name: string; description: string } }
  | { type: "update_organization"; input: { organization_id: ID; name: string; description: string } }
  | { type: "invite_organization_member"; input: { organization_id: ID; user_id: ID; role?: "admin" | "member" } }
  | { type: "respond_organization_invite"; input: { organization_id: ID; accept: boolean } }
  | { type: "set_organization_member_role"; input: { organization_id: ID; user_id: ID; role: "admin" | "member" } }
  | { type: "remove_organization_member"; input: { organization_id: ID; user_id: ID } }
  | { type: "leave_organization"; input: { organization_id: ID } };
