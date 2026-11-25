import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { PublicBeaconPreview } from "@/src/features/discovery/PublicBeaconPreview";
import { usePublicBeacons } from "@/src/features/discovery/usePublicBeacons";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { supabase } from "@/src/shared/supabase";
import { openGuestEntry } from "@/src/features/auth/guestEntry";
import { SectionTutorial } from "./SectionTutorial";

export function GuestBeaconsWelcome() {
  const { styles, tokens } = useTheme();
  const discovery = usePublicBeacons("");
  return (
    <View style={{ gap: tokens.space.md }}>
      <SectionTutorial item="welcome" />
      <View style={[styles.card, { gap: tokens.space.sm }]}>
        <Text accessibilityRole="header" style={styles.h2}>Good things happen together.</Text>
        <Txt muted>Discover activities, find your people, and make something happen.</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm }}>
          <Button compact title="Create an account" onPress={() => openGuestEntry("/activities", undefined, "create")} />
          <Button compact secondary title="Sign in" onPress={() => openGuestEntry("/activities")} />
        </View>
      </View>
      <View testID="home-friends-section" style={{ gap: tokens.space.xs }}>
        <Text accessibilityRole="header" style={styles.h2}>Your People</Text>
        <Txt>Your people will appear here.</Txt>
        <Txt muted>Sign in to add friends and make plans together.</Txt>
      </View>
      <View testID="home-personal-timeline" style={{ gap: tokens.space.xs }}>
        <Text accessibilityRole="header" style={styles.h2}>Your Activity</Text>
        <Text style={styles.label}>Current Activity</Text>
        <Txt muted>Your current activity will appear here.</Txt>
        <Text style={styles.label}>Up Next</Text>
        <Txt muted>Nothing coming up yet.</Txt>
        <Button compact secondary title="Create your first Beacon" onPress={() => openGuestEntry("/create", "create")} />
      </View>
      <View testID="visitor-discovery" style={{ gap: tokens.space.sm }}>
        <Text accessibilityRole="header" style={styles.h2}>
          Explore Beacons
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
            <Txt muted>Explore another area or start something of your own.</Txt>
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
              <Button compact secondary title="Create Beacon" onPress={() => openGuestEntry("/create", "create")} />
            </View>
          </>
        )}
      </View>
      <Button compact secondary title="Help & Tips" onPress={() => router.push("/help")} />
    </View>
  );
}
