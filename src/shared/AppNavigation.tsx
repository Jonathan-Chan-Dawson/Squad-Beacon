import React, { useMemo } from "react";
import { Stack } from "expo-router";
export function AppNavigation({
  renderScreen,
}: {
  renderScreen?: (name: string, children: React.ReactNode) => React.ReactNode;
}) {
  const screenLayout = useMemo<
    React.ComponentProps<typeof Stack>["screenLayout"]
  >(
    () =>
      renderScreen
        ? ({ route, children }) => <>{renderScreen(route.name, children)}</>
        : undefined,
    [renderScreen],
  );
  return (
    <Stack screenOptions={{ headerShown: false }} screenLayout={screenLayout}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create" options={{ presentation: "modal" }} />
      <Stack.Screen
        name="profile/edit"
        options={{ presentation: "fullScreenModal" }}
      />
    </Stack>
  );
}
