import React, { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useReducedMotion } from "@/src/shared/design-system";
import { Txt, useTheme } from "@/src/shared/ui";
export function CreationDisclosure({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
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
        borderTopWidth: 1,
        borderColor: colors.line,
        paddingTop: 8,
        gap: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onToggle}
        style={{
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.h2}>{title}</Text>
          {!open && summary ? <Txt muted>{summary}</Txt> : null}
        </View>
        <Animated.Text
          accessible={false}
          style={[
            styles.body,
            {
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
          ⌄
        </Animated.Text>
      </Pressable>
      {open ? <View style={{ gap: 12 }}>{children}</View> : null}
    </View>
  );
}
