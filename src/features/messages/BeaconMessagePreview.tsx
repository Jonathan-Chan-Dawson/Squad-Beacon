import React from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { useDesignTheme } from "@/src/shared/design-system";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { beaconLinkId } from "./beaconLinks";

export function BeaconMessagePreview({ body }: { body: string }) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  const router = useRouter();
  const id = beaconLinkId(
    body,
    typeof window === "undefined" ? undefined : window.location.origin,
  );
  if (!id) return null;
  const beacon =
    data.viewer_id === userId
      ? data.activities.find((row) => row.id === id)
      : undefined;
  if (!beacon || !userId || !canReadBeaconActivity(data, beacon, userId))
    return (
      <View style={{ padding: 10 }}>
        <Text style={{ color: colors.textSecondary }}>Beacon unavailable</Text>
      </View>
    );
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`View Beacon ${beacon.title}`}
      onPress={() =>
        router.push({ pathname: "/activity/[id]", params: { id } })
      }
      style={{
        minHeight: 56,
        padding: 10,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 3,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ color: colors.textPrimary, fontWeight: "600" }}
      >
        {beacon.title}
      </Text>
      <Text
        numberOfLines={1}
        style={{ color: colors.textSecondary, fontSize: 12 }}
      >
        {new Date(beacon.starts_at).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        · View Beacon ›
      </Text>
    </MotionPressable>
  );
}
