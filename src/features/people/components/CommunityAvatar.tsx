import React from "react";
import { View } from "react-native";
import {
  BookOpen,
  Building2,
  Coffee,
  Dumbbell,
  Gamepad2,
  Layers3,
  List,
  Music,
  Sparkles,
  UsersRound,
  Volleyball,
} from "lucide-react-native";
import type { SquadIconKey } from "@/src/shared/types";
import type { SocialEntityType } from "@/src/features/social/types";
import { useTheme } from "@/src/shared/ui";
import { squadIconChoices, squadIconKey } from "../squadIcons";

const squadIcons = {
  users: UsersRound,
  fitness: Dumbbell,
  sports: Volleyball,
  gaming: Gamepad2,
  coffee: Coffee,
  study: BookOpen,
  music: Music,
  sparkles: Sparkles,
};

/** Callers supply an already authorized identity; this never fetches private data. */
export function CommunityAvatar({
  type = "squad",
  iconKey,
  size = 44,
}: {
  type?: SocialEntityType | "list";
  iconKey?: SquadIconKey;
  size?: number;
}) {
  const { colors } = useTheme();
  const key = squadIconKey(iconKey);
  const Icon =
    type === "squad"
      ? squadIcons[key]
      : type === "space"
        ? Layers3
        : type === "organization"
          ? Building2
          : List;
  const label =
    type === "squad"
      ? `Squad icon: ${squadIconChoices.find((choice) => choice.key === key)!.label}`
      : type === "list"
        ? "Private list icon"
        : type === "space"
          ? "Organization icon"
          : "Super-Organization icon";
  return (
    <View
      testID={`community-avatar-${type}-${type === "squad" ? key : "default"}`}
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: colors.lime,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon
        size={Math.round(size * 0.52)}
        color={colors.green}
        accessible={false}
      />
    </View>
  );
}
