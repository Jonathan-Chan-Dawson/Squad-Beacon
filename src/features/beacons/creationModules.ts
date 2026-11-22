import type { BeaconControlValues } from "./controls";
export type CreationModuleField = {
  [K in keyof BeaconControlValues]: BeaconControlValues[K] extends boolean
    ? K
    : never;
}[keyof BeaconControlValues];
export const creationModules: {
  field: CreationModuleField;
  name: string;
  family: "Social" | "Collaboration" | "Media";
  description: string;
  icon: string;
}[] = [
  {
    field: "enable_chat",
    name: "Chat",
    family: "Social",
    description: "One conversation for participants.",
    icon: "◌",
  },
  {
    field: "enable_experiences",
    name: "Beacon Memories",
    family: "Social",
    description: "Keep photos and short videos together.",
    icon: "▧",
  },
  {
    field: "enable_comments",
    name: "Comments",
    family: "Social",
    description: "Questions and replies in the Overview.",
    icon: "☷",
  },
  {
    field: "enable_reactions",
    name: "Reactions",
    family: "Social",
    description: "React using the existing emoji picker.",
    icon: "♡",
  },
  {
    field: "enable_checklist",
    name: "Checklist",
    family: "Collaboration",
    description: "Shared sections, tasks, and things to bring.",
    icon: "☑",
  },
  {
    field: "enable_journal",
    name: "Beacon Sketchboard",
    family: "Collaboration",
    description: "Private notes or intentionally shared ideas.",
    icon: "✎",
  },
  {
    field: "enable_focus",
    name: "Timer",
    family: "Collaboration",
    description: "A countdown or Pomodoro session.",
    icon: "◷",
  },
  {
    field: "enable_scoreboard",
    name: "Teams / Scoreboard",
    family: "Collaboration",
    description: "Split into teams and keep score.",
    icon: "⚑",
  },
  {
    field: "enable_music",
    name: "Music link",
    family: "Media",
    description: "Share a supported music link.",
    icon: "♫",
  },
];
export function recommendedCreationModules(
  category: string,
): CreationModuleField[] {
  return category === "Study"
    ? ["enable_focus", "enable_checklist"]
    : category === "Fitness"
      ? ["enable_scoreboard"]
      : ["enable_chat", "enable_experiences"];
}
