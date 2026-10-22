import type { Payload } from "@/src/shared/types";
import type { BeaconDraft } from "./types";

export type PlanningCreationSession = {
  threadId?: string;
  attempt?: { requestId: string; payload: Payload };
  options?: { requestId: string; payload: BeaconDraft; id?: string }[];
};
export async function publishPlanningSession(
  session: PlanningCreationSession,
  payload: Payload,
  options: BeaconDraft[],
  act: (
    action: string,
    payload: Payload,
    requestId?: string,
  ) => Promise<Record<string, unknown>>,
  id: () => string = () => crypto.randomUUID(),
) {
  if (!session.attempt) {
    session.attempt = { requestId: id(), payload: structuredClone(payload) };
    session.options = options.map((option) => ({
      requestId: id(),
      payload: structuredClone(option),
    }));
  }
  if (!session.threadId) {
    const result = await act(
      "create_planning_thread",
      session.attempt.payload,
      session.attempt.requestId,
    );
    if (typeof result.id !== "string" || !result.id)
      throw new Error("Could not verify publication. Retry this saved setup.");
    session.threadId = result.id;
  }
  for (const option of session.options ?? []) {
    if (option.id) continue;
    const result = await act(
      "add_council_proposal",
      { thread_id: session.threadId, payload: option.payload },
      option.requestId,
    );
    if (typeof result.id !== "string" || !result.id)
      throw new Error(
        "Your Council exists, but an option could not be verified. Retry to finish adding options.",
      );
    option.id = result.id;
  }
  return session.threadId;
}

const drafts = new Map<string, Map<string, unknown>>();
export function planningDraftValue<T>(
  key: string,
  field: string,
  initial: () => T,
): T {
  return drafts.get(key)?.has(field)
    ? (drafts.get(key)!.get(field) as T)
    : initial();
}
export function storePlanningDraft(key: string, field: string, value: unknown) {
  let draft = drafts.get(key);
  if (!draft) {
    draft = new Map();
    drafts.set(key, draft);
  }
  draft.set(field, value);
}
export function clearPlanningDraft(key: string) {
  drafts.delete(key);
}
