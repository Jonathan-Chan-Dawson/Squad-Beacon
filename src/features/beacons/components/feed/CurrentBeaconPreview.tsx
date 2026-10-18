import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useTheme } from "@/src/shared/ui";
import { BeaconIcon } from "../BeaconIcon";

export type CurrentBeaconRole = "hosting" | "cohosting" | "going";

export function currentBeaconRoleLabel(role: CurrentBeaconRole) {
  return role === "cohosting"
    ? "Co-hosting"
    : role === "hosting"
      ? "Hosting"
      : "Going";
}

function startedLabel(activity: Activity, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(activity.starts_at)) / 60_000),
  );
  if (minutes < 1) return "Started just now";
  if (minutes < 60) return `Started ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining
    ? `Started ${hours} hr ${remaining} min ago`
    : `Started ${hours} hr ago`;
}

function untilLabel(activity: Activity) {
  return `Until ${new Date(activity.ends_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function CurrentBeaconPreview({
  activity,
  role,
  now,
  onPress,
  featured = false,
  compact = false,
}: {
  activity: Activity;
  role: CurrentBeaconRole;
  now: number;
  onPress?: () => void;
  featured?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const iconSize = featured || compact ? 34 : 44;
  const iconGlyphSize = featured || compact ? 24 : 30;
  const content = (
    <>
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: 12,
          backgroundColor: colors.green + "12",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BeaconIcon
          category={activity.category}
          emoji={activity.decoration_emoji}
          size={iconGlyphSize}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          style={{
            color: colors.green,
            fontSize: 11,
            lineHeight: 16,
            fontWeight: "600",
          }}
        >
          {featured ? "Featured · Happening now" : "Happening now"}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.ink,
            fontSize: 14,
            lineHeight: 19,
            fontWeight: "600",
          }}
        >
          {activity.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: colors.muted, fontSize: 11, lineHeight: 15 }}
        >
          {startedLabel(activity, now)} · {untilLabel(activity)} ·{" "}
          {currentBeaconRoleLabel(role)}
        </Text>
      </View>
    </>
  );

  if (!onPress)
    return (
      <View
        testID="current-beacon-preview"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: iconSize + 8,
          paddingVertical: 4,
        }}
      >
        {content}
      </View>
    );

  return (
    <Pressable
      testID="current-beacon-preview"
      accessibilityRole="button"
      accessibilityLabel={`${featured ? "Featured, " : ""}Happening now: ${activity.title}. ${startedLabel(activity, now)}. ${currentBeaconRoleLabel(role)}.`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        minHeight: iconSize + 8,
        paddingHorizontal: compact ? 3 : 7,
        paddingVertical: 4,
        borderRadius: 14,
        backgroundColor: featured ? colors.green + "0A" : "transparent",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}
