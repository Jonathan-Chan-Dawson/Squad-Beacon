import type { MapBounds } from "@/src/shared/exploration";
import type { PulseSummary } from "./types";
import { pulseInBounds, validPulseBounds } from "./bounds";
export function meaningfulPulse(summary: PulseSummary) {
  return (
    (summary.crowd ?? 0) >= 2 ||
    (summary.wait ?? 0) >= 2 ||
    (summary.parking ?? 0) >= 1 ||
    summary.conditions.length > 0
  );
}
export const PULSE_DETAIL_ZOOM = 18;

export function pulseLayerPolicy(
  zoom: number,
  bounds: MapBounds,
  summaries: readonly PulseSummary[],
) {
  const tier =
    zoom < 12
      ? ("far" as const)
      : zoom < PULSE_DETAIL_ZOOM
        ? ("mid" as const)
        : ("close" as const);
  const eligible =
    Number.isFinite(zoom) &&
    zoom >= PULSE_DETAIL_ZOOM &&
    validPulseBounds(bounds)
      ? summaries
          .filter(
            (summary) =>
              summary.freshness >= 0.35 &&
              meaningfulPulse(summary) &&
              pulseInBounds(summary.lat, summary.lng, bounds),
          )
          .sort(
            (a, b) =>
              b.importance * b.freshness - a.importance * a.freshness ||
              a.placeKey.localeCompare(b.placeKey),
          )
      : [];
  // No per-place Pulse decoration at normal or medium zoom.
  const halos: PulseSummary[] = [];
  const badges = tier === "close" ? eligible.slice(0, 20) : [];
  return {
    tier,
    halos,
    badges,
    collapsedCount:
      tier === "close" ? Math.max(0, eligible.length - badges.length) : 0,
  };
}
