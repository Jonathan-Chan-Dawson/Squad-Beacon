import type { BeaconDraft } from "./types";
import type { PlanningCreationSession } from "./creationSession";
import type { Audience } from "@/src/shared/types";

export type ComposerOption = {
  id: string;
  payload: BeaconDraft;
  editorToken?: string;
};
export type ComposerDraft = {
  recoveryToken?: string;
  timeSlots?: import("./types").PlanningSlot[];
  allowBackupHosting?: boolean;
  voteMethod?: "pick_one" | "approval";
  interestTarget?: string;
  title: string;
  body: string;
  audience: Audience;
  audienceId: string | null;
  startsAt: string;
  deadline: string;
  minutes: string;
  place: string;
  category: BeaconDraft["category"];
  coownerIds?: string[];
  options: ComposerOption[];
  touched: string[];
  publication: PlanningCreationSession;
};

// Navigation restoration only. These drafts do not survive a process restart.
const sessions = new Map<string, ComposerDraft>();
export function storeComposerSession(
  viewer: string,
  id: string,
  draft: ComposerDraft,
) {
  sessions.set(`${viewer}:${id}`, draft);
}
export function composerSession(
  viewer: string,
  id: string,
  create: () => ComposerDraft,
) {
  const key = `${viewer}:${id}`;
  if (!sessions.has(key)) sessions.set(key, create());
  return sessions.get(key)!;
}
export function completeComposerSession(viewer: string, id: string) {
  sessions.delete(`${viewer}:${id}`);
}
export function saveComposerOption(
  viewer: string,
  id: string,
  optionId: string,
  payload: BeaconDraft,
) {
  const draft = sessions.get(`${viewer}:${id}`);
  if (!draft || draft.publication.attempt)
    throw new Error(
      "This Council draft is no longer editable. Return to the Council.",
    );
  if (payload.audience !== draft.audience || payload.audience_id !== draft.audienceId)
    throw new Error("Use the same audience as this Council. Change its audience in the Council composer.");
  const option = draft.options.find((row) => row.id === optionId);
  if (!option) throw new Error("This option is no longer available.");
  option.payload = structuredClone(payload);
  option.editorToken = undefined;
}

export const pingStarters = [
  {
    id: "free",
    label: "Anyone Free?",
    title: "Anyone free to hang out?",
    hours: 3,
    closeHours: 1,
  },
  {
    id: "try",
    label: "Want to Try?",
    title: "Anyone interested in trying something new?",
    hours: 72,
    closeHours: 24,
  },
  {
    id: "nearby",
    label: "Anyone Nearby?",
    title: "Anyone around for coffee?",
    hours: 2,
    closeHours: 0.5,
  },
] as const;
export function applyPingStarter(
  draft: ComposerDraft,
  id: string,
  now: number,
) {
  const starter = pingStarters.find((row) => row.id === id);
  if (!starter) return;
  if (!draft.touched.includes("title")) draft.title = starter.title;
  if (!draft.touched.includes("startsAt"))
    draft.startsAt = new Date(now + starter.hours * 3600000).toISOString();
  if (!draft.touched.includes("deadline"))
    draft.deadline = new Date(now + starter.closeHours * 3600000).toISOString();
}
