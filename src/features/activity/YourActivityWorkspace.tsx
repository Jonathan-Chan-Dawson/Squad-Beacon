import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import YourBeacons from "@/src/features/beacons/screens/YourActivityScreen";
import PlansScreen from "@/src/features/plans/PlansScreen";
import CalendarScreen from "@/src/features/beacons/screens/CalendarScreen";
import { ActivityEmbedded } from "./ActivityFrame";

export type ActivityTab = "beacons" | "plans" | "calendar";
export function activityTab(
  value: unknown,
  fallback: ActivityTab,
): ActivityTab {
  return value === "beacons" || value === "plans" || value === "calendar"
    ? value
    : fallback;
}
export default function YourActivityWorkspace({
  initialTab = "beacons",
}: {
  initialTab?: ActivityTab;
}) {
  const { userId, demo, viewerEpoch } = useBeacon();
  return (
    <Workspace
      key={`${userId}:${demo}:${viewerEpoch}`}
      initialTab={initialTab}
    />
  );
}
function Workspace({ initialTab }: { initialTab: ActivityTab }) {
  const params = useLocalSearchParams();
  const selected = activityTab(params.tab, initialTab);
  const [visited, setVisited] = useState<ActivityTab[]>([selected]);
  if (!visited.includes(selected))
    setVisited((current) => [...current, selected]);
  const { semanticColors: c, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const tabs = ["beacons", "plans", "calendar"] as const;
  const change = (tab: ActivityTab) => router.setParams({ tab });
  return (
    <View
      testID="your-activity-workspace"
      style={{ flex: 1, backgroundColor: c.bg }}
    >
      <View
        style={{
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: tokens.layout.screenGutter,
            minHeight: 48,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selected === "beacons" ? "Back to Beacons" : "Back"
            }
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/activities")
            }
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <ArrowLeft size={22} color={c.textPrimary} />
          </Pressable>
          <Text
            testID="your-activity-header"
            accessibilityRole="header"
            style={{ color: c.textPrimary, ...tokens.type.titleSmall }}
          >
            Your Activity
          </Text>
        </View>
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            paddingHorizontal: tokens.layout.screenGutter,
          }}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              aria-selected={selected === tab}
              accessibilityState={{ selected: selected === tab }}
              onPress={() => change(tab)}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderBottomWidth: 3,
                borderBottomColor: selected === tab ? c.accent : "transparent",
                paddingHorizontal: 4,
              }}
            >
              <Text
                style={{
                  color: selected === tab ? c.accent : c.textSecondary,
                  ...tokens.type.secondary,
                  fontWeight: selected === tab ? "700" : "500",
                }}
              >
                {tab === "beacons"
                  ? "Beacons"
                  : tab === "plans"
                    ? "Plans"
                    : "Calendar"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ActivityEmbedded.Provider value>
        {tabs
          .filter((tab) => visited.includes(tab) || selected === tab)
          .map((tab) => (
            <View
              key={tab}
              accessibilityElementsHidden={selected !== tab}
              importantForAccessibility={
                selected === tab ? "auto" : "no-hide-descendants"
              }
              style={{ flex: 1, display: selected === tab ? "flex" : "none" }}
            >
              {tab === "beacons" ? (
                <YourBeacons />
              ) : tab === "plans" ? (
                <PlansScreen />
              ) : (
                <CalendarScreen />
              )}
            </View>
          ))}
      </ActivityEmbedded.Provider>
    </View>
  );
}
