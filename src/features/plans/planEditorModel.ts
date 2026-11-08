import type { Data, Payload, Plan, PlanTemplate } from "@/src/shared/types";
import {
  planPermissions,
  planStops,
  stopActivity,
  stopThread,
} from "./livingPlans";

export type EditorStop = {
  id: string;
  kind: "idea" | "beacon" | "existing" | "decision";
  title: string;
  details: string;
  activity_id?: string | null;
  thread_id?: string | null;
  beacon?: Payload;
  include?: boolean;
  creation_token?: string;
};
export type PlanEditorDraft = {
  version: 1;
  token: string;
  plan_id?: string;
  revision: number;
  title: string;
  description: string;
  timezone: string;
  start_date: string;
  squad_id: string | null;
  stops: EditorStop[];
  removed_stop_ids: string[];
  handoff?: "decision";
  request?: { id: string; payload: Payload };
};
export function editorStopsFromTemplate(
  template: PlanTemplate,
  squadId: string | null,
  newId: () => string,
): EditorStop[] {
  const stops: NonNullable<PlanTemplate["stops"]> =
    template.stops ??
    template.steps.map((s) => ({ title: s.title, details: s.description }));
  return stops.map((s) => ({
    id: newId(),
    kind: s.beacon ? "beacon" : "idea",
    title: s.title,
    details: s.details ?? "",
    ...(s.beacon
      ? {
          beacon: {
            ...s.beacon,
            invitee_ids: [],
            public_listing: undefined,
            audience: squadId ? "squad" : "private",
            audience_id: squadId,
          },
          include: false,
        }
      : {}),
  }));
}
export function planEditorFromData(
  data: Data,
  plan: Plan,
  viewer: string,
  token: string,
): PlanEditorDraft {
  return {
    version: 1,
    token,
    plan_id: plan.id,
    revision: plan.revision ?? 0,
    title: plan.title,
    description: plan.description ?? "",
    timezone: plan.timezone,
    start_date: plan.start_date ?? "",
    squad_id: plan.squad_id ?? null,
    removed_stop_ids: [],
    stops: planStops(data, plan, viewer).map((s) => {
      const a = stopActivity(data, s, viewer),
        draft = data.plan_beacon_drafts?.find((d) => d.stop_id === s.id);
      return {
        id: s.id,
        kind: draft
          ? "beacon"
          : s.activity_id
            ? "existing"
            : s.thread_id
              ? "decision"
              : "idea",
        title: a?.title ?? stopThread(data, s, viewer)?.title ?? s.title,
        details: s.details,
        activity_id: s.activity_id,
        thread_id: s.thread_id,
        ...(draft
          ? { beacon: draft.payload, include: draft.include ?? true }
          : {}),
      };
    }),
  };
}
export function validatePlanEditor(draft: PlanEditorDraft) {
  if (!draft.title.trim() || draft.title.trim().length > 100)
    throw new Error("Give your Plan a name up to 100 characters.");
  if (
    draft.description.length > 1000 ||
    draft.stops.length > 30 ||
    new Set(draft.stops.map((s) => s.id)).size !== draft.stops.length
  )
    throw new Error("Use up to 30 distinct activities and shorter details.");
  for (const s of draft.stops)
    if (!s.title.trim() || s.title.length > 120 || s.details.length > 2000)
      throw new Error("Give each activity a title and shorter details.");
  new Intl.DateTimeFormat("en", { timeZone: draft.timezone });
}
export function assertPlanEditorAccess(
  data: Data,
  planId: string,
  viewer: string,
) {
  const plan = data.plans.find((p) => p.id === planId);
  if (
    !plan ||
    !planPermissions(data, plan, viewer).editor ||
    plan.status === "cancelled"
  )
    throw new Error("Only current Plan organizers can edit this Plan.");
  return plan;
}
