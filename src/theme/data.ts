import type { Category } from "@/src/shared/types";
import {
  themeVariants,
  type ResolvedAppearance,
  type ThemeName,
} from "@/src/theme/palettes";

export type { Category, ResolvedAppearance, ThemeName };

export const space = {
  none: 0,
  xxs: 4,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  section: 48,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  card: 20,
  button: 14,
  sheet: 28,
  pill: 999,
  circle: 999,
} as const;

export const type = {
  large: { fontSize: 32, lineHeight: 38, fontWeight: "700" },
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700" },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
  titleSmall: { fontSize: 18, lineHeight: 24, fontWeight: "600" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22 },
  secondary: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  denseMaxMultiplier: 1.3,
  weight: { regular: "400", medium: "500", semibold: "600", bold: "700" },
} as const;

export const shadow = {
  card: { opacity: 0.08, radius: 12, offsetY: 5, elevation: 2 },
  raised: { opacity: 0.12, radius: 18, offsetY: 8, elevation: 4 },
} as const;

export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 1 },
  pressScale: 0.97,
  pressDuration: 90,
  pressDurationMs: 90,
  disabledOpacity: 0.55,
  pressedOpacity: 0.8,
  skeletonOpacityRest: 0.72,
  standardDuration: 220,
  entranceDuration: 180,
  listStagger: 30,
  listStaggerCount: 8,
  toastDuration: 3200,
  skeletonPulseDuration: 900,
  skeletonOpacityLow: 0.45,
  skeletonOpacityHigh: 0.85,
} as const;

export const layout = {
  screenGutter: 16,
  contentMaxWidth: 640,
  tabBarHeight: 49,
  createButtonSize: 58,
  createButtonRaise: 14,
  scrollClearance: 24,
  tabletBreakpoint: 768,
  primaryButtonHeight: 52,
  avatarDefaultSize: 36,
  categoryBadgeSize: 36,
  minTapTarget: 44,
  touchTarget: 44,
  denseRowMinHeight: 44,
  denseRowMultiplier: 1.3,
  avatarStackOverlap: 10,
  avatarStackLimit: 4,
} as const;

export const iconSize = { xs: 12, sm: 16, md: 20, lg: 24 } as const;

export const tokens = {
  space,
  radius,
  type,
  shadow,
  motion,
  layout,
  iconSize,
} as const;

export type SemanticColors = {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  onAccent: string;
  danger: string;
  scrim: string;
  transparent: string;
};

export type CategoryIconName =
  "Dumbbell" | "BookOpen" | "Gamepad2" | "Palette" | "Coffee" | "Sparkles";
export type Availability =
  "available" | "endingSoon" | "unavailable" | "unknown";
export type AvailabilityIconName =
  "CircleCheck" | "Clock3" | "CircleX" | "CircleHelp";

export type CategoryColorToken = {
  label: Category;
  color: string;
  tint: string;
  onColor: string;
  iconName: CategoryIconName;
};
export type AvailabilityColorToken = {
  label: string;
  color: string;
  tint: string;
  onColor: string;
  iconName: AvailabilityIconName;
};

export type SemanticDesignTokens = typeof tokens & {
  categories: Record<Category, CategoryColorToken>;
  availability: Record<Availability, AvailabilityColorToken>;
};

export type DesignColorTheme = {
  theme: ThemeName;
  appearance: ResolvedAppearance;
  resolvedAppearance: ResolvedAppearance;
  colors: SemanticColors;
  tokens: SemanticDesignTokens;
  categories: Record<Category, CategoryColorToken>;
  availability: Record<Availability, AvailabilityColorToken>;
} & typeof tokens;

const categoryIcons: Record<Category, CategoryIconName> = {
  Fitness: "Dumbbell",
  Study: "BookOpen",
  Gaming: "Gamepad2",
  Creative: "Palette",
  Social: "Coffee",
  Other: "Sparkles",
};

export const categoryColors: Record<
  ResolvedAppearance,
  Record<Category, string>
> = {
  light: {
    Fitness: "#9A3E0B",
    Study: "#174F99",
    Gaming: "#6438A5",
    Creative: "#A52D68",
    Social: "#086B60",
    Other: "#765000",
  },
  dark: {
    Fitness: "#FFC091",
    Study: "#9BC7FF",
    Gaming: "#CEB4FF",
    Creative: "#FFA9D0",
    Social: "#8DE6D7",
    Other: "#F2D16E",
  },
};

const availabilityColors: Record<
  ResolvedAppearance,
  Record<Availability, string>
> = {
  light: {
    available: "#176B4A",
    endingSoon: "#765000",
    unavailable: "#9D3F48",
    unknown: "#536273",
  },
  dark: {
    available: "#8EE0B3",
    endingSoon: "#F2D16E",
    unavailable: "#FF9B9C",
    unknown: "#B1C5BA",
  },
};

const availabilityMetadata: Record<
  Availability,
  { label: string; iconName: AvailabilityIconName }
> = {
  available: { label: "Available", iconName: "CircleCheck" },
  endingSoon: { label: "Ending soon", iconName: "Clock3" },
  unavailable: { label: "Unavailable", iconName: "CircleX" },
  unknown: { label: "Availability unknown", iconName: "CircleHelp" },
};

function blend(foreground: string, background: string, amount: number) {
  const foregroundChannels = foreground
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16));
  const backgroundChannels = background
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16));
  const channels = foregroundChannels.map((channel, index) =>
    Math.round(channel * amount + backgroundChannels[index] * (1 - amount)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(color: string) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function onColor(color: string) {
  return contrast(color, "#FFFFFF") >= contrast(color, "#14221D")
    ? "#FFFFFF"
    : "#14221D";
}

const colorThemeCache = new Map<string, DesignColorTheme>();

export function getDesignColorTheme(
  name: ThemeName,
  appearance: ResolvedAppearance,
): DesignColorTheme {
  const cacheKey = `${name}:${appearance}`;
  const cached = colorThemeCache.get(cacheKey);
  if (cached) return cached;

  const palette = themeVariants[name][appearance];
  const colors: SemanticColors = {
    bg: palette.bg,
    surface: palette.white,
    surfaceRaised: blend(
      palette.ink,
      palette.white,
      appearance === "dark" ? 0.07 : 0.035,
    ),
    border: palette.line,
    textPrimary: palette.ink,
    textSecondary: palette.muted,
    accent: palette.green,
    onAccent: onColor(palette.green),
    danger: palette.red,
    scrim: "rgba(0, 0, 0, 0.48)",
    transparent: "transparent",
  };
  const categories = Object.fromEntries(
    (Object.keys(categoryIcons) as Category[]).map((category) => {
      const color = categoryColors[appearance][category];
      return [
        category,
        {
          label: category,
          color,
          tint: blend(color, colors.surface, 0.16),
          onColor: onColor(color),
          iconName: categoryIcons[category],
        },
      ];
    }),
  ) as Record<Category, CategoryColorToken>;
  const availability = Object.fromEntries(
    (Object.keys(availabilityMetadata) as Availability[]).map((state) => {
      const color = availabilityColors[appearance][state];
      return [
        state,
        {
          ...availabilityMetadata[state],
          color,
          tint: blend(color, colors.surface, 0.16),
          onColor: onColor(color),
        },
      ];
    }),
  ) as Record<Availability, AvailabilityColorToken>;
  const themeTokens: SemanticDesignTokens = {
    ...tokens,
    categories,
    availability,
  };
  const design = {
    theme: name,
    appearance,
    resolvedAppearance: appearance,
    colors,
    tokens: themeTokens,
    ...themeTokens,
  };
  colorThemeCache.set(cacheKey, design);
  return design;
}

export const activityTones: Record<Category, string> = {
  ...categoryColors.light,
};
