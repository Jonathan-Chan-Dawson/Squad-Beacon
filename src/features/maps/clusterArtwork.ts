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
import { markerIdentity, ownsMapBeacon } from "./markerIdentity";
import { formatLocationAge, type ClusterPoint } from "./cluster";

export type ClusterMemberArtwork = {
  id: string;
  kind: ClusterPoint["kind"];
  category: Category;
  label: string;
  owned: boolean;
  identity: ReturnType<typeof markerIdentity>;
  profile?: Profile;
  availability: FriendAvailabilityState;
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
  ) {
    const activitiesById = new Map(activities.map((row) => [row.id, row]));
    const profilesById = new Map(profiles.map((row) => [row.id, row]));
    const locationsById = new Map(locations.map((row) => [row.owner_id, row]));
    const states = new Map<string, FriendAvailabilityState>();
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
      const owned = !!activity && ownsMapBeacon(data, activity, viewer);
      const identity = activity ? markerIdentity(data, activity, viewer) : null;
      const availability = profile ? (states.get(id) ?? "unknown") : "unknown";
      const age = profile
        ? (formatLocationAge(locationsById.get(id)?.updated_at ?? null, now) ??
          "now")
        : "";
      const label = profile?.name ?? activity?.title ?? "Beacon";
      const category = point.category ?? activity?.category ?? "Other";
      const visualRevision = JSON.stringify([
        point.id,
        category,
        owned,
        identity,
        availability,
        profile?.avatar_seed,
        profile?.avatar_style,
        profile?.avatar_updated_at,
        profile?.profile_visibility,
        profile ? canViewProfile(data, profile, viewer) : false,
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
              category,
              label,
              owned,
              identity,
              profile,
              availability,
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
