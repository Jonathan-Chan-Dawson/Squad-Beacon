import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatThread } from "@/src/features/messages/ChatThread";
import { useBeacon } from "@/src/shared/store";
import { Screen, Txt } from "@/src/shared/ui";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";

export default function BeaconChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId, loading } = useBeacon();
  const activity = data.activities.find((row) => row.id === id);
  const allowed =
    !!userId &&
    data.viewer_id === userId &&
    !!activity &&
    canUseBeaconModules(data, activity, userId);
  return (
    <Screen
      title={allowed ? activity.title : "Beacon chat"}
      eyebrow="CHAT"
      scroll={false}
      create={false}
      compactHeader
    >
      {loading ? (
        <Txt muted>Loading chat…</Txt>
      ) : allowed ? (
        <ChatThread key={`${userId}:${id}`} activityId={id} />
      ) : (
        <Txt muted>This chat is unavailable or is not shared with you.</Txt>
      )}
    </Screen>
  );
}
