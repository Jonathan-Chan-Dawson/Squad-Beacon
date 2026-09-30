import React from "react";
import { Pressable, Text, View } from "react-native";
import { X, ArrowUpRight, MapPin } from "lucide-react-native";
import { useBeacon } from "./store";
import { useNow } from "./useNow";
import { Action, Txt, useTheme } from "./ui";
import { ProfileAvatar } from "./ProfileAvatar";
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
    person = data.profiles.find((p) => p.id === (personId ?? a?.owner_id)),
    r = data.rsvps.find(
      (r) => r.activity_id === beaconId && r.user_id === userId,
    );
  const joinable =
    a &&
    a.mode !== "solo" &&
    a.owner_id !== userId &&
    a.status === "scheduled" &&
    Date.parse(a.ends_at) > now;
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
          <Text style={styles.label}>{person?.name ?? "Your beacon"}</Text>
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
      {joinable && (
        <View style={{ flexDirection: "row", gap: 5 }}>
          {[
            {
              label:
                r?.status === "requested"
                  ? "Pending"
                  : r?.status === "going"
                    ? "Going"
                    : a.approval_required || a.mode === "invite"
                      ? "Ask"
                      : "In",
              status: "going",
            },
            { label: "Maybe", status: "interested" },
            { label: "Out", status: "withdraw" },
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
