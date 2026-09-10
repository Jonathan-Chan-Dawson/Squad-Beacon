import React from "react";
import { Switch, Text, View } from "react-native";
import { usePreferences } from "./preferences";
import { colors, styles } from "./ui";

export function AvatarToggle({
  description = false,
}: {
  description?: boolean;
}) {
  const { showAvatars, setShowAvatars, ready, error } = usePreferences();
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.body, { fontWeight: "600" }]}>Show avatars</Text>
          {description && (
            <Text style={styles.muted}>
              Photos and initials on this device. Names stay visible.
            </Text>
          )}
        </View>
        <Switch
          accessibilityLabel="Show avatars"
          disabled={!ready}
          value={showAvatars}
          onValueChange={setShowAvatars}
          trackColor={{ false: "#B8C3BC", true: colors.green }}
        />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
