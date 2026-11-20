import type { Data, Payload } from "./types";
import { isApprovedGoing } from "@/src/features/beacons/permissions";

export const actionNoticeCopy = {
  squad: ["Squad has been assembled.", "Squad created.", "The group chat has a headquarters.", "Crew unlocked.", "The squad era begins.", "And so the team-up begins."],
  friend: ["First friend unlocked.", "First friend added.", "Player two has entered the chat.", "Look at you, building a crew.", "One friend closer to a group chat."],
  beacon: ["Beacon lit. Let’s go!", "Beacon created.", "The plan has left the group chat.", "Someone finally picked a time.", "It’s on the map now.", "The plot has a location."],
  firstBeacon: ["Your first Beacon is ready.", "First Beacon created."],
  cancelled: ["Beacon called off.", "Beacon cancelled.", "This one’s off the calendar.", "Plot twist. We’ll regroup.", "Pause the group-chat hype."],
  removed: ["Beacon off the map.", "Beacon removed.", "One less pin on the map.", "Pin pulled.", "The map has been tidied."],
  completed: ["That’s a wrap!", "Beacon completed.", "Roll the credits.", "Mission accomplished.", "That one’s in the books.", "Cue the end credits."],
  plan: ["A plan has entered the chat.", "Plan created.", "A plan is taking shape.", "Look at us being organized.", "The group chat has a game plan."],
  joined: ["You’re on the roster.", "Beacon joined.", "You’re in. Cue the montage.", "Your spot is on the map.", "One more for the crew.", "The plot thickens. You’re going.", "Consider yourself assembled."],
  left: ["You’ve left the Beacon.", "Left Beacon.", "A quiet exit. Classy.", "Plot twist. You’re sitting this one out.", "Exit stage left.", "Your spot is back on the map.", "The calendar gets a breather."],
  voted: ["The Council has heard you.", "Vote saved.", "Ballot dropped. Very official.", "One vote closer to a plan.", "Democracy, but for hangouts.", "Your two cents are in.", "The plot is now subject to a vote."],
} as const;

export type ActionNoticeKind = keyof typeof actionNoticeCopy;

export function actionNoticeMessage(kind: ActionNoticeKind, quips: boolean, id: number) {
  const [first, plain, ...more] = actionNoticeCopy[kind];
  if (!quips || kind === "firstBeacon") return quips ? first : plain;
  const variants = [first, ...more];
  return variants[(id - 1) % variants.length] ?? first;
}

export function actionNoticeFor(
  before: Data,
  after: Data,
  viewer: string,
  action: string,
  payload: Payload,
): ActionNoticeKind | null {
  if (before.viewer_id !== viewer || after.viewer_id !== viewer) return null;
  if (action === "rsvp" || action === "join_public_beacon") {
    const id = action === "rsvp" ? payload.id : payload.activity_id;
    const beacon = after.activities.find((row) => row.id === id);
    if (!beacon || beacon.mode === "solo" || beacon.owner_id === viewer) return null;
    const going = (data: Data) => isApprovedGoing(beacon,
      data.rsvps.find((row) => row.activity_id === id && row.user_id === viewer));
    const wasGoing = going(before);
    const isGoing = going(after);
    return wasGoing === isGoing ? null : isGoing ? "joined" : "left";
  }
  if (action === "vote_council_proposal" || action === "save_council_approval_ballot") {
    const voted = (data: Data) => [
      ...data.planning_votes, ...(data.planning_approval_ballots ?? []),
    ].some((row) => row.thread_id === payload.thread_id && row.user_id === viewer);
    return !voted(before) && voted(after) ? "voted" : null;
  }
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
