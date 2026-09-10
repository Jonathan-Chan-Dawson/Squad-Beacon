import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowUpRight, MapPin, Monitor, Users } from "lucide-react-native";
import { Activity } from "./types";
import { useBeacon } from "./store";
import { activityWhen } from "./domain";
import { colors, styles } from "./ui";
import { ProfileAvatar } from "./ProfileAvatar";
export function ActivityCard({ activity: a }: { activity: Activity }) {
  const { data } = useBeacon(),
    owner = data.profiles.find((p) => p.id === a.owner_id),
    place = data.places.find((p) => p.activity_id === a.id),
    going = data.rsvps.filter(
      (r) => r.activity_id === a.id && r.status === "going",
    ).length,
    interested = data.rsvps.filter(
      (r) => r.activity_id === a.id && r.status === "interested",
    ).length;
  const live = activityWhen(a) === "Happening now";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={"View " + a.title}
      onPress={() =>
        router.push({ pathname: "/activity/[id]", params: { id: a.id } })
      }
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.between}>
        <View style={[styles.row, { flex: 1 }]}>
          <ProfileAvatar profile={owner} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", color: colors.ink }}>
              {owner?.name ?? "Squad member"}
            </Text>
            <Text style={styles.muted}>
              {a.category} ·{" "}
              {a.mode === "invite"
                ? "Invite-only"
                : a.mode === "solo"
                  ? "Solo"
                  : "Squad activity"}
            </Text>
          </View>
        </View>
        <ArrowUpRight size={20} color={colors.green} />
      </View>
      <Text style={styles.h2}>{a.title}</Text>
      <View style={styles.row}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: live ? colors.green : "#C6CABD",
          }}
        />
        <Text
          style={[
            styles.muted,
            live && { color: colors.green, fontWeight: "600" },
          ]}
        >
          {activityWhen(a)}
        </Text>
      </View>
      <View style={styles.row}>
        {place?.online_url ? (
          <Monitor size={15} color={colors.muted} />
        ) : (
          <MapPin size={15} color={colors.muted} />
        )}
        <Text style={[styles.muted, { flex: 1 }]}>
          {place?.label ||
            (place ? "Place to be decided" : "Meeting details restricted")}
        </Text>
      </View>
      <View
        style={[
          styles.between,
          { borderTopWidth: 1, borderColor: colors.line, paddingTop: 10 },
        ]}
      >
        <View style={styles.row}>
          <Users size={16} color={colors.green} />
          <Text style={styles.muted}>
            {going} going · {interested} interested
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>
          Details →
        </Text>
      </View>
    </Pressable>
  );
}
