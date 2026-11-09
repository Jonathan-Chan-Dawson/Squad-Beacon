import React, { useId } from "react";
import { Pressable, Text, View } from "react-native";
import {
  ArrowUpRight,
  Building2,
  ArrowRight,
  Layers3,
  UsersRound,
} from "lucide-react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useTheme } from "@/src/shared/ui";
import type { SocialEntityType, SocialRole } from "@/src/features/social/types";
import type { Profile, SquadIconKey } from "@/src/shared/types";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { CommunityAvatar } from "./CommunityAvatar";

import { communityTypeLabel } from "@/src/features/social/communityPresentation";
export { communityTypeLabel };
export const communityRoleLabel = (role: SocialRole) =>
  role === "coowner" ? "Co-owner" : role[0].toUpperCase() + role.slice(1);

export const communityDirectoryTypes = [
  "organization",
  "space",
  "squad",
] as const;
const communityAccent = {
  organization: "Social",
  space: "Study",
  squad: "Fitness",
} as const;

export function CommunityArtwork({ type }: { type: SocialEntityType }) {
  const { tokens } = useTheme();
  const { color } = tokens.categories[communityAccent[type]];
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 190,
        opacity: 0.4,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 190 86"
        preserveAspectRatio="xMaxYMid slice"
      >
        {type === "organization" ? (
          <>
            <Path
              d="M30 72 79 33 115 63 159 18 188 42 M79 33 159 18 M115 63 183 83"
              fill="none"
              stroke={color}
            />
            <Circle cx="79" cy="33" r="6" fill={color} />
            <Circle cx="115" cy="63" r="4" fill={color} />
            <Circle cx="159" cy="18" r="7" fill={color} />
            <Circle cx="188" cy="42" r="4" fill={color} />
          </>
        ) : type === "space" ? (
          <>
            <Path
              d="M62 38 131 3 199 38 131 73Z M62 55 131 90 199 55 M62 21 131 -14 199 21"
              fill="none"
              stroke={color}
              strokeWidth={1.4}
            />
            <Path
              d="M101 38 131 23 160 38 131 53Z"
              fill={color}
              opacity={0.35}
            />
          </>
        ) : (
          <>
            {[18, 32, 46, 60].map((radius) => (
              <Circle
                key={radius}
                cx="143"
                cy="43"
                r={radius}
                stroke={color}
                fill="none"
              />
            ))}
            <Circle cx="143" cy="43" r="6" fill={color} />
            <Circle cx="112" cy="20" r="4" fill={color} />
            <Circle cx="181" cy="65" r="5" fill={color} />
          </>
        )}
      </Svg>
    </View>
  );
}

export function CommunitySectionHeading({
  type,
  title,
  onToggle,
}: {
  type: SocialEntityType;
  title: string;
  onToggle?: () => void;
}) {
  const { styles, colors } = useTheme();
  return (
    <View style={[styles.between, { minHeight: 44, gap: 4 }]}>
      <View style={[styles.row, { flex: 1, minWidth: 0 }]}>
        <CommunityAvatar type={type} size={30} />
        <Text accessibilityRole="header" style={styles.h2}>
          {title}
        </Text>
      </View>
      {onToggle && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See more ${title}`}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.row,
            { minHeight: 44, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.label, { color: colors.green }]}>See more</Text>
          <ArrowRight size={15} color={colors.green} />
        </Pressable>
      )}
    </View>
  );
}

/** Members are optional and must already be authorized by the calling surface. */
export function CommunityCardDetails({
  type,
  name,
  description,
  memberCount,
  badge,
  context,
  members = [],
  iconKey,
  compact = false,
}: {
  type: SocialEntityType;
  name: string;
  description?: string;
  memberCount: number;
  badge: string;
  context?: string;
  members?: Profile[];
  iconKey?: SquadIconKey;
  compact?: boolean;
}) {
  const { styles, colors, tokens, semanticColors } = useTheme();
  const accent = tokens.categories[communityAccent[type]];
  return (
    <View style={{ gap: 8 }}>
      <View
        style={[
          styles.row,
          { gap: 10 },
          !compact && {
            position: "relative",
            overflow: "hidden",
            minHeight: 56,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 12,
            backgroundColor: accent.tint,
          },
        ]}
      >
        {!compact && <CommunityArtwork type={type} />}
        <CommunityAvatar type={type} iconKey={iconKey} size={38} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={[styles.label, { color: accent.color }]}>
            {compact ? badge : `${communityTypeLabel(type)} · ${badge}`}
          </Text>
          <Text
            style={[styles.h2, compact && { fontSize: 16 }]}
            numberOfLines={2}
          >
            {name}
          </Text>
        </View>
        <ArrowUpRight size={18} color={colors.muted} accessible={false} />
      </View>
      {!!description?.trim() && (
        <Text style={styles.muted} numberOfLines={2}>
          {description.trim()}
        </Text>
      )}
      <View style={[styles.row, { flexWrap: "wrap", gap: 6 }]}>
        <UsersRound size={15} color={colors.muted} accessible={false} />
        <Text style={styles.label}>
          {memberCount.toLocaleString()}{" "}
          {memberCount === 1 ? "member" : "members"}
        </Text>
        {!!context && (
          <Text style={[styles.label, { flexShrink: 1 }]} numberOfLines={2}>
            · {context}
          </Text>
        )}
      </View>
      {!!members.length && (
        <View
          style={[
            styles.row,
            {
              backgroundColor: semanticColors.surfaceRaised,
              padding: 6,
              borderRadius: 10,
              gap: 6,
            },
          ]}
        >
          {members.map((member) => (
            <ProfileAvatar key={member.id} profile={member} size={23} />
          ))}
          <Text style={[styles.muted, { flex: 1 }]} numberOfLines={2}>
            {members.map((member) => member.name).join(", ")}
          </Text>
        </View>
      )}
    </View>
  );
}

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
