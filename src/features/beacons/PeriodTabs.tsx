import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { CalendarDays, History, Zap } from "lucide-react-native";
import { MotionPressable } from "@/src/shared/MotionPressable";
import {
  uiHaptics,
  useDesignTheme,
  useReducedMotion,
} from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";
import type { FeedPage } from "./FeedPager.types";

export type PeriodTabsProps = {
  value: FeedPage;
  onChange: (value: FeedPage) => void;
  nowCount: number;
  upcomingCount: number;
};

export function PeriodTabs({
  value,
  onChange,
  nowCount,
  upcomingCount,
}: PeriodTabsProps) {
  const { colors, tokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const options = useMemo(
    () => [
      { value: "Now" as const, label: "Now", count: nowCount, Icon: Zap },
      {
        value: "Upcoming" as const,
        label: "Upcoming",
        count: upcomingCount,
        Icon: CalendarDays,
      },
      { value: "Past" as const, label: "Past", Icon: History },
    ],
    [nowCount, upcomingCount],
  );
  const activeIndex = options.findIndex((option) => option.value === value);
  const segmentWidth = Math.max(0, (width - space.xs * 2 - space.xs * 2) / 3);
  const indicator = useAnimatedStyle(() => {
    const offset = Math.max(0, activeIndex) * (segmentWidth + space.xs);
    return {
      transform: [
        {
          translateX: reducedMotion
            ? offset
            : withSpring(offset, tokens.motion.spring),
        },
      ],
    };
  }, [activeIndex, reducedMotion, segmentWidth, tokens.motion.spring]);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Beacon time period"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        position: "relative",
        flexDirection: "row",
        alignItems: "stretch",
        gap: space.xs,
        padding: space.xs,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
        borderColor: colors.border,
        borderWidth: 1,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: space.xs,
            top: space.xs,
            bottom: space.xs,
            width: segmentWidth,
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          },
          indicator,
        ]}
      />
      {options.map(({ value: option, label, count, Icon }) => {
        const selected = option === value;
        const color = selected ? colors.textPrimary : colors.textSecondary;
        return (
          <MotionPressable
            key={option}
            accessibilityRole="tab"
            accessibilityLabel={
              count === undefined ? label : `${label}, ${count} Beacons`
            }
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => {
              if (selected) return;
              void uiHaptics.light();
              onChange(option);
            }}
            style={({ pressed }) => ({
              zIndex: 1,
              flex: 1,
              minWidth: 0,
              minHeight: tokens.layout.minTapTarget,
              paddingHorizontal: space.xs,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: space.xs,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <Icon size={16} color={color} />
            <Text
              numberOfLines={1}
              style={{
                color,
                ...type.secondary,
                fontWeight: selected ? type.weight.bold : type.weight.medium,
                flexShrink: 1,
              }}
            >
              {label}
            </Text>
            {count !== undefined ? (
              <View
                style={{
                  minWidth: 19,
                  height: 19,
                  paddingHorizontal: 4,
                  borderRadius: radius.circle,
                  backgroundColor: selected ? colors.accent : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: selected ? colors.onAccent : colors.textSecondary,
                    ...type.caption,
                    fontWeight: type.weight.bold,
                  }}
                >
                  {count > 99 ? "99+" : count}
                </Text>
              </View>
            ) : null}
          </MotionPressable>
        );
      })}
    </View>
  );
}
