import type { ActivityPlace } from "@/src/shared/types";
import type { PulsePlace, PulseSummary } from "@/src/features/pulse/types";
import { pulseAreaKey } from "@/src/features/pulse/validation";
import { pulseCopy } from "@/src/features/pulse/copy/pulse";

export type ProjectedPulse = {
  summary: PulseSummary;
  x: number;
  y: number;
  satellite: boolean;
};
/** A separate screen-space pass: these summaries never enter Beacon clustering. */
export function collidePulseBadges(
  points: readonly ProjectedPulse[],
  width: number,
  height: number,
) {
  const selected: ProjectedPulse[] = [];
  for (const point of [...points].sort(
    (a, b) =>
      b.summary.importance * b.summary.freshness -
        a.summary.importance * a.summary.freshness ||
      a.summary.placeKey.localeCompare(b.summary.placeKey),
  )) {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > width ||
      point.y > height
    )
      continue;
    if (
      selected.some(
        (other) =>
          Math.hypot(point.x - other.x, point.y - other.y) <
          (point.satellite ? 12 : 16) + (other.satellite ? 12 : 16),
      )
    )
      continue;
    selected.push(point);
  }
  return selected;
}
export function nearPulsePlace(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const longitude = ((a.lng - b.lng + 540) % 360) - 180;
  return (
    Math.hypot(
      (a.lat - b.lat) * 111320,
      longitude * 111320 * Math.cos((a.lat * Math.PI) / 180),
    ) <= 35
  );
}
/** Only pass already authorized meeting places. Matching conveys no access. */
export function pulseHasBeacon(
  summary: PulseSummary,
  places: readonly ActivityPlace[],
) {
  return places.some(
    (place) =>
      place.online_url == null &&
      place.latitude != null &&
      place.longitude != null &&
      nearPulsePlace(summary, { lat: place.latitude, lng: place.longitude }),
  );
}
export function savedPulsePlace(place: ActivityPlace): PulsePlace | null {
  if (
    place.online_url != null ||
    place.latitude == null ||
    place.longitude == null
  )
    return null;
  // ActivityPlace has no venue/provider ID. Keep named venues distinct even in
  // the same geohash cell; an area key is reserved for unnamed long presses.
  const label = place.label.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  let hash = 2166136261;
  for (const character of label)
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  return {
    placeKey: `saved:${place.latitude.toFixed(6)}:${place.longitude.toFixed(6)}:${(hash >>> 0).toString(16)}`,
    name: place.label,
    lat: place.latitude,
    lng: place.longitude,
    category: "unknown",
  };
}
export function areaPulsePlace(lat: number, lng: number): PulsePlace {
  return {
    placeKey: pulseAreaKey(lat, lng),
    name: pulseCopy.areaUpdate,
    lat,
    lng,
    category: "area",
    isArea: true,
  };
}
export function summaryPulsePlace(
  summary: PulseSummary,
  known: readonly PulsePlace[],
): PulsePlace {
  const exact = known.find((place) => place.placeKey === summary.placeKey);
  const nearbyName = known.find((place) =>
    nearPulsePlace(place, summary),
  )?.name;
  return {
    placeKey: summary.placeKey,
    name:
      exact?.name ??
      nearbyName ??
      (summary.placeKey.startsWith("area:")
        ? pulseCopy.areaUpdate
        : pulseCopy.liveUpdate),
    lat: summary.lat,
    lng: summary.lng,
    category: summary.category,
    isArea: summary.placeKey.startsWith("area:"),
  };
}
