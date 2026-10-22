import React from "react";
import { I18nManager } from "react-native";
import { Stack } from "expo-router";
import { useReducedMotion } from "./design-system";
import { useDesignTheme } from "@/src/theme";
import { useSystemBars } from "./SystemBars";
import { pageAnimation } from "./mobilePresentation";
export function AppNavigation() {
  const reduced = useReducedMotion();
  const { colors, resolvedAppearance } = useDesignTheme();
  const { hidden } = useSystemBars();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: pageAnimation(reduced, I18nManager.isRTL),
        gestureEnabled: true,
        statusBarStyle: resolvedAppearance === "dark" ? "light" : "dark",
        statusBarHidden: hidden,
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="create"
        options={{
          presentation: "modal",
          animation: reduced ? "none" : "slide_from_bottom",
          gestureDirection: "vertical",
        }}
      />
      <Stack.Screen
        name="profile/edit"
        options={{
          presentation: "fullScreenModal",
          animation: reduced ? "none" : "slide_from_bottom",
          gestureDirection: "vertical",
        }}
      />
    </Stack>
  );
}
