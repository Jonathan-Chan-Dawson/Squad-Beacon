import type { Audience, Category, Data, ID } from "@/src/shared/types";

export type PlanningThreadKind = "ping" | "vote" | "draw";
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
}

export interface PlanningPingResponse {
  thread_id: ID;
  user_id: ID;
  response: PlanningResponse;
  auto_rsvp: boolean;
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
}

export interface PlanningVote {
  thread_id: ID;
  proposal_id: ID;
  user_id: ID;
  created_at: string;
}

export interface PlanningData {
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
>;
