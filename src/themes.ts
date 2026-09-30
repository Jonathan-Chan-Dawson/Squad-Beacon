export const themes = {
  Mint: {
    bg: "#F2F6EE",
    ink: "#173D32",
    muted: "#587568",
    line: "#DCE7D9",
    green: "#28775C",
    lime: "#DDF5A1",
    white: "#FFFFFF",
    red: "#B64048",
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
  },
};
export type ThemeName = keyof typeof themes;
