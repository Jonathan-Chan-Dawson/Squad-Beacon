export type LocationPermissionState = { supported: boolean; foreground: string; background: string };
export async function readLocationPermissionState(): Promise<LocationPermissionState> { return { supported: false, foreground: "Unavailable on web", background: "Unavailable on web" }; }
export async function requestForegroundLocation(): Promise<void> { throw new Error("Location sharing requires the mobile app."); }
