import React, { useId } from "react";
import { Pressable, Text, View } from "react-native";
import { Building2, Layers3, UsersRound } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/src/shared/ui";
import type { SocialEntityType, SocialRole } from "@/src/features/social/types";

export const communityTypeLabel = (type: SocialEntityType) =>
  type === "organization"
    ? "Organization"
    : type === "space"
      ? "Space"
      : "Squad";
export const communityRoleLabel = (role: SocialRole) =>
  role === "coowner" ? "Co-owner" : role[0].toUpperCase() + role.slice(1);

export function CommunityCover({
  type,
  compact = false,
}: {
  type: SocialEntityType;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const gradientId = `community-${useId().replace(/:/g, "")}`;
  const Icon =
    type === "organization"
      ? Building2
      : type === "space"
        ? Layers3
        : UsersRound;
  return (
    <View
      style={{
        height: compact ? 62 : 94,
        borderRadius: 16,
        overflow: "hidden",
        justifyContent: "center",
        paddingHorizontal: 18,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0 }}
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.lime} />
            <Stop offset="1" stopColor={colors.bg} />
          </LinearGradient>
        </Defs>
        <Rect width="400" height="120" fill={`url(#${gradientId})`} />
      </Svg>
      <View
        style={{
          alignSelf: "flex-start",
          padding: 10,
          borderRadius: 14,
          backgroundColor: colors.bg,
        }}
      >
        <Icon size={24} color={colors.green} />
      </View>
    </View>
  );
}

export interface CommunityCardProps {
  type: SocialEntityType;
  name: string;
  memberCount: number;
  role?: SocialRole | null;
  squadCount?: number;
  squadNames?: string[];
  onPress: () => void;
  compact?: boolean;
}

/** Only exact-membership-authorized names and counts belong in this member card. */
export function CommunityCard({
  type,
  name,
  memberCount,
  role,
  squadCount,
  squadNames = [],
  onPress,
  compact,
}: CommunityCardProps) {
  const { styles, colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${communityTypeLabel(type)} ${name}`}
      onPress={onPress}
      style={[styles.card, { gap: 9, padding: 12 }]}
    >
      <CommunityCover type={type} compact={compact} />
      <View style={styles.between}>
        <Text style={styles.label}>{communityTypeLabel(type)}</Text>
        {role ? (
          <Text style={[styles.label, { color: colors.green }]}>
            {communityRoleLabel(role)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.h2} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.muted}>
        {memberCount} {memberCount === 1 ? "member" : "members"}
      </Text>
      {squadCount !== undefined ? (
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 16,
            backgroundColor: colors.lime,
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          <Text style={[styles.label, { color: colors.green }]}>
            {squadCount} {squadCount === 1 ? "Squad" : "Squads"} you belong to
          </Text>
        </View>
      ) : null}
      {squadNames.length ? (
        <Text style={styles.muted} numberOfLines={1}>
          {squadNames.join(" · ")}
        </Text>
      ) : null}
    </Pressable>
  );
}
