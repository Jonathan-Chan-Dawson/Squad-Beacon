import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useTheme } from "@/src/shared/ui";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { canReadOrganization } from "@/src/features/organizations/domain";
import { visibleSquadPingResponses } from "@/src/features/organizations/squadChat";
import { PlanningResponseCard } from "@/src/features/people/components/PlanningResponseCard";
import {
  canReadPlanningThread,
  normalizePlanningData,
  pendingPlanningThreads,
  visiblePlanningProposals,
} from "./domain";
import type { PlanningThread } from "./types";

export function PlanningInbox({
  limit,
  onOpen,
  compact = false,
  seeAllCount,
  onSeeAll,
  onOpenThread,
}: {
  limit?: number;
  onOpen?: () => void;
  compact?: boolean;
  seeAllCount?: number;
  onSeeAll?: () => void;
  onOpenThread?: (thread: PlanningThread) => boolean;
} = {}) {
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  // Retain the original authorized thread through response feedback, then remove it.
  const [settling, setSettling] = useState<Record<string, PlanningThread>>({});
  if (!userId || data.viewer_id !== userId) return null;
  const planning = normalizePlanningData(data);
  const pending = pendingPlanningThreads(data, planning, userId, now);
  const retained = Object.values(settling).filter(
    (thread) =>
      !pending.some((item) => item.id === thread.id) &&
      planning.planning_threads.some(
        (item) =>
          item.id === thread.id && canReadPlanningThread(data, item, userId),
      ),
  );
  const threads = [...pending, ...retained].sort((a, b) => {
    if (compact) {
      const aNeedsReply =
        a.kind === "ping" &&
        a.owner_id !== userId &&
        Date.parse(a.deadline_at) > now;
      const bNeedsReply =
        b.kind === "ping" &&
        b.owner_id !== userId &&
        Date.parse(b.deadline_at) > now;
      if (aNeedsReply !== bNeedsReply) return aNeedsReply ? -1 : 1;
    }
    return Date.parse(a.deadline_at) - Date.parse(b.deadline_at);
  });
  if (!threads.length && !(compact && (seeAllCount ?? 0) > 0)) return null;
  const blocked = (personId: string) =>
    data.blocks.some(
      (row) =>
        (row.blocker_id === userId && row.blocked_id === personId) ||
        (row.blocker_id === personId && row.blocked_id === userId),
    );
  const clearSettling = (id: string) =>
    setSettling((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      <View style={styles.between}>
        <Text style={styles.h2}>Needs your response</Text>
        {compact && onSeeAll && (seeAllCount ?? 0) > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See all responses and invitations"
            onPress={onSeeAll}
            hitSlop={8}
            style={{
              minHeight: 36,
              justifyContent: "center",
              paddingHorizontal: 5,
            }}
          >
            <Text style={[styles.label, { color: colors.green }]}>
              See all · {seeAllCount}
            </Text>
          </Pressable>
        ) : limit && pending.length > limit ? (
          <Text style={styles.label}>{pending.length} pending</Text>
        ) : null}
      </View>
      {threads.slice(0, limit ?? threads.length).map((thread) => {
        const source =
          thread.audience === "squad"
            ? canOpenSquadProfile(data, thread.audience_id ?? "", userId)
              ? (data.squads.find((squad) => squad.id === thread.audience_id)
                  ?.name ?? "Squad")
              : "Squad"
            : thread.audience === "organization"
              ? canReadOrganization(data, thread.audience_id ?? "", userId)
                ? (data.organizations.find(
                    (org) => org.id === thread.audience_id,
                  )?.name ?? "Organization")
                : "Organization"
              : "Friends";
        const open = () => {
          onOpen?.();
          if (onOpenThread?.(thread)) return;
          router.push({ pathname: "/council/[id]", params: { id: thread.id } });
        };
        const common = {
          id: thread.id,
          title: thread.title,
          sourceLabel: source,
          deadline: thread.deadline_at,
          compact,
          onOpen: open,
        };
        if (thread.kind === "ping") {
          const responses =
            thread.audience === "squad"
              ? visibleSquadPingResponses(data, thread, userId)
              : planning.planning_ping_responses.filter(
                  (response) =>
                    response.thread_id === thread.id &&
                    response.user_id !== thread.owner_id &&
                    !blocked(response.user_id) &&
                    canReadPlanningThread(data, thread, response.user_id),
                );
          return (
            <View key={thread.id} testID={`planning-prompt-${thread.id}`}>
              <PlanningResponseCard
                {...common}
                kind="ping"
                counts={[
                  {
                    label: "Interested",
                    value: responses.filter(
                      (response) => response.response === "interested",
                    ).length,
                  },
                  {
                    label: "Maybe",
                    value: responses.filter(
                      (response) => response.response === "maybe",
                    ).length,
                  },
                ]}
                selected={
                  responses.find((response) => response.user_id === userId)
                    ?.response
                }
                disabled={
                  thread.owner_id === userId ||
                  thread.status !== "open" ||
                  Date.parse(thread.deadline_at) <= now
                }
                onRespond={async (response) => {
                  setSettling((current) => ({
                    ...current,
                    [thread.id]: thread,
                  }));
                  try {
                    await act("respond_planning_ping", {
                      thread_id: thread.id,
                      response,
                      auto_rsvp: false,
                    });
                    return true;
                  } catch (error) {
                    clearSettling(thread.id);
                    throw error;
                  }
                }}
                onAcknowledged={() => clearSettling(thread.id)}
              />
            </View>
          );
        }
        const options = visiblePlanningProposals(
          data,
          planning.planning_proposals,
          thread.id,
          userId,
        ).filter(
          (proposal) =>
            proposal.approved &&
            proposal.disqualified_at == null &&
            canReadPlanningThread(data, thread, proposal.author_id),
        );
        const votes = planning.planning_votes.filter(
          (vote) =>
            vote.thread_id === thread.id &&
            options.some((option) => option.id === vote.proposal_id) &&
            !blocked(vote.user_id) &&
            canReadPlanningThread(data, thread, vote.user_id),
        );
        return (
          <View key={thread.id} testID={`planning-prompt-${thread.id}`}>
            <PlanningResponseCard
              {...common}
              kind={thread.kind}
              counts={
                thread.kind === "vote"
                  ? [
                      { label: "options", value: options.length },
                      { label: "votes", value: votes.length },
                    ]
                  : [{ label: "approved options", value: options.length }]
              }
              selected={
                thread.kind === "vote"
                  ? votes.find((vote) => vote.user_id === userId)?.proposal_id
                  : null
              }
              actions={[
                {
                  id: "details",
                  feedback: "none",
                  label: thread.kind === "vote" ? "Review vote" : "Review draw",
                  onPress: open,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}
