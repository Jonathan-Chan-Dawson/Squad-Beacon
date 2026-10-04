import React from "react";
import { Pressable, Text, View } from "react-native";
import { X, ArrowUpRight, MapPin } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, Txt, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canReadPlanningThread } from "@/src/features/planning/domain";
export function MapTooltip({
  beaconId,
  personId,
  pinned,
  onDetails,
  onClose,
}: {
  beaconId: string | null;
  personId: string | null;
  pinned: boolean;
  onDetails: () => void;
  onClose: () => void;
}) {
  const { data, userId, act } = useBeacon(),
    { colors, styles } = useTheme(),
    now = useNow();
  const a = data.activities.find((a) => a.id === beaconId),
    personCandidate = data.profiles.find(
      (p) => p.id === (personId ?? a?.owner_id),
    ),
    person =
      personCandidate && canViewProfile(data, personCandidate, userId!)
        ? personCandidate
        : undefined,
    r = data.rsvps.find(
      (r) => r.activity_id === beaconId && r.user_id === userId,
    );
  const joinable =
    a &&
    a.mode !== "solo" &&
    a.owner_id !== userId &&
    a.status === "scheduled" &&
    Date.parse(a.ends_at) > now;
  const decisionThread =
    a && userId && data.viewer_id === userId
      ? data.planning_threads.find(
          (thread) =>
            (thread.kind === "vote" || thread.kind === "draw") &&
            thread.materialized_activity_id === a.id &&
            canReadPlanningThread(data, thread, userId),
        )
      : undefined;
  return (
    <View
      style={{
        gap: 8,
        padding: 14,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white + "F5",
        boxShadow: "0 8px 28px #142e3033",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -8,
          left: "45%",
          width: 16,
          height: 16,
          backgroundColor: colors.white,
          transform: [{ rotate: "45deg" }],
        }}
      />
      <View style={styles.row}>
        <ProfileAvatar profile={person} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {person?.name ??
              (a?.owner_id === userId ? "Your beacon" : "Beacon host")}
          </Text>
          <Text numberOfLines={2} style={[styles.h2, { fontSize: 16 }]}>
            {a?.title ?? "Say hello. Make a plan."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close map tooltip"
          onPress={onClose}
          style={{ padding: 8 }}
        >
          <X size={18} color={colors.ink} />
        </Pressable>
      </View>
      {!pinned && <Txt muted>No meeting pin shared yet</Txt>}
      {a && (
        <View style={styles.row}>
          <MapPin size={13} color={colors.green} />
          <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>
            {data.places.find((p) => p.activity_id === a.id)?.label ||
              (a.available ? "Free to hang" : a.category)}
          </Text>
        </View>
      )}
      {decisionThread && (
        <Text style={[styles.muted, { fontSize: 12 }]}>
          Chosen by {decisionThread.kind === "vote" ? "Vote" : "Draw"}
        </Text>
      )}
      {joinable && (
        <View style={{ flexDirection: "row", gap: 5 }}>
          {[
            {
              label:
                r?.status === "requested"
                  ? "Pending"
                  : r?.status === "going"
                    ? "I'm In"
                    : (a.approval_required || a.mode === "invite") &&
                        !r?.approved
                      ? "Request"
                      : "I'm In",
              status: "going",
            },
            { label: "Maybe", status: "interested" },
            { label: "I'm Out", status: "withdraw" },
          ].map(({ label, status }) => (
            <View key={status} style={{ flex: 1 }}>
              <Action
                title={label}
                secondary={status !== "going"}
                disabled={
                  status === "going" &&
                  (r?.status === "going" || r?.status === "requested")
                }
                run={() => act("rsvp", { id: a.id, status })}
              />
            </View>
          ))}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Beacon details"
        onPress={onDetails}
        style={[
          styles.row,
          {
            justifyContent: "center",
            padding: 10,
            borderRadius: 14,
            backgroundColor: colors.lime,
          },
        ]}
      >
        <Text style={styles.label}>Details & conversation</Text>
        <ArrowUpRight size={17} color={colors.green} />
      </Pressable>
    </View>
  );
}
