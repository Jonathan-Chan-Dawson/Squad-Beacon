import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarClock, Check, CircleHelp, Dices, Vote } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import {
  Action,
  Button,
  Empty,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import {
  canManagePlanningThread,
  canReadPlanningThread,
  canRespondToPlanningThread,
  councilVoteCounts,
  normalizePlanningData,
  validateCouncilProposal,
  visiblePlanningProposals,
} from "./domain";
import type { BeaconDraft, PlanningProposal } from "./types";
import { ProposalEditor } from "./ProposalEditor";
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

export default function PlanningDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  const planning = normalizePlanningData(data);
  const thread = planning.planning_threads.find((item) => item.id === id);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [pingAutoRsvp, setPingAutoRsvp] = useState<boolean | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState(false);

  const accessible = !!thread && canReadPlanningThread(data, thread, userId ?? "");
  const manages = !!thread && accessible && canManagePlanningThread(thread, userId ?? "");
  const proposals = useMemo(
    () =>
      thread
        ? visiblePlanningProposals(
            data,
            planning.planning_proposals,
            thread.id,
            userId ?? "",
          ).filter((proposal) =>
            canReadPlanningThread(data, thread, proposal.author_id),
          )
        : [],
    [data, planning.planning_proposals, thread, userId],
  );
  const votes = planning.planning_votes.filter((vote) => vote.thread_id === id);
  const approvedIds = new Set(
    proposals
      .filter((proposal) => proposal.approved && proposal.disqualified_at == null)
      .map((proposal) => proposal.id),
  );
  const voteCounts = councilVoteCounts(votes, id ?? "", approvedIds);
  const myVote = votes.find((vote) => vote.user_id === userId);
  const myResponse = planning.planning_ping_responses.find(
    (response) => response.thread_id === id && response.user_id === userId,
  );
  const autoRsvpChoice = pingAutoRsvp ?? !!myResponse?.auto_rsvp;
  const canRespond =
    !!thread && canRespondToPlanningThread(data, thread, userId ?? "");
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
    const author = data.profiles.find((person) => person.id === proposal.author_id);
    return (
      <View key={proposal.id} style={styles.card}>
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.h2}>{proposal.payload.title}</Text>
            <Text style={styles.muted}>
              {proposal.payload.category} · {dateLabel(proposal.payload.starts_at)}
            </Text>
            <Text style={styles.muted}>Suggested by {author?.name ?? "A member"}</Text>
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
            {proposal.payload.latitude != null && proposal.payload.longitude != null
              ? ` · ${proposal.payload.latitude.toFixed(3)}, ${proposal.payload.longitude.toFixed(3)}`
              : ""}
          </Txt>
        ) : null}
        <Text style={styles.label}>
          {proposal.disqualified_at
            ? "REPLACED"
            : proposal.approved
              ? `${voteCounts.get(proposal.id) ?? 0} votes · APPROVED`
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
            title={selected ? "Your vote · change vote" : "Vote for this option"}
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
      <Screen title="Planning decision" eyebrow="PING, VOTE, OR DRAW">
        <Empty
          title="This planning thread isn’t available."
          body="It may have closed or no longer be shared with you."
        />
      </Screen>
    );

  const Icon =
    thread.kind === "ping" ? CircleHelp : thread.kind === "vote" ? Vote : Dices;

  return (
    <Screen title={thread.title} eyebrow={thread.kind.toUpperCase()}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Icon color={colors.green} size={19} />
          <Text style={styles.h2}>{labelForStatus(thread.status)}</Text>
        </View>
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

      {thread.kind === "ping" && thread.payload && (
        <View style={styles.card}>
          <Text style={styles.label}>IF CONVERTED TO A BEACON</Text>
          <Text style={styles.h2}>{thread.payload.title}</Text>
          <Txt muted>
            {thread.payload.category} · {dateLabel(thread.payload.starts_at)}
          </Txt>
          {thread.status === "open" && userId !== thread.owner_id && canRespond && (
            <>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: autoRsvpChoice }}
                accessibilityLabel="Auto-RSVP if this ping becomes a beacon"
                onPress={() =>
                  setPingAutoRsvp((current) => !(current ?? !!myResponse?.auto_rsvp))
                }
                style={({ pressed }) => ({
                  minHeight: 48,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.bg,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View
                  style={{
                    width: 21,
                    height: 21,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: autoRsvpChoice ? colors.green : colors.muted,
                    backgroundColor: autoRsvpChoice ? colors.green : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {autoRsvpChoice ? <Check color={colors.white} size={15} /> : null}
                </View>
                <Text style={styles.body}>Auto-RSVP if this becomes a beacon</Text>
              </Pressable>
              {(["interested", "maybe", "pass"] as const).map((response) => (
                <Action
                  key={response}
                  title={
                    myResponse?.response === response
                      ? `${response[0].toUpperCase()}${response.slice(1)} · update`
                      : `${response[0].toUpperCase()}${response.slice(1)}`
                  }
                  secondary={myResponse?.response !== response}
                  run={() =>
                    act("respond_planning_ping", {
                      thread_id: thread.id,
                      response,
                      auto_rsvp: response === "interested" && autoRsvpChoice,
                    })
                  }
                />
              ))}
            </>
          )}
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
            {planning.planning_ping_responses.filter(
              (response) => response.thread_id === thread.id,
            ).length} responses · Interested with Auto-RSVP will request or join
            according to the beacon’s approval settings.
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
                  : "At the deadline, an approved option is drawn at random; no entries are needed."}
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
          {proposals.length ? proposals.map(proposalCard) : (
            <Empty
              title="No options yet."
              body="Add a beacon option. An option host can approve it before the vote or draw."
            />
          )}
          {thread.kind === "vote" && thread.status === "open" && canRespond &&
            proposals.some((proposal) => proposal.approved && proposal.disqualified_at == null) &&
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
                run={() => act("resolve_planning_thread", { thread_id: thread.id })}
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
        thread={thread}
        visible={proposalOpen}
        onClose={() => setProposalOpen(false)}
        onSave={saveProposal}
      />
      <Sheet
        title="Replace the selected beacon?"
        visible={replaceConfirm}
        onClose={() => setReplaceConfirm(false)}
      >
        <Txt>
          This will cancel the current scheduled beacon and create the next
          eligible option. Existing RSVP records stay on the cancelled beacon,
          and its attendees will be notified.
        </Txt>
        <Action
          title="Confirm replacement"
          run={async () => {
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
        />
      </Sheet>
      {thread.kind === "vote" && thread.status === "resolved" && !winner && (
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
        <Empty title="This thread was cancelled." body="Its history stays here." />
      )}
      <View style={styles.row}>
        <Button title="Pings & Decisions" secondary onPress={() => router.replace("/councils")} />
        <Button title="Beacons" onPress={() => router.replace("/(tabs)")} />
      </View>
    </Screen>
  );
}
