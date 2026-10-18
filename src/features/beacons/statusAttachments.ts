import type { Activity, Data } from "@/src/shared/types";
import { canReadActivityPreview } from "./beaconModules";
import { beaconRoleFor } from "./permissions";
import { canManagePlanningThread, canReadPlanningThread } from "@/src/features/planning/domain";

export type StatusAttachmentType = "beacon" | "ping" | "vote" | "draw";
export type StatusPresentation = "text_only" | "activity_only" | "text_activity";
export type StatusAttachment = { type: StatusAttachmentType; id: string };
export type ResolvedStatusAttachment = StatusAttachment & { title: string; time: string; state: string; category?: Activity["category"]; emoji?: string | null };

export function resolveStatusAttachment(data: Data, attachment: StatusAttachment | null | undefined, viewer: string | null, now: number): ResolvedStatusAttachment | null {
  if (!attachment || !viewer || data.viewer_id !== viewer) return null;
  if (attachment.type === "beacon") {
    const activity = data.activities.find(row => row.id === attachment.id && row.mode !== "solo");
    if (!activity || !canReadActivityPreview(data, activity, viewer) || activity.status !== "scheduled" || Date.parse(activity.ends_at) <= now || (activity.plan_id && activity.plan_step && !activity.plan_started_at)) return null;
    return { ...attachment, title: activity.title, time: activity.starts_at, state: Date.parse(activity.starts_at) <= now ? "Live" : "Upcoming", category: activity.category, emoji: activity.decoration_emoji };
  }
  const thread = data.planning_threads.find(row => row.id === attachment.id && row.kind === attachment.type);
  if (!thread || !canReadPlanningThread(data, thread, viewer) || thread.status !== "open" || (thread.kind !== "draw" && Date.parse(thread.deadline_at) <= now)) return null;
  return { ...attachment, title: thread.title, time: thread.deadline_at, state: Date.parse(thread.deadline_at) <= now ? "Awaiting draw" : "Open", category: thread.payload?.category };
}

export function eligibleStatusAttachments(data: Data, viewer: string | null, now: number): ResolvedStatusAttachment[] {
  if (!viewer || data.viewer_id !== viewer) return [];
  const candidates: StatusAttachment[] = [
    ...data.activities.filter(row => row.mode !== "solo" && ["owner", "coowner"].includes(beaconRoleFor(data, row, viewer))).map(row => ({ type: "beacon" as const, id: row.id })),
    ...data.planning_threads.filter(row => canManagePlanningThread(row, viewer)).map(row => ({ type: row.kind, id: row.id })),
  ];
  return candidates.flatMap(row => { const resolved = resolveStatusAttachment(data, row, viewer, now); return resolved ? [resolved] : []; })
    .sort((a, b) => Number(b.state === "Live") - Number(a.state === "Live") || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}

export function visibleStatusAttachment(data: Data, status: Activity | undefined, viewer: string | null, now: number) {
  if (!status || !viewer || status.mode !== "solo" || status.status !== "scheduled" || Date.parse(status.starts_at) > now || Date.parse(status.ends_at) <= now || status.status_sharing === false || status.status_note_hidden || status.status_presentation === "text_only" || !canReadActivityPreview(data, status, viewer)) return null;
  return resolveStatusAttachment(data, status.status_attachment, viewer, now);
}

export function statusNoteText(status: Activity | undefined) {
  return !status || status.status_sharing === false || status.status_note_hidden || status.status_presentation === "activity_only" ? "" : status.title;
}
