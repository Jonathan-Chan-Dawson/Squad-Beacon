import type { Data } from "@/src/shared/types";
import { visibleSquadPingResponses } from "@/src/features/organizations/squadChat";
import { canReadPlanningThread, canRespondToPlanningThread, visiblePlanningProposals } from "./domain";

/** Only invoked from explicit submission handlers. Server authorization remains authoritative. */
export function requirePlanningSubmission(data: Data, viewer: string | null, id: string) {
  const state = planningInteraction(data, viewer, id, Date.now());
  if (!state?.eligible) throw new Error("Your access or the deadline changed. Refresh and try again.");
  return state;
}

/** All callers use the canonical snapshot, eligibility rules, and mutation actions. */
export function planningInteraction(data: Data, viewer: string | null, id: string, now: number) {
  if (!viewer || data.viewer_id !== viewer) return null;
  const thread = data.planning_threads.find(row => row.id === id);
  if (!thread || !canReadPlanningThread(data, thread, viewer)) return null;
  const blocked = (person: string) => data.blocks.some(row => row.blocker_id === viewer && row.blocked_id === person || row.blocked_id === viewer && row.blocker_id === person);
  const options = visiblePlanningProposals(data, data.planning_proposals, id, viewer).filter(row => row.approved && !row.disqualified_at && Date.parse(row.payload.starts_at) > now && canReadPlanningThread(data, thread, row.author_id));
  const responses = thread.audience === "squad" ? visibleSquadPingResponses(data, thread, viewer) : data.planning_ping_responses.filter(row => row.thread_id === id && row.user_id !== thread.owner_id && !blocked(row.user_id) && canReadPlanningThread(data, thread, row.user_id));
  const votes = data.planning_votes.filter(row => row.thread_id === id && !blocked(row.user_id) && options.some(option => option.id === row.proposal_id) && canReadPlanningThread(data, thread, row.user_id));
  return { thread, options, responses, votes, eligible: canRespondToPlanningThread(data, thread, viewer, now) };
}

