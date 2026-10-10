export const PLACE_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "gym",
  "court",
  "field",
  "recreation",
  "parking",
  "trail",
  "park",
  "library",
  "study",
  "unknown",
  "area",
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];
export function isPlaceCategory(value: unknown): value is PlaceCategory {
  return (
    typeof value === "string" &&
    (PLACE_CATEGORIES as readonly string[]).includes(value)
  );
}
/** Use provider type metadata, never the place name or viewer information. */
export function classifyPlaceCategory(
  types: readonly string[] = [],
): PlaceCategory {
  const tokens = types.map((type) => type.toLowerCase());
  const rules: [PlaceCategory, string[]][] = [
    ["parking", ["parking", "parking_lot"]],
    ["cafe", ["cafe", "coffee_shop"]],
    ["bar", ["bar", "pub"]],
    ["restaurant", ["restaurant", "food_court"]],
    ["gym", ["gym", "fitness_center"]],
    ["court", ["tennis_court", "basketball_court", "sports_court"]],
    ["field", ["athletic_field", "soccer_field"]],
    ["recreation", ["recreation_center", "sports_complex"]],
    ["trail", ["hiking_area", "hiking_trail"]],
    ["park", ["park", "national_park"]],
    ["library", ["library"]],
    ["study", ["study_space", "coworking_space"]],
  ];
  return (
    rules.find(([, values]) =>
      values.some((value) => tokens.includes(value)),
    )?.[0] ?? "unknown"
  );
}
