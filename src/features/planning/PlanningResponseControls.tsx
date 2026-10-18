import React, { useState } from "react";
import { View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Txt } from "@/src/shared/ui";
import { PlanningResponseCard } from "@/src/features/people/components/PlanningResponseCard";
import { validateCouncilProposal } from "./domain";
import {
  planningInteraction,
  requirePlanningSubmission,
} from "./planningInteraction";
import { ProposalEditor } from "./ProposalEditor";

export function PlanningResponseControls({
  threadId,
  onOpen = () => {},
  showDeadline = true,
}: {
  threadId: string;
  onOpen?: () => void;
  showDeadline?: boolean;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const state = planningInteraction(data, userId, threadId, now);
  if (!state) return <Txt muted>This activity is no longer available.</Txt>;
  const { thread, eligible, options, responses, votes } = state;
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
      <PlanningResponseCard
        {...common}
        kind="ping"
        selected={selected?.response}
        disabled={closed || thread.owner_id === userId}
        counts={[
          {
            label: "Interested",
            value: responses.filter((row) => row.response === "interested")
              .length,
          },
          {
            label: "Maybe",
            value: responses.filter((row) => row.response === "maybe").length,
          },
        ]}
        onRespond={async (response) => {
          requirePlanningSubmission(data, userId, threadId);
          const epoch = getViewerEpoch();
          await act("respond_planning_ping", {
            thread_id: thread.id,
            response,
            auto_rsvp: response === "interested" && !!selected?.auto_rsvp,
            available_after:
              response === "interested"
                ? (selected?.available_after ?? null)
                : null,
          });
          return epoch === getViewerEpoch();
        }}
      />
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <PlanningResponseCard
        {...common}
        kind={thread.kind}
        selected={votes.find((row) => row.user_id === userId)?.proposal_id}
        disabled={thread.kind === "vote" && closed}
        counts={[
          { label: "approved options", value: options.length },
          ...(thread.kind === "vote"
            ? [{ label: "votes", value: votes.length }]
            : []),
        ]}
        actions={
          thread.kind === "vote"
            ? options.map((option) => ({
                id: option.id,
                label: `${option.payload.title} · ${votes.filter((row) => row.proposal_id === option.id).length}`,
                onPress: async () => {
                  const latest = requirePlanningSubmission(
                    data,
                    userId,
                    threadId,
                  );
                  if (!latest.options.some((row) => row.id === option.id))
                    throw new Error("This option is no longer available.");
                  const epoch = getViewerEpoch();
                  await act("vote_council_proposal", {
                    thread_id: thread.id,
                    proposal_id: option.id,
                  });
                  return epoch === getViewerEpoch();
                },
              }))
            : []
        }
      />
      {thread.kind === "draw" &&
        options.map((option) => (
          <Txt key={option.id}>{option.payload.title}</Txt>
        ))}
      {!options.length && (
        <Txt muted>No eligible approved options right now.</Txt>
      )}
      {closed && (
        <Txt muted>
          {thread.kind === "draw" && thread.status === "open"
            ? "Awaiting organizer draw. No entries are needed."
            : "Responses are closed."}
        </Txt>
      )}
      {eligible && (
        <Button
          secondary
          compact
          title="Add option"
          onPress={() => setAdding((value) => !value)}
        />
      )}
      {adding && eligible && (
        <ProposalEditor
          inline
          thread={thread}
          visible
          onClose={() => setAdding(false)}
          onSave={async (payload) => {
            requirePlanningSubmission(data, userId, threadId);
            validateCouncilProposal(thread, payload, Date.now());
            await act("add_council_proposal", {
              thread_id: thread.id,
              payload,
            });
            setAdding(false);
          }}
        />
      )}
    </View>
  );
}
