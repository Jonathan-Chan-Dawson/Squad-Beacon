import React from "react";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";
import "@/src/device";
import { BeaconProvider, useBeacon } from "@/src/store";
import { Auth, Onboard } from "@/src/Auth";
import { Loading, Screen, Action, Txt } from "@/src/ui";
export { ErrorBoundary } from "expo-router";
function Navigation() {
  const { userId, loading, data, error, refresh } = useBeacon(),
    segments = useSegments();
  const publicRoute =
    segments[0] === "auth" ||
    segments[0] === "legal" ||
    segments[0] === "invite";
  if (!publicRoute) {
    if (loading) return <Loading />;
    if (!userId) return <Auth />;
    if (error)
      return (
        <Screen title="Let’s reconnect." eyebrow="CONNECTION" create={false}>
          <Txt>{error}</Txt>
          <Action title="Retry" run={refresh} />
        </Screen>
      );
    if (!data.profiles.some((p) => p.id === userId)) return <Onboard />;
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create" options={{ presentation: "modal" }} />
    </Stack>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BeaconProvider>
        <StatusBar style="dark" />
        <Navigation />
      </BeaconProvider>
    </SafeAreaProvider>
  );
}
