import React from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useReducedMotion } from "@/src/shared/design-system";
import { useTheme } from "@/src/shared/ui";
import { pulseCopy } from "../copy/pulse";

export function usePulseColors() {
  const { resolvedAppearance } = useTheme();
  return resolvedAppearance === "dark"
    ? ["#7FD2B8", "#D9B75A", "#F4A35D", "#F273A3"] as const
    : ["#357B63", "#9D7419", "#B95B1E", "#B93860"] as const;
}

export function PulseLevelGlyph({ level, compact = false, color }: { level: number; compact?: boolean; color?: string }) {
  const { semanticColors: colors } = useTheme();
  const levels = usePulseColors();
  const reducedMotion = useReducedMotion();
  const selected = Math.max(0, Math.min(3, level));
  return <View accessibilityLabel={pulseCopy.crowd[selected]} style={{ flexDirection: "row", alignItems: "flex-end", gap: compact ? 2 : 4, height: compact ? 12 : 22 }}>
    {[0, 1, 2, 3].map((segment) => <Animated.View key={segment} entering={reducedMotion ? undefined : FadeIn.duration(180).delay(segment * 40)}
      style={{ width: compact ? 3 : 12, height: compact ? 4 + segment * 2 : 10 + segment * 4, borderRadius: 2,
        backgroundColor: segment <= selected ? color ?? levels[selected] : colors.border }} />)}
  </View>;
}
