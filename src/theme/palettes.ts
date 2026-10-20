// Theme IDs and legacy color keys remain stable for saved preferences and consumers.
// Colorful supporting text blends text/background at 72% (light), 78% (dark);
// outlines use 14%/20%, raised surfaces 3.5%/7%, and primary containers 10%/16%.
// Essential keeps its explicitly specified neutral hierarchy.

const lightThemes = {
  Essential: {
    bg: "#FAFAFB",
    ink: "#181A1F",
    muted: "#666973",
    line: "#E4E5E8",
    green: "#343A40",
    lime: "#F0F1F3",
    white: "#FFFFFF",
    red: "#A73545",
    surfaceRaised: "#F0F1F3",
    onPrimary: "#FFFFFF",
    heroBg: "#343A40",
    heroText: "#F5F5F7",
    heroAccent: "#D9DDE2",
  },
  Midnight: {
    bg: "#F3F6FC",
    ink: "#1B2942",
    muted: "#576276",
    line: "#D5D9E2",
    green: "#1D746E",
    lime: "#E8F1F1",
    white: "#FFFFFF",
    red: "#A73545",
    surfaceRaised: "#F7F8F8",
    onPrimary: "#FFFFFF",
    heroBg: "#101826",
    heroText: "#F0F6FF",
    heroAccent: "#86DEC9",
  },
  Ocean: {
    bg: "#EFF9FC",
    ink: "#153847",
    muted: "#526E7A",
    line: "#D0DEE3",
    green: "#236F8D",
    lime: "#E9F1F4",
    white: "#FFFFFF",
    red: "#A73545",
    surfaceRaised: "#F7F8F9",
    onPrimary: "#FFFFFF",
    heroBg: "#0C1F2B",
    heroText: "#ECF9FF",
    heroAccent: "#7BCDEA",
  },
  Mint: {
    bg: "#F3F8F0",
    ink: "#203C2B",
    muted: "#5B7162",
    line: "#D5DED4",
    green: "#32764B",
    lime: "#EBF0E9",
    white: "#FFFEFB",
    red: "#A73545",
    surfaceRaised: "#F7F7F4",
    onPrimary: "#FFFFFF",
    heroBg: "#142119",
    heroText: "#ECF7EF",
    heroAccent: "#B7E6A7",
  },
  Sunset: {
    bg: "#FFF6EF",
    ink: "#422D2D",
    muted: "#776563",
    line: "#E5DAD4",
    green: "#B95038",
    lime: "#F8EBE6",
    white: "#FFFCF9",
    red: "#A73545",
    surfaceRaised: "#F8F5F2",
    onPrimary: "#FFFFFF",
    heroBg: "#231919",
    heroText: "#FFF2EA",
    heroAccent: "#FFAF92",
  },
  Berry: {
    bg: "#FAF2FB",
    ink: "#3D2946",
    muted: "#726179",
    line: "#E0D6E2",
    green: "#7E449D",
    lime: "#F2E9F4",
    white: "#FFFBFE",
    red: "#A73545",
    surfaceRaised: "#F8F4F8",
    onPrimary: "#FFFFFF",
    heroBg: "#211827",
    heroText: "#F9EFFF",
    heroAccent: "#DCA9F3",
  },
} as const;

const darkThemes = {
  Essential: {
    bg: "#0D0E10",
    ink: "#F5F5F7",
    muted: "#A6A8B0",
    line: "#303137",
    green: "#D9DDE2",
    lime: "#25272C",
    white: "#191A1E",
    red: "#FF9B9C",
    surfaceRaised: "#25272C",
    onPrimary: "#17191D",
    heroBg: "#0B0C0E",
    heroText: "#F5F5F7",
    heroAccent: "#D9DDE2",
  },
  Midnight: {
    bg: "#101826",
    ink: "#F0F6FF",
    muted: "#BFC5CF",
    line: "#3D4451",
    green: "#86DEC9",
    lime: "#2C4757",
    white: "#1B2A41",
    red: "#FF9B9C",
    surfaceRaised: "#2A384E",
    onPrimary: "#17191D",
    heroBg: "#0E1521",
    heroText: "#F0F6FF",
    heroAccent: "#86DEC9",
  },
  Ocean: {
    bg: "#0C1F2B",
    ink: "#ECF9FF",
    muted: "#BBC9D0",
    line: "#394B55",
    green: "#7BCDEA",
    lime: "#274C5F",
    white: "#173345",
    red: "#FF9B9C",
    surfaceRaised: "#264152",
    onPrimary: "#17191D",
    heroBg: "#0B1B26",
    heroText: "#ECF9FF",
    heroAccent: "#7BCDEA",
  },
  Mint: {
    bg: "#142119",
    ink: "#ECF7EF",
    muted: "#BCC8C0",
    line: "#3F4C44",
    green: "#B7E6A7",
    lime: "#3A523E",
    white: "#22362A",
    red: "#FF9B9C",
    surfaceRaised: "#304438",
    onPrimary: "#17191D",
    heroBg: "#121D16",
    heroText: "#ECF7EF",
    heroAccent: "#B7E6A7",
  },
  Sunset: {
    bg: "#231919",
    ink: "#FFF2EA",
    muted: "#CFC2BC",
    line: "#4F4443",
    green: "#FFAF92",
    lime: "#553C36",
    white: "#352624",
    red: "#FF9B9C",
    surfaceRaised: "#433432",
    onPrimary: "#17191D",
    heroBg: "#1F1616",
    heroText: "#FFF2EA",
    heroAccent: "#FFAF92",
  },
  Berry: {
    bg: "#211827",
    ink: "#F9EFFF",
    muted: "#C9C0CF",
    line: "#4C4352",
    green: "#DCA9F3",
    lime: "#4D3958",
    white: "#32243A",
    red: "#FF9B9C",
    surfaceRaised: "#403248",
    onPrimary: "#17191D",
    heroBg: "#1D1522",
    heroText: "#F9EFFF",
    heroAccent: "#DCA9F3",
  },
} as const;

export type ThemeName = keyof typeof lightThemes;
export type AppearanceMode = "system" | "light" | "dark";
export type ResolvedAppearance = Exclude<AppearanceMode, "system">;
export type ThemePalette = {
  [Key in keyof typeof lightThemes.Mint]: string;
};

export const themeNames = Object.keys(lightThemes) as ThemeName[];
export const themeVariants: Record<
  ThemeName,
  Record<ResolvedAppearance, ThemePalette>
> = Object.fromEntries(
  themeNames.map((name) => [
    name,
    { light: lightThemes[name], dark: darkThemes[name] },
  ]),
) as Record<ThemeName, Record<ResolvedAppearance, ThemePalette>>;

// Keep the original theme export for consumers that expect one palette per name.
// Midnight was historically dark; the other legacy palettes were light.
export const themes: Record<ThemeName, ThemePalette> = {
  ...lightThemes,
  Essential: darkThemes.Essential,
  Midnight: darkThemes.Midnight,
};

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && themeNames.includes(value as ThemeName);
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "system" || value === "light" || value === "dark";
}

export function getInitialThemePreferences(
  savedTheme: unknown,
  savedAppearance: unknown,
): { theme: ThemeName; appearanceMode: AppearanceMode } {
  const hasSavedTheme = isThemeName(savedTheme);
  const theme = hasSavedTheme ? savedTheme : "Essential";
  if (isAppearanceMode(savedAppearance))
    return { theme, appearanceMode: savedAppearance };
  if (savedAppearance == null && hasSavedTheme) {
    return {
      theme,
      appearanceMode:
        theme === "Midnight" || theme === "Essential" ? "dark" : "light",
    };
  }
  return { theme, appearanceMode: "dark" };
}

export function resolveAppearanceMode(
  mode: AppearanceMode,
  deviceMode?: ResolvedAppearance | "unspecified" | null,
): ResolvedAppearance {
  return mode === "system" && (deviceMode === "light" || deviceMode === "dark")
    ? deviceMode
    : mode === "system"
      ? "dark"
      : mode;
}
