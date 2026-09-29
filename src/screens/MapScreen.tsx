import React, { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import BeaconMap from "@/components/BeaconMap";
import { useBeacon } from "../store";
import { ActivityCard } from "../ActivityCard";
import {
  Button,
  Chips,
  Empty,
  Screen,
  Sheet,
  Txt,
  colors,
  styles,
} from "../ui";
import { AvatarToggle } from "../AvatarToggle";
import { friendIds } from "../domain";
export default function MapScreen() {
  const { data, userId } = useBeacon();
  const [time, setTime] = useState("All"),
    [audience, setAudience] = useState("Everyone"),
    [view, setView] = useState("Map"),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
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
    <Screen title="Find your next little adventure." eyebrow="BEACONS">
      <View style={styles.between}>
        <Chips options={["Map", "List"]} value={view} onChange={setView} />
        <Button title="Filters" secondary onPress={() => setFilters(true)} />
        <Button
          title="Past & inbox"
          secondary
          onPress={() => router.push("/(tabs)/activities")}
        />
      </View>
      <Chips
        options={["All", "Now", "Upcoming"]}
        value={time}
        onChange={setTime}
      />
      {view === "Map" && (
        <BeaconMap
          activities={activities}
          places={data.places}
          locations={locations}
          profiles={data.profiles}
          onActivity={setSelected}
          onPerson={(id) =>
            router.push({ pathname: "/person/[id]", params: { id } })
          }
        />
      )}
      <Sheet
        title="Your kind of plans"
        visible={filters}
        onClose={() => setFilters(false)}
      >
        <Text style={styles.muted}>Show plans from</Text>
        <Chips options={choices} value={audience} onChange={setAudience} />
        <AvatarToggle />
        <Text style={styles.muted}>
          Pins are meeting places. Avatars mark shared live locations.
        </Text>
      </Sheet>
      <Sheet
        title="Meet you there?"
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        {data.activities.find((a) => a.id === selected) && (
          <ActivityCard
            activity={data.activities.find((a) => a.id === selected)!}
            onOpen={() => {
              const id = selected!;
              setSelected(null);
              router.push({ pathname: "/activity/[id]", params: { id } });
            }}
          />
        )}
        <Button
          title="Open full beacon"
          secondary
          onPress={() => {
            const id = selected!;
            setSelected(null);
            router.push({ pathname: "/activity/[id]", params: { id } });
          }}
        />
      </Sheet>
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
        <Text style={styles.h2}>Good company starts here</Text>
        <Text style={styles.label}>{activities.length} plans</Text>
      </View>
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} />
      ))}
      {!activities.length && (
        <View style={{ gap: 10 }}>
          <Empty
            title={
              audience !== "Everyone" || time !== "All"
                ? "No beacons in this view"
                : "A little quiet? Start something."
            }
            body="A coffee, a walk, a quick catch-up. Your next memory starts with a small plan."
          />
          <Button
            title="Create your first beacon"
            onPress={() => router.push("/create")}
          />
          <Button
            title="Add friends"
            secondary
            onPress={() =>
              router.push({
                pathname: "/(tabs)/squads",
                params: { tab: "Friends" },
              })
            }
          />
        </View>
      )}
    </Screen>
  );
}
