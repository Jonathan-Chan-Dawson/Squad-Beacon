import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Squad, SquadIconKey } from "@/src/shared/types";
import { Action, useTheme } from "@/src/shared/ui";
import { CommunityAvatar } from "./CommunityAvatar";
import { squadIconChoices, squadIconKey } from "../squadIcons";

export function SquadIconPicker({
  squad,
  onSave,
}: {
  squad: Squad;
  onSave: (icon: SquadIconKey) => Promise<unknown>;
}) {
  const { styles, colors } = useTheme();
  const saved = squadIconKey(squad.icon_key);
  const [choice, setChoice] = useState(saved);
  return (
    <View style={[styles.card, { gap: 12 }]}>
      <Text style={styles.h2}>Squad icon</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {squadIconChoices.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${item.label} Squad icon`}
            accessibilityState={{ selected: choice === item.key }}
            aria-selected={choice === item.key}
            onPress={() => setChoice(item.key)}
            style={{
              minWidth: 60,
              minHeight: 72,
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              padding: 6,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: choice === item.key ? colors.green : colors.line,
            }}
          >
            <CommunityAvatar iconKey={item.key} size={36} />
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Action
        compact
        title="Save Squad icon"
        disabled={choice === saved}
        run={() => onSave(choice)}
      />
    </View>
  );
}
