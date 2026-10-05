import {
  canReadPlanningThread,
  normalizePlanningData,
} from "@/src/features/planning/domain";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import type { PlanningPingResponse, PlanningThread } from "@/src/features/planning/types";
import type { Data, ID } from "@/src/shared/types";

function blockedBetween(data: Data, first: ID, second: ID) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === first && block.blocked_id === second) ||
      (block.blocker_id === second && block.blocked_id === first),
  );
}

/** Live canonical Pings for the current member's exact Squad; no copied chat messages. */
export function selectSquadChatPings(
  data: Data,
  squadId: ID,
  viewerId: ID,
): PlanningThread[] {
  if (
    data.viewer_id !== viewerId ||
    !activeSquadMembership(data, squadId, viewerId)
  )
    return [];

  return normalizePlanningData(data)
    .planning_threads.filter(
      (thread) =>
        thread.kind === "ping" &&
        thread.audience === "squad" &&
        thread.audience_id === squadId &&
        thread.status !== "cancelled" &&
        canReadPlanningThread(data, thread, viewerId),
    )
    .sort(
      (first, second) =>
        first.created_at.localeCompare(second.created_at) ||
        first.id.localeCompare(second.id),
    );
}

/** Responses stay aggregate-only in chat and exclude blocked or removed people. */
export function visibleSquadPingResponses(
  data: Data,
  thread: PlanningThread,
  viewerId: ID,
): PlanningPingResponse[] {
  if (
    data.viewer_id !== viewerId ||
    thread.audience !== "squad" ||
    !thread.audience_id ||
    !activeSquadMembership(data, thread.audience_id, viewerId) ||
    !canReadPlanningThread(data, thread, viewerId)
  )
    return [];

  return normalizePlanningData(data).planning_ping_responses.filter(
    (response) =>
      response.thread_id === thread.id &&
      response.user_id !== thread.owner_id &&
      canReadPlanningThread(data, thread, response.user_id) &&
      !blockedBetween(data, viewerId, response.user_id),
  );
}
