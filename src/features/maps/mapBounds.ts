import type { MapBounds } from "@/src/shared/exploration";
/** Normalize provider coordinates without losing dateline or whole-world views. */
export function providerMapBounds(
  north: number,
  south: number,
  east: number,
  west: number,
): MapBounds {
  const wholeWorld = Math.abs(east - west) >= 360;
  const wrap = (value: number) => ((value + 540) % 360) - 180;
  return {
    north: Math.min(90, north),
    south: Math.max(-90, south),
    east: wholeWorld ? 180 : wrap(east),
    west: wholeWorld ? -180 : wrap(west),
  };
}
