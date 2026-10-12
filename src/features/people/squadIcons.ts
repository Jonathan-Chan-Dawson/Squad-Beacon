import type { SquadIconKey } from "@/src/shared/types";

export const squadIconChoices: readonly { key: SquadIconKey; label: string }[] =
  [
    { key: "users", label: "People" },
    { key: "fitness", label: "Fitness" },
    { key: "sports", label: "Sports" },
    { key: "gaming", label: "Gaming" },
    { key: "coffee", label: "Coffee" },
    { key: "study", label: "Study" },
    { key: "music", label: "Music" },
    { key: "sparkles", label: "Sparkles" },
  ];
export function isSquadIconKey(value: unknown): value is SquadIconKey {
  return squadIconChoices.some((choice) => choice.key === value);
}
export function squadIconKey(value: unknown): SquadIconKey {
  return isSquadIconKey(value) ? value : "users";
}
