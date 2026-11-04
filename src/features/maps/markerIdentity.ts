import { friendIds } from "@/src/shared/domain";
import type { Activity, Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { isBeaconLive } from "@/src/features/beacons/beaconLive";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";

export type BeaconMarkerState = {
  owned: boolean;
  saved: boolean;
  friendHosted: boolean;
  live: boolean;
};
export const EMPTY_MARKER_STATE: BeaconMarkerState = {
  owned: false,
  saved: false,
  friendHosted: false,
  live: false,
};
export const BEACON_PULSE_DURATION = 2000;
export const BEACON_PULSE_SCALE = 1.45;

/** Prepare once per authorized snapshot, never from another account's relationships. */
export function prepareMapIdentity(data: Data, viewerId: string | null) {
  const authorized = !!viewerId && data.viewer_id === viewerId;
  return {
    viewerId: authorized ? viewerId : null,
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
  return {
    owned: activity.owner_id === viewer,
    saved: lookup.saved.has(activity.id),
    friendHosted: lookup.friends.has(activity.owner_id),
    live: isBeaconLive(activity, now),
  };
}

export function markerStateLabel(state: BeaconMarkerState) {
  return [
    state.owned && "Your Beacon",
    state.saved && "Saved",
    state.friendHosted && "Friend-hosted",
    state.live && "Live",
  ]
    .filter(Boolean)
    .join(", ");
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
export const categoryMarkerGlyphs = {
  Fitness: "🏀",
  Study: "📚",
  Gaming: "🎮",
  Creative: "🎨",
  Social: "☕",
  Other: "✦",
} as const;
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

/** Map rings use fixed, vivid status colors independently of the selected theme. */
export const mapAvailabilityColors = {
  available: "#16C65B",
  unavailable: "#F12B38",
  endingSoon: "#F3C917",
  "ending-soon": "#F3C917",
  unknown: "#B7BEC8A6",
};
