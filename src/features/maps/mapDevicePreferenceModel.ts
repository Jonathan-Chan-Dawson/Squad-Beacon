import { isValidCoordinate, type MapViewport } from "@/src/shared/exploration";
import type { MapStyle } from "./components/BeaconMap";
export type MapDevicePreferences = {
  liveUpdates: boolean;
  showFriends: boolean;
  style: MapStyle;
  camera?: MapViewport;
  hintsSeen: number;
};
export const defaultMapDevicePreferences: MapDevicePreferences = {
  liveUpdates: true,
  showFriends: true,
  style: "standard",
  hintsSeen: 0,
};
export function parseMapDevicePreferences(
  value: unknown,
): MapDevicePreferences {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const camera = row.camera as MapViewport | undefined;
  const validCamera =
    camera &&
    camera.center &&
    isValidCoordinate(camera.center) &&
    Number.isFinite(camera.zoom) &&
    camera.zoom >= 0 &&
    camera.zoom <= 20 &&
    camera.bounds &&
    Object.values(camera.bounds).every(Number.isFinite) &&
    camera.bounds.north <= 90 &&
    camera.bounds.south >= -90 &&
    camera.bounds.north >= camera.bounds.south &&
    Math.abs(camera.bounds.east) <= 180 &&
    Math.abs(camera.bounds.west) <= 180;
  return {
    liveUpdates: row.liveUpdates !== false,
    showFriends: row.showFriends !== false,
    style: row.style === "satellite" ? "satellite" : "standard",
    hintsSeen:
      typeof row.hintsSeen === "number" && Number.isFinite(row.hintsSeen)
        ? Math.max(0, Math.min(3, Math.floor(row.hintsSeen)))
        : 0,
    ...(validCamera ? { camera } : {}),
  };
}
