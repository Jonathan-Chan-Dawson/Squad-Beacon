import React from "react";
import { Text, View } from "react-native";
import { ActivityBadge } from "../ActivityBadge";
import type { Category } from "@/src/shared/types";
import { useTheme } from "@/src/shared/ui";

/** Shared read-only identity for published cards and draft review. No RSVP state. */
export function BeaconIdentity({
  title,
  category,
  subtitle,
}: {
  title: string;
  category: Category;
  subtitle?: string;
}) {
  const { styles } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <ActivityBadge category={category} size={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.h2}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
