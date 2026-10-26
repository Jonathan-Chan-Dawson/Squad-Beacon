import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { BeaconIcon } from "@/src/features/beacons/components/BeaconIcon";
import { planningInteraction } from "./planningInteraction";
import { useNow } from "@/src/shared/useNow";
import { submitPlanning } from "./submission";
import { ProposalEditor } from "./ProposalEditor";
import { PlanningLink } from "./PlanningControls";
import {
  canReadPlanningThread,
  validateCouncilProposal,
  canManagePlanningThread,
  visiblePlanningProposals,
} from "./domain";
import { Check } from "lucide-react-native";
import type { PlanningThread } from "./types";

export function CouncilProposalReview({
  thread,
  onBeforeAction,
}: {
  thread: PlanningThread;
  onBeforeAction?: () => void;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (
    !userId ||
    !canManagePlanningThread(thread, userId) ||
    thread.status !== "open" ||
    Date.parse(thread.deadline_at) <= now
  )
    return null;
  const pending = visiblePlanningProposals(
    data,
    data.planning_proposals,
    thread.id,
    userId,
  ).filter(
    (p) =>
      !p.approved &&
      !p.disqualified_at &&
      canReadPlanningThread(data, thread, p.author_id),
  );
  if (!pending.length) return null;
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.muted}>Suggestions to review</Text>
      {pending.map((p) => (
        <View
          key={p.id}
          style={{
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <BeaconIcon category={p.payload.category} size={30} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.body, { fontSize: 14, fontWeight: "600" }]}>
              {p.payload.title}
            </Text>
            <Text style={styles.muted}>
              {new Date(p.payload.starts_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · Pending approval
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Approve ${p.payload.title}`}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => {
              const epoch = getViewerEpoch();
              onBeforeAction?.();
              setBusy(true);
              setError("");
              void act("approve_council_proposal", {
                thread_id: thread.id,
                proposal_id: p.id,
                approved: true,
                expected_actor_id: userId,
              })
                .catch((e) => {
                  if (epoch === getViewerEpoch())
                    setError((e as Error).message);
                })
                .finally(() => {
                  if (epoch === getViewerEpoch()) setBusy(false);
                });
            }}
            style={{
              minHeight: 44,
              minWidth: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={21} color={busy ? colors.muted : colors.green} />
          </Pressable>
        </View>
      ))}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

export function CouncilChoices({
  threadId,
  expanded,
  onExpand,
  onBeforeRespond,
  onOpenBeaconEditor,
}: {
  threadId: string;
  expanded: boolean;
  onExpand: () => void;
  onBeforeRespond?: () => void;
  onOpenBeaconEditor?: () => void;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  const state = planningInteraction(data, userId, threadId, now);
  const ballot = (data.planning_approval_ballots ?? []).find(
    (b) => b.thread_id === threadId && b.user_id === userId,
  );
  const vote = state?.votes.find((v) => v.user_id === userId);
  const [choices, setChoices] = useState<string[]>(ballot?.proposal_ids ?? []);
  const [none, setNone] = useState(ballot?.none_work ?? false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!state) return null;
  const { thread, eligible, options, votes } = state;
  const approval = thread.vote_method === "approval";
  const answered = approval ? !!ballot : !!vote;
  const manages =
    thread.owner_id === userId || thread.coowner_ids.includes(userId ?? "");
  const showCounts = answered || manages || thread.status !== "open";
  const ballots = (data.planning_approval_ballots ?? []).filter(
    (b) =>
      b.thread_id === threadId &&
      canReadPlanningThread(data, thread, b.user_id),
  );
  const counts = (id: string) =>
    data.planning_option_counts?.find(
      (c) => c.thread_id === threadId && c.proposal_id === id,
    )?.total ??
    (approval
      ? ballots.filter(
          (b) =>
            b.proposal_ids.includes(id) &&
            !data.blocks.some((x) => {
              const author = options.find((p) => p.id === id)?.author_id;
              return (
                (x.blocker_id === b.user_id && x.blocked_id === author) ||
                (x.blocked_id === b.user_id && x.blocker_id === author)
              );
            }) &&
            !data.blocks.some(
              (x) =>
                (x.blocker_id === userId && x.blocked_id === b.user_id) ||
                (x.blocked_id === userId && x.blocker_id === b.user_id),
            ),
        ).length
      : votes.filter((v) => v.proposal_id === id).length);
  async function save(ids: string[], explicitNone: boolean) {
    ids = ids.filter((id) => options.some((option) => option.id === id));
    if (approval && !explicitNone && !ids.length) {
      setError(
        "Choose an eligible option or explicitly select None work for me.",
      );
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    onBeforeRespond?.();
    const epoch = getViewerEpoch();
    try {
      await submitPlanning(userId, threadId, () =>
        act(
          approval ? "save_council_approval_ballot" : "vote_council_proposal",
          {
            thread_id: threadId,
            ...(approval
              ? { proposal_ids: ids, none_work: explicitNone }
              : { proposal_id: ids[0] }),
            expected_actor_id: userId,
          },
        ),
      );
    } catch (e) {
      if (epoch === getViewerEpoch()) setError((e as Error).message);
    } finally {
      if (epoch === getViewerEpoch()) setBusy(false);
    }
  }
  const visible = expanded ? options : options.slice(0, 3);
  const updated = ballot?.updated_at ?? vote?.updated_at ?? vote?.created_at;
  return (
    <View style={{ gap: 8 }}>
      {visible.map((option) => {
        const selected = approval
          ? choices.includes(option.id)
          : vote?.proposal_id === option.id;
        const isNew =
          updated &&
          Date.parse(option.approved_at ?? option.created_at) >
            Date.parse(updated);
        return (
          <Pressable
            key={option.id}
            accessibilityRole={approval ? "checkbox" : "radio"}
            aria-checked={selected}
            accessibilityState={{
              checked: selected,
              disabled: !eligible || busy,
            }}
            accessibilityLabel={`${option.payload.title}, ${new Date(option.payload.starts_at).toLocaleString()}${option.payload.label ? `, ${option.payload.label}` : ""}`}
            disabled={!eligible || busy}
            onPress={() => {
              if (approval) {
                setNone(false);
                setChoices(
                  selected
                    ? choices.filter((id) => id !== option.id)
                    : [...choices, option.id],
                );
              } else void save([option.id], false);
            }}
            style={{
              minHeight: 56,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <BeaconIcon category={option.payload.category} size={32} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={styles.body}>{option.payload.title}</Text>
              <Text numberOfLines={1} style={styles.muted}>
                {new Date(option.payload.starts_at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {option.payload.label ? ` · ${option.payload.label}` : ""}
              </Text>
              {isNew && <Txt muted>New since your vote</Txt>}
              {showCounts && (
                <Txt muted>
                  {counts(option.id)} {approval ? "approvals" : "votes"}
                </Txt>
              )}
            </View>
            <Txt>{selected ? "✓" : approval ? "□" : "○"}</Txt>
          </Pressable>
        );
      })}
      {!expanded && options.length > 3 && (
        <Button compact secondary title="Show All Options" onPress={onExpand} />
      )}
      {approval && eligible && (
        <>
          <Button
            compact
            secondary
            title={none ? "None work for me ✓" : "None work for me"}
            onPress={() => {
              setChoices([]);
              setNone(true);
            }}
          />
          <Button
            title={ballot ? "Update Choices" : "Save Choices"}
            disabled={busy || (!none && !choices.length)}
            onPress={() => void save(choices, none)}
          />
        </>
      )}
      {expanded &&
        eligible &&
        data.planning_proposals.some(
          (p) =>
            p.thread_id === thread.id &&
            p.author_id === userId &&
            !p.approved &&
            !p.disqualified_at,
        ) && <Txt muted>Your suggestion is awaiting organizer approval.</Txt>}
      {answered && (
        <Txt muted>
          {approval && ballot?.none_work
            ? "Your response: None work for me"
            : "Your choices are saved. You can change them until the deadline."}
        </Txt>
      )}
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!eligible && <Txt muted>Responses are closed.</Txt>}
      {expanded && eligible && (
        <PlanningLink
          title="Suggest an option"
          onPress={() => setAdding(!adding)}
        />
      )}
      {adding && eligible && (
        <ProposalEditor
          inline
          onOpenBeaconEditor={onOpenBeaconEditor}
          thread={thread}
          visible
          onClose={() => setAdding(false)}
          onSave={async (payload) => {
            validateCouncilProposal(thread, payload);
            await act("add_council_proposal", {
              thread_id: thread.id,
              payload,
              expected_actor_id: userId,
            });
            setAdding(false);
          }}
        />
      )}
    </View>
  );
}
