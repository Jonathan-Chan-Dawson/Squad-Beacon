import React, { useEffect } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotion } from "@/src/shared/design-system";
import { PulseBadge } from "@/src/features/pulse/components/PulseBadge";
import { summaryPulsePlace, type ProjectedPulse } from "../pulseMapPolicy";
import type { PulsePlace } from "@/src/features/pulse/types";
function HeatGlow({ item, calm }: { item: ProjectedPulse; calm: boolean }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.2);
  useEffect(() => {
    opacity.set(
      !calm && !reduced && item.summary.freshness >= 0.5
        ? withRepeat(
            withTiming(0.24, {
              duration: item.summary.crowd === 3 ? 800 : 1200,
            }),
            -1,
            true,
          )
        : 0.2,
    );
    return () => cancelAnimation(opacity);
  }, [calm, item.summary.crowd, item.summary.freshness, opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const color = item.summary.crowd === 3 ? "#DE477B" : "#E87536";
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: item.x - 36,
          top: item.y - 36,
          width: 72,
          height: 72,
        },
        style,
      ]}
    >
      <Svg width={72} height={72}>
        <Defs>
          <RadialGradient id="heat">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={36} cy={36} r={36} fill="url(#heat)" />
      </Svg>
    </Animated.View>
  );
}
export function PulseMapOverlay({
  points,
  halos,
  places,
  onPlace,
  popToken,
  popPlaceKey,
  calm = false,
}: {
  points: readonly ProjectedPulse[];
  halos?: readonly ProjectedPulse[];
  places: readonly PulsePlace[];
  onPlace?: (place: PulsePlace, point?: { x: number; y: number }) => void;
  popToken?: string | number;
  popPlaceKey?: string;
  calm?: boolean;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        opacity: calm ? 0 : 1,
      }}
    >
      {halos?.map((item) => (
        <HeatGlow key={item.summary.placeKey} item={item} calm={calm} />
      ))}
      {points.map((item) => {
        const place = summaryPulsePlace(item.summary, places);
        const offset = item.satellite ? 15 : 0;
        return (
          <View
            key={item.summary.placeKey}
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: item.x - 12 + offset,
              top: item.y - 12 + offset,
            }}
          >
            <PulseBadge
              summary={item.summary}
              satellite={item.satellite}
              placeName={place.name}
              popToken={
                item.summary.placeKey === popPlaceKey ? popToken : undefined
              }
              calm={calm}
              onPress={() => onPlace?.(place, item)}
            />
          </View>
        );
      })}
    </View>
  );
}
