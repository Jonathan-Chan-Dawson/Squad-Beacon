import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { PublicBeaconPreview } from "@/src/features/discovery/PublicBeaconPreview";
import { usePublicBeacons } from "@/src/features/discovery/usePublicBeacons";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { supabase } from "@/src/shared/supabase";
import { WelcomeCard } from "./OnboardingUI";
import {
  finishVisitorWelcome,
  noteVisitorWelcomeSeen,
  visitorWelcomeHandled,
} from "./visitorEntry";

export function GuestBeaconsWelcome() {
  const { semanticColors, styles, tokens } = useTheme();
  const [showWelcome, setShowWelcome] = useState(
    () => !visitorWelcomeHandled(),
  );
  const discovery = usePublicBeacons("");
  useFocusEffect(
    useCallback(() => {
      if (showWelcome) noteVisitorWelcomeSeen();
    }, [showWelcome]),
  );
  const dismiss = () => {
    finishVisitorWelcome();
    setShowWelcome(false);
  };
  return (
    <View style={{ gap: tokens.space.md }}>
      {showWelcome && (
        <View
          testID="visitor-welcome"
          style={{
            backgroundColor: semanticColors.surfaceRaised,
            borderRadius: tokens.radius.card,
            padding: tokens.space.md,
          }}
        >
          <WelcomeCard
            onExplore={dismiss}
            onDismiss={dismiss}
            onTour={() => {
              dismiss();
              router.push({ pathname: "/help", params: { tour: "yes" } });
            }}
          />
        </View>
      )}
      <View testID="visitor-discovery" style={{ gap: tokens.space.sm }}>
        <Text accessibilityRole="header" style={styles.h2}>
          Discover Beacons
        </Text>
        {!supabase || discovery.error ? (
          <>
            <Text accessibilityRole="alert" style={styles.error}>
              Couldn’t load public Beacons.
            </Text>
            <Button
              compact
              secondary
              title="Try again"
              onPress={discovery.refresh}
            />
          </>
        ) : !discovery.ready ? (
          <Txt muted>Finding Beacons…</Txt>
        ) : discovery.rows.length ? (
          <>
            {discovery.rows.slice(0, 3).map((summary) => (
              <PublicBeaconPreview
                key={summary.activity_id}
                summary={summary}
                compact
                adaptiveDiscovery
                hideClose
                onClose={() => {}}
                onJoined={(id) =>
                  router.push({ pathname: "/activity/[id]", params: { id } })
                }
                onDetails={() =>
                  router.push({
                    pathname: "/discover/[id]",
                    params: { id: summary.activity_id },
                  })
                }
              />
            ))}
            <Button
              compact
              secondary
              title="Browse all"
              onPress={() => router.push("/browse-beacons")}
            />
          </>
        ) : (
          <>
            <Txt>Nothing happening here yet.</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button
                compact
                secondary
                title="Search another area"
                onPress={() => router.push("/browse-beacons")}
              />
              <Button
                compact
                secondary
                title="Open Map"
                onPress={() => router.push("/")}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
