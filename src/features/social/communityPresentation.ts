import type { SocialEntityType } from "./types";

/** Database names are stable; these are the names people see. */
export const communityTypeLabel = (type: SocialEntityType) =>
  type === "organization"
    ? "Network"
    : type === "space"
      ? "Organization"
      : "Squad";

export const communityTypePlural = (type: SocialEntityType) =>
  type === "organization"
    ? "Networks"
    : type === "space"
      ? "Organizations"
      : "Squads";
