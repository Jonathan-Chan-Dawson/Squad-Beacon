import { Clock3, MapPin, Navigation, RotateCcw } from "lucide-react-native";
import React, { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canSetArrivalState } from "@/src/features/beacons/permissions";
import { useTheme } from "@/src/shared/ui";

const states = [
  ["none", "Not on my way"],
  ["arriving", "On my way"],
  ["present", "I’m here"],
] as const;
type ArrivalState = (typeof states)[number][0];

export function AttendanceControls({
  activity,
  locationPreview,
}: {
  activity: Activity;
  locationPreview?: ReactNode;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  if (!userId || !canUseBeaconModules(data, activity, userId)) return null;
  const current = data.beacon_attendance.find(
    (entry) => entry.activity_id === activity.id && entry.user_id === userId,
  );
  const currentState = current?.state ?? "none";
  const readOnly =
    activity.status === "completed" || activity.status === "cancelled";
  const available = states.filter(([state]) =>
    canSetArrivalState(data, activity, userId, userId, state, now),
  );
  if ((readOnly && !current) || (!readOnly && !available.length)) return null;
  const currentLabel =
    states.find(([state]) => state === currentState)?.[1] ?? "Not on my way";
  const StatusIcon =
    currentState === "arriving"
      ? Navigation
      : currentState === "present"
        ? MapPin
        : Clock3;

  async function update(state: ArrivalState) {
    if (lock.current) return;
    const epoch = getViewerEpoch();
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await act("set_beacon_attendance", { id: activity.id, state });
    } catch (failure) {
      if (epoch === getViewerEpoch())
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not update arrival. Try again.",
        );
    } finally {
      lock.current = false;
      if (epoch === getViewerEpoch()) setBusy(false);
    }
  }

  return (
    <View
      testID="beacon-arrival"
      style={{ flexDirection: "row", alignItems: "stretch", gap: 8 }}
    >
      <View
        style={[styles.card, { flex: 1, minWidth: 0, padding: 12, gap: 8, justifyContent: "center" }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <View style={[styles.row, { gap: 7 }]}>
              <StatusIcon size={18} color={colors.green} accessible={false} />
              <Text style={[styles.body, { fontWeight: "600", flexShrink: 1 }]}>
                Your arrival
              </Text>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              {currentLabel}
            </Text>
            {readOnly && <Text style={styles.label}>Saved arrival</Text>}
          </View>
        </View>
        {!readOnly && (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {available
                .filter(([state]) => state !== "none")
                .map(([state, label]) => {
                  const Icon = state === "arriving" ? Navigation : MapPin;
                  const selected = state === currentState;
                  return (
                    <Pressable
                      key={state}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      aria-pressed={selected}
                      accessibilityState={{ selected, disabled: busy }}
                      disabled={busy}
                      onPress={() => void update(state)}
                      style={({ pressed }) => ({
                        flex: 1,
                        minWidth: 104,
                        minHeight: 44,
                        padding: 9,
                        borderRadius: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        borderWidth: 1,
                        borderColor: selected ? colors.green : colors.line,
                        backgroundColor: selected ? colors.lime : colors.white,
                        opacity: busy ? 0.6 : pressed ? 0.7 : 1,
                      })}
                    >
                      <Icon
                        size={16}
                        color={selected ? colors.green : colors.muted}
                        accessible={false}
                      />
                      <Text
                        style={[
                          styles.label,
                          {
                            color: selected ? colors.green : colors.ink,
                            flexShrink: 1,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
            {currentState !== "none" &&
              available.some(([state]) => state === "none") && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reset arrival"
                  disabled={busy}
                  onPress={() => void update("none")}
                  style={[
                    styles.row,
                    { minHeight: 44, alignSelf: "flex-start", gap: 5 },
                  ]}
                >
                  <RotateCcw
                    size={13}
                    color={colors.muted}
                    accessible={false}
                  />
                  <Text style={styles.label}>Reset arrival</Text>
                </Pressable>
              )}
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
      {!!locationPreview && (
        <View
          style={[
            styles.card,
            {
              padding: 4,
              width: 106,
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          {locationPreview}
        </View>
      )}
    </View>
  );
}
