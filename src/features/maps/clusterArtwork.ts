import type {
  Activity,
  Category,
  Data,
  LocationSession,
  Profile,
} from "@/src/shared/types";
import {
  friendAvailabilityState,
  type FriendAvailabilityState,
} from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { activeAvailability } from "@/src/features/beacons/availability";
import { isBeaconLive } from "@/src/features/beacons/beaconLive";
import { matchesSearch } from "@/src/shared/search";
import {
  prepareMapIdentity,
  beaconMarkerState,
  markerStateLabel,
  personMarkerColor,
  EMPTY_MARKER_STATE,
  type BeaconMarkerState,
  type PersonMarkerBadge,
} from "./markerIdentity";
import { formatLocationAge, type ClusterPoint } from "./cluster";

export type ClusterMemberArtwork = {
  id: string;
  kind: ClusterPoint["kind"];
  publicMarker: boolean;
  category: Category;
  label: string;
  owned: boolean;
  markerState: BeaconMarkerState;
  profile?: Profile;
  availability: FriendAvailabilityState;
  availabilityDetail?: ReturnType<typeof activeAvailability>;
  relationshipColor?: string;
  personBadges?: PersonMarkerBadge[];
  age: string;
  revision: string;
  visualRevision: string;
};

/** One indexed pass per map update; unchanged member models retain object identity. */
export class ClusterArtworkCache {
  private previous = new Map<string, ClusterMemberArtwork>();
  build(
    points: ClusterPoint[],
    activities: Activity[],
    profiles: Profile[],
    locations: LocationSession[],
    availabilityActivities: Activity[],
    data: Data,
    viewer: string | null,
    now: number,
    lookup = prepareMapIdentity(data, viewer),
    availabilityNow = now,
  ) {
    const activitiesById = new Map(activities.map((row) => [row.id, row]));
    const profilesById = new Map(profiles.map((row) => [row.id, row]));
    const locationsById = new Map(locations.map((row) => [row.owner_id, row]));
    const states = new Map<string, FriendAvailabilityState>();
    const presenceById = new Map(lookup.viewerId ? data.presence?.map((row) => [row.owner_id, row]) : []);
    const favoritePeople = new Set(data.favorites.filter((row) => row.owner_id === lookup.viewerId && row.kind === "friend").map((row) => row.target_id));
    for (const activity of availabilityActivities) {
      const state = friendAvailabilityState(activity, now);
      if (state !== "unknown" && !states.has(activity.owner_id))
        states.set(activity.owner_id, state);
    }
    const next = new Map<string, ClusterMemberArtwork>();
    for (const point of points) {
      if (next.has(point.id)) continue;
      const id = point.id.slice(7),
        profile = point.kind === "person" ? profilesById.get(id) : undefined;
      const activity =
        point.kind === "beacon" ? activitiesById.get(id) : undefined;
      const publicMarker = point.kind === "beacon" && !activity;
      const markerState = activity
        ? beaconMarkerState(data, activity, lookup, now)
        : EMPTY_MARKER_STATE;
      const owned = markerState.owned;
      const presence = profile ? presenceById.get(id) : undefined;
      const availabilityDetail = activeAvailability(presence, availabilityNow);
      const availability = profile ? presence || data.capabilities?.timed_availability ? availabilityDetail?.status === "busy" ? "unavailable" : availabilityDetail ? "available" : "unknown" : (states.get(id) ?? "unknown") : "unknown";
      const relationshipColor = profile ? personMarkerColor(id, lookup) : undefined;
      const readableProfile = !!profile && canViewProfile(data, profile, viewer);
      const visibleLive = presence?.current_activity?.type === "beacon" ? activitiesById.get(presence.current_activity.id) : undefined;
      const personBadges: PersonMarkerBadge[] | undefined = readableProfile ? [
        ...(favoritePeople.has(id) ? ["favorite" as const] : []),
        ...(visibleLive && isBeaconLive(visibleLive, now) ? ["live" as const] : []),
        ...(lookup.interests.some((interest) => matchesSearch(interest, ...(profile?.interests ?? []))) ? ["interest" as const] : []),
        ...(lookup.squadPeople.has(id) ? ["squad" as const] : []),
      ].slice(0, 2) : undefined;
      const age = profile
        ? (formatLocationAge(locationsById.get(id)?.updated_at ?? null, now) ??
          "now")
        : "";
      const label =
        profile?.name ??
        `${activity?.title ?? "Beacon"}${markerStateLabel(markerState) ? `, ${markerStateLabel(markerState)}` : ""}`;
      const category = point.category ?? activity?.category ?? "Other";
      const visualRevision = JSON.stringify([
        point.id,
        category,
        publicMarker,
        owned,
        markerState,
        availability,
        relationshipColor,
        personBadges,
        availabilityDetail,
        profile?.avatar_seed,
        profile?.avatar_style,
        profile?.avatar_updated_at,
        profile?.profile_visibility,
        readableProfile,
        viewer,
      ]);
      const revision = JSON.stringify([visualRevision, label, age]);
      const old = this.previous.get(point.id);
      next.set(
        point.id,
        old?.revision === revision
          ? old
          : {
              id: point.id,
              kind: point.kind,
              publicMarker,
              category,
              label,
              owned,
              markerState,
              profile,
              availability,
              relationshipColor,
              personBadges,
              availabilityDetail,
              age,
              revision,
              visualRevision,
            },
      );
    }
    this.previous = next;
    return next;
  }
}
