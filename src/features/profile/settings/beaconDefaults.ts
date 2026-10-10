import type { Audience, Data } from "@/src/shared/types";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import {
  activeOrganizationRole,
  canReadOrganization,
} from "@/src/features/organizations/domain";

export type SonarDurationMinutes = 15 | 30 | 60 | 240;
export type ViewerDeviceDefaults = {
  beaconAudience?: Audience;
  beaconAudienceId?: string | null;
  sonarDurationMinutes?: SonarDurationMinutes;
};
export const defaultAudienceOptions = [
  "private",
  "friends",
  "list",
  "squad",
  "organization",
] as const;

export function parseViewerDeviceDefaults(
  value: unknown,
): ViewerDeviceDefaults {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const audience = defaultAudienceOptions.find(
    (option) => option === row.beaconAudience,
  );
  const duration = [15, 30, 60, 240].find(
    (option) => option === row.sonarDurationMinutes,
  ) as SonarDurationMinutes | undefined;
  return {
    ...(audience
      ? {
          beaconAudience: audience,
          beaconAudienceId:
            typeof row.beaconAudienceId === "string"
              ? row.beaconAudienceId
              : null,
        }
      : {}),
    ...(duration ? { sonarDurationMinutes: duration } : {}),
  };
}

export function eligibleDefaultTargets(
  data: Data,
  viewerId: string,
  audience: Audience,
) {
  if (data.viewer_id !== viewerId) return [];
  if (audience === "list")
    return data.lists.filter((list) => list.owner_id === viewerId);
  if (audience === "squad")
    return data.squads.filter((squad) =>
      canOpenSquadProfile(data, squad.id, viewerId),
    );
  if (audience === "organization")
    return data.organizations.filter(
      (org) =>
        !org.archived_at &&
        canReadOrganization(data, org.id, viewerId) &&
        !!activeOrganizationRole(org, data.organization_members, viewerId),
    );
  return [];
}

/** Resolve a device preference against the current viewer snapshot, never a stale target. */
export function resolveDefaultAudience(
  data: Data,
  viewerId: string,
  defaults: ViewerDeviceDefaults,
): { audience: Audience; audienceId: string | null; fellBack: boolean } {
  if (data.viewer_id !== viewerId)
    return {
      audience: "private" as Audience,
      audienceId: null,
      fellBack: true,
    };
  const serverDefault =
    data.profiles.find((profile) => profile.id === viewerId)
      ?.default_audience === "private"
      ? "private"
      : "friends";
  const audience =
    defaults.beaconAudience &&
    defaults.beaconAudience !== "private" &&
    defaults.beaconAudience !== "friends"
      ? defaults.beaconAudience
      : serverDefault;
  if (audience === "private" || audience === "friends")
    return { audience, audienceId: null, fellBack: false };
  const target = eligibleDefaultTargets(data, viewerId, audience).find(
    (row) => row.id === defaults.beaconAudienceId,
  );
  return target
    ? { audience, audienceId: target.id, fellBack: false }
    : { audience: serverDefault as Audience, audienceId: null, fellBack: true };
}
