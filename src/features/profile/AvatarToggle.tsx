import { ThemedSwitch } from "@/src/shared/ThemedSwitch";
import React from "react";
import { Text, View } from "react-native";
import { usePreferences } from "@/src/shared/preferences";
import { useTheme } from "@/src/shared/ui";

export function AvatarToggle({
  description = false,
}: {
  description?: boolean;
}) {
  const { styles } = useTheme();

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
        <ThemedSwitch
          accessibilityLabel="Show avatars"
          disabled={!ready}
          value={showAvatars}
          onValueChange={setShowAvatars}
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
