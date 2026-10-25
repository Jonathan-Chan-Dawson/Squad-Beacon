import { submitPlanning } from "./submission";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Txt } from "@/src/shared/ui";
import { requirePlanningSubmission } from "./planningInteraction";
import { PingAvailabilityEditor } from "./PingAvailabilityEditor";

export function PingPreferences({
  threadId,
  onBeforeRespond,
}: {
  threadId: string;
  onBeforeRespond?: () => void;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<boolean | null>(null);
  const thread = data.planning_threads.find((row) => row.id === threadId);
  const response = data.planning_ping_responses.find(
    (row) => row.thread_id === threadId && row.user_id === userId,
  );
  const auto = choice ?? !!response?.auto_rsvp;
  if (!thread?.payload) return null;
  async function save(available_after: string | null) {
    onBeforeRespond?.();
    requirePlanningSubmission(data, userId, threadId);
    const epoch = getViewerEpoch();
    await submitPlanning(userId, threadId, () =>
      act("respond_planning_ping", {
        thread_id: threadId,
        response: "interested",
        auto_rsvp: auto,
        available_after,
      }),
    );
    if (epoch !== getViewerEpoch()) throw new Error("Your account changed.");
    setChoice(null);
  }
  return (
    <View style={{ gap: 8 }}>
      {response?.available_after ? (
        <Txt muted>
          Available after {new Date(response.available_after).toLocaleString()}
        </Txt>
      ) : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Auto-RSVP if this ping becomes a beacon"
        accessibilityState={{ checked: auto }}
        aria-checked={auto}
        onPress={() => setChoice(!auto)}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Txt>{auto ? "✓ " : "○ "}Auto-RSVP if this becomes a Beacon</Txt>
      </Pressable>
      {choice !== null && choice !== !!response?.auto_rsvp ? (
        <Action
          secondary
          title="Save Interested preferences"
          run={() => save(response?.available_after ?? null)}
        />
      ) : null}
      <Button
        compact
        secondary
        title="Interested After…"
        onPress={() => setEditing(!editing)}
      />
      {editing ? (
        <PingAvailabilityEditor
          inline
          availableAfter={response?.available_after}
          autoRsvp={auto}
          startsAt={thread.payload.starts_at}
          onSave={save}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </View>
  );
}
