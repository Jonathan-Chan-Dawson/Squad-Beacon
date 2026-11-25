import { useState } from "react";
import { CircleUserRound } from "lucide-react-native";
import { Text, View } from "react-native";
import { openGuestEntry } from "@/src/features/auth/guestEntry";
import { PrimaryTab } from "@/src/shared/NavigationTabs";
import { Button, Screen, Txt, useTheme } from "@/src/shared/ui";

const sections = ["Overview", "Beacons", "About"] as const;

export default function GuestProfileScreen() {
  const { semanticColors, tokens, styles } = useTheme();
  const [section, setSection] = useState<(typeof sections)[number]>("Overview");
  return (
    <Screen title="Profile" eyebrow="" compactHeader create={false}>
      <View style={{ gap: tokens.space.md }}>
        <View style={{ alignItems: "center", gap: tokens.space.sm }}>
          <CircleUserRound
            size={68}
            strokeWidth={1}
            color={semanticColors.textSecondary}
          />
          <Text style={styles.h2}>Your profile</Text>
        </View>
        <View style={[styles.card, { gap: tokens.space.sm }]}>
          <Text style={styles.h2}>Make Squad Beacon yours.</Text>
          <Txt muted>
            Sign in to see your profile, share your status, and connect with
            friends.
          </Txt>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: tokens.space.sm,
            }}
          >
            <Button
              compact
              title="Create account"
              onPress={() => openGuestEntry("/profile", "profile", "create")}
            />
            <Button
              compact
              secondary
              title="Sign in"
              onPress={() => openGuestEntry("/profile", "profile")}
            />
          </View>
        </View>
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: "row", flexWrap: "wrap" }}
        >
          {sections.map((item) => (
            <PrimaryTab
              key={item}
              role="tab"
              label={item}
              selected={item === section}
              onPress={() => setSection(item)}
            />
          ))}
        </View>
        {section === "Overview" ? (
          <View style={{ gap: tokens.space.sm }}>
            <Text style={styles.h2}>Current Activity</Text>
            <Txt muted>Your current activity will appear here.</Txt>
            <Text style={styles.h2}>Up Next</Text>
            <Txt muted>Nothing coming up yet.</Txt>
          </View>
        ) : (
          <Txt muted>
            {section === "Beacons"
              ? "Your Beacons will appear here."
              : "Your bio and interests will appear here."}
          </Txt>
        )}
      </View>
    </Screen>
  );
}
