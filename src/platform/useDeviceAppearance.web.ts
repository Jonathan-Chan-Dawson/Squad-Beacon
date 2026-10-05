import { useSyncExternalStore } from "react";

type DeviceAppearance = "light" | "dark" | "unspecified";
const darkModeQuery = "(prefers-color-scheme: dark)";

function getSnapshot(): DeviceAppearance {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return "unspecified";
  return window.matchMedia(darkModeQuery).matches ? "dark" : "light";
}

function getServerSnapshot(): DeviceAppearance {
  return "unspecified";
}

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return () => {};
  const query = window.matchMedia(darkModeQuery);
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}

export default function useDeviceAppearance(): DeviceAppearance {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
