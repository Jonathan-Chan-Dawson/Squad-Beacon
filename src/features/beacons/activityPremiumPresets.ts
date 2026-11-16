import type { AgendaSettings } from "./agenda";

/** Configuration-only recipes; no attendees, private content, or live state. */
export const activityPremiumPresets = [
  {
    title: "Study",
    segments: [
      [-30, "Prepare materials", 15],
      [0, "Focused study", 25],
      [25, "Break", 5],
      [30, "Review and reflect", 15],
    ],
  },
  {
    title: "Sports",
    segments: [
      [-30, "Equipment preparation", 15],
      [0, "Check-in and warm-up", 15],
      [15, "Practice or match", 45],
      [60, "Cool down", 10],
    ],
  },
  {
    title: "Party",
    segments: [
      [-60, "Set up and prepare", 45],
      [0, "Welcome guests", 15],
      [15, "Shared activities", 60],
      [75, "Wrap up and memories", 15],
    ],
  },
  {
    title: "Outdoor",
    segments: [
      [-60, "Equipment and route review", 20],
      [0, "Meet and prepare", 15],
      [15, "First route segment", 45],
      [60, "Rest and route check", 15],
      [75, "Return segment", 45],
    ],
  },
  {
    title: "Errands",
    segments: [
      [-30, "Prepare lists", 15],
      [0, "First stop", 30],
      [30, "Travel and regroup", 15],
      [45, "Second stop", 30],
      [75, "Check remaining items", 10],
    ],
  },
] as const;
export function activityAgendaPreset(title: string): AgendaSettings {
  const preset = activityPremiumPresets.find((p) => p.title === title);
  if (!preset) throw new Error("Choose an activity preset.");
  return {
    enabled: true,
    steps: preset.segments.map(([offset, label, minutes], index) => ({
      id: `${title.toLowerCase()}-${index}`,
      label,
      offset,
      minutes,
      reminder: null,
      organizer: null,
      tasks: [],
      state: "planned",
    })),
  };
}
