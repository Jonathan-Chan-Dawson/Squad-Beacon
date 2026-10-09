import React from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowUpRight, ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import { useTheme } from "@/src/shared/ui";

export function CommunityBreadcrumb({
  items,
}: {
  items: { id: string; label: string; onPress: () => void }[];
}) {
  const { styles, colors } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 5,
        }}
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 ? <ChevronRight size={14} color={colors.muted} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.label}`}
              onPress={item.onPress}
              style={{
                minHeight: 44,
                maxWidth: "100%",
                paddingHorizontal: 12,
                justifyContent: "center",
                borderRadius: 22,
                backgroundColor: colors.lime,
              }}
            >
              <Text
                style={[styles.label, { color: colors.green }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.muted}>
        Linked communities keep separate membership and privacy.
      </Text>
    </View>
  );
}

export function CompactQuickAction({
  title,
  icon: Icon,
  onPress,
}: {
  title: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ alignItems: "center", gap: 5, flex: 1, minWidth: 56 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.lime,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={21} color={colors.green} />
      </View>
      <Text
        style={[styles.label, { textAlign: "center", fontSize: 10 }]}
        numberOfLines={2}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** Caller supplies an authorized, scheduled Beacon and the current live status. */
export function CompactBeaconCard({
  activity,
  label,
  live,
  onPress,
  testID,
}: {
  activity: Activity;
  label: string;
  live?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${activity.title}`}
      accessibilityHint="Opens a Beacon preview"
      onPress={onPress}
      style={[styles.card, styles.row, { minHeight: 76 }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          {live ? (
            <Text
              style={[
                styles.label,
                {
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 10,
                  color: colors.green,
                  backgroundColor: colors.lime,
                },
              ]}
            >
              Live
            </Text>
          ) : null}
        </View>
        <Text style={[styles.body, { fontWeight: "700" }]} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.muted}>
          {new Date(activity.starts_at).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <ArrowUpRight size={18} color={colors.green} />
    </Pressable>
  );
}
