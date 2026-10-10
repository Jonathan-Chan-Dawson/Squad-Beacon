import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  parseMapDevicePreferences,
  type MapDevicePreferences,
} from "./mapDevicePreferenceModel";
export {
  parseMapDevicePreferences,
  defaultMapDevicePreferences,
} from "./mapDevicePreferenceModel";
export type { MapDevicePreferences } from "./mapDevicePreferenceModel";
const key = "beacon.map-device.v2";
const writes = { current: Promise.resolve() };
export async function readMapDevicePreferences() {
  const raw =
    Platform.OS === "web"
      ? typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(key)
      : await SecureStore.getItemAsync(key);
  try {
    return parseMapDevicePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return parseMapDevicePreferences(null);
  }
}
export async function writeMapDevicePreferences(
  patch: Partial<MapDevicePreferences>,
) {
  const task = writes.current
    .catch(() => {})
    .then(async () => {
      const value = JSON.stringify(
        parseMapDevicePreferences({
          ...(await readMapDevicePreferences()),
          ...patch,
        }),
      );
      if (Platform.OS === "web") {
        if (typeof localStorage !== "undefined")
          localStorage.setItem(key, value);
      } else await SecureStore.setItemAsync(key, value);
    });
  writes.current = task;
  await task;
}
