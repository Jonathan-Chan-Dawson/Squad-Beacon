import React, { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import BeaconMap from "@/components/BeaconMap";
import { useBeacon } from "../store";
import { ActivityCard } from "../ActivityCard";
import { Chips, Empty, Screen, Txt, colors, styles } from "../ui";
import { AvatarToggle } from "../AvatarToggle";
import { friendIds } from "../domain";
export default function MapScreen() {
  const { data, userId } = useBeacon();
  const [time, setTime] = useState("All"),
    [audience, setAudience] = useState("Everyone"),
    [view, setView] = useState("Map + list"),
    [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const friends = friendIds(data, userId!);
  const choices = [
    "Everyone",
    "Friends",
    ...data.profiles
      .filter((p) => friends.includes(p.id))
      .map((p) => "@" + p.username),
    ...data.squads.map((s) => s.name),
  ];
  const activities = data.activities
    .filter((a) => a.status === "scheduled" && Date.parse(a.ends_at) > now)
    .filter((a) => time !== "Now" || Date.parse(a.starts_at) <= now)
    .filter((a) => time !== "Upcoming" || Date.parse(a.starts_at) > now)
    .filter(
      (a) =>
        audience === "Everyone" ||
        (audience === "Friends"
          ? friends.includes(a.owner_id)
          : audience.startsWith("@")
            ? a.owner_id ===
              data.profiles.find((p) => "@" + p.username === audience)?.id
            : a.audience_id ===
              data.squads.find((s) => s.name === audience)?.id),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const locations = data.locations.filter(
    (l) =>
      audience === "Everyone" ||
      (audience === "Friends"
        ? friends.includes(l.owner_id)
        : audience.startsWith("@")
          ? l.owner_id ===
            data.profiles.find((p) => "@" + p.username === audience)?.id
          : data.squad_members.some(
              (m) =>
                m.user_id === l.owner_id &&
                m.squad_id === data.squads.find((s) => s.name === audience)?.id,
            )),
  );
  const sharing = data.locations.find(
    (l) => l.owner_id === userId && Date.parse(l.expires_at) > now,
  );
  return (
    <Screen title="Map" eyebrow="See plans. Join your friends.">
      <Chips
        options={["All", "Now", "Upcoming"]}
        value={time}
        onChange={setTime}
      />
      <Chips
        options={["Map + list", "List only"]}
        value={view}
        onChange={setView}
      />
      {view === "Map + list" && (
        <BeaconMap
          activities={activities}
          places={data.places}
          locations={locations}
          profiles={data.profiles}
          onActivity={(id) =>
            router.push({ pathname: "/activity/[id]", params: { id } })
          }
          onPerson={(id) =>
            router.push({ pathname: "/person/[id]", params: { id } })
          }
        />
      )}
      <Text style={styles.muted}>Show plans from</Text>
      <Chips options={choices} value={audience} onChange={setAudience} />
      <AvatarToggle />
      <Text style={styles.muted}>
        Pins are meeting places. Avatars mark shared live locations.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/location")}
        style={[
          styles.row,
          {
            backgroundColor: sharing ? colors.lime : "#E8ECE5",
            padding: 15,
            borderRadius: 16,
          },
        ]}
      >
        <ShieldCheck color={colors.green} size={21} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>
            {sharing
              ? "You’re sharing temporarily"
              : "Your live location is off"}
          </Text>
          <Txt muted>
            {sharing
              ? "Manage recipients and stop sharing →"
              : "Share temporarily →"}
          </Txt>
        </View>
      </Pressable>
      <View style={styles.between}>
        <Text style={styles.h2}>Shared activities</Text>
        <Text style={styles.label}>{activities.length} plans</Text>
      </View>
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} />
      ))}
      {!activities.length && (
        <Empty
          title="No plans yet"
          body="Create an activity and invite a friend."
        />
      )}
    </Screen>
  );
}
