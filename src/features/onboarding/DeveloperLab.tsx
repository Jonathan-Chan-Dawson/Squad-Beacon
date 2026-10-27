import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { usePreferences } from "@/src/shared/preferences";
import { useExploration } from "@/src/shared/exploration";
import { Button, Sheet, Txt } from "@/src/shared/ui";
import { useDesignTheme } from "@/src/shared/design-system";
import { scenarios, type DemoScenario } from "./scenarios";
import { useOnboarding } from "./runtime";
import {
  BeaconIllustration,
  illustrationRegistry,
  type IllustrationKey,
} from "./illustrations";
import { SemanticEmpty } from "./OnboardingUI";
import { DEMO_ID } from "@/src/shared/demo";
import {
  completePlanningDraft,
  startPlanningDraft,
} from "@/src/features/beacons/socialPlanningSession";
import { updateFriendsBrowseState } from "@/src/features/beacons/friendsBrowseSession";

export function DeveloperLab() {
  const { demo, demoScenario, switchDemoScenario } = useBeacon();
  const [open, setOpen] = useState(false);
  const [art, setArt] = useState(false);
  const { colors, tokens } = useDesignTheme();
  const { tone, setTone, quips, setQuips, resetTips } = useOnboarding();
  const { setAppearanceMode } = usePreferences();
  const exploration = useExploration();
  useEffect(() => {
    if (demoScenario === "filtered")
      exploration.setQuery("zz-no-matching-beacon-zz");
    // ExplorationProvider remounts on scenario changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoScenario]);
  if (!__DEV__ || !demo) return null;
  function selectScenario(value: DemoScenario) {
    completePlanningDraft(DEMO_ID, startPlanningDraft(DEMO_ID));
    updateFriendsBrowseState(DEMO_ID, {
      query: "",
      filter: "All",
      listId: null,
    });
    router.replace("/(tabs)/activities");
    switchDemoScenario(value);
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Developer lab: ${scenarios[demoScenario]}`}
        onPress={() => setOpen(true)}
        style={{
          position: "absolute",
          left: 8,
          bottom: 80,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 10,
          minHeight: 32,
          justifyContent: "center",
        }}
      >
        <Text style={{ ...tokens.type.caption, color: colors.textSecondary }}>
          DEV · {scenarios[demoScenario]}
        </Text>
      </Pressable>
      <Sheet
        title="Onboarding developer lab"
        visible={open}
        onClose={() => setOpen(false)}
      >
        <Txt muted>
          Simulated data only. These controls never change live accounts.
        </Txt>
        {(Object.entries(scenarios) as [DemoScenario, string][]).map(
          ([key, title]) => (
            <Button
              key={key}
              secondary
              compact
              title={`Scenario: ${title}`}
              onPress={() => selectScenario(key)}
            />
          ),
        )}
        <Button
          secondary
          title="Reset current scenario"
          onPress={() => selectScenario(demoScenario)}
        />
        <Button secondary title="Reset contextual tips" onPress={resetTips} />
        <Txt>Copy: {tone}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["friendly", "playful", "bro"] as const).map((value) => (
            <Button
              key={value}
              secondary
              compact
              title={`Tone: ${value}`}
              onPress={() => setTone(value)}
            />
          ))}
        </View>
        <Button
          secondary
          title={quips ? "Disable quips" : "Enable quips"}
          onPress={() => setQuips(!quips)}
        />
        <SemanticEmpty name="empty.upcoming" personality density="section" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            secondary
            compact
            title="Preview light"
            onPress={() => setAppearanceMode("light")}
          />
          <Button
            secondary
            compact
            title="Preview dark"
            onPress={() => setAppearanceMode("dark")}
          />
        </View>
        <Button
          secondary
          title="Preview illustrations"
          onPress={() => setArt(!art)}
        />
        {art ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Object.keys(illustrationRegistry).map((name) => (
              <View key={name} style={{ alignItems: "center", width: 140 }}>
                <BeaconIllustration name={name as IllustrationKey} />
                <Txt muted>{name}</Txt>
              </View>
            ))}
          </View>
        ) : null}
        {[
          ["Home", "/(tabs)/activities"],
          ["Map", "/(tabs)"],
          ["Browse", "/browse-beacons"],
          ["Friends", "/friends"],
          ["Squads", "/(tabs)/squads"],
          ["Create", "/create"],
          ["Plans", "/plans"],
          ["Profile", "/(tabs)/profile"],
          ["Calendar", "/calendar"],
          ["Responses", "/responses"],
        ].map(([label, path]) => (
          <Button
            key={label}
            secondary
            compact
            title={`Open ${label}`}
            onPress={() => {
              setOpen(false);
              router.navigate(path as Href);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}
