import type { DeviceNotificationState } from "./notificationState.types";
export type { DeviceNotificationState } from "./notificationState.types";
export async function readDeviceNotificationState(_viewerId: string): Promise<DeviceNotificationState> {
  return { supported: false, physicalDevice: false, projectConfigured: false, permission: "undetermined", canAskAgain: false, registration: "none" };
}
export async function acknowledgePushRegistration(_viewerId: string): Promise<void> {}
export async function clearPushRegistrationReceipt(): Promise<void> {}
