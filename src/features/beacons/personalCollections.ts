import type { Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "./beaconModules";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
export type BeaconCollection = "saved" | "friends" | "squads";
export const collectionTitles: Record<BeaconCollection, string> = {
  saved: "Saved Beacons",
  friends: "Favorite Friends",
  squads: "Favorite Squads",
};
/** These are three existing collections, each with its own access policy. */
export function personalCollections(data: Data, viewer: string | null) {
  if (!viewer || data.viewer_id !== viewer)
    return { saved: [], friends: [], squads: [] };
  const savedIds = new Set(
    data.beacon_favorites
      .filter((row) => row.owner_id === viewer)
      .map((row) => row.activity_id),
  );
  const friendIds = new Set(
    data.favorites
      .filter((row) => row.owner_id === viewer && row.kind === "friend")
      .map((row) => row.target_id),
  );
  const squadIds = new Set(
    data.favorites
      .filter((row) => row.owner_id === viewer && row.kind === "squad")
      .map((row) => row.target_id),
  );
  return {
    saved: data.activities.filter(
      (row) => savedIds.has(row.id) && canReadBeaconActivity(data, row, viewer),
    ),
    friends: data.profiles.filter(
      (row) => friendIds.has(row.id) && canViewProfile(data, row, viewer),
    ),
    squads: data.squads.filter(
      (row) =>
        squadIds.has(row.id) && canOpenSquadProfile(data, row.id, viewer),
    ),
  };
}
