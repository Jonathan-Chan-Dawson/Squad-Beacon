import type { Category } from "@/src/shared/types";
import type { ExplorationFilters, MapViewport } from "@/src/shared/exploration";
import { explorationFilterCount } from "@/src/features/maps/filtering";

function longitudeSpan(west: number, east: number) {
  const raw = east - west;
  return Math.abs(raw) >= 360 ? 360 : (raw + 360) % 360;
}

/** Returns the largest center/scale change as a fraction of the old viewport. */
export function viewportChangeRatio(previous: MapViewport, next: MapViewport) {
  const height = Math.max(0.000001, Math.abs(previous.bounds.north - previous.bounds.south));
  const width = Math.max(0.000001, longitudeSpan(previous.bounds.west, previous.bounds.east));
  const latitudeMovement = Math.abs(next.center.latitude - previous.center.latitude) / height;
  const longitudeMovement = Math.abs(((next.center.longitude - previous.center.longitude + 540) % 360) - 180) / width;
  const nextHeight = Math.abs(next.bounds.north - next.bounds.south);
  const nextWidth = longitudeSpan(next.bounds.west, next.bounds.east);
  const scaleChange = Math.max(
    Math.abs(nextHeight / height - 1),
    Math.abs(nextWidth / width - 1),
  );
  return Math.max(latitudeMovement, longitudeMovement, scaleChange);
}

/** Ask for an explicit area search once the camera shifts about a quarter viewport. */
export function shouldSearchNewViewport(
  previous: MapViewport | null,
  next: MapViewport,
  threshold = 0.25,
) {
  return !!previous && viewportChangeRatio(previous, next) >= threshold;
}

export function matchesSelectedCategories(
  category: Category,
  selected: readonly Category[],
) {
  return selected.length === 0 || selected.includes(category);
}

/** Keep a readable selected Beacon in list/preview data even when filters exclude it. */
export function includeSelectedActivity<T extends { id: string }>(
  visible: readonly T[],
  selected: T | null | undefined,
): readonly T[] {
  if (!selected || visible.some((activity) => activity.id === selected.id)) return visible;
  return [...visible, selected];
}

/** Counts each chosen category chip, while all other fields count as one filter. */
export function mapAdvancedFilterCount(
  filters: ExplorationFilters,
  categories: readonly Category[],
) {
  const withoutLegacyCategory = { ...filters, category: "All categories" as const };
  return explorationFilterCount(withoutLegacyCategory) + categories.length;
}

