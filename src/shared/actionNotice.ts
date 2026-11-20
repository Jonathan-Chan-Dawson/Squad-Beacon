import type { Data, Payload } from "./types";

export const actionNoticeCopy = {
  squad: ["Squad has been assembled.", "Squad created."],
  friend: ["First friend unlocked.", "First friend added."],
  beacon: ["Beacon lit. Let’s go!", "Beacon created."],
  firstBeacon: ["Your first Beacon is ready.", "First Beacon created."],
  cancelled: ["Beacon called off.", "Beacon cancelled."],
  removed: ["Beacon off the map.", "Beacon removed."],
  completed: ["That’s a wrap!", "Beacon completed."],
  plan: ["A plan has entered the chat.", "Plan created."],
} as const;

export type ActionNoticeKind = keyof typeof actionNoticeCopy;

export function actionNoticeFor(
  before: Data,
  after: Data,
  viewer: string,
  action: string,
  payload: Payload,
): ActionNoticeKind | null {
  if (before.viewer_id !== viewer || after.viewer_id !== viewer) return null;
  if (action === "create_squad" || action === "create_squad_from_beacon") {
    return after.squads.some((row) => row.owner_id === viewer &&
      !before.squads.some((old) => old.id === row.id)) ? "squad" : null;
  }
  if (action === "create_plan") {
    return after.plans.some((row) => row.owner_id === viewer &&
      !before.plans.some((old) => old.id === row.id)) ? "plan" : null;
  }
  if (["create_activity", "create_activity_with_invitees", "create_plan_beacon",
    "create_plan_beacon_with_invitees", "publish_planning_beacon"].includes(action)) {
    return after.activities.some((row) => row.owner_id === viewer && row.mode !== "solo" &&
      !before.activities.some((old) => old.id === row.id)) ? "beacon" : null;
  }
  if (action !== "activity_status" && action !== "end_plan_beacon" &&
      action !== "moderate_remove_activity") return null;
  const previous = before.activities.find((row) => row.id === payload.id);
  if (!previous || previous.mode === "solo") return null;
  const current = after.activities.find((row) => row.id === previous.id);
  if (action === "moderate_remove_activity")
    return !current || (previous.status !== "cancelled" && current.status === "cancelled") ? "removed" : null;
  if (current?.status === previous.status) return null;
  if (current?.status === "completed") return "completed";
  if (current?.status === "cancelled") return "cancelled";
  return null;
}
