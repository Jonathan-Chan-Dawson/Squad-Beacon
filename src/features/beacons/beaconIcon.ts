import type { Category } from "@/src/shared/types";
import { DECORATION_EMOJIS } from "./controls";

const categories: readonly string[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];
export function resolveBeaconIcon(
  emoji?: string | null,
  category?: string | null,
):
  | { kind: "emoji"; emoji: string }
  | { kind: "category"; category: Category }
  | { kind: "default" } {
  if (emoji && (DECORATION_EMOJIS as readonly string[]).includes(emoji))
    return { kind: "emoji", emoji };
  if (category && categories.includes(category))
    return { kind: "category", category: category as Category };
  return { kind: "default" };
}
