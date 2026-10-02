import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { defaultWidgetPreferences, type WidgetPreferences } from "@/src/features/widgets/types";

function keyFor(accountId: string) {
  return `beacon.widgets.${accountId}`;
}

export async function readWidgetPreferences(accountId: string) {
  try {
    const serialized =
      Platform.OS === "web"
        ? localStorage.getItem(keyFor(accountId))
        : await SecureStore.getItemAsync(keyFor(accountId));
    if (!serialized) return defaultWidgetPreferences();
    const parsed = JSON.parse(serialized) as Partial<WidgetPreferences>;
    const defaults = defaultWidgetPreferences();
    return {
      ...defaults,
      ...parsed,
      version: 2,
      circles: { ...defaults.circles, ...parsed.circles },
      privacy:
        parsed.version === 2 && parsed.privacy === "full" ? "full" : "discreet",
      enabled: parsed.version === 2 && parsed.enabled === true,
    } satisfies WidgetPreferences;
  } catch {
    return defaultWidgetPreferences();
  }
}

export async function saveWidgetPreferences(
  accountId: string,
  preferences: WidgetPreferences,
) {
  const serialized = JSON.stringify(preferences);
  if (Platform.OS === "web")
    localStorage.setItem(keyFor(accountId), serialized);
  else await SecureStore.setItemAsync(keyFor(accountId), serialized);
}
