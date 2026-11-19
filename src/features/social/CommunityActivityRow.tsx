import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { activityWhen } from "@/src/shared/domain";
import { useNow } from "@/src/shared/useNow";
import { useTheme } from "@/src/shared/ui";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { cardSocialPreview } from "@/src/features/beacons/cardSocialPreview";
import { BeaconIcon } from "@/src/features/beacons/components/BeaconIcon";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";

/** Compact community activity preview; participation comes from the existing safe selector. */
export function CommunityActivityRow({
  activity,
  testID,
  communityName,
}: {
  activity: Activity;
  testID?: string;
  communityName?: string;
}) {
  const { data, userId } = useBeacon();
  const { styles, semanticColors: colors } = useTheme();
  const now = useNow();
  if (
    !userId ||
    data.viewer_id !== userId ||
    !canReadBeaconActivity(data, activity, userId)
  )
    return null;
  const social = cardSocialPreview(data, userId, activity.id);
  const state =
    activity.status === "cancelled"
      ? "Canceled"
      : activity.status === "completed" || Date.parse(activity.ends_at) <= now
        ? "Past"
        : Date.parse(activity.starts_at) <= now
          ? "Happening now"
          : "Upcoming";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Open Beacon ${activity.title}`}
      onPress={() =>
        router.push({ pathname: "/activity/[id]", params: { id: activity.id } })
      }
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.surfaceRaised,
        minHeight: 72,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <BeaconIcon
        emoji={activity.decoration_emoji}
        category={activity.category}
        size={42}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[styles.body, { fontWeight: "600" }]} numberOfLines={2}>
          {activity.title}
        </Text>
        <Text style={styles.muted}>{activityWhen(activity)}</Text>
        <Text numberOfLines={2} style={styles.muted}>
          {[activity.category, state, communityName]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {social?.rosterAllowed && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 5,
            }}
          >
            {social.attendeeAvatars.map((person) => (
              <ProfileAvatar key={person.id} profile={person} size={23} />
            ))}
            <Text style={styles.muted}>
              {social.capacity.count}{" "}
              {state === "Past" || state === "Canceled" ? "confirmed" : "going"}
            </Text>
          </View>
        )}
      </View>
      <ChevronRight size={17} color={colors.textSecondary} />
    </Pressable>
  );
}
