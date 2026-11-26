import { DiscoveryBeaconCard } from "@/src/features/discovery/DiscoveryBeaconCard";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
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
  return (
    <DiscoveryBeaconCard density="mini" testID={testID} activityId={activity.id} title={activity.title}
      category={activity.category} decorationEmoji={activity.decoration_emoji} mapIcon={activity.map_icon}
      statusLabel={label} isLive={live} detailsLabel={`${label}: ${activity.title}`} onDetails={onPress}
      whenLabel={new Date(activity.starts_at).toLocaleString([], {
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })}
    />
  );
}
