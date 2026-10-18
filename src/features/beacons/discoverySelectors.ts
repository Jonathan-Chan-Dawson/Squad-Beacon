import type { Activity, Data } from "@/src/shared/types";
import { browseBeacons } from "@/src/shared/browsing";
import {
  matchesExplorationArea,
  type ExplorationArea,
  type ExplorationFilters,
} from "@/src/shared/exploration";
import { canReadBeaconActivity } from "./beaconModules";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import { matchesBeaconFilters } from "@/src/features/maps/filtering";
import { matchesSelectedCategories } from "@/src/features/maps/mapUIselectors";
import { isHubActivityStarted } from "./hubSelectors";

/** Discovery search only receives meeting fields the viewer is allowed to read. */
export function discoveryActivities(
  data: Data,
  userId: string | null,
  now: number,
  period: "Active" | "Upcoming",
  query: string,
  filters: ExplorationFilters,
  area: ExplorationArea | null,
) {
  if (!userId || data.viewer_id !== userId) return [] as Activity[];
  if (
    (filters.time === "Now" && period === "Upcoming") ||
    (filters.time === "Upcoming" && period === "Active")
  )
    return [];
  const places = data.places.filter((place) =>
    canViewBeaconMeetingDetails(data, place.activity_id, userId),
  );
  const safeData = { ...data, places };
  const categories =
    filters.categories ??
    (filters.category === "All categories" ? [] : [filters.category]);
  return browseBeacons(
    safeData,
    userId,
    {
      period,
      sort: "Soonest",
      query,
      category: "All categories",
      audience: filters.audience === "Public" ? "public" : filters.audience,
      joined: filters.join === "I'm In",
    },
    now,
  )
    .filter(
      (activity) =>
        activity.mode !== "solo" &&
        canReadBeaconActivity(data, activity, userId) &&
        isHubActivityStarted(activity),
    )
    .filter((activity) =>
      matchesSelectedCategories(activity.category, categories),
    )
    .filter(
      (activity) => !filters.planId || activity.plan_id === filters.planId,
    )
    .filter((activity) =>
      matchesBeaconFilters(safeData, activity, userId, filters, now, {
        includeBaseFilters: false,
        query,
      }),
    )
    .filter((activity) => {
      const place = places.find((row) => row.activity_id === activity.id);
      const coordinate =
        place?.online_url == null &&
        place?.latitude != null &&
        place.longitude != null
          ? { latitude: place.latitude, longitude: place.longitude }
          : null;
      return !!place?.online_url || matchesExplorationArea(area, coordinate);
    });
}
