import { useNotificationHandling } from "@/src/platform/notifications";
import React, { useEffect, useRef } from "react";
import { setCreationDraftAccount } from "@/src/features/beacons/socialPlanningSession";
import { PreferencesProvider } from "@/src/shared/preferences";
import {
  router,
  usePathname,
  useGlobalSearchParams,
  useRootNavigationState,
} from "expo-router";
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
import { AccountGate } from "@/src/features/auth/AccountGate";
import "@/src/features/auth/entryIntentStorage";
import { accountReadiness } from "@/src/shared/accountReadiness";
import { SheetIsolation } from "@/src/shared/ui";
import { WidgetPreferencesProvider } from "@/src/features/widgets/preferences";
import { WidgetSync } from "@/src/features/widgets/WidgetRuntime";
import { ExplorationProvider } from "@/src/shared/exploration";
import { OnboardingProvider } from "@/src/features/onboarding/runtime";
import { reserveFirstVisitorEntry } from "@/src/features/onboarding/visitorEntry";
import { FirstSuccessNotice } from "@/src/features/onboarding/OnboardingUI";
import { ChatKeyboardProvider } from "@/src/features/messages/ChatKeyboard";
// Keep lab controls out of production dependency graphs.
const DeveloperLab = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/src/features/onboarding/DeveloperLab").DeveloperLab
  : () => null;
export { ErrorBoundary } from "expo-router";
function Navigation({
  startupDecidedRef,
}: {
  startupDecidedRef: React.RefObject<boolean>;
}) {
  const account = useBeacon();
  const { refresh } = account;
  const readiness = accountReadiness(account);
  const pathname = usePathname();
  const query = JSON.stringify(useGlobalSearchParams());
  const navigationKey = useRootNavigationState()?.key;
  useEffect(() => {
    if (!navigationKey || startupDecidedRef.current) return;
    if (pathname !== "/" || query !== "{}") {
      startupDecidedRef.current = true;
      return;
    }
    if (readiness.state === "loading") return;
    startupDecidedRef.current = true;
    if (readiness.state === "ready") reserveFirstVisitorEntry();
    if (readiness.state === "signed-out" && reserveFirstVisitorEntry())
      router.replace("/activities");
  }, [navigationKey, pathname, query, readiness.state, startupDecidedRef]);
  useEffect(() => {
    // Capture incoming routes, not readiness changes caused by sign-out.
    rememberEntryIntent(pathname, JSON.parse(query));
  }, [pathname, query]);
  useNotificationHandling(readiness.state === "ready", refresh);
  return <AppNavigation renderScreen={renderAccountScreen} />;
}
function renderAccountScreen(name: string, children: React.ReactNode) {
  // Initialize tab routes before gating their individual screens.
  return name === "(tabs)" ? (
    <>{children}</>
  ) : (
    <AccountGate name={name}>{children}</AccountGate>
  );
}
function AppRuntime() {
  const { userId, demo, viewerEpoch } = useBeacon();
  const startupDecidedRef = useRef(false);
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
                <Navigation startupDecidedRef={startupDecidedRef} />
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
