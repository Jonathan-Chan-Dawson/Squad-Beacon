// Stable theme IDs and legacy color aliases preserve saved preferences.
// Each family defines page, card, raised and selected surfaces in both appearances.

const lightThemes = {
  Essential: {
    bg: "#F6F5F1",
    ink: "#252720",
    muted: "#68685F",
    line: "#DDDCD3",
    green: "#795D17",
    lime: "#EEE6CD",
    white: "#FFFDF8",
    red: "#A73545",
    surfaceRaised: "#EEECE5",
    onPrimary: "#FFFFFF",
    heroBg: "#262820",
    heroText: "#F5F3E9",
    heroAccent: "#D8C273",
  },
  Midnight: {
    bg: "#F1F4F9",
    ink: "#1D2B40",
    muted: "#536174",
    line: "#D4DCE6",
    green: "#196B65",
    lime: "#DDEDEB",
    white: "#FAFBFE",
    red: "#A73545",
    surfaceRaised: "#E7EDF4",
    onPrimary: "#FFFFFF",
    heroBg: "#131B28",
    heroText: "#EDF2FA",
    heroAccent: "#8ACDBC",
  },
  Ocean: {
    bg: "#EEF6FA",
    ink: "#193746",
    muted: "#506673",
    line: "#CBDDE5",
    green: "#1A6886",
    lime: "#DCECF4",
    white: "#FAFDFE",
    red: "#A73545",
    surfaceRaised: "#E3EEF4",
    onPrimary: "#FFFFFF",
    heroBg: "#11232E",
    heroText: "#EDF7FC",
    heroAccent: "#86CCE5",
  },
  Mint: {
    bg: "#F2F6F0",
    ink: "#243B2C",
    muted: "#586B5C",
    line: "#D2DDCF",
    green: "#306B43",
    lime: "#DEECD8",
    white: "#FCFDF8",
    red: "#A73545",
    surfaceRaised: "#E7EFE3",
    onPrimary: "#FFFFFF",
    heroBg: "#18251C",
    heroText: "#F0F6EA",
    heroAccent: "#B9DCA2",
  },
  Sunset: {
    bg: "#FBF2EC",
    ink: "#452D29",
    muted: "#75615B",
    line: "#E2D4CB",
    green: "#A74330",
    lime: "#F6DFD3",
    white: "#FFFBF7",
    red: "#A73545",
    surfaceRaised: "#F4E8DF",
    onPrimary: "#FFFFFF",
    heroBg: "#281E1C",
    heroText: "#FFF0E7",
    heroAccent: "#F0AB8F",
  },
  Berry: {
    bg: "#F7F1F8",
    ink: "#3D2946",
    muted: "#6D5D75",
    line: "#DED0E3",
    green: "#794394",
    lime: "#ECDAF0",
    white: "#FDFAFE",
    red: "#A73545",
    surfaceRaised: "#EFE5F1",
    onPrimary: "#FFFFFF",
    heroBg: "#251D2B",
    heroText: "#F7EEFC",
    heroAccent: "#D5B1E8",
  },
  Sunflower: {
    bg: "#FBF7E6",
    ink: "#332D1E",
    muted: "#6D654C",
    line: "#DFD4A6",
    green: "#795A00",
    lime: "#F4E3A1",
    white: "#FFFCF0",
    red: "#A73545",
    surfaceRaised: "#F5EECF",
    onPrimary: "#FFFFFF",
    heroBg: "#252216",
    heroText: "#FBF4D9",
    heroAccent: "#F1D265",
  },
} as const;

const darkThemes = {
  Essential: {
    bg: "#171816",
    ink: "#F0F1EB",
    muted: "#B9BCB2",
    line: "#40433B",
    green: "#D8C273",
    lime: "#3B3826",
    white: "#21231F",
    red: "#FF9B9C",
    surfaceRaised: "#2C2E29",
    onPrimary: "#23241D",
    heroBg: "#171913",
    heroText: "#F0F1EB",
    heroAccent: "#D8C273",
  },
  Midnight: {
    bg: "#131B28",
    ink: "#EDF2FA",
    muted: "#B9C4D2",
    line: "#384657",
    green: "#8ACDBC",
    lime: "#2A434A",
    white: "#1D293A",
    red: "#FF9B9C",
    surfaceRaised: "#29364A",
    onPrimary: "#17191D",
    heroBg: "#101723",
    heroText: "#EDF2FA",
    heroAccent: "#8ACDBC",
  },
  Ocean: {
    bg: "#11232E",
    ink: "#EDF7FC",
    muted: "#B9CBD4",
    line: "#39515E",
    green: "#86CCE5",
    lime: "#284958",
    white: "#1B3341",
    red: "#FF9B9C",
    surfaceRaised: "#284552",
    onPrimary: "#17191D",
    heroBg: "#0E1D27",
    heroText: "#EDF7FC",
    heroAccent: "#86CCE5",
  },
  Mint: {
    bg: "#18251C",
    ink: "#F0F6EA",
    muted: "#BCCAB9",
    line: "#425244",
    green: "#B9DCA2",
    lime: "#344C32",
    white: "#24372A",
    red: "#FF9B9C",
    surfaceRaised: "#324635",
    onPrimary: "#17191D",
    heroBg: "#142017",
    heroText: "#F0F6EA",
    heroAccent: "#B9DCA2",
  },
  Sunset: {
    bg: "#281E1C",
    ink: "#FFF0E7",
    muted: "#D1BEB4",
    line: "#59443B",
    green: "#F0AB8F",
    lime: "#51382E",
    white: "#382A26",
    red: "#FF9B9C",
    surfaceRaised: "#493831",
    onPrimary: "#17191D",
    heroBg: "#221916",
    heroText: "#FFF0E7",
    heroAccent: "#F0AB8F",
  },
  Berry: {
    bg: "#251D2B",
    ink: "#F7EEFC",
    muted: "#CBBBD3",
    line: "#54415E",
    green: "#D5B1E8",
    lime: "#4B3455",
    white: "#35283D",
    red: "#FF9B9C",
    surfaceRaised: "#44354D",
    onPrimary: "#17191D",
    heroBg: "#201825",
    heroText: "#F7EEFC",
    heroAccent: "#D5B1E8",
  },
  Sunflower: {
    bg: "#211F15",
    ink: "#FBF4D9",
    muted: "#C8C09F",
    line: "#514A30",
    green: "#F1D265",
    lime: "#494020",
    white: "#2D2A1C",
    red: "#FF9B9C",
    surfaceRaised: "#393522",
    onPrimary: "#29230E",
    heroBg: "#1C1B12",
    heroText: "#FBF4D9",
    heroAccent: "#F1D265",
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
