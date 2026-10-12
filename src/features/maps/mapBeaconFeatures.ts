import type { Activity, Data } from "@/src/shared/types";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  canReadPlanningThread,
  visiblePlanningProposals,
} from "@/src/features/planning/domain";

/** Suggested and resolved Beacons share the existing decision and access rules. */
export function beaconLinkedDecision(
  data: Data,
  beaconId: string,
  viewerId: string | null,
) {
  const activity = data.activities.find((row) => row.id === beaconId);
  if (
    !viewerId ||
    data.viewer_id !== viewerId ||
    !activity ||
    !canReadBeaconActivity(data, activity, viewerId)
  )
    return undefined;
  const linked = data.planning_threads.filter(
    (thread) =>
      (thread.kind === "vote" || thread.kind === "draw") &&
      canReadPlanningThread(data, thread, viewerId) &&
      (thread.materialized_activity_id === beaconId ||
        visiblePlanningProposals(
          data,
          data.planning_proposals,
          thread.id,
          viewerId,
        ).some((proposal) => proposal.activity_id === beaconId)),
  );
  return linked.find((thread) => thread.status === "open") ?? linked[0];
}

export const beaconFeatureLabels = {
  overview: "Overview",
  activity: "Tools",
  people: "People",
  reactions: "Reactions",
  comments: "Comments",
  chat: "Chat",
  checklist: "Checklist",
  journal: "Beacon Sketchboard",
  experiences: "Reels & memories",
  focus: "Focus timer",
  scoreboard: "Teams & scores",
  music: "Music",
  settings: "Host controls",
  decision: "Decision",
} as const;
export type MapBeaconFeature = keyof typeof beaconFeatureLabels;

export function enabledMapBeaconFeatures(
  activity: Activity,
): MapBeaconFeature[] {
  return [
    "overview",
    "people",
    ...(
      [
        "reactions",
        "comments",
        "chat",
        "checklist",
        "journal",
        "experiences",
        "focus",
        "scoreboard",
        "music",
      ] as const
    ).filter(
      (module) =>
        isBeaconModuleEnabled(activity, module) &&
        (module !== "music" || !!activity.music_url),
    ),
  ];
}

export type BeaconSheetTab = "overview" | "activity" | "chat" | "people";
export type BeaconActivityModule =
  "checklist" | "journal" | "focus" | "scoreboard" | "experiences" | "music";

/** Priority follows the event lifecycle and purpose, never the tab/component order. */
export function beaconActivityModules(
  activity: Activity,
  now: number,
): BeaconActivityModule[] {
  const past =
    activity.status !== "scheduled" || Date.parse(activity.ends_at) <= now;
  const live = !past && Date.parse(activity.starts_at) <= now;
  const order: BeaconActivityModule[] = past
    ? ["experiences", "scoreboard", "journal", "checklist", "focus", "music"]
    : live && isBeaconModuleEnabled(activity, "scoreboard")
      ? ["scoreboard", "checklist", "focus", "music", "journal", "experiences"]
      : activity.category === "Study"
        ? [
            "focus",
            "checklist",
            "journal",
            "music",
            "scoreboard",
            "experiences",
          ]
        : activity.category === "Creative" && live
          ? [
              "experiences",
              "journal",
              "checklist",
              "music",
              "focus",
              "scoreboard",
            ]
          : [
              "checklist",
              "scoreboard",
              "focus",
              "music",
              "journal",
              "experiences",
            ];
  return order.filter(
    (module) => module !== "music" && isBeaconModuleEnabled(activity, module),
  );
}

export function beaconSheetTabs(
  activity: Activity,
  hasDecision = false,
): BeaconSheetTab[] {
  return [
    "overview",
    ...(beaconActivityModules(activity, 0).length || hasDecision
      ? ["activity" as const]
      : []),
    ...(isBeaconModuleEnabled(activity, "chat") ? ["chat" as const] : []),
    "people",
  ];
}

export function sheetTabForFeature(feature: MapBeaconFeature): BeaconSheetTab {
  if (feature === "chat" || feature === "people" || feature === "overview")
    return feature;
  return feature === "settings" ||
    feature === "music" ||
    feature === "comments" ||
    feature === "reactions"
    ? "overview"
    : "activity";
}
