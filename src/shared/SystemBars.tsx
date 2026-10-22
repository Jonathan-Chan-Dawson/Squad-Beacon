import React from "react";
import { StatusBar } from "expo-status-bar";
import { usePreferences } from "./preferences";

// Web keeps its existing presentation; system-bar requests are native-only.
export function SystemBarsProvider({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}
export function AppSystemBars() {
  const { resolvedAppearance } = usePreferences();
  return <StatusBar style={resolvedAppearance === "dark" ? "light" : "dark"} />;
}
export function ImmersiveStatusBar() {
  return null;
}
export function useImmersiveStatusBar(_hidden = false) {}
export function useSystemBars() {
  return { hidden: false };
}
