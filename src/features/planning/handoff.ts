import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import type { Data } from "@/src/shared/types";
import type { BeaconDraft, PlanningThread } from "./types";
import { canReadPlanningThread, makeBeaconDraft } from "./domain";
import {
  hasPlanningDraftField,
  setCreationDraftField,
  startCreationDraft,
} from "@/src/features/beacons/socialPlanningSession";

export function openPlanningReview(
  data: Data,
  viewer: string,
  thread: PlanningThread,
  context: { claimToken?: string; proposalId?: string; slotId?: string; returnPlanId?: string } = {},
) {
  if (!canReadPlanningThread(data, thread, viewer))
    throw new Error("This decision is no longer available.");
  if (thread.materialized_activity_id) {
    router.push({
      pathname: "/activity/[id]",
      params: { id: thread.materialized_activity_id },
    });
    return;
  }
  const recovery = data.planning_recovery?.find(
    (r) => r.thread_id === thread.id && r.owner_id === viewer,
  )?.context;
  let payload: BeaconDraft = {
    ...makeBeaconDraft(),
    ...thread.payload,
    ...recovery,
    title: thread.payload?.title ?? thread.title,
    audience: thread.audience,
    audience_id: thread.audience_id,
  };
  const proposal = data.planning_proposals.find(
    (p) =>
      p.thread_id === thread.id &&
      p.id ===
        (context.proposalId ??
          thread.reserved_draw_id ??
          thread.winner_proposal_id),
  );
  if (proposal) payload = { ...proposal.payload };
  const slot = data.planning_slots?.find(
    (s) =>
      s.thread_id === thread.id &&
      s.id === (context.slotId ?? thread.selected_slot_id) &&
      !s.retired_at,
  );
  if (thread.kind === "time" && !slot)
    throw new Error("Choose a valid time first.");
  if (slot)
    payload = {
      ...payload,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      timezone: slot.timezone,
    };
  if (
    context.claimToken &&
    !["squad", "organization"].includes(thread.audience)
  )
    payload = { ...payload, audience: "private", audience_id: null };
  const existingToken = data.planning_recovery?.find(
    (r) => r.thread_id === thread.id && r.owner_id === viewer,
  )?.context.local_draft_token;
  const reuse =
    !!existingToken && hasPlanningDraftField(viewer, existingToken, "title");
  const token = reuse ? existingToken! : startCreationDraft(viewer);
  for (const [key, value] of Object.entries({
    title: payload.title,
    description: payload.description,
    category: payload.category,
    starts: payload.starts_at,
    ends: payload.ends_at,
    when: "Pick time",
    duration: `${(Date.parse(payload.ends_at) - Date.parse(payload.starts_at)) / 60000} min`,
    audience: payload.audience,
    audienceId: payload.audience_id,
    label: payload.label,
    url: payload.online_url ?? "",
    placeType: payload.online_url ? "Online" : "In person",
    pin:
      payload.latitude == null
        ? null
        : { latitude: payload.latitude, longitude: payload.longitude },
    approval: payload.approval_required ? "Host approval" : "Open joining",
  }))
    if (!reuse || ["starts", "ends", "when", "duration"].includes(key))
      setCreationDraftField(viewer, token, key, value);
  router.push({
    pathname: "/create",
    params: {
      editor: "yes",
      planSession: token,
      sourcePlanningId: thread.id,
      planningClaimToken: context.claimToken ?? "",
      planningProposalId: context.proposalId ?? proposal?.id ?? "",
      planningSlotId: context.slotId ?? slot?.id ?? "",
      timezone: payload.timezone,
      ...(context.returnPlanId ? { returnPlanId: context.returnPlanId } : {}),
    },
  });
}
export function findTimeRoute(threadId?: string) {
  return {
    pathname: "/planning/create" as const,
    params: {
      kind: "time",
      sessionId: randomUUID(),
      ...(threadId ? { sourceThreadId: threadId } : {}),
    },
  };
}
