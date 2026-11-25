import { friendIds } from "@/src/shared/domain";
import type { Availability } from "@/src/theme/data";
import type { Activity, Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { isBeaconLive } from "@/src/features/beacons/beaconLive";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import type { MapContextPoint } from "./contextFilters";
import { mapPointOffset } from "./mapPointOffset";
import { matchesSearch } from "@/src/shared/search";

export type BeaconMarkerState = {
  owned: boolean;
  saved: boolean;
  friendHosted: boolean;
  squadHosted: boolean;
  live: boolean;
  participatingLive: boolean;
  interest?: boolean;
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
export const BEACON_PIN_LIGHT_INSET = 38;
export const BEACON_SELECTED_SCALE = 1.08;
export const BEACON_SELECTED_BEAM_HEIGHT = 24;
export const BEACON_LIVE_BEAM_HEIGHT = 24;
export const mapIdentityColors = {
  ownership: "#F5B952",
  friend: "#77B9FA",
  squad: "#68D6A2",
  other: "#AFA2DE",
  personOther: "#94A3B8",
  selection: "#CBBBF8",
  cluster: "#E3AF79",
  live: "#F4CD64",
  interest: "#E6A6DA",
};

export function beaconRelationship(state?: BeaconMarkerState | null) {
  return state?.owned ? "ownership" : state?.friendHosted ? "friend" : state?.squadHosted ? "squad" : "other";
}

export function beaconMarkerColor(state?: BeaconMarkerState | null) {
  return mapIdentityColors[beaconRelationship(state)];
}

export function constellationRelationships<T>(points: readonly T[], stateFor: (point: T) => BeaconMarkerState | undefined, limit: number) {
  const relationships = new Set<ReturnType<typeof beaconRelationship>>();
  for (const point of points) {
    if (relationships.size >= limit) break;
    relationships.add(beaconRelationship(stateFor(point)));
  }
  return [...relationships];
}

export const beaconBadgeArtwork = {
  ownership: { color: mapIdentityColors.ownership, testId: "beacon-ownership-star", path: "m12 2 3.1 6.3 7 .9-5 5 1.2 7L12 18l-6.3 3.2 1.2-7-5-5 7-.9Z", filled: true },
  friend: { color: mapIdentityColors.friend, testId: "beacon-friend-badge", path: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2", filled: false },
  squad: { color: mapIdentityColors.squad, testId: "beacon-squad-badge", path: "M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2m-1-17a4 4 0 0 1 0 7m2 4a4 4 0 0 1 2 4v2", filled: false },
  live: { color: mapIdentityColors.live, testId: "beacon-live-badge", path: "m13 2-9 12h7l-1 8 10-12h-7Z", filled: true },
  saved: { color: mapIdentityColors.selection, testId: "beacon-saved-bookmark", path: "M6 3h12v18l-6-4-6 4Z", filled: true },
  interest: { color: mapIdentityColors.interest, testId: "beacon-interest-badge", path: "M12 21 3.6 12.6A5.5 5.5 0 0 1 12 5.5a5.5 5.5 0 0 1 8.4 7.1Z", filled: true },
} as const;

export const BEACON_BADGE_SIZE = 11;
export const BEACON_BADGE_GAP = 2;

export function beaconMarkerBadges(state: BeaconMarkerState, limit: 1 | 3, showRelevance = true) {
  const relationship = beaconRelationship(state);
  const badges: (keyof typeof beaconBadgeArtwork)[] = [];
  if (relationship !== "other") badges.push(relationship);
  if (state.live) badges.push("live");
  if (showRelevance && state.saved) badges.push("saved");
  if (showRelevance && state.interest) badges.push("interest");
  return badges.slice(0, limit);
}

export function beaconPinEmphasis(
  state: BeaconMarkerState | null | undefined,
  _selected: boolean,
  _categoryColor: string,
  compact = false,
) {
  const relationship = beaconRelationship(state);
  const color = mapIdentityColors[relationship];
  const level = { ownership: 3, friend: 4, squad: 5, other: 6 }[relationship];
  return {
    level, color, core: color,
    beamHeight: compact ? 17 : BEACON_SELECTED_BEAM_HEIGHT,
    beamWidth: compact ? 13 : 18,
    coreWidth: compact ? 2 : 3,
    beamOpacity: compact ? 0.46 : 0.66,
    glowOpacity: compact ? 0.24 : 0.38,
  };
}

/** Scale the established priority effect as the map zooms out. */
export function distantBeaconPinEmphasis(
  lighting: ReturnType<typeof beaconPinEmphasis> | null,
  tier: "medium" | "far" | "micro",
) {
  if (!lighting) return null;
  const beam = tier === "medium" ? 0.66 : 0;
  return {
    ...lighting,
    beamHeight: Math.round(lighting.beamHeight * beam),
    beamWidth: Math.round(lighting.beamWidth * (tier === "far" ? 0.6 : 0.8)),
    coreWidth: Math.max(1, Math.round(lighting.coreWidth * (tier === "far" ? 0.55 : 0.75))),
    beamOpacity: lighting.beamOpacity * (tier === "far" ? 0.8 : 0.9),
    glowOpacity: lighting.glowOpacity * (tier === "medium" ? 0.8 : tier === "far" ? 0.48 : 0.35),
  };
}

export function beaconPulseStyle(
  state: BeaconMarkerState | null | undefined,
  _selected: boolean,
  _categoryColor: string,
) {
  return { color: beaconMarkerColor(state), opacity: 0.24, duration: BEACON_PULSE_DURATION };
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
    squadPeople: new Set(authorized ? [
      ...data.squad_members.filter((row) => squads.has(row.squad_id)).map((row) => row.user_id),
      ...data.squads.filter((row) => squads.has(row.id)).map((row) => row.owner_id),
    ] : []),
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
    interests: authorized ? (data.profiles.find((row) => row.id === viewerId)?.interests ?? []) : [],
    saved: new Set(
      authorized
        ? data.beacon_favorites
            .filter((row) => row.owner_id === viewerId)
            .map((row) => row.activity_id)
        : [],
    ),
  };
}

export function personMarkerColor(id: string, lookup: ReturnType<typeof prepareMapIdentity>) {
  return mapIdentityColors[id === lookup.viewerId ? "ownership" : lookup.friends.has(id) ? "friend" : lookup.squadPeople.has(id) ? "squad" : "personOther"];
}

export const personMarkerBadges = {
  favorite: { glyph: "★", color: mapIdentityColors.ownership },
  interest: { glyph: "♥", color: mapIdentityColors.interest },
  squad: { glyph: "♟", color: mapIdentityColors.squad },
  live: { glyph: "◉", color: mapIdentityColors.live },
};

export type PersonMarkerBadge = keyof typeof personMarkerBadges;

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
    interest: lookup.interests.some((interest) => matchesSearch(interest, activity.title, activity.category, activity.description)),
  };
}

export function markerStateLabel(state: BeaconMarkerState) {
  return [
    state.owned && "Your Beacon",
    state.saved && "Saved",
    state.interest && "Matches your interests",
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
export const BEACON_NAME_MAX_WIDTH = 112;

export function visibleMapLabels(
  points: readonly { id: string; kind: "beacon" | "person"; latitude: number; longitude: number }[],
  singletons: ReadonlySet<string>,
  zoom: number,
  priority: (id: string) => number,
) {
  const candidates = points.filter((point) => singletons.has(point.id) && (zoom >= 12 || priority(point.id) === 0));
  candidates.sort((left, right) => priority(left.id) - priority(right.id) || left.id.localeCompare(right.id));
  const accepted: typeof candidates = [];
  for (const point of candidates) {
    if (accepted.some((other) => {
      const { x, y } = mapPointOffset(point, other, zoom);
      return Math.abs(x) < (point.kind === "beacon" || other.kind === "beacon" ? 112 : 94) && Math.abs(y) < 25;
    })) continue;
    accepted.push(point);
  }
  return new Set(accepted.map((point) => point.id));
}

export function visibleBeaconLabels(
  points: readonly { id: string; latitude: number; longitude: number }[],
  singletons: ReadonlySet<string>,
  zoom: number,
) {
  if (zoom < 12) return new Set<string>();
  const close = zoom >= 15;
  return new Set(points.filter((point) =>
    point.id.startsWith("beacon:") && singletons.has(point.id) &&
    !points.some((other) => {
      if (other.id === point.id) return false;
      const { x, y } = mapPointOffset(other, point, zoom);
      return close
        ? (Math.abs(x) < BEACON_NAME_MAX_WIDTH && Math.abs(y) < 20) ||
          (Math.abs(x) < 79 && y > -42 && y < 72)
        : Math.abs(x) < 132 && Math.abs(y) < 90;
    }),
  ).map((point) => point.id));
}

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
