import React, { useEffect, useState } from "react";
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";
import { useReducedMotion } from "@/src/shared/design-system";

/** The screen owns the outside-tap shield; this surface never covers its trigger. */
export function MapControlPopover({
  title,
  onClose,
  width,
  maxHeight,
  top,
  right,
  children,
}: {
  title: string;
  onClose(): void;
  width: number;
  maxHeight: number;
  top: number;
  right: number;
  children: React.ReactNode;
}) {
  const { colors, styles } = useTheme();
  const reducedMotion = useReducedMotion();
  const [reveal] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: 1,
      duration: reducedMotion ? 0 : 140,
      useNativeDriver: true,
    }).start();
    const subscription =
      Platform.OS === "web"
        ? null
        : BackHandler.addEventListener("hardwareBackPress", () => {
            onClose();
            return true;
          });
    if (Platform.OS === "web") {
      const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      };
      document.addEventListener("keydown", escape);
      return () => document.removeEventListener("keydown", escape);
    }
    return () => subscription?.remove();
  }, [onClose, reducedMotion, reveal]);
  return (
    <Animated.View
      testID={`map-${title.toLowerCase().replaceAll(" ", "-")}-popover`}
      style={{
        position: "absolute",
        top,
        right,
        width,
        maxHeight,
        padding: 10,
        gap: 4,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
        boxShadow: "0 8px 28px #142e3033",
        opacity: reveal,
        transform: [
          {
            translateX: reveal.interpolate({
              inputRange: [0, 1],
              outputRange: [5, 0],
            }),
          },
        ],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={[styles.label, { flex: 1 }]}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title.toLowerCase()}`}
          onPress={onClose}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={17} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 5 }}>
        {children}
      </ScrollView>
    </Animated.View>
  );
}

export function MapNavigationRow({
  label,
  icon: Icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress(): void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 6,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={17} color={colors.green} />
      <Text style={{ color: colors.ink, fontSize: 13, flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
