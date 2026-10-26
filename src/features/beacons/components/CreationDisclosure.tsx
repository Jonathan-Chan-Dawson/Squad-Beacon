import React, { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useReducedMotion } from "@/src/shared/design-system";
import { Txt, useTheme } from "@/src/shared/ui";
import { ChevronDown } from "lucide-react-native";
export function CreationDisclosure({
  title,
  summary,
  open,
  onToggle,
  children,
  compact = false,
  icon,
}: {
  icon?: React.ReactNode;
  compact?: boolean;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { styles, colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [rotation] = useState(() => new Animated.Value(open ? 1 : 0));
  useEffect(() => {
    Animated.timing(rotation, {
      toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : 170,
      useNativeDriver: true,
    }).start();
    return () => rotation.stopAnimation();
  }, [open, reducedMotion, rotation]);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: 12,
        backgroundColor: open ? colors.lime : colors.white,
        paddingHorizontal: 10,
        paddingTop: compact ? 2 : 4,
        paddingBottom: open ? 10 : 2,
        gap: compact ? 2 : 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={compact ? summary : undefined}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={{
          minHeight: compact ? 44 : 52,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {icon}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={compact ? styles.label : styles.h2}>{title}</Text>
          {summary ? <Txt muted>{summary}</Txt> : null}
        </View>
        <Animated.View
          accessible={false}
          style={[
            {
              width: 22,
              alignItems: "center",
              justifyContent: "center",
              transform: [
                {
                  rotate: rotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "180deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <ChevronDown size={18} strokeWidth={2} color={colors.muted} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View
          style={{
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            paddingTop: 8,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
