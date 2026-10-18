import React from "react";
import { Text, View } from "react-native";
import { Radio } from "lucide-react-native";
import { useDesignTheme } from "@/src/shared/design-system";
import { ActivityBadge } from "../ActivityBadge";
import { resolveBeaconIcon } from "../beaconIcon";

export function BeaconIcon({
  emoji,
  category,
  size = 32,
  inline = false,
}: {
  emoji?: string | null;
  category?: string | null;
  size?: number;
  inline?: boolean;
}) {
  const { colors, tokens } = useDesignTheme();
  const icon = resolveBeaconIcon(emoji, category);
  return (
    <View
      testID={`beacon-icon-${icon.kind}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        icon.kind === "category" ? `${icon.category} Beacon` : "Beacon"
      }
      style={{
        width: size,
        height: size,
        borderRadius: inline ? 0 : size / 3,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: inline
          ? "transparent"
          : tokens.availability.available.tint,
      }}
    >
      {icon.kind === "emoji" ? (
        <Text
          style={{
            fontSize: inline ? size : size * 0.58,
            lineHeight: inline ? size + 2 : size * 0.8,
          }}
        >
          {icon.emoji}
        </Text>
      ) : icon.kind === "category" ? (
        <ActivityBadge
          category={icon.category}
          size={size}
          iconSize={inline ? size * 0.85 : size * 0.54}
        />
      ) : (
        <Radio
          size={inline ? size * 0.85 : size * 0.56}
          color={colors.accent}
        />
      )}
    </View>
  );
}
