import type { Category } from "./types";
import type { ExplorationFilters } from "./exploration";

export const BEACON_CATEGORIES: readonly Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];

export function selectedBeaconCategories(
  filters: ExplorationFilters,
): Category[] {
  const selected =
    filters.categories ??
    (filters.category === "All categories" ? [] : [filters.category]);
  return BEACON_CATEGORIES.filter((category) => selected.includes(category));
}

/** Legacy inputs are accepted at the boundary; the stored state has one representation. */
export function normalizeExplorationFilters(
  filters: ExplorationFilters,
): ExplorationFilters {
  return {
    ...filters,
    categories: selectedBeaconCategories(filters),
    category: "All categories",
    happeningNow: filters.happeningNow === true || filters.time === "Now",
    time: filters.time === "Now" ? "All" : filters.time,
  };
}

export function clearQuickDiscoveryFilters(
  filters: ExplorationFilters,
): ExplorationFilters {
  return normalizeExplorationFilters({
    ...filters,
    friendScope: null,
    categories: [],
    category: "All categories",
  });
}

export function resetDiscoveryFilters(): ExplorationFilters {
  return {
    audience: "Everyone",
    categories: [],
    category: "All categories",
    time: "All",
    happeningNow: false,
    friendScope: null,
    personalizedRanking: undefined,
    planId: null,
    when: "Any",
    join: "Any",
    format: "Any",
    starredOnly: false,
  };
}

export function wantsHappeningNow(filters: ExplorationFilters) {
  return filters.happeningNow === true || filters.time === "Now";
}
