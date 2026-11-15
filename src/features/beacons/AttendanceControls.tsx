import { Clock3, MapPin, Navigation } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canSetArrivalState } from "@/src/features/beacons/permissions";
import { Action, Txt, useTheme } from "@/src/shared/ui";

const states = [
  ["none", "Not on my way"],
  ["arriving", "On my way"],
  ["present", "I’m here"],
] as const;

export function AttendanceControls({ activity }: { activity: Activity }) {
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  if (!userId) return null;
  const current = data.beacon_attendance.find(
    (entry) => entry.activity_id === activity.id && entry.user_id === userId,
  );
  if (!canUseBeaconModules(data, activity, userId)) return null;
  const currentState = current?.state ?? "none";
  const readOnly =
    activity.status === "completed" || activity.status === "cancelled";
  const available = states.filter(([state]) =>
    canSetArrivalState(data, activity, userId, userId, state, now),
  );
  if ((readOnly && !current) || (!readOnly && available.length === 0))
    return null;
  const currentLabel =
    states.find(([state]) => state === currentState)?.[1] ?? "Not on my way";
  return (
    <View style={[styles.card, { gap: 8, padding: 13 }]}>
      <View style={styles.row}>
        {currentState === "none" ? (
          <Clock3 size={20} color={colors.green} />
        ) : (
          <MapPin size={20} color={colors.green} />
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.h2}>Your arrival</Text>
          <Text style={styles.muted}>{currentLabel}</Text>
        </View>
      </View>
      {readOnly ? (
        <Txt muted>
          Saved arrival: {currentLabel}. This history is read-only.
        </Txt>
      ) : (
        <>
          <Txt muted>Update this manually to let the group know.</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {available
              .filter(([state]) => state !== "none")
              .map(([state, label]) => (
                <View
                  key={state}
                  style={[
                    {
                      minWidth: 110,
                      flex: 1,
                      alignItems: "stretch",
                      padding: 4,
                      borderRadius: 12,
                      backgroundColor:
                        currentState === state ? colors.lime : colors.white,
                    },
                  ]}
                >
                  <View style={{ alignItems: "center", padding: 2 }}>
                    {state === "arriving" ? (
                      <Navigation size={17} color={colors.green} />
                    ) : (
                      <MapPin size={17} color={colors.green} />
                    )}
                  </View>
                  <Action
                    title={currentState === state ? `✓ ${label}` : label}
                    accessibilityLabel={label}
                    compact
                    secondary
                    run={() =>
                      act("set_beacon_attendance", { id: activity.id, state })
                    }
                  />
                </View>
              ))}
          </View>
          {currentState !== "none" &&
            available.some(([state]) => state === "none") && (
              <Action
                compact
                secondary
                title="Reset arrival"
                run={() =>
                  act("set_beacon_attendance", {
                    id: activity.id,
                    state: "none",
                  })
                }
              />
            )}
        </>
      )}
    </View>
  );
}
