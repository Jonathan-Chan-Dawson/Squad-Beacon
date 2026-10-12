import React from "react";
import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";
import { mapTooltip } from "./tooltipConstants";

export function MapTooltipShell({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={{
        padding: mapTooltip.padding,
        gap: mapTooltip.gap,
        borderRadius: mapTooltip.radius,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
      }}
    >
      {children}
    </View>
  );
}
export function MapTooltipClose({
  onClose,
  label,
}: {
  onClose(): void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onClose}
      hitSlop={4}
      style={{
        width: mapTooltip.closeWidth,
        height: mapTooltip.actionHeight,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <X size={mapTooltip.iconSize} color={colors.muted} />
    </Pressable>
  );
}

export function MapTooltipButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  accessibilityLabel,
}: {
  accessibilityLabel?: string;
  title: string;
  onPress(): void;
  secondary?: boolean;
  disabled?: boolean;
  compact?: boolean;
  icon?: React.ReactNode;
}) {
  const { colors, semanticColors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: mapTooltip.actionHeight,
        paddingHorizontal: mapTooltip.actionPadding,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: mapTooltip.actionRadius,
        borderWidth: 1,
        borderColor: secondary ? colors.line : colors.green,
        backgroundColor: secondary ? colors.bg : colors.green,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: mapTooltip.actionTextSize,
          fontWeight: "700",
          color: secondary ? colors.ink : semanticColors.onAccent,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
