import * as Location from "expo-location";
import type { LocationPermissionState } from "./locationPermissions";
export type { LocationPermissionState } from "./locationPermissions";
export async function readLocationPermissionState(): Promise<LocationPermissionState> {
  const [foreground, background] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);
  return { supported: true, foreground: foreground.status, background: background.status };
}
/** Only called from the explicit Settings button; never starts a location session. */
export async function requestForegroundLocation() {
  if (!(await Location.requestForegroundPermissionsAsync()).granted) throw new Error("Location permission was not granted.");
}
