import React from "react";
import { Pressable, Text, View } from "react-native";
import { useDesignTheme } from "@/src/shared/design-system";

/** Small visible controls retain a full touch target without padded button faces. */
export function HomeAction({
  title,
  label = title,
  onPress,
  primary = false,
  plain = false,
  disabled = false,
  selected,
  icon,
  testID,
  stretch = false,
  outlined = false,
}: {
  title?: string;
  label?: string;
  onPress: () => void;
  primary?: boolean;
  plain?: boolean;
  disabled?: boolean;
  selected?: boolean;
  icon?: React.ReactNode;
  testID?: string;
  stretch?: boolean;
  outlined?: boolean;
}) {
  const { colors } = useDesignTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        alignSelf: stretch ? "stretch" : undefined,
        minHeight: 44,
        minWidth: 44,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        flexShrink: 0,
      })}
    >
      <View
        testID={testID ? `${testID}-face` : undefined}
        style={{
          width: stretch ? "100%" : undefined,
          minHeight: outlined ? 34 : 30,
          minWidth: outlined ? 36 : undefined,
          paddingHorizontal: plain ? 4 : 10,
          paddingVertical: 5,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          backgroundColor: primary
            ? colors.accent
            : plain
              ? "transparent"
              : colors.surfaceRaised,
          borderRadius: outlined ? 11 : stretch ? 9 : 15,
          borderWidth: outlined ? 1 : plain || primary ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        {icon}
        {title ? (
          <Text
            style={{
              color: primary ? colors.onAccent : colors.textSecondary,
              fontSize: 12,
              lineHeight: 18,
              fontWeight: "500",
            }}
          >
            {title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
