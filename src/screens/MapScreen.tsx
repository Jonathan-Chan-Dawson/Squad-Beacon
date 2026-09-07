import React, { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { MapPin, Radio, ShieldCheck } from "lucide-react-native";
import BeaconMap from "@/components/BeaconMap";
import { useBeacon } from "../store";
import { ActivityCard } from "../ActivityCard";
import { Button, Chips, Empty, Screen, Txt, colors, styles } from "../ui";
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
    <Screen
      title="Find your next together."
      eyebrow="YOUR WORLD, A LITTLE CLOSER"
    >
      <View style={styles.between}>
        <View style={styles.row}>
          <MapPin size={16} color={colors.green} />
          <Txt muted>Places your people have shared</Txt>
        </View>
        <Radio size={19} color={colors.green} />
      </View>
      <Chips
        options={["All", "Now", "Upcoming"]}
        value={time}
        onChange={setTime}
      />
      <Chips options={choices} value={audience} onChange={setAudience} />
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
              : "Meeting pins are places, not live friend locations. →"}
          </Txt>
        </View>
      </Pressable>
      <View style={styles.between}>
        <Text style={styles.h2}>Room for one more</Text>
        <Text style={styles.label}>{activities.length} PLANS</Text>
      </View>
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} />
      ))}
      {!activities.length && (
        <Empty
          title="Make the first move."
          body="Create a plan and invite your people. Online activities are welcome here too."
        />
      )}
      <View style={styles.hero}>
        <Text style={[styles.h2, { color: "white" }]}>
          “We should do something”{"\n"}starts here.
        </Text>
        <Text style={{ color: "#C7D8CC", lineHeight: 22 }}>
          A walk, a study session, a few rounds. Give your friends something to
          say yes to.
        </Text>
        <Button
          secondary
          title="Put a plan out there →"
          onPress={() => router.push("/create")}
        />
      </View>
    </Screen>
  );
}
