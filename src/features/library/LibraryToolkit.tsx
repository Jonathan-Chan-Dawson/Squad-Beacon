import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  ArrowUpRight,
  CalendarRange,
  Heart,
  Layers3,
} from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";

type LibraryToolkitProps = {
  planCount: number;
  favoriteCount: number;
  savedBeaconCount: number;
  templateCount: number;
  onPlans: () => void;
  onFavorites: () => void;
  onTemplates: () => void;
};

export function LibraryToolkit({
  planCount,
  favoriteCount,
  savedBeaconCount,
  templateCount,
  onPlans,
  onFavorites,
  onTemplates,
}: LibraryToolkitProps) {
  const { colors, styles } = useTheme();

  return (
    <View style={{ gap: 9, paddingTop: 4 }}>
      <View style={styles.between}>
        <Text style={styles.label}>YOUR TOOLKIT</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Beacon Plans"
        accessibilityHint={`${planCount} personal plans saved. Open your plans.`}
        onPress={onPlans}
        style={({ pressed }) => ({
          minHeight: 72,
          borderRadius: 20,
          paddingHorizontal: 14,
          paddingVertical: 11,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.ink,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.lime,
          }}
        >
          <CalendarRange size={20} color={colors.green} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.h2, { color: colors.white }]}>Beacon Plans</Text>
          <Text style={[styles.muted, { color: colors.white, opacity: 0.76 }]}>
            Your personal plans
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={{ color: colors.white, fontSize: 13, fontWeight: "700" }}>
            {planCount}
          </Text>
          <ArrowUpRight size={17} color={colors.lime} />
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 9 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Favorites"
          accessibilityHint={`${favoriteCount} favorite friends and squads and ${savedBeaconCount} saved Beacons. Manage favorites.`}
          onPress={onFavorites}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 68,
            borderRadius: 18,
            padding: 11,
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.line,
            opacity: pressed ? 0.76 : 1,
          })}
        >
          <Heart size={19} color={colors.green} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>
              Favorites
            </Text>
            <Text numberOfLines={1} style={styles.muted}>
              {favoriteCount + savedBeaconCount} saved
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My templates"
          accessibilityHint={`${templateCount} saved. Open your beacon templates.`}
          onPress={onTemplates}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 68,
            borderRadius: 18,
            padding: 11,
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.line,
            opacity: pressed ? 0.76 : 1,
          })}
        >
          <Layers3 size={19} color={colors.green} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>
              My templates
            </Text>
            <Text numberOfLines={1} style={styles.muted}>
              {templateCount} ready to reuse
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
