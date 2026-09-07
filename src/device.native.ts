import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { rpc } from "./supabase";
const TASK = "beacon-temporary-location",
  KEY = "beacon-location-session",
  PUSH = "beacon-push-token";
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
TaskManager.defineTask(TASK, async ({ data, error }) => {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) {
    await stopDeviceLocation();
    return;
  }
  const session = JSON.parse(raw) as { id: string; expires_at: string };
  if (Date.parse(session.expires_at) <= Date.now()) {
    await stopDeviceLocation();
    return;
  }
  if (error) return; // The server marks old points stale even if the OS stops delivering updates.
  const locations = (data as { locations?: Location.LocationObject[] })
    ?.locations;
  const point = locations?.at(-1);
  if (!point || Date.now() - point.timestamp > 60000) return;
  try {
    await rpc("update_location", {
      id: session.id,
      latitude: point.coords.latitude,
      longitude: point.coords.longitude,
    });
  } catch {
    /* Never queue coordinates for later replay. */
  }
});
export async function startDeviceLocation(session: {
  id: string;
  expires_at: string;
}) {
  if (!(await TaskManager.isAvailableAsync()))
    throw new Error("Use a development build to share location.");
  if ((await Location.requestForegroundPermissionsAsync()).status !== "granted")
    throw new Error("Location permission was not granted.");
  if ((await Location.requestBackgroundPermissionsAsync()).status !== "granted")
    throw new Error(
      "Allow background location to share while the app is closed.",
    );
  await stopDeviceLocation();
  await SecureStore.setItemAsync(KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await rpc("update_location", {
      id: session.id,
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    });
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 45000,
      distanceInterval: 50,
      deferredUpdatesInterval: 45000,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Squad Beacon location sharing",
        notificationBody:
          "Sharing temporarily with your selected friends. Open Squad Beacon to stop.",
        killServiceOnDestroy: true,
      },
    });
    expiryTimer = setTimeout(
      () => {
        void stopDeviceLocation();
      },
      Math.max(0, Date.parse(session.expires_at) - Date.now()),
    );
  } catch (error) {
    await stopDeviceLocation();
    throw error;
  }
}
export async function stopDeviceLocation() {
  if (expiryTimer) clearTimeout(expiryTimer);
  await SecureStore.deleteItemAsync(KEY);
  if (
    (await TaskManager.isAvailableAsync()) &&
    (await Location.hasStartedLocationUpdatesAsync(TASK))
  )
    await Location.stopLocationUpdatesAsync(TASK);
}
export async function enablePush() {
  if (!Device.isDevice)
    throw new Error("Use a physical phone for push notifications.");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Activities and reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  if ((await Notifications.requestPermissionsAsync()).status !== "granted")
    throw new Error("Notification permission was not granted.");
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error("Configure the EAS project ID before enabling push.");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await rpc("register_push", { token });
  await SecureStore.setItemAsync(PUSH, token);
}
export async function clearPush() {
  const token = await SecureStore.getItemAsync(PUSH);
  if (token) {
    await rpc("unregister_push", { token });
    await SecureStore.deleteItemAsync(PUSH);
  }
}
