import { useNotificationHandling } from "@/src/platform/notifications";
import React from "react";
import { PreferencesProvider, usePreferences } from "@/src/shared/preferences";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import "react-native-reanimated";
import "@/src/platform/device";
import { BeaconProvider, useBeacon } from "@/src/shared/store";
import { Auth, Onboard } from "@/src/features/auth/Auth";
import { ProfileSurvey } from "@/src/features/profile/ProfileSurvey";
import { Loading, Screen, Action, SheetIsolation, Txt } from "@/src/shared/ui";
import { DemoNoticeProvider } from "@/src/shared/design-system";
import { WidgetPreferencesProvider } from "@/src/features/widgets/preferences";
import { WidgetSync } from "@/src/features/widgets/WidgetRuntime";
import { ExplorationProvider } from "@/src/shared/exploration";
import { ChatKeyboardProvider } from "@/src/features/messages/ChatKeyboard";
export { ErrorBoundary } from "expo-router";
function ThemedStatusBar() {
  const { resolvedAppearance } = usePreferences();
  return <StatusBar style={resolvedAppearance === "dark" ? "light" : "dark"} />;
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
      <Stack.Screen name="profile/edit" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}
function AppRuntime() {
  const { userId, demo } = useBeacon();
  return (
    <DemoNoticeProvider
      sessionKey={`${userId ?? "signed-out"}:${demo ? "demo" : "live"}`}
    >
      <ExplorationProvider key={userId ?? "signed-out"}>
        <WidgetPreferencesProvider accountId={userId}>
          <BottomSheetModalProvider>
            <WidgetSync />
            <ThemedStatusBar />
            <SheetIsolation>
              <Navigation />
            </SheetIsolation>
          </BottomSheetModalProvider>
        </WidgetPreferencesProvider>
      </ExplorationProvider>
    </DemoNoticeProvider>
  );
}
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ChatKeyboardProvider>
          <PreferencesProvider>
            <BeaconProvider>
              <AppRuntime />
            </BeaconProvider>
          </PreferencesProvider>
        </ChatKeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
