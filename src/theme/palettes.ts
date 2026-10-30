// Stable family IDs preserve saved preferences. Quiet surfaces establish depth;
// primary actions and complementary secondary highlights carry the family colors.

const lightThemes = {
  Essential: {
    bg: "#F4F3EF",
    ink: "#202833",
    muted: "#566272",
    line: "#D0D5DF",
    green: "#3654A3",
    lime: "#E4EBFF",
    white: "#FFFFFF",
    surfaceRaised: "#E9EBF0",
    onPrimary: "#FFFFFF",
    heroBg: "#202A3C",
    heroText: "#F2F5FC",
    heroAccent: "#B6C7FF",
    secondary: "#975033",
    secondaryContainer: "#F5E6DB",
    borderStrong: "#798495",
    red: "#AD3049",
  },
  Midnight: {
    bg: "#F1F3F8",
    ink: "#202B40",
    muted: "#536079",
    line: "#D4DAE6",
    green: "#4F52A6",
    lime: "#E8E5FF",
    white: "#FFFFFF",
    surfaceRaised: "#E5EAF3",
    onPrimary: "#FFFFFF",
    heroBg: "#151D31",
    heroText: "#EEF1FC",
    heroAccent: "#B7B8FF",
    secondary: "#166E68",
    secondaryContainer: "#DDEEE9",
    borderStrong: "#7C879D",
    red: "#AD3049",
  },
  Ocean: {
    bg: "#EFF4F7",
    ink: "#203342",
    muted: "#536675",
    line: "#CDD9E1",
    green: "#08698B",
    lime: "#D8EDF7",
    white: "#FCFEFF",
    surfaceRaised: "#E0EAF0",
    onPrimary: "#FFFFFF",
    heroBg: "#102A3C",
    heroText: "#EDF6FC",
    heroAccent: "#84D3F4",
    secondary: "#A14E2C",
    secondaryContainer: "#F5E5D9",
    borderStrong: "#758C9A",
    red: "#AD3049",
  },
  Mint: {
    bg: "#F1F5F1",
    ink: "#23372E",
    muted: "#53675A",
    line: "#D0DCD2",
    green: "#256747",
    lime: "#DBEDE0",
    white: "#FCFDFA",
    surfaceRaised: "#E1EAE1",
    onPrimary: "#FFFFFF",
    heroBg: "#172E24",
    heroText: "#EFF6F0",
    heroAccent: "#9CDBB2",
    secondary: "#85506E",
    secondaryContainer: "#F0E3EB",
    borderStrong: "#7B8E80",
    red: "#AD3049",
  },
  Sunset: {
    bg: "#F8F2ED",
    ink: "#3D2D2B",
    muted: "#716058",
    line: "#DFD2CA",
    green: "#A33F2F",
    lime: "#F7DED2",
    white: "#FFFCF8",
    surfaceRaised: "#EFE2D8",
    onPrimary: "#FFFFFF",
    heroBg: "#30201F",
    heroText: "#FFF1EA",
    heroAccent: "#F6AA8F",
    secondary: "#176E78",
    secondaryContainer: "#DEEEED",
    borderStrong: "#9A8276",
    red: "#AD3049",
  },
  Berry: {
    bg: "#F5F1F7",
    ink: "#352B42",
    muted: "#675C75",
    line: "#DDD2E4",
    green: "#774295",
    lime: "#EADCF4",
    white: "#FEFCFF",
    surfaceRaised: "#EAE3F0",
    onPrimary: "#FFFFFF",
    heroBg: "#2A1F36",
    heroText: "#F8F0FC",
    heroAccent: "#D6B1F4",
    secondary: "#806007",
    secondaryContainer: "#F2EBD2",
    borderStrong: "#8E7D9C",
    red: "#AD3049",
  },
  Sunflower: {
    bg: "#F8F5EA",
    ink: "#332F23",
    muted: "#68624E",
    line: "#DFD6B8",
    green: "#785800",
    lime: "#F4E4A6",
    white: "#FFFEF7",
    surfaceRaised: "#EEE8D3",
    onPrimary: "#FFFFFF",
    heroBg: "#2D281A",
    heroText: "#FAF4DE",
    heroAccent: "#F3D36E",
    secondary: "#355C9C",
    secondaryContainer: "#E2EAF8",
    borderStrong: "#91866A",
    red: "#AD3049",
  },
} as const;

const darkThemes = {
  Essential: {
    bg: "#14171D",
    ink: "#F0F3F8",
    muted: "#B7C1CF",
    line: "#3A4554",
    green: "#AFC2FF",
    lime: "#2D3A5B",
    white: "#1F242D",
    surfaceRaised: "#2C3441",
    onPrimary: "#13234B",
    heroBg: "#111A2B",
    heroText: "#F0F3F8",
    heroAccent: "#AFC2FF",
    secondary: "#E8B894",
    secondaryContainer: "#3C302A",
    borderStrong: "#758399",
    red: "#FF9EA9",
  },
  Midnight: {
    bg: "#111625",
    ink: "#EEF1FC",
    muted: "#B9C3D9",
    line: "#3C465F",
    green: "#B7B8FF",
    lime: "#33345A",
    white: "#1D2538",
    surfaceRaised: "#2B354C",
    onPrimary: "#1D2149",
    heroBg: "#101627",
    heroText: "#EEF1FC",
    heroAccent: "#B7B8FF",
    secondary: "#8CDCC9",
    secondaryContainer: "#253F3F",
    borderStrong: "#7A88A4",
    red: "#FF9EA9",
  },
  Ocean: {
    bg: "#101D27",
    ink: "#EDF6FC",
    muted: "#B5C8D7",
    line: "#3A5062",
    green: "#84D3F4",
    lime: "#203F55",
    white: "#1C2B38",
    surfaceRaised: "#2A3C4C",
    onPrimary: "#102D40",
    heroBg: "#0D1B28",
    heroText: "#EDF6FC",
    heroAccent: "#84D3F4",
    secondary: "#F3B48B",
    secondaryContainer: "#423025",
    borderStrong: "#728CA0",
    red: "#FF9EA9",
  },
  Mint: {
    bg: "#14211D",
    ink: "#EFF6F0",
    muted: "#B8CEC0",
    line: "#3F594B",
    green: "#9CDBB2",
    lime: "#294A38",
    white: "#20322B",
    surfaceRaised: "#2D4539",
    onPrimary: "#173124",
    heroBg: "#111E18",
    heroText: "#EFF6F0",
    heroAccent: "#9CDBB2",
    secondary: "#DEB1D2",
    secondaryContainer: "#422D3E",
    borderStrong: "#769587",
    red: "#FF9EA9",
  },
  Sunset: {
    bg: "#211A1B",
    ink: "#FFF1EA",
    muted: "#D3BDB6",
    line: "#5E4543",
    green: "#F6AA8F",
    lime: "#52332C",
    white: "#342729",
    surfaceRaised: "#493638",
    onPrimary: "#3C2119",
    heroBg: "#211719",
    heroText: "#FFF1EA",
    heroAccent: "#F6AA8F",
    secondary: "#8AD8DB",
    secondaryContainer: "#253D43",
    borderStrong: "#A08078",
    red: "#FF9EA9",
  },
  Berry: {
    bg: "#201927",
    ink: "#F8F0FC",
    muted: "#CABAD5",
    line: "#584367",
    green: "#D6B1F4",
    lime: "#4A315B",
    white: "#302638",
    surfaceRaised: "#43334F",
    onPrimary: "#301A43",
    heroBg: "#1C1525",
    heroText: "#F8F0FC",
    heroAccent: "#D6B1F4",
    secondary: "#E7CE84",
    secondaryContainer: "#3D3526",
    borderStrong: "#9480A5",
    red: "#FF9EA9",
  },
  Sunflower: {
    bg: "#1E1D18",
    ink: "#FAF4DE",
    muted: "#CDC4A4",
    line: "#5A5135",
    green: "#F3D36E",
    lime: "#4B4123",
    white: "#2E2B22",
    surfaceRaised: "#423D2B",
    onPrimary: "#30270E",
    heroBg: "#191810",
    heroText: "#FAF4DE",
    heroAccent: "#F3D36E",
    secondary: "#AFC8FA",
    secondaryContainer: "#2B3548",
    borderStrong: "#978D6E",
    red: "#FF9EA9",
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
