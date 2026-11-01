import React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useDesignTheme, useReducedMotion } from "@/src/shared/design-system";

export function PrimaryTab({
  label,
  selected,
  onPress,
  role = "button",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: "button" | "tab";
}) {
  const { colors, tokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = React.useState(false);
  const underline = useAnimatedStyle(
    () => ({
      opacity: reducedMotion
        ? selected
          ? 1
          : 0
        : withTiming(selected ? 1 : 0, { duration: 160 }),
    }),
    [selected, reducedMotion],
  );
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-selected={role === "tab" ? selected : undefined}
      aria-pressed={role === "button" ? selected : undefined}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        borderWidth: 2,
        borderColor: focused ? colors.accent : "transparent",
        borderRadius: tokens.radius.xs,
        minHeight: tokens.layout.minTapTarget,
        minWidth: tokens.layout.minTapTarget,
        paddingHorizontal: tokens.space.sm,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
        style={{
          ...tokens.type.secondary,
          fontWeight: selected ? "700" : "500",
          color: selected ? colors.textPrimary : colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: tokens.space.sm,
            right: tokens.space.sm,
            height: 2,
            backgroundColor: colors.accent,
          },
          underline,
        ]}
      />
    </Pressable>
  );
}

export function NavigationFilterChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, tokens } = useDesignTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        borderWidth: 2,
        borderColor: focused ? colors.accent : "transparent",
        borderRadius: tokens.radius.pill,
        minHeight: tokens.layout.minTapTarget,
        justifyContent: "center",
      }}
    >
      <View
        testID={testID}
        style={{
          minHeight: 32,
          paddingHorizontal: 12,
          justifyContent: "center",
          borderRadius: tokens.radius.pill,
          backgroundColor: selected ? colors.accent : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.accent : colors.border,
        }}
      >
        <Text
          style={{
            ...tokens.type.secondary,
            fontWeight: "600",
            color: selected ? colors.onAccent : colors.textSecondary,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
