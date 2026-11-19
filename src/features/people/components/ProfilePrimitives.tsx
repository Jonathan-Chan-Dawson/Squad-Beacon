import React from "react";
import { Text, View } from "react-native";
import {
  ChevronRight,
  FileText,
  Palette,
  Users,
  Link2,
  Shield,
  Settings2,
} from "lucide-react-native";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useTheme } from "@/src/shared/ui";

/** Quiet secondary navigation with a full-size mobile touch target. */
export function ProfileLink({
  title,
  detail,
  icon,
  onPress,
  label,
  surface = false,
}: {
  title: string;
  detail?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  label?: string;
  surface?: boolean;
}) {
  const { styles, colors, semanticColors } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      accessibilityHint={detail}
      style={({ pressed }) => ({
        minHeight: surface ? 68 : 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: surface ? 12 : 8,
        paddingHorizontal: surface ? 12 : 0,
        borderRadius: surface ? 14 : 0,
        borderWidth: surface ? 1 : 0,
        borderColor: semanticColors.border,
        backgroundColor: surface ? semanticColors.surfaceRaised : "transparent",
        marginBottom: surface ? 6 : 0,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          numberOfLines={2}
          style={[styles.body, surface && { fontWeight: "600" }]}
        >
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={2} style={styles.muted}>
            {detail}
          </Text>
        ) : null}
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

/** Existing management destinations share the directory's quiet row hierarchy. */
export function CommunitySettingsRow({
  category,
  title,
  detail,
  onPress,
}: {
  category: string;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  const { semanticColors: colors } = useTheme();
  const Icon =
    category === "details"
      ? FileText
      : category === "appearance"
        ? Palette
        : category === "members"
          ? Users
          : category === "connections"
            ? Link2
            : category === "policy" || category === "access"
              ? Shield
              : Settings2;
  const descriptions: Record<string, string> = {
    details: "Name and description",
    appearance: "Community icon and style",
    members: "Members, roles and invitations",
    connections: "Linked communities with independent membership",
    access: "Discovery, joining and invitations",
    policy: "Discovery, joining and invitations",
    actions: "Membership and advanced actions",
  };
  return (
    <View
      style={
        category === "actions"
          ? {
              paddingTop: 12,
              marginTop: 6,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }
          : undefined
      }
    >
      <ProfileLink
        surface
        title={title}
        detail={detail ?? descriptions[category]}
        icon={<Icon size={22} color={colors.accent} />}
        onPress={onPress}
      />
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
