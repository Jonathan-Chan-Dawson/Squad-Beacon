import React, { useState } from "react";
import { Text } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useReducedMotion } from "@/src/shared/design-system";
import { useTheme } from "@/src/shared/ui";
import { pulseCopy } from "@/src/features/pulse/copy/pulse";
export function MapContextMenu({
  point,
  bounds,
  onUpdate,
  onCreate,
  onDirections,
}: {
  point: { x: number; y: number };
  bounds: { width: number; height: number; top: number; bottom: number };
  onUpdate(): void;
  onCreate(): void;
  onDirections(): void;
}) {
  const { colors, tokens } = useTheme();
  const [menuHeight, setMenuHeight] = useState(164);
  const gutter = tokens.layout.screenGutter;
  const menuWidth = Math.min(236, bounds.width - gutter * 2);
  const reduced = useReducedMotion();
  return (
    <Animated.View
      onLayout={(event) => setMenuHeight(event.nativeEvent.layout.height)}
      entering={
        reduced
          ? FadeIn.duration(120)
          : ZoomIn.springify().damping(18).stiffness(220)
      }
      style={{
        position: "absolute",
        left: Math.max(
          gutter,
          Math.min(bounds.width - menuWidth - gutter, point.x - menuWidth / 2),
        ),
        top: Math.max(
          bounds.top,
          Math.min(bounds.height - bounds.bottom - menuHeight, point.y - 30),
        ),
        width: menuWidth,
        padding: tokens.space.sm,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white,
        zIndex: 30,
        elevation: 30,
      }}
    >
      {[
        [pulseCopy.title, onUpdate],
        [pulseCopy.createBeacon, onCreate],
        [pulseCopy.directions, onDirections],
      ].map(([label, action]) => (
        <MotionPressable
          key={String(label)}
          accessibilityRole="button"
          accessibilityLabel={String(label)}
          onPress={action as () => void}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: 10,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: "600" }}>
            {String(label)}
          </Text>
        </MotionPressable>
      ))}
    </Animated.View>
  );
}
