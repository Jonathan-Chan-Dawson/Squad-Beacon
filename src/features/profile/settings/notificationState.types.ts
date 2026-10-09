export type DeviceNotificationState = {
  supported: boolean;
  physicalDevice: boolean;
  projectConfigured: boolean;
  permission: "granted" | "denied" | "undetermined";
  canAskAgain: boolean;
  registration: "none" | "verified" | "unknown";
};
