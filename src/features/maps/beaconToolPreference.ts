import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { SheetTool } from "./BeaconPanelNavigation";

// Device UI preference only, scoped to the viewer and Beacon. Never part of shared data.
const cache = new Map<string, SheetTool>();
const keyFor = (viewer: string, beacon: string) =>
  `beacon.tool.${encodeURIComponent(viewer).replace(/%/g, "_")}.${encodeURIComponent(beacon).replace(/%/g, "_")}`;
export async function readBeaconTool(viewer: string, beacon: string) {
  const key = keyFor(viewer, beacon);
  if (cache.has(key)) return cache.get(key);
  try {
    const value =
      Platform.OS === "web"
        ? localStorage.getItem(key)
        : await SecureStore.getItemAsync(key);
    if (
      value &&
      [
        "checklist",
        "focus",
        "scoreboard",
        "teams",
        "journal",
        "experiences",
        "music",
        "decision",
      ].includes(value)
    ) {
      cache.set(key, value as SheetTool);
      return value as SheetTool;
    }
  } catch {
    /* Storage unavailable: selection still works in this session. */
  }
}
export function rememberBeaconTool(
  viewer: string,
  beacon: string,
  tool: SheetTool,
) {
  const key = keyFor(viewer, beacon);
  cache.set(key, tool);
  try {
    if (Platform.OS === "web") localStorage.setItem(key, tool);
    else void SecureStore.setItemAsync(key, tool).catch(() => {});
  } catch {
    /* Keep the in-memory preference. */
  }
}
