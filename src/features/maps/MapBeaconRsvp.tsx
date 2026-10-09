import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Check } from "lucide-react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, useTheme } from "@/src/shared/ui";
import {
  uiHaptics,
  useDesignTheme,
  useReducedMotion,
} from "@/src/shared/design-system";
import { beaconCapacity, isApprovedGoing } from "@/src/features/beacons/permissions";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import type { Activity } from "@/src/shared/types";

/** The map's compact RSVP controls use the same canonical `rsvp` action as BeaconResponse. */
export function MapBeaconRsvp({
  activity,
  compact = false,
}: {
  activity: Activity;
  compact?: boolean;
}) {
  const { data, userId, act } = useBeacon();
  const { styles } = useTheme();
  const { colors } = useDesignTheme();
  const now = useNow();
  const reducedMotion = useReducedMotion();
  const [transient, setTransient] = useState<{
    activityId: string;
    busy: boolean;
    error: string;
    check: boolean;
  }>({ activityId: activity.id, busy: false, error: "", check: false });
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rsvp = data.rsvps.find(
    (candidate) => candidate.activity_id === activity.id && candidate.user_id === userId,
  );
  const going = isApprovedGoing(activity, rsvp);
  const pending = rsvp?.status === "requested";
  const capacity = beaconCapacity(data, activity);
  const closed = capacity.closed && !pending && !going;
  const approval =
    (activity.approval_required || activity.mode === "invite") && !rsvp?.approved;
  const active =
    activity.status === "scheduled" && Date.parse(activity.ends_at) > now;
  const canRespond =
    !!userId &&
    data.viewer_id === userId &&
    canReadBeaconActivity(data, activity, userId) &&
    activity.owner_id !== userId &&
    activity.mode !== "solo" &&
    active;

  // Keep transient feedback scoped to the current row identity because FlashList recycles cells.
  useEffect(() => {
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [activity.id]);

  if (!canRespond) return null;

  const currentTransient =
    transient.activityId === activity.id
      ? transient
      : { activityId: activity.id, busy: false, error: "", check: false };
  const busy = currentTransient.busy;
  const error = currentTransient.error;

  async function respond(status: "going" | "interested" | "withdraw") {
    const hadGoing = going;
    setTransient({ activityId: activity.id, busy: true, error: "", check: false });
    try {
      await act("rsvp", { id: activity.id, status });
      if (status === "going") {
        await uiHaptics.success();
        if (!hadGoing) {
          setTransient((current) =>
            current.activityId === activity.id
              ? { ...current, check: true }
              : current,
          );
          if (checkTimer.current) clearTimeout(checkTimer.current);
          checkTimer.current = setTimeout(() => {
            setTransient((current) =>
              current.activityId === activity.id
                ? { ...current, check: false }
                : current,
            );
          }, 1800);
        }
      }
    } catch (responseError) {
      setTransient({
        activityId: activity.id,
        busy: false,
        check: false,
        error:
          responseError instanceof Error
            ? responseError.message
            : "Could not update your response.",
      });
    } finally {
      setTransient((current) =>
        current.activityId === activity.id ? { ...current, busy: false } : current,
      );
    }
  }

  const disabled = busy || closed;
  const mainTitle = going
    ? "I'm Out"
    : pending
      ? "Pending"
      : capacity.full
        ? "Full"
        : closed
          ? "Closed"
          : approval
            ? "Request to join"
            : "I'm In";
  const mainSecondary = going || pending || closed;

  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Button
            title={busy ? "Working…" : mainTitle}
            onPress={() => void respond(going ? "withdraw" : "going")}
            disabled={disabled || pending}
            secondary={mainSecondary}
            compact={compact}
            icon={
              currentTransient.check ? (
                <Animated.View
                  entering={
                    reducedMotion
                      ? FadeIn.duration(120)
                      : FadeIn.springify().damping(18)
                  }
                  exiting={FadeOut.duration(120)}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Check size={16} color={colors.accent} />
                </Animated.View>
              ) : undefined
            }
          />
        </View>
        {!going && !closed && !pending && (
          <View style={{ flex: 0.82 }}>
            <Button
              title={busy ? "Working…" : "Maybe"}
              onPress={() => void respond("interested")}
              disabled={busy || rsvp?.status === "interested"}
              secondary
              compact={compact}
            />
          </View>
        )}
        {pending && (
          <View style={{ flex: 0.82 }}>
            <Button
              title={busy ? "Working…" : "Cancel request"}
              onPress={() => void respond("withdraw")}
              disabled={busy}
              secondary
              compact
            />
          </View>
        )}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={[styles.error, { fontSize: 12 }]}>
          {error}
        </Text>
      )}
    </View>
  );
}
