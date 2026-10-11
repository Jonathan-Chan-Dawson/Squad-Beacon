import React from "react";
import { CategoryBadge } from "@/src/shared/design-system";
import { activityTones } from "@/src/theme";
import type { Category } from "@/src/shared/types";
export { activityTones };
export function ActivityBadge({
  category,
  size = 40,
  iconSize,
}: {
  category: Category;
  size?: number;
  iconSize?: number;
}) {
  return <CategoryBadge category={category} size={size} iconSize={iconSize} />;
}
