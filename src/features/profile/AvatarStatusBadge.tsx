import React from "react";
import { View } from "react-native";
import { useDesignTheme } from "@/src/theme";
import {
  friendAvailabilityState,
  type FriendAvailabilityState,
} from "@/src/shared/domain";
import type { Activity } from "@/src/shared/types";

export function avatarAvailability(
  activities: readonly Activity[],
  personId: string,
  now: number,
): FriendAvailabilityState {
  return (
    activities
      .filter((activity) => activity.owner_id === personId)
      .map((activity) => friendAvailabilityState(activity, now))
      .find((state) => state !== "unknown") ?? "unknown"
  );
}

/** Unknown/private availability never gets a colored badge. */
export function AvatarStatusBadge({
  state,
  size = 12,
}: {
  state?: FriendAvailabilityState;
  size?: number;
}) {
  const { availability, colors } = useDesignTheme();
  if (!state || state === "unknown") return null;
  const token = availability[state === "ending-soon" ? "endingSoon" : state];
  return (
    <View
      testID={`avatar-status-${state}`}
      accessibilityLabel={
        state === "available"
          ? "Free to hang"
          : state === "unavailable"
            ? "Busy"
            : "Availability ending soon"
      }
      style={{
        position: "absolute",
        top: -1,
        right: -1,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: token.color,
        borderColor: colors.surface,
        borderWidth: 2,
        zIndex: 2,
      }}
    />
  );
}
