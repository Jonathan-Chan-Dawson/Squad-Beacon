import type { ComponentType } from "react";
import {
  BookOpen,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock3,
  Coffee,
  Dumbbell,
  Gamepad2,
  Palette,
  Sparkles,
} from "lucide-react-native";
import {
  getDesignColorTheme,
  type Availability,
  type AvailabilityColorToken,
  type AvailabilityIconName,
  type Category,
  type CategoryColorToken,
  type CategoryIconName,
  type DesignColorTheme,
} from "@/src/theme/data";

export * from "@/src/theme/data";

export type DesignIcon = ComponentType<{ color?: string; size?: number }>;
export type CategoryToken = Omit<CategoryColorToken, "iconName"> & {
  icon: DesignIcon;
};
export type AvailabilityToken = Omit<AvailabilityColorToken, "iconName"> & {
  icon: DesignIcon;
};
export type DesignTokens = Omit<
  DesignColorTheme["tokens"],
  "categories" | "availability"
> & {
  categories: Record<Category, CategoryToken>;
  availability: Record<Availability, AvailabilityToken>;
};
export type DesignTheme = Omit<
  DesignColorTheme,
  "tokens" | "categories" | "availability"
> & {
  tokens: DesignTokens;
  categories: Record<Category, CategoryToken>;
  availability: Record<Availability, AvailabilityToken>;
} & Omit<DesignTokens, "categories" | "availability">;

const categoryIcons: Record<CategoryIconName, DesignIcon> = {
  Dumbbell,
  BookOpen,
  Gamepad2,
  Palette,
  Coffee,
  Sparkles,
};
const availabilityIcons: Record<AvailabilityIconName, DesignIcon> = {
  CircleCheck,
  Clock3,
  CircleX,
  CircleHelp,
};

const themeCache = new Map<string, DesignTheme>();

export function getDesignTheme(
  name: DesignColorTheme["theme"],
  appearance: DesignColorTheme["appearance"],
): DesignTheme {
  const cacheKey = `${name}:${appearance}`;
  const cached = themeCache.get(cacheKey);
  if (cached) return cached;

  const colorTheme = getDesignColorTheme(name, appearance);
  const categories = Object.fromEntries(
    (Object.keys(colorTheme.categories) as Category[]).map((category) => {
      const { iconName, ...categoryToken } = colorTheme.categories[category];
      return [category, { ...categoryToken, icon: categoryIcons[iconName] }];
    }),
  ) as Record<Category, CategoryToken>;
  const availability = Object.fromEntries(
    (Object.keys(colorTheme.availability) as Availability[]).map((state) => {
      const { iconName, ...availabilityToken } = colorTheme.availability[state];
      return [
        state,
        { ...availabilityToken, icon: availabilityIcons[iconName] },
      ];
    }),
  ) as Record<Availability, AvailabilityToken>;
  const themeTokens = {
    ...colorTheme.tokens,
    categories,
    availability,
  } as DesignTokens;
  const design = {
    ...colorTheme,
    tokens: themeTokens,
    categories,
    availability,
  } as DesignTheme;
  themeCache.set(cacheKey, design);
  return design;
}
