import React, { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Check, Flame, ParkingCircle, Timer, TriangleAlert } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { cancelAnimation, ZoomIn, ZoomOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useReducedMotion } from "@/src/shared/design-system";
import { useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import type { PulseSummary } from "../types";
import { pulseCopy } from "../copy/pulse";
import { pulseSummaryLabel } from "../wording";
import { PulseLevelGlyph, usePulseColors } from "./PulseVisuals";

export type PulseBadgeProps = {
  summary: PulseSummary;
  satellite?: boolean;
  popToken?: string | number;
  placeName?: string;
  onPress?: () => void;
  calm?: boolean;
};

export function PulseBadge({ summary, satellite = false, popToken, placeName, onPress, calm = false }: PulseBadgeProps) {
  const { semanticColors: colors } = useTheme();
  const levels = usePulseColors();
  const reducedMotion = useReducedMotion();
  const now = useNow();
  const glow = useSharedValue(0.25);
  const scale = useSharedValue(1);
  const popHalo = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const popHaloStyle = useAnimatedStyle(() => ({ opacity: popHalo.value * 0.35, transform: [{ scale: 1 + (1 - popHalo.value) * 0.8 }] }));
  const crowd = summary.crowd ?? 0;
  const condition = summary.conditions[0];
  const availability = condition && ["seats_available", "equipment_available", "courts_open"].includes(condition.key);
  const dominantLevel = condition ? condition.key === "blocked_closed" ? 3 : availability ? 0 : 1
    : summary.wait !== undefined && summary.wait >= 2 ? summary.wait : summary.parking !== undefined ? summary.parking === 2 ? 3 : summary.parking : crowd;
  const color = levels[dominantLevel];
  const breathing = crowd >= 2 && summary.freshness >= 0.5 && !calm && !reducedMotion;
  useEffect(() => {
    glow.set(breathing ? withRepeat(withTiming(0.55, { duration: crowd === 3 ? 800 : 1200 }), -1, true) : 0.25);
    return () => cancelAnimation(glow);
  }, [breathing, crowd, glow]);
  useEffect(() => {
    if (popToken && !reducedMotion) {
      scale.set(withSequence(withTiming(0.6, { duration: 1 }), withSpring(1.1, { damping: 18, stiffness: 220 }), withSpring(1, { damping: 18, stiffness: 220 })));
      popHalo.set(withSequence(withTiming(1, { duration: 1 }), withTiming(0, { duration: 360 })));
    } else { scale.set(1); popHalo.set(0); }
  }, [popToken, reducedMotion, scale, popHalo]);
  const Icon = condition ? availability ? Check : TriangleAlert : summary.wait !== undefined && summary.wait >= 2 ? Timer : summary.parking !== undefined ? ParkingCircle : Flame;
  const label = (placeName || pulseCopy.areaUpdate) + ": " + pulseSummaryLabel(summary, now);
  const height = satellite ? 16 : 24;
  const body = <Animated.View entering={reducedMotion ? undefined : ZoomIn.duration(180)} exiting={reducedMotion ? undefined : ZoomOut.duration(240)}
    style={[{ opacity: Math.max(0.55, Math.min(1, 0.55 + summary.freshness * 0.45)) }, animatedStyle]}>
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -6, left: -6, right: -6, bottom: -6 }, popHaloStyle]}>
      <Svg width="100%" height="100%"><Circle cx="50%" cy="50%" r={satellite ? 12 : 18} stroke={color} strokeWidth={2} fill="none" /></Svg>
    </Animated.View>
    {crowd >= 2 && <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -8, left: -8, right: -8, bottom: -8 }, glowStyle]}>
      <Svg width="100%" height="100%"><Circle cx="50%" cy="50%" r={satellite ? 14 : 20} fill={color} /></Svg>
    </Animated.View>}
    <View style={{ height, paddingHorizontal: satellite ? 3 : 5, flexDirection: "row", alignItems: "center", gap: satellite ? 2 : 4,
      borderRadius: height / 2, borderWidth: 1, borderColor: color, backgroundColor: colors.surface }}>
      <Icon size={satellite ? 10 : 14} color={color} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><PulseLevelGlyph level={dominantLevel} compact color={color} /></View>
    </View>
  </Animated.View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={satellite ? 14 : 10}>{body}</Pressable>
    : <View accessibilityLabel={label}>{body}</View>;
}
