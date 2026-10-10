import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  parseViewerDeviceDefaults,
  type ViewerDeviceDefaults,
} from "./beaconDefaults";

export type {
  ViewerDeviceDefaults,
  SonarDurationMinutes,
} from "./beaconDefaults";
const writes = new Map<string, Promise<void>>();
const keyFor = (viewerId: string) =>
  `beacon.viewer-defaults.${Array.from(viewerId)
    .map((character) => character.codePointAt(0)!.toString(16))
    .join("-")}`;

export async function readViewerDeviceDefaults(
  viewerId: string,
): Promise<ViewerDeviceDefaults> {
  if (!viewerId) return {};
  const key = keyFor(viewerId);
  const raw =
    Platform.OS === "web"
      ? typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(key)
      : await SecureStore.getItemAsync(key);
  if (!raw) return {};
  try {
    return parseViewerDeviceDefaults(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function writeViewerDeviceDefaults(
  viewerId: string,
  patch: ViewerDeviceDefaults,
): Promise<void> {
  if (!viewerId) throw new Error("Sign in to save device defaults.");
  const previous = writes.get(viewerId) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const current = await readViewerDeviceDefaults(viewerId);
      const value = JSON.stringify(
        parseViewerDeviceDefaults({ ...current, ...patch }),
      );
      const key = keyFor(viewerId);
      if (Platform.OS === "web") {
        if (typeof localStorage === "undefined")
          throw new Error("This browser cannot save device defaults.");
        localStorage.setItem(key, value);
      } else
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
        });
    });
  writes.set(viewerId, next);
  try {
    await next;
  } finally {
    if (writes.get(viewerId) === next) writes.delete(viewerId);
  }
}
