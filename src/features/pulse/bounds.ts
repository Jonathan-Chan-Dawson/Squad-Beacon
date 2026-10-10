import type { MapBounds } from "@/src/shared/exploration";
export function validPulseBounds(
  bounds: MapBounds | null,
): bounds is MapBounds {
  return (
    !!bounds &&
    Object.values(bounds).every(Number.isFinite) &&
    bounds.north >= bounds.south &&
    bounds.north <= 90 &&
    bounds.south >= -90 &&
    Math.abs(bounds.east) <= 180 &&
    Math.abs(bounds.west) <= 180
  );
}
export function pulseInBounds(lat: number, lng: number, bounds: MapBounds) {
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    (bounds.west <= bounds.east
      ? lng >= bounds.west && lng <= bounds.east
      : lng >= bounds.west || lng <= bounds.east)
  );
}
export function pulseBoundsKey(bounds: MapBounds, zoom: number) {
  return (
    [bounds.north, bounds.south, bounds.east, bounds.west]
      .map((value) => value.toFixed(4))
      .join(":") +
    ":" +
    (zoom < 12 ? "far" : zoom < 15 ? "mid" : "close")
  );
}
