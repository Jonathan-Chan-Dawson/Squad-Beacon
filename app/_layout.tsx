import { useNotificationHandling } from "@/src/platform/notifications";
import React, { useEffect } from "react";
import { setCreationDraftAccount } from "@/src/features/beacons/socialPlanningSession";
import { PreferencesProvider } from "@/src/shared/preferences";
import { useSegments, usePathname, useGlobalSearchParams } from "expo-router";
import { rememberEntryIntent } from "@/src/features/auth/entryIntent";
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
import { accountReadiness } from "@/src/shared/accountReadiness";
import { Loading, Screen, Action, SheetIsolation, Txt } from "@/src/shared/ui";
import { WidgetPreferencesProvider } from "@/src/features/widgets/preferences";
import { WidgetSync } from "@/src/features/widgets/WidgetRuntime";
import { ExplorationProvider } from "@/src/shared/exploration";
import { OnboardingProvider } from "@/src/features/onboarding/runtime";
import { FirstSuccessNotice } from "@/src/features/onboarding/OnboardingUI";
import { ChatKeyboardProvider } from "@/src/features/messages/ChatKeyboard";
// Keep lab controls out of production dependency graphs.
const DeveloperLab = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/src/features/onboarding/DeveloperLab").DeveloperLab
  : () => null;
export { ErrorBoundary } from "expo-router";
function Navigation() {
  const account = useBeacon(),
    segments = useSegments();
  const { userId, viewerEpoch, error, refresh } = account;
  const readiness = accountReadiness(account);
  const pathname = usePathname();
  const query = JSON.stringify(useGlobalSearchParams());
  useEffect(() => {
    // Capture incoming routes, not readiness changes caused by sign-out.
    rememberEntryIntent(pathname, JSON.parse(query));
  }, [pathname, query]);
  useNotificationHandling(readiness.state === "ready", refresh);
  const publicRoute =
    segments[0] === "auth" ||
    segments[0] === "legal" ||
    pathname.startsWith("/g/") ||
    segments[0] === "invite";
  if (!publicRoute) {
    if (readiness.state === "loading") return <Loading />;
    if (readiness.state === "signed-out") return <Auth />;
    if (readiness.state === "unavailable")
      return (
        <Screen title="Let’s reconnect." eyebrow="CONNECTION" create={false}>
          <Txt>
            {error ??
              "Your account is not ready yet. Retry to load your profile."}
          </Txt>
          <Action title="Retry" run={refresh} />
        </Screen>
      );
    if (readiness.state === "needs-profile")
      return <Onboard key={`${userId}:${viewerEpoch}`} />;
  }
  return <AppNavigation />;
}
function AppRuntime() {
  const { userId, demo, viewerEpoch } = useBeacon();
  useEffect(() => {
    if (Platform.OS !== "web") setCreationDraftAccount(userId);
  }, [userId]);
  return (
    <DemoNoticeProvider
      sessionKey={`${userId ?? "signed-out"}:${demo ? "demo" : "live"}`}
    >
      <OnboardingProvider>
        <ExplorationProvider key={`${userId}:${demo}:${viewerEpoch}`}>
          <WidgetPreferencesProvider accountId={userId}>
            <BottomSheetModalProvider>
              <WidgetSync />
              <AppSystemBars />
              <SheetIsolation>
                <Navigation />
                <FirstSuccessNotice />
                {__DEV__ && demo ? <DeveloperLab /> : null}
              </SheetIsolation>
            </BottomSheetModalProvider>
          </WidgetPreferencesProvider>
        </ExplorationProvider>
      </OnboardingProvider>
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
