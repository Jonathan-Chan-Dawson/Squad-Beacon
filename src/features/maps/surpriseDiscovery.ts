import type { Activity, Data } from "@/src/shared/types";
import type {
  Coordinate,
  ExplorationFilters,
  MapViewport,
} from "@/src/shared/exploration";
import {
  coordinateInBounds,
  isValidCoordinate,
} from "@/src/shared/exploration";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadBeaconMeetingDetails, matchesBeaconFilters } from "./filtering";
import { beaconHasSquadParticipant } from "./mapDiscovery";
import { publicMapBeacons } from "./publicMapDiscovery";
import { selectedBeaconCategories } from "@/src/shared/explorationFilters";
import { beaconParticipation } from "@/src/features/beacons/participation";
import { beaconInterestMatch } from "./discoveryRanking";
import {
  matchesDiscoveryFriends,
  matchesKnownDiscoveryContext,
  prepareDiscoveryFriends,
} from "./discoveryFriends";
import type { PublicBeaconSummary } from "@/src/features/discovery/types";

export type SurpriseCandidate = {
  id: string;
  kind: "activity" | "public";
  coordinate: Coordinate;
  zoom: number;
  weight: number;
};

/** Inputs are the ordinary matching discovery results, never selected/Plan exceptions. */
export function surpriseCandidates(
  data: Data,
  viewerId: string | null,
  matchingActivities: readonly Activity[],
  matchingPublic: readonly PublicBeaconSummary[],
  filters: ExplorationFilters,
  viewport: MapViewport | null,
  now: number,
) {
  if (!viewerId || data.viewer_id !== viewerId || !viewport)
    return [] as SurpriseCandidate[];
  const friends = prepareDiscoveryFriends(data, viewerId, "friends");
  const scopedFriends = prepareDiscoveryFriends(
    data,
    viewerId,
    filters.friendScope,
  );
  const squad = data.squads.find((s) => s.id === filters.audience);
  const personal = filters.personalizedRanking !== false;
  const result = new Map<string, SurpriseCandidate>();
  const allowed = (coordinate: Coordinate) =>
    isValidCoordinate(coordinate) &&
    coordinateInBounds(coordinate, viewport.bounds);
  for (const matching of matchingActivities) {
    const activity = data.activities.find((row) => row.id === matching.id);
    if (!activity) continue;
    if (
      !matchesBeaconFilters(
        data,
        activity,
        viewerId,
        squad ? { ...filters, audience: "Everyone" } : filters,
        now,
        { friends: scopedFriends },
      ) ||
      (squad &&
        !beaconHasSquadParticipant(data, activity, squad.id, viewerId)) ||
      !canReadBeaconActivity(data, activity, viewerId) ||
      activity.mode === "solo" ||
      activity.status !== "scheduled" ||
      !Number.isFinite(Date.parse(activity.starts_at)) ||
      !(Date.parse(activity.ends_at) > Date.parse(activity.starts_at)) ||
      !(Date.parse(activity.ends_at) > now) ||
      (activity.plan_id && activity.plan_step && !activity.plan_started_at) ||
      data.blocks.some(
        (b) =>
          (b.blocker_id === viewerId && b.blocked_id === activity.owner_id) ||
          (b.blocked_id === viewerId && b.blocker_id === activity.owner_id),
      ) ||
      data.activity_exclusions.some(
        (row) => row.activity_id === activity.id && row.user_id === viewerId,
      ) ||
      !canReadBeaconMeetingDetails(data, activity, viewerId)
    )
      continue;
    const place = data.places.find((row) => row.activity_id === activity.id);
    if (
      !place ||
      place.online_url ||
      place.latitude == null ||
      place.longitude == null
    )
      continue;
    const coordinate = { latitude: place.latitude, longitude: place.longitude };
    if (!allowed(coordinate)) continue;
    const joining =
      beaconParticipation(data, viewerId, activity.id, now)?.allowed.includes(
        "join",
      ) === true;
    result.set(activity.id, {
      id: activity.id,
      kind: "activity",
      coordinate,
      zoom: 15,
      weight:
        (joining ? 4 : 1) +
        Number(matchesDiscoveryFriends(activity, friends)) +
        Number(personal && beaconInterestMatch(data, activity, viewerId)),
    });
  }
  const interests = new Set(
    (data.profiles.find((p) => p.id === viewerId)?.interests ?? []).map((s) =>
      s.trim().toLowerCase(),
    ),
  );
  for (const row of publicMapBeacons(
    matchingPublic,
    filters,
    selectedBeaconCategories(filters),
    [],
    false,
    viewport,
    now,
    { data, viewerId, now, friends: scopedFriends },
  )) {
    if (
      result.has(row.activity_id) ||
      row.closed ||
      !(Date.parse(row.ends_at) > now) ||
      !Number.isFinite(Date.parse(row.starts_at)) ||
      !(Date.parse(row.ends_at) > Date.parse(row.starts_at)) ||
      row.coarse_lat == null ||
      row.coarse_lng == null ||
      !matchesKnownDiscoveryContext(row.activity_id, filters, {
        data,
        viewerId,
        now,
      })
    )
      continue;
    const known = data.activities.find((a) => a.id === row.activity_id);
    if (
      known &&
      (known.mode === "solo" ||
        known.status !== "scheduled" ||
        (known.plan_id && known.plan_step && !known.plan_started_at) ||
        data.blocks.some(
          (b) =>
            (b.blocker_id === viewerId && b.blocked_id === known.owner_id) ||
            (b.blocked_id === viewerId && b.blocker_id === known.owner_id),
        ))
    )
      continue;
    const coordinate = { latitude: row.coarse_lat, longitude: row.coarse_lng };
    if (!allowed(coordinate)) continue;
    const full =
      row.capacity_policy === "strict" &&
      row.capacity_limit != null &&
      row.accepted_seat_count >= row.capacity_limit;
    result.set(row.activity_id, {
      id: row.activity_id,
      kind: "public",
      coordinate,
      zoom: 13,
      weight:
        (!row.viewer_response && !full ? 4 : 1) +
        Number(
          !!known &&
            canReadBeaconActivity(data, known, viewerId) &&
            matchesDiscoveryFriends(known, friends),
        ) +
        Number(
          personal &&
            row.interest_tags.some((s) =>
              interests.has(s.trim().toLowerCase()),
            ),
        ),
    });
  }
  return [...result.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Local weighted sampling without replacement; stable refreshes retain the cycle. */
export class SurpriseCycle {
  private key = "";
  private seen = new Set<string>();
  private last: string | null = null;
  private context = "";
  pick(
    context: string,
    candidates: readonly SurpriseCandidate[],
    random = Math.random,
  ) {
    if (context !== this.context) {
      this.context = context;
      this.last = null;
    }
    const key = JSON.stringify([
      context,
      candidates.map((c) => [c.id, c.kind, c.coordinate, c.weight]),
    ]);
    if (key !== this.key) {
      this.key = key;
      this.seen.clear();
    }
    let available = candidates.filter((c) => !this.seen.has(c.id));
    if (!available.length) {
      this.seen.clear();
      available = [...candidates];
    }
    if (available.length > 1 || (candidates.length > 1 && !this.seen.size))
      available = available.filter((c) => c.id !== this.last);
    if (!available.length) return null;
    const total = available.reduce((sum, c) => sum + c.weight, 0);
    let ticket = Math.min(0.999999999, Math.max(0, random())) * total;
    const pick =
      available.find((c) => (ticket -= c.weight) < 0) ??
      available[available.length - 1];
    this.seen.add(pick.id);
    this.last = pick.id;
    return pick;
  }
  reset() {
    this.key = "";
    this.context = "";
    this.seen.clear();
    this.last = null;
  }
}
