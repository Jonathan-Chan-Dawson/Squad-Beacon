import React from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/src/shared/ui";

/** Shared Beacon hierarchy: one heading/action row and one coherent content surface. */
export function BeaconSection({
  title,
  description,
  action,
  children,
  surface = false,
  style,
  testID,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  surface?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors, styles } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        { gap: 16 },
        surface && {
          backgroundColor: colors.white,
          borderRadius: 16,
          padding: 16,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={[styles.h2, { fontSize: 18, lineHeight: 24 }]}
          >
            {title}
          </Text>
          {description && <Text style={styles.muted}>{description}</Text>}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
export function BeaconActionRow({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

export function BeaconDisclosure({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onToggle(): void;
  children: React.ReactNode;
}) {
  const { styles, colors } = useTheme();
  return (
    <View
      style={{
        gap: open ? 12 : 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
        paddingBottom: 12,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.body, { fontWeight: "600" }]}>{title}</Text>
          {description && <Text style={styles.muted}>{description}</Text>}
        </View>
        <Text style={styles.muted}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open && children}
    </View>
  );
}
