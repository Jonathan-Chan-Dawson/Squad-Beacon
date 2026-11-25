import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { openGuestEntry } from "@/src/features/auth/guestEntry";
import { PrimaryTab } from "@/src/shared/NavigationTabs";
import { useBeacon } from "@/src/shared/store";
import { Button, Screen, Txt, useTheme } from "@/src/shared/ui";
import MessagingHubScreen from "./MessagingHubScreen";

const sections = ["Chats", "Communities"] as const;

function GuestSquads() {
  const { styles, tokens } = useTheme();
  const params = useLocalSearchParams<{ section?: string; tab?: string }>();
  const [section, setSection] = useState<(typeof sections)[number]>(
    params.section === "Communities" || params.tab === "Organizations"
      ? "Communities"
      : "Chats",
  );
  return (
    <Screen title="Squads" eyebrow="" compactHeader create={false}>
      <View style={{ gap: tokens.space.md }}>
        <View accessibilityRole="tablist" style={{ flexDirection: "row" }}>
          {sections.map((item) => (
            <PrimaryTab
              key={item}
              role="tab"
              label={item}
              selected={section === item}
              onPress={() => setSection(item)}
            />
          ))}
        </View>
        {section === "Chats" ? (
          <View style={{ gap: tokens.space.sm }}>
            <Text style={styles.h2}>Conversations</Text>
            <Txt muted>Your conversations will appear here.</Txt>
            <Button
              compact
              title="Sign in to start chatting"
              onPress={() => openGuestEntry("/squads", "chats")}
            />
          </View>
        ) : (
          <View style={{ gap: tokens.space.sm }}>
            <Text style={styles.h2}>Communities</Text>
            <Txt muted>Explore organizations and communities.</Txt>
            <Text style={styles.label}>Networks · Organizations · Squads</Text>
            <Txt muted>Find your people and build your crew.</Txt>
            <Button
              compact
              title="Sign in to join or create a Squad"
              onPress={() =>
                openGuestEntry("/squads", "squads", undefined, { section })
              }
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

export default function SquadsScreen() {
  const { userId } = useBeacon();
  return userId ? <MessagingHubScreen /> : <GuestSquads />;
}
