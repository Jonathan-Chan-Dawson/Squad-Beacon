import type { Audience, Category, Data, ID } from "@/src/shared/types";

export type PlanningThreadKind = "ping" | "vote" | "draw" | "time";
export type PlanningThreadStatus =
  | "open"
  | "resolved"
  | "no_options"
  | "expired"
  | "cancelled";
export type PlanningResponse = "interested" | "maybe" | "pass";

export interface BeaconDraft {
  title: string;
  description: string;
  category: Category;
  mode: "squad" | "invite";
  starts_at: string;
  ends_at: string;
  timezone: string;
  approval_required: boolean;
  audience: Audience;
  audience_id: ID | null;
  target_count: number | null;
  label: string;
  online_url: string | null;
  latitude: number | null;
  longitude: number | null;
  aspiration_ids: ID[];
}

export interface PlanningThread {
  id: ID;
  owner_id: ID;
  coowner_ids: ID[];
  kind: PlanningThreadKind;
  title: string;
  body: string;
  audience: Audience;
  audience_id: ID | null;
  deadline_at: string;
  status: PlanningThreadStatus;
  payload: BeaconDraft | null;
  winner_proposal_id: ID | null;
  replaced_from_proposal_id: ID | null;
  materialized_activity_id: ID | null;
  created_at: string;
  resolved_at: string | null;
  reserved_draw_id?: ID | null;
  vote_method?: "pick_one" | "approval";
  result_summary?: {support:number;tie_count:number} | null;
  resolution_policy?: "legacy" | "explicit";
  interest_target?: number | null;
  allow_backup_hosting?: boolean;
  source_activity_note_id?: ID | null;
  source_thread_id?: ID | null;
  slots_revision?: number;
  selected_slot_id?: ID | null;
  finalized_by?: ID | null;
  finalized_at?: string | null;
  continuation_closed_at?: string | null;
  not_organized_at?: string | null;
}

export interface PlanningPingResponse {
  thread_id: ID;
  user_id: ID;
  response: PlanningResponse;
  auto_rsvp: boolean;
  available_after?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanningProposal {
  id: ID;
  thread_id: ID;
  author_id: ID;
  payload: BeaconDraft;
  approved: boolean;
  disqualified_at: string | null;
  created_at: string;
  activity_id: ID | null;
  approved_at?: string | null;
}

export interface PlanningVote {
  thread_id: ID;
  proposal_id: ID;
  user_id: ID;
  created_at: string;
  updated_at?: string;
}

export interface PlanningSlot { id: ID; thread_id: ID; starts_at: string; ends_at: string; timezone: string; retired_at: string | null }
export type AvailabilityChoice = "yes" | "maybe" | "no";
export interface PlanningAvailability { thread_id: ID; user_id: ID; slots_revision: number; answers: Record<ID, AvailabilityChoice>; none_work: boolean; updated_at: string }
export interface ApprovalBallot { thread_id: ID; user_id: ID; proposal_ids: ID[]; none_work: boolean; updated_at: string }
export interface OrganizerMessage { thread_id: ID; user_id: ID; message: string; updated_at: string }
export interface PlanningClaim { thread_id: ID; user_id: ID; token: ID; expires_at: string; revision: number }

export interface PlanningData {
  planning_availability?: PlanningAvailability[];
  planning_approval_ballots?: ApprovalBallot[];
  planning_threads: PlanningThread[];
  planning_ping_responses: PlanningPingResponse[];
  planning_proposals: PlanningProposal[];
  planning_votes: PlanningVote[];
}

export type PlanningAccessData = Pick<
  Data,
  | "blocks"
  | "friendships"
  | "lists"
  | "list_members"
  | "squad_members"
  | "squads"
  | "organizations"
  | "organization_members"
  | "organization_bans"
> & {viewer_id?: ID | null; planning_member_access?: {thread_id:ID;user_id:ID}[]};
