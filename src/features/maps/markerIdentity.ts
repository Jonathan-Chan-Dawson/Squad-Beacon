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
import { planningKindLabels } from "@/src/features/planning/planningLabels";

export type BeaconMarkerState = {
  owned: boolean;
  saved: boolean;
  friendHosted: boolean;
  squadHosted: boolean;
  live: boolean;
  participatingLive: boolean;
  joined?: boolean;
  lifecycle?: "upcoming" | "soon" | "live" | "ended" | "completed" | "cancelled";
  light?: number;
  count?: number;
  response?: "invited" | "requested" | "interested";
  favoriteHost?: boolean;
  friendsGoing?: boolean;
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
export const PUBLIC_BEACON_FACE_SIZE = 44;
export const BEACON_SELECTED_SCALE = 1.08;
export const BEACON_SELECTED_BEAM_HEIGHT = 24;
export const BEACON_LIVE_BEAM_HEIGHT = 24;
export const mapIdentityColors = {
  ownership: "#FFD66B",
  joined: "#E8A54D",
  friend: "#77B9FA",
  squad: "#68D6A2",
  other: "#B29CE9",
  personOther: "#94A3B8",
  selection: "#CBBBF8",
  cluster: "#F4F8FF",
  live: "#FF9F58",
  interest: "#FF83C5",
};

export function beaconRelationship(state?: BeaconMarkerState | null) {
  return state?.owned ? "ownership" : state?.joined || state?.participatingLive ? "joined" : state?.squadHosted ? "squad" : state?.friendHosted ? "friend" : "other";
}

export function beaconMarkerColor(state?: BeaconMarkerState | null) {
  return mapIdentityColors[beaconRelationship(state)];
}

export function stellarRelationships<T>(points: readonly T[], stateFor: (point: T) => BeaconMarkerState | undefined, limit: number) {
  if (!limit) return [];
  const relationships = new Set<ReturnType<typeof beaconRelationship>>();
  for (const point of points) {
    relationships.add(beaconRelationship(stateFor(point)));
    if (relationships.size === 5) break;
  }
  return (["ownership", "joined", "squad", "friend", "other"] as const)
    .filter(relationship => relationships.has(relationship)).slice(0, limit);
}

export const beaconBadgeArtwork = {
  ownership: { color: "#FFE13D", testId: "beacon-ownership-star", path: "m12 2 3.1 6.3 7 .9-5 5 1.2 7L12 18l-6.3 3.2 1.2-7-5-5 7-.9Z", filled: true },
  friend: { color: mapIdentityColors.friend, testId: "beacon-friend-badge", path: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2", filled: false },
  squad: { color: mapIdentityColors.squad, testId: "beacon-squad-badge", path: "M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2m-1-17a4 4 0 0 1 0 7m2 4a4 4 0 0 1 2 4v2", filled: false },
  live: { color: "#FFD66B", testId: "beacon-live-badge", path: "M12 12h.01M9 9a4.2 4.2 0 0 0 0 6m6-6a4.2 4.2 0 0 1 0 6M6 6a8.5 8.5 0 0 0 0 12M18 6a8.5 8.5 0 0 1 0 12", filled: false },
  joined: { color: mapIdentityColors.joined, testId: "beacon-joined-badge", path: "m5 12 5 5L20 7", filled: false },
  soon: { color: "#F8BF71", testId: "beacon-starting-badge", path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2", filled: false },
  cancelled: { color: "#D4969D", testId: "beacon-cancelled-badge", path: "m6 6 12 12M18 6 6 18", filled: false },
  favorite: { color: "#ED9CC8", testId: "beacon-favorite-host-badge", path: "M12 21 3.6 12.6A5.5 5.5 0 0 1 12 5.5a5.5 5.5 0 0 1 8.4 7.1Z", filled: true },
  invited: { color: "#A5D7FF", testId: "beacon-invited-badge", path: "M3 6h18v12H3zM3 7l9 6 9-6", filled: false },
  requested: { color: "#F0BB83", testId: "beacon-pending-badge", path: "M7 3h10v4l-4 5 4 5v4H7v-4l4-5-4-5z", filled: false },
  saved: { color: "#C9B6FA", testId: "beacon-saved-bookmark", path: "M6 3h12v18l-6-4-6 4Z", filled: true },
  interest: { color: "#EAB3DD", testId: "beacon-interest-badge", path: "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z", filled: true },
} as const;

export const MAP_BADGE_INK = "#242032";

export function beaconGlyphSize(faceSize: number) {
  return Math.min(30, Math.round(faceSize * 0.53));
}

type BadgeKind = keyof typeof beaconBadgeArtwork;
type BadgeSlot = "identity" | "context" | "saved" | "lifecycle";
const badgeSignals: readonly {
  slot: BadgeSlot; kind: BadgeKind; priority: number; label: string;
  when: (state: BeaconMarkerState) => boolean;
}[] = [
  { slot: "identity", kind: "ownership", priority: 0, label: "Your Beacon", when: s => s.owned },
  { slot: "identity", kind: "joined", priority: 0, label: "Going", when: s => !!(s.joined || s.participatingLive) },
  { slot: "context", kind: "invited", priority: 1, label: "Invited", when: s => s.response === "invited" },
  { slot: "context", kind: "requested", priority: 1, label: "Pending approval", when: s => s.response === "requested" },
  { slot: "saved", kind: "saved", priority: 2, label: "Saved", when: s => s.saved },
  { slot: "identity", kind: "favorite", priority: 2, label: "Favorite host", when: s => !!s.favoriteHost },
  { slot: "context", kind: "favorite", priority: 2, label: "Favorite host", when: s => !!s.favoriteHost },
  { slot: "context", kind: "friend", priority: 3, label: "Friends going", when: s => !!s.friendsGoing },
  { slot: "context", kind: "interest", priority: 3, label: "Interested", when: s => s.response === "interested" },
  { slot: "context", kind: "interest", priority: 3, label: "Matches your interests", when: s => !!s.interest },
  { slot: "identity", kind: "squad", priority: 4, label: "Your Squad", when: s => s.squadHosted },
  { slot: "identity", kind: "friend", priority: 4, label: "Friend-hosted", when: s => s.friendHosted },
  { slot: "lifecycle", kind: "cancelled", priority: 0, label: "Cancelled", when: s => s.lifecycle === "cancelled" },
  { slot: "lifecycle", kind: "live", priority: 0, label: "Live", when: s => s.live },
  { slot: "lifecycle", kind: "soon", priority: 0, label: "Starting soon", when: s => s.lifecycle === "soon" },
];

export function beaconMarkerSlots(state: BeaconMarkerState, options: {
  size: number; street?: boolean; selected?: boolean; crowded?: boolean; petal?: boolean;
  showRelevance?: boolean; publicMarker?: boolean; count?: boolean;
}) {
  const { size, street, selected, crowded, petal, showRelevance = true, publicMarker, count } = options;
  const budget = petal || !street || crowded ? 1 : selected || (state.count ?? 0) >= 15 ? 3 : (state.count ?? 0) >= 5 ? 2 : 1;
  const chosen = new Map<BadgeSlot, BadgeKind>();
  let bottom = 0;
  for (const { slot, kind, priority, when } of badgeSignals) {
    if (chosen.has(slot) || !when(state)) continue;
    if (slot === "lifecycle" ? petal || size < 29 : bottom >= budget || (petal && priority > 0) || (!showRelevance && priority >= 2 && priority < 4)) continue;
    if (kind === "favorite" && chosen.get("identity") === kind) continue;
    if (priority === 4 && bottom) continue;
    if (slot === "context" && count) continue;
    chosen.set(slot, kind);
    if (slot !== "lifecycle") bottom++;
  }
  return [...chosen].map(([slot, kind]) => {
    const diameter = petal || !street ? 11 : size >= 52 ? 14 : 12;
    const glyphSize = diameter - 3;
    return {
      slot, kind, diameter, glyphSize,
      left: slot === "context" ? (size - diameter) / 2 : slot === "identity" ? 0 : size - diameter,
      top: slot === "lifecycle" ? -3 : size - diameter + (slot === "context" || publicMarker ? 6 : 3),
    };
  });
}

export function beaconFaceSize(state: BeaconMarkerState | null | undefined, baseline: number, street: boolean) {
  const n = state?.count ?? 0;
  const scale = n >= 1000 ? 1.65 : n >= 100 ? 1.50 : n >= 30 ? 1.30 : n >= 15 ? 1.16 : n >= 5 ? 1.08 : 1;
  return Math.round(baseline * (street ? scale : 1 + (scale - 1) * 0.35));
}

export function quietBeacon(state: BeaconMarkerState | null | undefined) {
  return state?.lifecycle === "ended" || state?.lifecycle === "completed" || state?.lifecycle === "cancelled";
}

export const planningMarkerArtwork = {
  ping: { color: "#ED9CC8", glyph: "↗", label: planningKindLabels.ping },
  vote: { color: "#D98CCD", glyph: "✓", label: planningKindLabels.vote },
  draw: { color: "#C795DF", glyph: "◇", label: planningKindLabels.draw },
  time: { color: "#E9A8CE", glyph: "◷", label: planningKindLabels.time },
} as const;

export function planningDeadlineSoon(deadline: string | undefined, now: number) {
  const before = Date.parse(deadline ?? "") - now;
  return before > 0 && before <= 30 * 60_000;
}

export function publicBeaconMarkerState(summary: MapContextPoint["publicSummary"], now: number): BeaconMarkerState {
  if (!summary) return EMPTY_MARKER_STATE;
  const before = Date.parse(summary.starts_at) - now;
  const end = Date.parse(summary.ends_at);
  const live = before <= 0 && end > now;
  return {
    ...EMPTY_MARKER_STATE,
    count: Number.isInteger(summary.accepted_seat_count) && summary.accepted_seat_count >= 0 ? summary.accepted_seat_count : undefined,
    joined: summary.viewer_response === "going",
    live,
    response: summary.viewer_response === "requested" ? "requested" : undefined,
    lifecycle: live ? "live" : end <= now ? "ended" : before > 30 * 60_000 ? "upcoming" : before > 0 ? "soon" : undefined,
    light: before > 86_400_000 ? 0.75 : before > 30 * 60_000 ? 0.9 : 1,
  };
}

export function beaconPinEmphasis(
  state: BeaconMarkerState | null | undefined,
  _selected: boolean,
  _categoryColor: string,
  compact = false,
) {
  const relationship = beaconRelationship(state);
  if (quietBeacon(state) || (relationship !== "ownership" && relationship !== "joined")) return null;
  const color = mapIdentityColors[relationship];
  const level = relationship === "ownership" ? 1 : 2;
  const intensity = (state?.light ?? 1) * (level === 1 ? 1 : 0.8);
  return {
    level, color, core: color,
    beamHeight: compact ? 17 : BEACON_SELECTED_BEAM_HEIGHT,
    beamWidth: compact ? 13 : 18,
    coreWidth: compact ? 2 : 3,
    beamOpacity: (compact ? 0.46 : 0.66) * intensity,
    glowOpacity: (compact ? 0.24 : 0.38) * intensity,
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
  const goingByActivity = new Map<string, Data["rsvps"]>();
  const closeLists = new Set(authorized ? data.lists.filter(row => row.owner_id === viewerId && row.name.toLowerCase() === "close friends").map(row => row.id) : []);
  for (const row of authorized ? data.rsvps : []) {
    if (row.status !== "going") continue;
    const entries = goingByActivity.get(row.activity_id);
    if (entries) entries.push(row);
    else goingByActivity.set(row.activity_id, [row]);
  }
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
    goingByActivity,
    favoritePeople: new Set(authorized ? [
      ...data.favorites.filter(row => row.owner_id === viewerId && row.kind === "friend").map(row => row.target_id),
      ...data.list_members.filter(row => closeLists.has(row.list_id)).map(row => row.user_id),
    ] : []),
    publicIds: new Set(data.public_beacons.map(row => row.activity_id)),
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
  const rsvp = lookup.rsvps.get(activity.id);
  const joined = !owned && isApprovedGoing(activity, rsvp);
  const start = Date.parse(activity.starts_at);
  const end = Date.parse(activity.ends_at);
  const placeholder = !!(activity.plan_id && activity.plan_step && !activity.plan_started_at);
  const before = start - now;
  const lifecycle = activity.status === "cancelled" ? "cancelled"
    : activity.status === "completed" ? "completed"
    : live ? "live"
    : !placeholder && end <= now ? "ended"
    : !placeholder && before > 0 && before <= 30 * 60_000 ? "soon"
    : !placeholder && before > 0 ? "upcoming" : undefined;
  const going = new Set(
    (lookup.goingByActivity.get(activity.id) ?? [])
      .filter(row => !lookup.blockedHosts.has(row.user_id) && isApprovedGoing(activity, row))
      .map(row => row.user_id),
  );
  going.delete(activity.owner_id);
  return {
    owned,
    joined,
    lifecycle,
    light: lifecycle === "upcoming" ? before > 86_400_000 ? 0.75 : 0.9 : 1,
    count: Number.isInteger(activity.accepted_seat_count) && activity.accepted_seat_count! >= 0
      ? activity.accepted_seat_count : going.size ? going.size + 1 : undefined,
    response: !owned && !joined && (rsvp?.status === "invited" || rsvp?.status === "requested" || rsvp?.status === "interested") ? rsvp.status : undefined,
    favoriteHost: lookup.favoritePeople.has(activity.owner_id),
    friendsGoing: [...going].some(person => lookup.friends.has(person)),
    saved: lookup.saved.has(activity.id),
    friendHosted: lookup.friends.has(activity.owner_id),
    squadHosted:
      lookup.squadBeacons.has(activity.id) ||
      (activity.audience === "squad" && !!activity.audience_id && lookup.squads.has(activity.audience_id)),
    live,
    participatingLive: live && (owned || joined),
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
    state.live ? "Live" : state.lifecycle === "soon" ? "Starting soon" : state.lifecycle,
    (state.joined || state.participatingLive) && !state.owned && "Going",
    state.response === "invited" && "Invited",
    state.response === "requested" && "Pending approval",
    state.count != null && `${state.count} confirmed participants`,
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
    if (point.publicBeaconId && !states.has(point.publicBeaconId))
      states.set(point.publicBeaconId, publicBeaconMarkerState(point.publicSummary, now));
    if (!point.stopNumber || !point.activityId || states.has(point.activityId)) continue;
    const activity = data.activities.find((row) => row.id === point.activityId);
    if (activity) states.set(activity.id, beaconMarkerState(data, activity, lookup, now));
  }
  return states;
}

export function mapPersonOpacity(ageLabel: string, selected: boolean) {
  return selected || ageLabel === "now" || !ageLabel ? 1
    : ageLabel.includes("h ago") || Number.parseInt(ageLabel, 10) >= 5 ? 0.72 : 1;
}

export function nextMapPlanStop(points: readonly MapContextPoint[], states: ReadonlyMap<string, BeaconMarkerState>) {
  return points.find(point => {
    if (!point.stopNumber || !point.activityId) return false;
    const phase = states.get(point.activityId)?.lifecycle;
    return phase === "upcoming" || phase === "soon";
  })?.id;
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
