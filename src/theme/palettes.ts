const lightThemes = {
  Mint: {
    bg: "#F2F6EE",
    ink: "#173D32",
    muted: "#587568",
    line: "#DCE7D9",
    green: "#28775C",
    lime: "#DDF5A1",
    white: "#FFFFFF",
    red: "#B64048",
    heroBg: "#16362A",
    heroText: "#FFFFFF",
    heroAccent: "#DDF5A1",
  },
  Sunset: {
    bg: "#FFF4ED",
    ink: "#522C47",
    muted: "#846275",
    line: "#F0DCD9",
    green: "#AA4261",
    lime: "#FFD5AD",
    white: "#FFFCFA",
    red: "#AC3545",
    heroBg: "#522C47",
    heroText: "#FFFFFF",
    heroAccent: "#FFD5AD",
  },
  Midnight: {
    bg: "#F1F4FA",
    ink: "#202D4A",
    muted: "#50617D",
    line: "#D8DFED",
    green: "#315F85",
    lime: "#D9E5F4",
    white: "#FFFFFF",
    red: "#AA3546",
    heroBg: "#1B2846",
    heroText: "#F5F7FF",
    heroAccent: "#B9D5FF",
  },
  Ocean: {
    bg: "#F0F7FA",
    ink: "#153A4A",
    muted: "#4F6D7C",
    line: "#D6E6EC",
    green: "#236B79",
    lime: "#BFE7E6",
    white: "#FFFFFF",
    red: "#A7354C",
    heroBg: "#153A4A",
    heroText: "#F4FBFF",
    heroAccent: "#A8E2DB",
  },
  Berry: {
    bg: "#FAF1F8",
    ink: "#492646",
    muted: "#75566F",
    line: "#ECDDE8",
    green: "#7C3E67",
    lime: "#F2C7DC",
    white: "#FFFCFE",
    red: "#A73551",
    heroBg: "#3A1D39",
    heroText: "#FFF8FD",
    heroAccent: "#F6C8D7",
  },
} as const;

const darkThemes = {
  Mint: {
    bg: "#121B18",
    ink: "#E8F3ED",
    muted: "#B1C5BA",
    line: "#30433B",
    green: "#8BD7B1",
    lime: "#344D40",
    white: "#1D2A24",
    red: "#FF9C9B",
    heroBg: "#09140F",
    heroText: "#F3FAF6",
    heroAccent: "#A5E7C1",
  },
  Sunset: {
    bg: "#20151B",
    ink: "#F7EAF0",
    muted: "#D0B3C0",
    line: "#513B47",
    green: "#F094B0",
    lime: "#5A3C4B",
    white: "#2A2027",
    red: "#FFADB1",
    heroBg: "#120C12",
    heroText: "#FFF5F8",
    heroAccent: "#FFD6B4",
  },
  Midnight: {
    bg: "#151C30",
    ink: "#EFF3FF",
    muted: "#B0BDD6",
    line: "#34405C",
    green: "#8DE1CC",
    lime: "#344F59",
    white: "#222E46",
    red: "#FF9BA9",
    heroBg: "#0B1122",
    heroText: "#F3F6FF",
    heroAccent: "#8DE1CC",
  },
  Ocean: {
    bg: "#101D24",
    ink: "#E6F3F8",
    muted: "#AEC4CD",
    line: "#2D4752",
    green: "#76D5D5",
    lime: "#2C4C56",
    white: "#1B2C34",
    red: "#FF9AAB",
    heroBg: "#08151B",
    heroText: "#F4FBFF",
    heroAccent: "#A8E2DB",
  },
  Berry: {
    bg: "#20151F",
    ink: "#F7EAF3",
    muted: "#CFB4C8",
    line: "#4A3547",
    green: "#E09BC7",
    lime: "#50374B",
    white: "#2E2130",
    red: "#FFA1B3",
    heroBg: "#140D15",
    heroText: "#FFF8FD",
    heroAccent: "#F6C8D7",
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
  const theme = hasSavedTheme ? savedTheme : "Midnight";
  if (isAppearanceMode(savedAppearance))
    return { theme, appearanceMode: savedAppearance };
  if (savedAppearance == null && hasSavedTheme) {
    return {
      theme,
      appearanceMode: theme === "Midnight" ? "dark" : "light",
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
