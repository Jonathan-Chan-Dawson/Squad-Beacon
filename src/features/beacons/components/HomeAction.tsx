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
  tone,
  prominent = false,
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
  tone?: { color: string; tint: string };
  prominent?: boolean;
}) {
  const { colors } = useDesignTheme();
  return (
    <Pressable
      aria-pressed={selected}
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
          minHeight: prominent ? 44 : outlined ? 34 : 30,
          minWidth: prominent ? 44 : outlined ? 36 : undefined,
          paddingHorizontal: plain ? 4 : 10,
          paddingVertical: 5,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          backgroundColor:
            tone?.tint ??
            (primary
              ? colors.accent
              : plain
                ? "transparent"
                : colors.surfaceRaised),
          borderRadius: prominent ? 12 : outlined ? 11 : stretch ? 9 : 15,
          borderWidth: outlined ? 1 : plain || primary ? 0 : 1,
          borderColor: tone?.color ?? colors.border,
        }}
      >
        {icon}
        {title ? (
          <Text
            style={{
              color:
                tone?.color ??
                (primary ? colors.onAccent : colors.textSecondary),
              fontSize: prominent ? 14 : 12,
              lineHeight: prominent ? 20 : 18,
              fontWeight: prominent ? "600" : "500",
            }}
          >
            {title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
