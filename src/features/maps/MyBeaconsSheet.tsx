import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowUpRight, ChevronRight } from "lucide-react-native";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { Sheet, Txt, useTheme } from "@/src/shared/ui";
import { isValidCoordinate } from "@/src/shared/exploration";
import type { Activity, ActivityPlace } from "@/src/shared/types";

export function MyBeaconsSheet({
  visible,
  onClose,
  hosting,
  joined,
  places,
  now,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  hosting: Activity[];
  joined: Activity[];
  /** Already filtered through meeting-details permissions by MapScreen. */
  places: ActivityPlace[];
  now: number;
  onSelect: (id: string) => void;
}) {
  const { colors, styles } = useTheme();
  const [chosen, setChosen] = useState<"hosting" | "joined" | null>(null);
  const tab = chosen ?? (hosting.length ? "hosting" : "joined");
  const rows = tab === "hosting" ? hosting : joined;
  return (
    <Sheet
      title="My Beacons"
      visible={visible}
      onClose={onClose}
      onDismiss={() => setChosen(null)}
      maxHeightPercent={70}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Your Beacons"
        style={{
          flexDirection: "row",
          gap: 24,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        {(
          [
            ["hosting", "Hosting", hosting.length],
            ["joined", "Joined", joined.length],
          ] as const
        ).map(([value, label, count]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={`${label} (${count})`}
            accessibilityState={{ selected: tab === value }}
            aria-selected={tab === value}
            onPress={() => setChosen(value)}
            style={{
              minHeight: 44,
              paddingHorizontal: 4,
              justifyContent: "center",
              borderBottomWidth: 2,
              borderBottomColor: tab === value ? colors.green : "transparent",
            }}
          >
            <Text
              style={{
                color: tab === value ? colors.green : colors.muted,
                fontWeight: tab === value ? "600" : "400",
                fontSize: 14,
              }}
            >
              {label} ({count})
            </Text>
          </Pressable>
        ))}
      </View>
      {!hosting.length && !joined.length ? (
        <Txt muted>
          You aren’t hosting or attending any live or upcoming Beacons.
        </Txt>
      ) : !rows.length ? (
        <Txt muted>
          {tab === "hosting"
            ? "You aren’t hosting any live or upcoming Beacons."
            : "You haven’t joined any live or upcoming Beacons."}
        </Txt>
      ) : null}
      {rows.map((activity) => {
        const place = places.find((row) => row.activity_id === activity.id);
        const located =
          !!place &&
          !place.online_url &&
          place.latitude != null &&
          place.longitude != null &&
          isValidCoordinate({
            latitude: place.latitude,
            longitude: place.longitude,
          });
        const live = Date.parse(activity.starts_at) <= now;
        const time = new Date(activity.starts_at).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const location = place?.online_url
          ? "Online"
          : located
            ? place.label
            : "Location unavailable";
        const ActionIcon = located ? ChevronRight : ArrowUpRight;
        return (
          <Pressable
            key={activity.id}
            testID={`my-beacon-${activity.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${activity.title} · ${live ? "Live now" : time} · ${location}`}
            accessibilityHint={
              located ? "Show this Beacon on the map" : "Open Beacon details"
            }
            onPress={() => onSelect(activity.id)}
            style={{
              minHeight: 76,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <ActivityBadge
              category={activity.category}
              size={36}
              iconSize={19}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Text
                numberOfLines={2}
                style={[styles.body, { fontWeight: "600" }]}
              >
                {activity.title}
              </Text>
              <Text numberOfLines={2} style={[styles.muted, { fontSize: 12 }]}>
                {live ? "Now" : time} · {location}
              </Text>
            </View>
            {live && (
              <View
                accessibilityLabel="Live now"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.success,
                }}
              />
            )}
            <ActionIcon size={16} color={colors.muted} />
          </Pressable>
        );
      })}
    </Sheet>
  );
}
