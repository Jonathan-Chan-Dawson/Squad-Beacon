import React from "react";
import { Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useTheme } from "@/src/shared/ui";

/** Quiet secondary navigation with a full-size mobile touch target. */
export function ProfileLink({
  title,
  detail,
  icon,
  onPress,
  label,
}: {
  title: string;
  detail?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  label?: string;
}) {
  const { styles, colors } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
      }}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.body}>{title}</Text>
        {detail ? <Text style={styles.muted}>{detail}</Text> : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </MotionPressable>
  );
}

export function ProfileActions({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

export function ProfileSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { styles } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.between, { flexWrap: "wrap", gap: 4 }]}>
        <Text accessibilityRole="header" style={styles.h2}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}
