import type { PublicBeaconSummary } from "@/src/features/discovery/types";
import type { Category } from "@/src/shared/types";
import {
  matchesExplorationArea,
  type ExplorationFilters,
  type MapViewport,
} from "@/src/shared/exploration";
import { matchesWhen } from "./filtering";
import { matchesSelectedCategories } from "./mapUIselectors";

/** Public cards have coarse areas, never Activity places or people coordinates. */
export function publicMapBeacons(
  rows: readonly PublicBeaconSummary[],
  filters: ExplorationFilters,
  categories: Category[],
  existingIds: string[],
  hasContext: boolean,
  viewport: MapViewport | null,
  now: number,
) {
  if (
    hasContext ||
    (filters.audience !== "Everyone" && filters.audience !== "Public") ||
    filters.planId ||
    filters.starredOnly ||
    (filters.format && !["Any", "Physical"].includes(filters.format)) ||
    (filters.join &&
      !["Any", "Open", "Request Approval", "Spots Available"].includes(
        filters.join,
      ))
  )
    return [];
  return rows
    .filter((row) => {
      if (
        row.closed ||
        Date.parse(row.ends_at) <= now ||
        row.coarse_lat === null ||
        row.coarse_lng === null ||
        existingIds.includes(row.activity_id)
      )
        return false;
      if (
        (filters.join === "Open" && row.requires_approval) ||
        (filters.join === "Request Approval" && !row.requires_approval)
      )
        return false;
      if (
        (filters.category !== "All categories" &&
          row.category !== filters.category) ||
        !matchesSelectedCategories(row.category, categories)
      )
        return false;
      if (!matchesWhen({ ...row, timezone: "" }, filters.when, now))
        return false;
      if (
        (filters.time === "Now" && Date.parse(row.starts_at) > now) ||
        (filters.time === "Upcoming" && Date.parse(row.starts_at) <= now)
      )
        return false;
      return (
        !viewport ||
        matchesExplorationArea(
          {
            kind: "viewport",
            label: "Visible area",
            coordinate: viewport.center,
            zoom: viewport.zoom,
            bounds: viewport.bounds,
          },
          { latitude: row.coarse_lat, longitude: row.coarse_lng },
        )
      );
    })
    .slice(0, 8);
}
