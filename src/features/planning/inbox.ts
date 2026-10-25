import type { Data } from "@/src/shared/types";
import {
  canManagePlanningThread,
  pendingPlanningThreads,
  normalizePlanningData,
} from "./domain";
import { planningInteraction } from "./planningInteraction";

export const inboxSections = [
  "Organizer Actions",
  "Needs Response",
  "Answered & Active",
  "History",
] as const;
export type InboxSection = (typeof inboxSections)[number];

/** Presentation only. Saved records and canonical visibility remain authoritative. */
export function planningInbox(data: Data, viewer: string | null, now: number) {
  if (!viewer || data.viewer_id !== viewer) return [];
  const pending = new Set(
    pendingPlanningThreads(data, normalizePlanningData(data), viewer, now).map(
      (row) => row.id,
    ),
  );
  return data.planning_threads
    .flatMap((thread) => {
      const state = planningInteraction(data, viewer, thread.id, now);
      if (!state) return [];
      const manages = canManagePlanningThread(thread, viewer);
      const response = state.responses.find((row) => row.user_id === viewer);
      const vote = state.votes.find((row) => row.user_id === viewer);
      const actionable = pending.has(thread.id);
      const section: InboxSection =
        thread.materialized_activity_id || thread.continuation_closed_at || thread.not_organized_at
          ? "History"
          : thread.kind === "time" && thread.selected_slot_id
            ? manages ? "Organizer Actions" : "Answered & Active"
          : thread.status !== "open"
          ? "History"
          : manages && actionable
            ? "Organizer Actions"
            : actionable
              ? "Needs Response"
              : "Answered & Active";
      return [{ ...state, manages, response, vote, actionable, section }];
    })
    .sort((a, b) =>
      a.section === "History" && b.section === "History"
        ? (b.thread.resolved_at ?? b.thread.created_at).localeCompare(
            a.thread.resolved_at ?? a.thread.created_at,
          )
        : a.thread.deadline_at.localeCompare(b.thread.deadline_at) ||
          a.thread.id.localeCompare(b.thread.id),
    );
}

/** Explicit management and unsupported contextual operations keep the dedicated route. */
export function planningDestination(
  id: string,
  intent: "participate" | "manage" = "participate",
) {
  return intent === "manage"
    ? { pathname: "/council/[id]" as const, params: { id, mode: "manage" } }
    : { pathname: "/responses" as const, params: { threadId: id } };
}
