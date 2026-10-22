import React from "react";
import { Stack } from "expo-router";
export function AppNavigation() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create" options={{ presentation: "modal" }} />
      <Stack.Screen
        name="profile/edit"
        options={{ presentation: "fullScreenModal" }}
      />
    </Stack>
  );
}
