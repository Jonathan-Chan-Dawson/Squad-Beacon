import { CouncilChoices } from "./CouncilChoices";
import { AvailabilityControls } from "./TimeFinder";
import { submitPlanning } from "./submission";
import React from "react";
import { View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Txt } from "@/src/shared/ui";
import { PlanningResponseCard } from "@/src/features/people/components/PlanningResponseCard";
import {
  planningInteraction,
  requirePlanningSubmission,
} from "./planningInteraction";
import { PingPreferences } from "./PingPreferences";

export function PlanningResponseControls({
  threadId,
  onOpen = () => {},
  showDeadline = true,
  expanded = true,
  compactPing = false,
  onResponded,
  onOpenBeaconEditor,
  onBeforeRespond,
}: {
  threadId: string;
  onOpen?: () => void;
  showDeadline?: boolean;
  expanded?: boolean;
  compactPing?: boolean;
  onResponded?: () => void;
  onOpenBeaconEditor?: () => void;
  onBeforeRespond?: () => void;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useNow();
  const state = planningInteraction(data, userId, threadId, now);
  if (!state) return <Txt muted>This activity is no longer available.</Txt>;
  const { thread, eligible, options, responses } = state;
  const common = {
    id: thread.id,
    title: thread.title,
    sourceLabel: "",
    deadline: thread.deadline_at,
    showDeadline,
    counts: [],
    onOpen,
    embedded: true,
  };
  const closed = !eligible;
  if (thread.kind === "ping") {
    const selected = responses.find((row) => row.user_id === userId);
    return (
      <View style={{ gap: 8 }}>
        <PlanningResponseCard
          key={userId}
          {...common}
          kind="ping"
          compact={compactPing}
          selected={selected?.response}
          disabled={closed || thread.owner_id === userId}
          counts={
            expanded
              ? [
                  {
                    label: "Interested",
                    value: responses.filter(
                      (row) => row.response === "interested",
                    ).length,
                  },
                  {
                    label: "Maybe",
                    value: responses.filter((row) => row.response === "maybe")
                      .length,
                  },
                ]
              : []
          }
          onRespond={async (response) => {
            onBeforeRespond?.();
            requirePlanningSubmission(data, userId, threadId);
            const epoch = getViewerEpoch();
            await submitPlanning(userId, threadId, () =>
              act("respond_planning_ping", {
                thread_id: thread.id,
                response,
                auto_rsvp: response === "interested" && !!selected?.auto_rsvp,
                available_after:
                  response === "interested"
                    ? (selected?.available_after ?? null)
                    : null,
              }),
            );
            if (epoch !== getViewerEpoch()) return false;
            onResponded?.();
            return true;
          }}
        />
        {expanded && !closed && thread.payload && thread.owner_id !== userId ? (
          <PingPreferences
            key={`${userId}:${selected?.response ?? "none"}`}
            threadId={threadId}
            onBeforeRespond={onBeforeRespond}
          />
        ) : null}
      </View>
    );
  }
  if (thread.kind === "time")
    return (
      <AvailabilityControls
        key={`${userId}:${thread.id}:${thread.slots_revision}:${data.planning_availability?.find((a) => a.thread_id === thread.id && a.user_id === userId)?.updated_at ?? ""}`}
        thread={thread}
        expanded={expanded}
        onExpand={onOpen}
        onBeforeRespond={onBeforeRespond}
      />
    );
  if (thread.kind === "vote")
    return (
      <CouncilChoices
        key={`${userId}:${thread.id}:${data.planning_approval_ballots?.find((b) => b.thread_id === thread.id && b.user_id === userId)?.updated_at ?? ""}`}
        threadId={thread.id}
        expanded={expanded}
        onExpand={onOpen}
        onBeforeRespond={onBeforeRespond}
        onOpenBeaconEditor={onOpenBeaconEditor}
      />
    );
  return (
    <View style={{ gap: 8 }}>
      {(expanded ? options : options.slice(0, 3)).map((option) => (
        <Txt key={option.id}>{option.payload.title}</Txt>
      ))}
      <Txt muted>
        {thread.status === "resolved"
          ? "Draw selected"
          : "The organizer runs the server Draw after the deadline. No response is needed."}
      </Txt>
    </View>
  );
}
