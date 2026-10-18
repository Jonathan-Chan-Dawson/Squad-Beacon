import React from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import type { Activity } from "@/src/shared/types";
import { BeaconParticipation } from "./useBeaconParticipation";
export function BeaconResponse({
  activity,
  compact = false,
}: {
  activity: Activity;
  compact?: boolean;
  joinLabel?: string;
}) {
  return (
    <BeaconParticipation
      activityId={activity.id}
      stretch={!compact}
      onOpen={() =>
        router.push({ pathname: "/activity/[id]", params: { id: activity.id } })
      }
    />
  );
}
export function BeaconMomentum({ activity: a }: { activity: Activity }) {
  const { styles } = useTheme();

  const { data } = useBeacon();
  const responses = data.rsvps.filter((r) => r.activity_id === a.id);
  const going = responses.filter(
    (r) => r.status === "going" && r.user_id !== a.owner_id,
  );
  const maybe = responses.filter((r) => r.status === "interested");
  const names = going
    .slice(0, 2)
    .map(
      (r) =>
        data.profiles.find((p) => p.id === r.user_id)?.name.split(" ")[0] ??
        "A friend",
    );
  if (a.mode === "solo")
    return (
      <Text style={styles.muted}>
        A little update from{" "}
        {data.profiles.find((p) => p.id === a.owner_id)?.name.split(" ")[0] ??
          "your friend"}
      </Text>
    );
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>
        {going.length + 1} going
        {maybe.length ? ` \u00b7 ${maybe.length} considering` : ""}
      </Text>
      {!!a.target_count && (
        <Text style={styles.label}>
          {going.length + 1 >= a.target_count
            ? "The crew is ready!"
            : `Need ${a.target_count - going.length - 1} more to make it happen`}
        </Text>
      )}
      <Text style={styles.muted}>
        {names.length
          ? `${names.join(" & ")}${going.length > 2 ? ` + ${going.length - 2} more` : ""} ${going.length === 1 ? "is" : "are"} in.`
          : "The host is in. Bring a little company."}
      </Text>
    </View>
  );
}
