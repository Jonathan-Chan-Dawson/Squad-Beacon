import React, { type ReactNode } from "react";
import { Keyboard, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useTheme } from "@/src/shared/ui";

export function ChatIdentityHeader({
  name,
  subtitle,
  avatar,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  subtitle?: string;
  avatar: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Opens a compact profile preview"
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingHorizontal: 8,
        borderRadius: 16,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 42,
          height: 42,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {avatar}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}
        >
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </MotionPressable>
  );
}
