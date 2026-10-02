import React from "react";
import { View } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canSetArrivalState } from "@/src/features/beacons/permissions";
import { Action, Txt, useTheme } from "@/src/shared/ui";

const states = [
  ["none", "Clear"],
  ["arriving", "Arriving"],
  ["present", "Here now"],
] as const;

export function AttendanceControls({ activity }: { activity: Activity }) {
  const { data, userId, act } = useBeacon();
  const { styles } = useTheme();
  const now = useNow();
  if (!userId) return null;
  const current = data.beacon_attendance.find(
    (entry) => entry.activity_id === activity.id && entry.user_id === userId,
  );
  if (!canUseBeaconModules(data, activity, userId)) return null;
  const currentState = current?.state ?? "none";
  const readOnly = activity.status === "completed" || activity.status === "cancelled";
  const available = states.filter(([state]) =>
    canSetArrivalState(data, activity, userId, userId, state, now),
  );
  if ((readOnly && !current) || (!readOnly && available.length === 0)) return null;
  const currentLabel = states.find(([state]) => state === currentState)?.[1] ?? "Clear";
  return (
    <View style={[styles.card, { gap: 8, padding: 13 }]}>
      <Txt>Arrival · manual</Txt>
      {readOnly ? (
        <Txt muted>Saved arrival: {currentLabel}. This history is read-only.</Txt>
      ) : (
        <>
          <Txt muted>Let the group know when you’re on your way or here.</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {available.map(([state, label]) => (
              <View key={state} style={{ minWidth: 90, flexGrow: 1 }}>
                <Action
                  title={currentState === state ? `${label} · selected` : label}
                  secondary={currentState !== state}
                  run={() => act("set_beacon_attendance", { id: activity.id, state })}
                />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
