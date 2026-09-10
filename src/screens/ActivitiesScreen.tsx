import React, { useState } from "react";
import { useNow } from "../useNow";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "../store";
import { ActivityCard } from "../ActivityCard";
import { Action, Button, Chips, Empty, Screen, styles } from "../ui";
export default function ActivitiesScreen() {
  const { data, userId, act } = useBeacon(),
    [filter, setFilter] = useState("Upcoming");
  const now = useNow();
  const activities = data.activities
    .filter((a) =>
      filter === "My plans"
        ? a.owner_id === userId
        : filter === "Joined"
          ? data.rsvps.some(
              (r) => r.activity_id === a.id && r.user_id === userId,
            )
          : filter === "Past"
            ? a.status !== "scheduled" || Date.parse(a.ends_at) < now
            : a.status === "scheduled" && Date.parse(a.ends_at) >= now,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <Screen title="Activities" eyebrow="Make time for your people">
      <Chips
        options={["Upcoming", "Joined", "My plans", "Past"]}
        value={filter}
        onChange={setFilter}
      />
      {activities.map((a) => (
        <ActivityCard key={a.id} activity={a} />
      ))}
      {!activities.length && (
        <Empty
          title="Your next plan goes here."
          body="Create an activity, or ask a friend to invite you."
        />
      )}
      <View style={styles.between}>
        <Text style={styles.h2}>Your inbox</Text>
        <Action title="Mark read" secondary run={() => act("read_notices")} />
      </View>
      {data.notices
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 20)
        .map((n) => (
          <View key={n.id} style={styles.card}>
            <Text
              style={[styles.body, { fontWeight: n.read_at ? "400" : "700" }]}
            >
              {n.body}
            </Text>
            {n.activity_id && (
              <Button
                title="View activity"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: n.activity_id! },
                  })
                }
              />
            )}
          </View>
        ))}
      {!data.notices.length && (
        <Text style={styles.muted}>
          Invitations and activity updates will appear here.
        </Text>
      )}
    </Screen>
  );
}
