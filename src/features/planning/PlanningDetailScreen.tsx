import { canOpenSquadPing } from "@/src/features/people/communication";
import { ConfirmDialog } from "@/src/shared/Dialogs";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Empty, Screen, Txt, useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarClock,
  Check,
  CircleHelp,
  Dices,
  Vote,
} from "lucide-react-native";
import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  canManagePlanningThread,
  canReadPlanningThread,
  canRespondToPlanningThread,
  councilVoteCounts,
  normalizePlanningData,
  validateCouncilProposal,
  visiblePlanningProposals,
} from "./domain";
import { PlanningResponseControls } from "./PlanningResponseControls";
import { ProposalEditor } from "./ProposalEditor";
import type { BeaconDraft, PlanningProposal } from "./types";
const dateLabel = (value: string) =>
  new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const labelForStatus = (status: string) =>
  status === "no_options"
    ? "No approved options"
    : status === "expired"
      ? "The approved options are now in the past"
      : status.replaceAll("_", " ");

export default function PlanningDetailScreen({
  threadId,
  embedded = false,
  onShowSuggested,
}: {
  threadId?: string;
  embedded?: boolean;
  onShowSuggested?: (id: string) => void;
} = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = threadId ?? params.id;
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  const planning = normalizePlanningData(data);
  const thread = planning.planning_threads.find((item) => item.id === id);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState(false);

  const accessible =
    !!userId &&
    data.viewer_id === userId &&
    !!thread &&
    canReadPlanningThread(data, thread, userId);
  const manages =
    !!thread && accessible && canManagePlanningThread(thread, userId ?? "");
  const proposals = thread
    ? visiblePlanningProposals(
        data,
        planning.planning_proposals,
        thread.id,
        userId ?? "",
      ).filter((proposal) =>
        canReadPlanningThread(data, thread, proposal.author_id),
      )
    : [];
  const votes = planning.planning_votes.filter((vote) => vote.thread_id === id);
  const approvedIds = new Set(
    proposals
      .filter(
        (proposal) => proposal.approved && proposal.disqualified_at == null,
      )
      .map((proposal) => proposal.id),
  );
  const voteCounts = councilVoteCounts(votes, id ?? "", approvedIds);
  const myVote = votes.find((vote) => vote.user_id === userId);
  const myResponse = planning.planning_ping_responses.find(
    (response) => response.thread_id === id && response.user_id === userId,
  );
  const canRespond =
    !!thread && canRespondToPlanningThread(data, thread, userId ?? "", now);
  const winner = thread
    ? proposals.find((proposal) => proposal.id === thread.winner_proposal_id)
    : undefined;
  const currentActivity = data.activities.find(
    (activity) => activity.id === thread?.materialized_activity_id,
  );
  const nextOptions = proposals.filter(
    (proposal) =>
      proposal.approved &&
      proposal.disqualified_at == null &&
      proposal.activity_id == null &&
      Date.parse(proposal.payload.starts_at) > now,
  );
  const replacementAvailable =
    thread?.status === "resolved" &&
    !!currentActivity &&
    currentActivity.status === "scheduled" &&
    Date.parse(currentActivity.starts_at) > now &&
    nextOptions.length > 0;
  const pendingReviews = proposals.filter(
    (proposal) => !proposal.approved && proposal.disqualified_at == null,
  );

  async function saveProposal(payload: BeaconDraft) {
    if (!thread) throw new Error("This planning thread is unavailable.");
    validateCouncilProposal(thread, payload, now);
    await act("add_council_proposal", {
      thread_id: thread.id,
      payload,
    });
    setProposalOpen(false);
  }

  function proposalCard(proposal: PlanningProposal) {
    const selected = myVote?.proposal_id === proposal.id;
    const canReview =
      manages &&
      thread?.status === "open" &&
      Date.parse(thread.deadline_at) > now;
    const canVote =
      thread?.kind === "vote" &&
      canRespond &&
      proposal.approved &&
      proposal.disqualified_at == null &&
      Date.parse(proposal.payload.starts_at) > now;
    const author = data.profiles.find(
      (person) => person.id === proposal.author_id,
    );
    return (
      <View key={proposal.id} style={styles.card}>
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.h2}>{proposal.payload.title}</Text>
            <Text style={styles.muted}>
              {proposal.payload.category} ·{" "}
              {dateLabel(proposal.payload.starts_at)}
            </Text>
            <Text style={styles.muted}>
              Suggested by {author?.name ?? "A member"}
            </Text>
          </View>
          {proposal.approved && proposal.disqualified_at == null ? (
            <Check color={colors.green} size={18} />
          ) : null}
        </View>
        {proposal.payload.description ? (
          <Txt muted>{proposal.payload.description}</Txt>
        ) : null}
        {proposal.payload.label || proposal.payload.latitude != null ? (
          <Txt muted>
            {proposal.payload.label || "Pinned meeting place"}
            {proposal.payload.latitude != null &&
            proposal.payload.longitude != null
              ? ` · ${proposal.payload.latitude.toFixed(3)}, ${proposal.payload.longitude.toFixed(3)}`
              : ""}
          </Txt>
        ) : null}
        <Text style={styles.label}>
          {proposal.disqualified_at
            ? "REPLACED"
            : proposal.approved
              ? thread?.kind === "vote"
                ? `${voteCounts.get(proposal.id) ?? 0} votes · APPROVED`
                : "APPROVED"
              : "WAITING FOR APPROVAL"}
        </Text>
        {canReview && proposal.disqualified_at == null && (
          <Action
            title={proposal.approved ? "Unapprove option" : "Approve option"}
            secondary={proposal.approved}
            run={() =>
              act("approve_council_proposal", {
                thread_id: thread.id,
                proposal_id: proposal.id,
                approved: !proposal.approved,
              })
            }
          />
        )}
        {canVote && (
          <Action
            title={
              selected ? "Your vote · change vote" : "Vote for this option"
            }
            secondary={selected}
            run={() =>
              act("vote_council_proposal", {
                thread_id: thread.id,
                proposal_id: proposal.id,
              })
            }
          />
        )}
      </View>
    );
  }

  if (!thread || !accessible)
    return (
      <PlanningFrame
        embedded={embedded}
        title="Planning decision"
        eyebrow="PING, VOTE, OR DRAW"
      >
        <Empty
          title="This planning thread isn’t available."
          body="It may have closed or no longer be shared with you."
        />
      </PlanningFrame>
    );

  const Icon =
    thread.kind === "ping" ? CircleHelp : thread.kind === "vote" ? Vote : Dices;

  return (
    <PlanningFrame
      embedded={embedded}
      title={thread.title}
      eyebrow={thread.kind.toUpperCase()}
    >
      <Button
        title={
          thread.kind === "ping"
            ? "Show Ping-related Beacons"
            : "Show Suggested Beacons"
        }
        secondary
        onPress={() =>
          onShowSuggested
            ? onShowSuggested(thread.id)
            : router.push({ pathname: "/", params: { mapThread: thread.id } })
        }
      />
      <View style={styles.card}>
        <View style={styles.row}>
          <Icon color={colors.green} size={19} />
          <Text style={styles.h2}>
            {thread.status === "open" && Date.parse(thread.deadline_at) <= now
              ? "Closed · awaiting organizer"
              : labelForStatus(thread.status)}
          </Text>
        </View>
        <Txt muted>
          Created by{" "}
          {data.profiles.find((person) => person.id === thread.owner_id)
            ?.name ?? "Organizer"}
        </Txt>
        {thread.body ? <Txt>{thread.body}</Txt> : null}
        <View style={styles.row}>
          <CalendarClock color={colors.muted} size={16} />
          <Txt muted>Decision deadline · {dateLabel(thread.deadline_at)}</Txt>
        </View>
        <Txt muted>
          Shared with {thread.audience === "private" ? "you" : thread.audience}
          {thread.audience_id ? " group" : ""}
        </Txt>
      </View>

      {manages && currentActivity && thread.materialized_activity_id && (
        <Button
          compact
          secondary
          title="Feature resulting Beacon"
          onPress={() =>
            router.push({
              pathname: "/activity-created",
              params: {
                id: thread.materialized_activity_id!,
                type: "beacon",
                intent: "feature",
              },
            })
          }
        />
      )}
      {thread.kind === "ping" && thread.payload && (
        <View style={styles.card}>
          <Text style={styles.label}>IF CONVERTED TO A BEACON</Text>
          <Text style={styles.h2}>{thread.payload.title}</Text>
          <Txt muted>
            {thread.payload.category} · {dateLabel(thread.payload.starts_at)}
          </Txt>
          {thread.payload.label ? (
            <Txt muted>{thread.payload.label}</Txt>
          ) : null}
          {canOpenSquadPing(data, thread, userId) ? (
            <Button
              compact
              secondary
              title="Open Squad chat"
              onPress={() =>
                router.push({
                  pathname: "/squad-chat/[id]",
                  params: { id: thread.audience_id!, ping: thread.id },
                })
              }
            />
          ) : null}
          {myResponse ? (
            <Txt muted>
              Your response: {myResponse.response}
              {myResponse.available_after
                ? ` · Available after ${dateLabel(myResponse.available_after)}`
                : ""}
            </Txt>
          ) : null}
          {thread.status === "open" &&
          userId !== thread.owner_id &&
          canRespond ? (
            <PlanningResponseControls threadId={thread.id} />
          ) : null}
          {thread.owner_id === userId && thread.status === "open" && (
            <Action
              title="Create a beacon from this ping"
              run={async () => {
                const result = await act("convert_planning_ping", {
                  thread_id: thread.id,
                });
                if (typeof result.activity_id === "string")
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: result.activity_id },
                  });
              }}
            />
          )}
          {thread.status === "resolved" && thread.materialized_activity_id && (
            <Button
              title="Open beacon"
              onPress={() => {
                const activityId = thread.materialized_activity_id;
                if (activityId)
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: activityId },
                  });
              }}
            />
          )}
          <Txt muted>
            {
              planning.planning_ping_responses.filter(
                (response) => response.thread_id === thread.id,
              ).length
            }{" "}
            responses · Interested with Auto-RSVP will request or join according
            to the beacon’s approval settings.
          </Txt>
        </View>
      )}

      {thread.kind !== "ping" && (
        <>
          <View style={[styles.between, { alignItems: "flex-end" }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.h2}>Beacon options</Text>
              <Text style={styles.muted}>
                {thread.kind === "vote"
                  ? "One changeable vote per person."
                  : "After the deadline, an organizer runs the draw. No entries are needed."}
              </Text>
            </View>
            {thread.status === "open" && canRespond && (
              <Button
                title="Add option"
                compact
                secondary
                onPress={() => setProposalOpen(true)}
              />
            )}
          </View>
          {pendingReviews.length > 0 && manages && (
            <View style={[styles.card, { backgroundColor: colors.lime }]}>
              <Txt>
                {pendingReviews.length} option
                {pendingReviews.length === 1 ? " needs" : "s need"} your review.
              </Txt>
            </View>
          )}
          {proposals.length ? (
            proposals
              .filter(
                (proposal) =>
                  manages ||
                  proposal.author_id === userId ||
                  proposal.id === thread.winner_proposal_id ||
                  (proposal.approved &&
                    !proposal.disqualified_at &&
                    Date.parse(proposal.payload.starts_at) > now),
              )
              .map(proposalCard)
          ) : (
            <Empty
              title="No options yet."
              body="Add a beacon option. An option host can approve it before the vote or draw."
            />
          )}
          {thread.kind === "vote" &&
            thread.status === "open" &&
            canRespond &&
            proposals.some(
              (proposal) =>
                proposal.approved && proposal.disqualified_at == null,
            ) &&
            !myVote && (
              <Txt muted>
                With no votes, the earliest approved option is chosen.
              </Txt>
            )}
          {thread.status === "open" &&
            manages &&
            Date.parse(thread.deadline_at) <= now && (
              <Action
                title={thread.kind === "vote" ? "Resolve vote" : "Run draw"}
                run={() =>
                  act("resolve_planning_thread", { thread_id: thread.id })
                }
              />
            )}
          {thread.status === "resolved" && winner && (
            <View style={styles.card}>
              <Text style={styles.label}>SELECTED BEACON</Text>
              <Text style={styles.h2}>{winner.payload.title}</Text>
              {thread.materialized_activity_id && (
                <Button
                  title="Open beacon"
                  onPress={() =>
                    router.push({
                      pathname: "/activity/[id]",
                      params: { id: thread.materialized_activity_id! },
                    })
                  }
                />
              )}
              {replacementAvailable && manages && (
                <Button
                  title="Replace with next option"
                  secondary
                  onPress={() => setReplaceConfirm(true)}
                />
              )}
            </View>
          )}
        </>
      )}
      <ProposalEditor
        inline={embedded}
        thread={thread}
        visible={proposalOpen}
        onClose={() => setProposalOpen(false)}
        onSave={saveProposal}
        onOpenBeaconEditor={() =>
          router.push({
            pathname: "/create",
            params: { threadId: thread.id, editor: "yes" },
          })
        }
      />
      <ConfirmDialog
        title="Replace the selected beacon?"
        visible={replaceConfirm}
        onClose={() => setReplaceConfirm(false)}
        onConfirm={async () => {
          const result = await act("replace_council_winner", {
            thread_id: thread.id,
            expected_winner_proposal_id: thread.winner_proposal_id,
            confirm_cancel_previous: true,
          });
          setReplaceConfirm(false);
          if (typeof result.activity_id === "string")
            router.push({
              pathname: "/activity/[id]",
              params: { id: result.activity_id },
            });
        }}
        confirmLabel={"Confirm replacement"}
        cancelLabel={"Cancel"}
        closeOnConfirm={false}
        destructive
      >
        <Txt>
          This will cancel the current scheduled beacon and create the next
          eligible option. Existing RSVP records stay on the cancelled beacon,
          and its attendees will be notified.
        </Txt>
      </ConfirmDialog>
      {thread.kind !== "ping" && thread.status === "resolved" && !winner && (
        <Empty
          title="No beacon was created."
          body={labelForStatus(thread.status)}
        />
      )}
      {thread.status === "no_options" && (
        <Empty
          title="No beacon was created."
          body="There were no approved options by the deadline. You can start another vote or draw from Past activities."
        />
      )}
      {thread.status === "expired" && (
        <Empty
          title="No beacon was created."
          body="Every approved option had already started when this decision was resolved."
        />
      )}
      {thread.status === "cancelled" && (
        <Empty
          title="This thread was cancelled."
          body="Its history stays here."
        />
      )}
      {!embedded && (
        <View style={styles.row}>
          <Button
            title="Pings & Decisions"
            secondary
            onPress={() => router.replace("/councils")}
          />
          <Button title="Beacons" onPress={() => router.replace("/(tabs)")} />
        </View>
      )}
    </PlanningFrame>
  );
}

function PlanningFrame({
  embedded,
  title,
  eyebrow,
  children,
}: React.ComponentProps<typeof Screen> & { embedded: boolean }) {
  const { styles } = useTheme();
  if (!embedded)
    return (
      <Screen title={title} eyebrow={eyebrow}>
        {children}
      </Screen>
    );
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}
