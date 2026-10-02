import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  ArrowUpRight,
  ArrowUp,
  Clock3,
  MapPin,
  Monitor,
} from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { activityWhen } from "@/src/shared/domain";
import { attendance } from "@/src/shared/browsing";
import { useNow } from "@/src/shared/useNow";
import { useTheme } from "@/src/shared/ui";
import { ActivityBadge } from "./ActivityBadge";
import { BeaconResponse } from "./BeaconResponse";

export function ActivityCard({
  activity,
  onOpen,
  highlighted = false,
}: {
  activity: Activity;
  onOpen?: () => void;
  highlighted?: boolean;
}) {
  const { styles, colors } = useTheme();
  const { data } = useBeacon();
  const now = useNow();
  const owner = data.profiles.find((profile) => profile.id === activity.owner_id);
  const place = data.places.find((item) => item.activity_id === activity.id);
  const when = activityWhen(activity, new Date(now));
  const live =
    activity.status === "scheduled" &&
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now;
  const peopleCount = activity.accepted_seat_count ?? attendance(data, activity);
  const isVirtual = !!place?.online_url;
  const location = isVirtual
    ? "Virtual"
    : place?.label ||
      (place ? "Place to be decided" : "Meeting details restricted");

  return (
    <View
      style={[
        styles.card,
        {
          padding: 12,
          gap: 8,
          borderRadius: 18,
          borderLeftWidth: 4,
          borderLeftColor: live ? colors.green : colors.line,
        },
      ]}
    >
      <View style={[styles.row, { gap: 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${activity.title} details`}
          onPress={
            onOpen ??
            (() =>
              router.push({
                pathname: "/(tabs)",
                params: { beacon: activity.id },
              }))
          }
          style={({ pressed }) => [
            styles.row,
            {
              flex: 1,
              minWidth: 0,
              gap: 9,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <ActivityBadge category={activity.category} size={36} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={2}
              style={[styles.h2, { fontSize: 17, lineHeight: 21 }]}
            >
              {activity.title}
            </Text>
            <Text numberOfLines={1} style={styles.muted}>
              {owner?.name ?? "Squad member"} {"\u00b7"} {activity.category}
            </Text>
          </View>
          <ArrowUpRight size={18} color={colors.green} />
        </Pressable>
        {highlighted ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="Priority: a starred friend or squad is related"
            style={{ padding: 4 }}
          >
            <ArrowUp size={17} color={colors.green} />
          </View>
        ) : null}
      </View>

      <View style={styles.between}>
        <View style={[styles.row, { flex: 1, minWidth: 0, gap: 6 }]}>
          {isVirtual ? (
            <Monitor size={15} color={colors.green} />
          ) : (
            <MapPin size={15} color={colors.green} />
          )}
          <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>
            {location}
          </Text>
        </View>
        <View style={[styles.row, { gap: 5 }]}>
          <Clock3 size={15} color={live ? colors.green : colors.muted} />
          <Text
            style={[
              styles.muted,
              live && { color: colors.green, fontWeight: "700" },
            ]}
          >
            {when}
          </Text>
        </View>
      </View>

      <View style={styles.between}>
        <Text style={styles.label}>
          {peopleCount} {peopleCount === 1 ? "person" : "people"} going
        </Text>
        {activity.target_count != null && activity.target_count > peopleCount ? (
          <Text style={styles.label}>
            Need {activity.target_count - peopleCount} more
          </Text>
        ) : null}
      </View>
      <BeaconResponse activity={activity} />
    </View>
  );
}
