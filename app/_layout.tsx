import { useNotificationHandling } from "@/src/platform/notifications";
import React from "react";
import { PreferencesProvider, usePreferences } from "@/src/shared/preferences";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";
import "@/src/platform/device";
import { BeaconProvider, useBeacon } from "@/src/shared/store";
import { Auth, Onboard } from "@/src/features/auth/Auth";
import { ProfileSurvey } from "@/src/features/profile/ProfileSurvey";
import { Loading, Screen, Action, Txt } from "@/src/shared/ui";
import { WidgetPreferencesProvider } from "@/src/features/widgets/preferences";
import { WidgetSync } from "@/src/features/widgets/WidgetRuntime";
export { ErrorBoundary } from "expo-router";
function ThemedStatusBar() {
  const { theme } = usePreferences();
  return <StatusBar style={theme === "Midnight" ? "light" : "dark"} />;
}
function Navigation() {
  const { userId, loading, data, error, refresh } = useBeacon(),
    segments = useSegments();
  useNotificationHandling(
    !!userId &&
      !loading &&
      !error &&
      data.profiles.some((p) => p.id === userId),
    refresh,
  );
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
    const profile = data.profiles.find((p) => p.id === userId)!;
    if (profile.onboarding_survey_status === "pending")
      return <ProfileSurvey profile={profile} activities={data.activities} />;
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create" options={{ presentation: "modal" }} />
    </Stack>
  );
}
function AppRuntime() {
  const { userId } = useBeacon();
  return (
    <WidgetPreferencesProvider accountId={userId}>
      <WidgetSync />
      <ThemedStatusBar />
      <Navigation />
    </WidgetPreferencesProvider>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <BeaconProvider>
          <AppRuntime />
        </BeaconProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
