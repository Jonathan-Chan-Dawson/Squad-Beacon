import type { Activity } from "@/src/shared/types";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";

export const beaconFeatureLabels = {
  overview: "Overview",
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
