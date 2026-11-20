import { friendIds } from "@/src/shared/domain";
import type { Availability } from "@/src/theme/data";
import type { Activity, Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { isBeaconLive } from "@/src/features/beacons/beaconLive";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import type { MapContextPoint } from "./contextFilters";

export type BeaconMarkerState = {
  owned: boolean;
  saved: boolean;
  friendHosted: boolean;
  squadHosted: boolean;
  live: boolean;
  participatingLive: boolean;
};
export const EMPTY_MARKER_STATE: BeaconMarkerState = {
  owned: false,
  saved: false,
  friendHosted: false,
  squadHosted: false,
  live: false,
  participatingLive: false,
};
export const BEACON_PULSE_DURATION = 2000;
export const BEACON_PULSE_SCALE = 1.45;
export const BEACON_PIN_RADIUS = 13;
export const COMPACT_BEACON_PIN_RADIUS = 9;
export const BEACON_PIN_TIP = { halfWidth: 9, height: 12, overlap: 2 };
export const COMPACT_BEACON_PIN_TIP = { halfWidth: 6, height: 7, overlap: 2 };
export const BEACON_PIN_LIGHT_INSET = 33;
export const BEACON_SELECTED_SCALE = 1.25;
export const BEACON_SELECTED_BEAM_HEIGHT = 32;
export const BEACON_LIVE_BEAM_HEIGHT = 21;
const LIVE_BEACON_COLOR = "#F18432";

export function beaconPinEmphasis(
  state: BeaconMarkerState | null | undefined,
  selected: boolean,
  categoryColor: string,
  compact = false,
) {
  if (selected)
    return { level: 1, color: "#E6AE45", core: "#FFFEF4", beamHeight: BEACON_SELECTED_BEAM_HEIGHT, beamWidth: 25, coreWidth: 5, beamOpacity: 1, glowOpacity: 0.98 };
  if (state?.participatingLive)
    return { level: 2, color: LIVE_BEACON_COLOR, core: "#FFDD9C", beamHeight: compact ? 6 : BEACON_LIVE_BEAM_HEIGHT, beamWidth: compact ? 8 : 18, coreWidth: compact ? 2 : 4, beamOpacity: compact ? 0.53 : 0.83, glowOpacity: compact ? 0.22 : 0.69 };
  if (state?.owned)
    return { level: 3, color: "#F3B932", core: "#FFF1AD", beamHeight: compact ? 0 : 15, beamWidth: 14, coreWidth: 3, beamOpacity: 0.71, glowOpacity: compact ? 0.15 : 0.47 };
  if (state?.friendHosted)
    return { level: 4, color: "#6DAFE5", core: "#CBEAFF", beamHeight: compact ? 0 : 12, beamWidth: 11, coreWidth: 2, beamOpacity: 0.59, glowOpacity: compact ? 0.1 : 0.26 };
  if (state?.squadHosted)
    return { level: 5, color: "#67C49B", core: "#C9F5E0", beamHeight: compact ? 11 : 14, beamWidth: compact ? 12 : 10, coreWidth: compact ? 3 : 2, beamOpacity: 0.57, glowOpacity: compact ? 0.09 : 0.25 };
  if (!compact && state?.saved)
    return { level: 0, color: categoryColor, core: categoryColor, beamHeight: 0, beamWidth: 0, coreWidth: 0, beamOpacity: 0, glowOpacity: 0.18 };
  return null;
}

export function beaconPulseStyle(
  state: BeaconMarkerState | null | undefined,
  selected: boolean,
  categoryColor: string,
) {
  if (selected) return { color: "#FFF0B8", opacity: 0.16, duration: BEACON_PULSE_DURATION };
  if (state?.participatingLive) return { color: LIVE_BEACON_COLOR, opacity: 0.42, duration: 2600 };
  return { color: categoryColor, opacity: 0.24, duration: BEACON_PULSE_DURATION };
}

/** Prepare once per authorized snapshot, never from another account's relationships. */
export function prepareMapIdentity(data: Data, viewerId: string | null) {
  const authorized = !!viewerId && data.viewer_id === viewerId;
  const squads = new Set<string>();
  const squadBeacons = new Set<string>();
  if (authorized) {
    for (const row of data.squad_members) {
      if (row.user_id === viewerId) squads.add(row.squad_id);
    }
    for (const squad of data.squads) {
      if (squad.owner_id === viewerId) squads.add(squad.id);
    }
    for (const link of data.activity_social_links) {
      if (link.entity_type === "squad" && squads.has(link.entity_id))
        squadBeacons.add(link.activity_id);
    }
  }
  return {
    viewerId: authorized ? viewerId : null,
    rsvps: new Map(authorized
      ? data.rsvps.filter((row) => row.user_id === viewerId).reverse().map((row) => [row.activity_id, row] as const)
      : []),
    squads,
    squadBeacons,
    blockedHosts: new Set(
      authorized
        ? data.blocks.flatMap((row) =>
            row.blocker_id === viewerId
              ? [row.blocked_id]
              : row.blocked_id === viewerId
                ? [row.blocker_id]
                : [],
          )
        : [],
    ),
    excludedBeacons: new Set(
      authorized
        ? data.activity_exclusions
            .filter((row) => row.user_id === viewerId)
            .map((row) => row.activity_id)
        : [],
    ),
    friends: new Set(authorized ? friendIds(data, viewerId) : []),
    saved: new Set(
      authorized
        ? data.beacon_favorites
            .filter((row) => row.owner_id === viewerId)
            .map((row) => row.activity_id)
        : [],
    ),
  };
}

export function beaconMarkerState(
  data: Data,
  activity: Activity,
  lookup: ReturnType<typeof prepareMapIdentity>,
  now: number,
): BeaconMarkerState {
  const viewer = lookup.viewerId;
  if (
    !viewer ||
    data.viewer_id !== viewer ||
    lookup.blockedHosts.has(activity.owner_id) ||
    lookup.excludedBeacons.has(activity.id) ||
    !canReadBeaconActivity(data, activity, viewer)
  )
    return EMPTY_MARKER_STATE;
  const owned = activity.owner_id === viewer;
  const live = isBeaconLive(activity, now);
  return {
    owned,
    saved: lookup.saved.has(activity.id),
    friendHosted: lookup.friends.has(activity.owner_id),
    squadHosted:
      lookup.squadBeacons.has(activity.id) ||
      (activity.audience === "squad" && !!activity.audience_id && lookup.squads.has(activity.audience_id)),
    live,
    participatingLive: live && (owned || isApprovedGoing(activity, lookup.rsvps.get(activity.id))),
  };
}

export function markerStateLabel(state: BeaconMarkerState) {
  return [
    state.owned && "Your Beacon",
    state.saved && "Saved",
    state.friendHosted && "Friend-hosted",
    state.squadHosted && !state.owned && "Your Squad",
    state.live && "Live",
    state.participatingLive && !state.owned && "Going",
  ]
    .filter(Boolean)
    .join(", ");
}

export function mapBeaconMarkerStates(
  data: Data,
  activities: readonly Activity[],
  points: readonly MapContextPoint[] | undefined,
  lookup: ReturnType<typeof prepareMapIdentity>,
  now: number,
) {
  const states = new Map(activities.map((activity) => [
    activity.id, beaconMarkerState(data, activity, lookup, now),
  ]));
  for (const point of points ?? []) {
    if (!point.stopNumber || !point.activityId || states.has(point.activityId)) continue;
    const activity = data.activities.find((row) => row.id === point.activityId);
    if (activity) states.set(activity.id, beaconMarkerState(data, activity, lookup, now));
  }
  return states;
}
export const mapIdentityColors = {
  ownership: "#168578",
};

export function ownsMapBeacon(
  data: Data,
  activity: Activity,
  viewerId: string | null,
) {
  return (
    !!viewerId &&
    data.viewer_id === viewerId &&
    activity.owner_id === viewerId &&
    canReadBeaconActivity(data, activity, viewerId)
  );
}

export function friendLocationLabel(name: string, age: string) {
  const first = name.trim().split(/\s+/)[0] || "Friend";
  return `${first.length > 10 ? `${first.slice(0, 9)}…` : first} · ${age}`;
}

/** Greedy screen-space labels; never remove the underlying authorized avatar. */
export function visibleFriendLabels(
  points: { id: string; latitude: number; longitude: number }[],
  zoom: number,
) {
  const accepted: { x: number; y: number }[] = [];
  const world = 256 * 2 ** zoom;
  return new Set(
    [...points]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((point) => {
        const radians =
          (Math.max(-85, Math.min(85, point.latitude)) * Math.PI) / 180;
        const x = ((point.longitude + 180) / 360) * world;
        const y = ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * world;
        if (
          accepted.some(
            (p) =>
              Math.min(Math.abs(p.x - x), world - Math.abs(p.x - x)) < 94 &&
              Math.abs(p.y - y) < 58,
          )
        )
          return false;
        accepted.push({ x, y });
        return true;
      })
      .map((point) => point.id),
  );
}
/** Identity is independent of access; use only the viewer’s authorized relationships. */
export function markerIdentity(
  data: Data,
  activity: Activity,
  viewerId: string | null,
) {
  if (
    !viewerId ||
    data.viewer_id !== viewerId ||
    !canReadBeaconActivity(data, activity, viewerId)
  )
    return null;
  const host = data.activity_social_links.find(
    (row) => row.activity_id === activity.id,
  );
  if (host?.entity_type === "organization")
    return {
      glyph: "◈",
      label: communityTypeLabel("organization"),
      kind: "community",
    } as const;
  if (host?.entity_type === "space")
    return {
      glyph: "✺",
      label: communityTypeLabel("space"),
      kind: "community",
    } as const;
  if (host?.entity_type === "squad" || activity.audience === "squad")
    return { glyph: "✦", label: "Squad", kind: "social" } as const;
  if (friendIds(data, viewerId).includes(activity.owner_id))
    return { glyph: "♥", label: "Friends", kind: "social" } as const;
  return null;
}

export function mapAvailabilityColors(availability: Record<Availability, { color: string }>) {
  return {
    available: availability.available.color,
    unavailable: availability.unavailable.color,
    "ending-soon": availability.endingSoon.color,
    unknown: availability.unknown.color,
  };
}
