import React, { useId } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, MessageCircle, Square } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useDesignTheme } from "@/src/shared/design-system";
import { type FriendNowRowProps } from "./FriendsNow";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";

export function HubFriendRow({ selected, onSelect, reactionAction, ...props }: FriendNowRowProps & {
  reactionAction?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, tokens } = useDesignTheme();
  const availability = props.friend.availability === "ending-soon" ? "endingSoon" : props.friend.availability;
  const statusToken = tokens.availability[availability];
  const until = props.friend.until ? new Date(props.friend.until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  return <View style={{ minHeight: 72, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`Select ${props.friend.name} to plan with`}
      accessibilityState={{ checked: selected }} onPress={onSelect}
      style={{ width: tokens.layout.minTapTarget, minHeight: tokens.layout.minTapTarget, alignItems: "center", justifyContent: "center" }}>
      {selected ? <Check size={22} color={colors.accent} /> : <Square size={22} color={colors.textSecondary} />}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${props.friend.name}'s profile`} onPress={() => props.onProfile(props.friend.id)}
      style={{ width: tokens.layout.minTapTarget, minHeight: tokens.layout.minTapTarget, alignItems: "center", justifyContent: "center" }}>
      <View style={{ borderWidth: 2, borderColor: statusToken.color, borderRadius: 22, padding: 2 }}><ProfileAvatar profile={props.friend.profile} size={32} /></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={props.friend.activeBeaconId ? `Open ${props.friend.name}'s active Beacon` : `View ${props.friend.name}'s profile`}
      onPress={() => props.friend.activeBeaconId ? props.onOpenBeacon(props.friend.activeBeaconId) : props.onProfile(props.friend.id)}
      style={{ flex: 1, minWidth: 0, minHeight: tokens.layout.minTapTarget, justifyContent: "center", gap: 2, paddingHorizontal: tokens.space.xs }}>
      <Text numberOfLines={1} style={{ color: colors.textPrimary, ...tokens.type.secondary, fontWeight: "700" }}>{props.friend.name}</Text>
      <Text numberOfLines={2} style={{ color: colors.textSecondary, ...tokens.type.caption }}>{props.friend.activeBeaconId ? "In a Beacon · " : ""}{props.friend.statusText}{until ? ` · until ${until}` : ""}</Text>
    </Pressable>
    {reactionAction}
    <Pressable accessibilityRole="button" accessibilityLabel={`Message ${props.friend.name}`} onPress={() => props.onMessage(props.friend.id)}
      style={{ width: tokens.layout.minTapTarget, minHeight: tokens.layout.minTapTarget, alignItems: "center", justifyContent: "center" }}><MessageCircle size={18} color={colors.accent} /></Pressable>
  </View>;
}

/** This fade sits below the rows, leaving all selection targets unobscured. */
export function HubFriendsFade() {
  const { colors } = useDesignTheme();
  const gradientId = useId().replace(/:/g, "");
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 16 }}>
    <Svg width="100%" height={16}>
      <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={colors.surfaceRaised} stopOpacity={0.35} /><Stop offset="1" stopColor={colors.bg} stopOpacity={0} /></LinearGradient></Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  </View>;
}
