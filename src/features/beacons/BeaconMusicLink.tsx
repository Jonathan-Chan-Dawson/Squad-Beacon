import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { ExternalLink, Music2 } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import type { Activity } from "@/src/shared/types";
import { canUseBeaconModules } from "./beaconModules";
import { isBeaconModuleEnabled } from "./permissions";
import { validateMusicUrl } from "./controls";

/** The existing music feature is an external link, not an audio player. */
export function BeaconMusicLink({ activity }: { activity: Activity }) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const [error, setError] = useState("");
  let url: string | null = null;
  try {
    url = validateMusicUrl(activity.music_url);
  } catch {
    /* Invalid or unsupported links stay hidden. */
  }
  if (
    !url ||
    !isBeaconModuleEnabled(activity, "music") ||
    !userId ||
    data.viewer_id !== userId ||
    !canUseBeaconModules(data, activity, userId)
  )
    return null;
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open shared music link"
        accessibilityHint="Opens music in its external app or website"
        onPress={async () => {
          setError("");
          try {
            await Linking.openURL(url!);
          } catch {
            setError("Could not open the music link.");
          }
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 48,
          paddingHorizontal: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Music2 size={18} color={colors.green} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label}>Shared music</Text>
          <Text numberOfLines={1} style={[styles.muted, { fontSize: 11 }]}>
            {new URL(url).hostname.replace(/^www\./, "")} · Opens externally
          </Text>
        </View>
        <ExternalLink size={16} color={colors.muted} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
