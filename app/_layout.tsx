import { useNotificationHandling } from "@/src/platform/notifications";
import React, { useEffect } from "react";
import { setCreationDraftAccount } from "@/src/features/beacons/socialPlanningSession";
import { PreferencesProvider } from "@/src/shared/preferences";
import { useSegments } from "expo-router";
import { Platform } from "react-native";
import { AppSystemBars, SystemBarsProvider } from "@/src/shared/SystemBars";
import { DemoNoticeProvider } from "@/src/shared/design-system";
import { AppNavigation } from "@/src/shared/AppNavigation";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import "react-native-reanimated";
import "@/src/platform/device";
import { BeaconProvider, useBeacon } from "@/src/shared/store";
import { Auth, Onboard } from "@/src/features/auth/Auth";
import { ProfileSurvey } from "@/src/features/profile/ProfileSurvey";
import { Loading, Screen, Action, SheetIsolation, Txt } from "@/src/shared/ui";
import { WidgetPreferencesProvider } from "@/src/features/widgets/preferences";
import { WidgetSync } from "@/src/features/widgets/WidgetRuntime";
import { ExplorationProvider } from "@/src/shared/exploration";
import { ChatKeyboardProvider } from "@/src/features/messages/ChatKeyboard";
export { ErrorBoundary } from "expo-router";
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
  return <AppNavigation />;
}
function AppRuntime() {
  const { userId, demo } = useBeacon();
  useEffect(() => {
    if (Platform.OS !== "web") setCreationDraftAccount(userId);
  }, [userId]);
  return (
    <DemoNoticeProvider
      sessionKey={`${userId ?? "signed-out"}:${demo ? "demo" : "live"}`}
    >
      <ExplorationProvider key={userId ?? "signed-out"}>
        <WidgetPreferencesProvider accountId={userId}>
          <BottomSheetModalProvider>
            <WidgetSync />
            <AppSystemBars />
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
            <SystemBarsProvider>
              <BeaconProvider>
                <AppRuntime />
              </BeaconProvider>
            </SystemBarsProvider>
          </PreferencesProvider>
        </ChatKeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
