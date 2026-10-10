import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import Constants from "expo-constants";
import type { DeviceNotificationState } from "./notificationState.types";
export type { DeviceNotificationState } from "./notificationState.types";
const receiptKey = "beacon-push-registration-viewer";
export async function readDeviceNotificationState(
  viewerId: string,
): Promise<DeviceNotificationState> {
  const [permission, token, receipt] = await Promise.all([
    Notifications.getPermissionsAsync(),
    SecureStore.getItemAsync("beacon-push-token"),
    SecureStore.getItemAsync(receiptKey),
  ]);
  return {
    supported: true,
    physicalDevice: Device.isDevice,
    projectConfigured: !!(
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId
    ),
    permission:
      permission.granted ||
      permission.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL
        ? "granted"
        : permission.status === "denied"
          ? "denied"
          : "undetermined",
    canAskAgain: permission.canAskAgain,
    registration: !token
      ? "none"
      : receipt === viewerId
        ? "verified"
        : "unknown",
  };
}
export async function acknowledgePushRegistration(viewerId: string) {
  await SecureStore.setItemAsync(receiptKey, viewerId, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}
export async function clearPushRegistrationReceipt() {
  await SecureStore.deleteItemAsync(receiptKey);
}
