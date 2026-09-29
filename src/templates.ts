import type { Activity, Category } from "./types";
export type BeaconTemplate = {
  title: string;
  label: string;
  category: Category;
  minutes: number;
  sourceId?: string;
};
export const templates: BeaconTemplate[] = [
  {
    label: "Coffee & catch-up",
    title: "Coffee and a little catch-up",
    category: "Social",
    minutes: 30,
  },
  {
    label: "Study sprint",
    title: "One focused hour, together",
    category: "Study",
    minutes: 60,
  },
  {
    label: "Fresh-air walk",
    title: "A walk and a good conversation",
    category: "Fitness",
    minutes: 30,
  },
  {
    label: "Grab a bite",
    title: "Hungry? Let's grab a bite",
    category: "Social",
    minutes: 60,
  },
  {
    label: "Game night",
    title: "One more round?",
    category: "Gaming",
    minutes: 120,
  },
  {
    label: "Make something",
    title: "Bring your unfinished project",
    category: "Creative",
    minutes: 60,
  },
];
export function repeatSuggestions(
  activities: Activity[],
  userId: string,
): BeaconTemplate[] {
  const groups = new Map<string, Activity[]>();
  for (const a of activities.filter(
    (a) => a.owner_id === userId && a.status === "completed",
  )) {
    const key = a.title.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        b.length - a.length ||
        b.at(-1)!.starts_at.localeCompare(a.at(-1)!.starts_at),
    )
    .slice(0, 3)
    .map((group) => {
      const a = group
        .slice()
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
      return {
        label:
          group.length > 1 ? `Your usual: ${a.title}` : `Again? ${a.title}`,
        title: a.title,
        category: a.category,
        minutes: Math.max(
          15,
          Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000),
        ),
        sourceId: a.id,
      };
    });
}
