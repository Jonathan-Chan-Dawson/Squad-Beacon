import React from "react";
import { View } from "react-native";
import { Check, Minus } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { useDesignTheme } from "@/src/theme";
import {
  friendAvailabilityState,
  type FriendAvailabilityState,
} from "@/src/shared/domain";
import type { Activity } from "@/src/shared/types";
import { availabilityColors, type activeAvailability } from "@/src/features/beacons/availability";

export function AvailabilityArc({ detail, size }: { detail?: ReturnType<typeof activeAvailability>; size: number }) {
  if (!detail || detail.progress == null) return null;
  const center = size / 2;
  const radius = center - 1.25;
  const end = Math.PI / 6 + detail.progress * Math.PI * 2 / 3;
  return <Svg pointerEvents="none" width={size} height={size} style={{ position: "absolute", left: 0, top: 0 }}>
    <Path d={`M ${center + Math.cos(Math.PI / 6) * radius} ${center + radius / 2} A ${radius} ${radius} 0 0 1 ${center + Math.cos(end) * radius} ${center + Math.sin(end) * radius}`} stroke={detail.arcColor} strokeWidth={2.5} strokeLinecap="round" fill="none" />
  </Svg>;
}

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
  const { colors } = useDesignTheme();
  if (!state || state === "unknown") return null;
  const busy = state === "unavailable";
  const Icon = busy ? Minus : Check;
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
        bottom: -1,
        right: -1,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: busy ? availabilityColors.busy : availabilityColors.available,
        borderColor: colors.surface,
        borderWidth: 2,
        zIndex: 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    ><Icon size={Math.max(5, size - 5)} color="#243129" strokeWidth={3} /></View>
  );
}
