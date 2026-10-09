import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Text, View } from "react-native";
import { UsersRound } from "lucide-react-native";
import type { Profile } from "@/src/shared/types";
import {
  AvatarStack,
  Card,
  useDesignTheme,
  useReducedMotion,
} from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";

export type ActivityDetailProgressProps = {
  avatars: Profile[];
  count: number;
  capacity: number | null;
  target: number | null;
  joining: boolean;
};

export function ActivityDetailProgress({
  avatars,
  count,
  capacity,
  target,
  joining,
}: ActivityDetailProgressProps) {
  const { colors } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [avatarScale] = useState(() => new Animated.Value(1));
  const previousCount = useRef(count);
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
  const hasCapacity = capacity != null && Number.isFinite(capacity) && capacity > 0;
  const hasTarget = target != null && Number.isFinite(target) && target > 0;
  const safeCapacity = hasCapacity ? capacity : null;
  const safeTarget = hasTarget ? target : null;
  const needMore = safeTarget == null ? 0 : Math.max(0, safeTarget - safeCount);
  const progressMax = safeTarget ?? safeCapacity;
  const people = avatars.map(({ id, name }) => ({ id, name }));

  useEffect(() => {
    const increased = safeCount > previousCount.current;
    previousCount.current = safeCount;
    if (!increased || reducedMotion) return;
    avatarScale.setValue(0.86);
    const animation = Animated.spring(avatarScale, {
      toValue: 1,
      damping: 16,
      stiffness: 260,
      mass: 0.72,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [avatarScale, reducedMotion, safeCount]);

  return (
    <Card
      testID="activity-detail-progress"
      style={{ gap: 10, padding: space.md }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <UsersRound size={18} color={colors.accent} />
          <Text style={{ color: colors.textPrimary, ...type.headline }}>
            {safeCount} going
          </Text>
        </View>
        {joining && (
          <View
            accessibilityLiveRegion="polite"
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            {!reducedMotion && (
              <ActivityIndicator size="small" color={colors.accent} />
            )}
            <Text style={{ color: colors.textSecondary, ...type.caption }}>
              Joining...
            </Text>
          </View>
        )}
      </View>

      {people.length > 0 && (
        <Animated.View
          style={{ alignSelf: "flex-start", transform: [{ scale: avatarScale }] }}
        >
          <AvatarStack people={people} limit={4} size={34} />
        </Animated.View>
      )}

      {(safeTarget != null || safeCapacity != null) && (
        <View style={{ gap: 8 }}>
          <View
            style={{
              minHeight: 24,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {safeTarget != null && (
                <Text
                  accessibilityLabel={`Hoping for ${safeTarget} participants`}
                  style={{
                    color: colors.textPrimary,
                    ...type.secondary,
                    fontWeight: type.weight.semibold,
                  }}
                >
                  Hoping for {safeTarget}
                </Text>
              )}
              {safeCapacity != null && (
                <Text
                  accessibilityLabel={`Capacity ${safeCapacity} spots`}
                  style={{ color: colors.textSecondary, ...type.caption }}
                >
                  {safeCapacity} spots
                </Text>
              )}
            </View>
            {needMore > 0 && (
              <Text
                style={{
                  color: colors.textSecondary,
                  ...type.caption,
                  fontWeight: type.weight.semibold,
                }}
              >
                Need {needMore} more
              </Text>
            )}
          </View>
          {progressMax != null && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={
                safeTarget != null
                  ? `Crew target: ${safeCount} of ${safeTarget}`
                  : `Capacity: ${safeCount} of ${safeCapacity}`
              }
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(Math.min(1, safeCount / progressMax) * 100),
              }}
              style={{
                height: 7,
                overflow: "hidden",
                borderRadius: radius.pill,
                backgroundColor: colors.border,
              }}
            >
              <View
                style={{
                  width: `${Math.round(Math.min(1, safeCount / progressMax) * 100)}%`,
                  height: "100%",
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

export default ActivityDetailProgress;
