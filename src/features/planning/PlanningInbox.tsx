import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, CalendarClock } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import {
  canReadPlanningThread,
  normalizePlanningData,
  pendingPlanningThreads,
} from "./domain";
import type { PlanningThread } from "./types";

function prompt(thread: PlanningThread, userId: string, now: number) {
  const manager =
    thread.owner_id === userId || thread.coowner_ids.includes(userId);
  if (thread.kind === "ping")
    return manager ? "Ready to make a beacon" : "Reply to this ping";
  if (manager && Date.parse(thread.deadline_at) <= now)
    return thread.kind === "vote"
      ? "Ready to resolve the vote"
      : "Ready to run the draw";
  if (manager) return "Review a proposed beacon";
  return "Cast or update your vote";
}

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
  if (!userId) return null;
  const pending = pendingPlanningThreads(
    data,
    normalizePlanningData(data),
    userId,
    now,
  ).sort((a, b) => {
    if (compact) {
      const aNeedsReply = a.kind === "ping" && a.owner_id !== userId && Date.parse(a.deadline_at) > now;
      const bNeedsReply = b.kind === "ping" && b.owner_id !== userId && Date.parse(b.deadline_at) > now;
      if (aNeedsReply !== bNeedsReply) return aNeedsReply ? -1 : 1;
    }
    return Date.parse(a.deadline_at) - Date.parse(b.deadline_at);
  });
  if (!pending.length && !(compact && (seeAllCount ?? 0) > 0)) return null;
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
            style={{ minHeight: 36, justifyContent: "center", paddingHorizontal: 5 }}
          >
            <Text style={[styles.label, { color: colors.green }]}>See all · {seeAllCount}</Text>
          </Pressable>
        ) : limit && pending.length > limit ? (
          <Text style={styles.label}>{pending.length} pending</Text>
        ) : null}
      </View>
      {pending.slice(0, limit ?? pending.length).map((thread) => {
        const responses = normalizePlanningData(
          data,
        ).planning_ping_responses.filter(
          (response) =>
            response.thread_id === thread.id &&
            canReadPlanningThread(data, thread, response.user_id),
        );
        const people = responses
          .filter((response) => response.response !== "pass")
          .flatMap((response) => {
            const profile = data.profiles.find(
              (person) => person.id === response.user_id,
            );
            return profile && canViewProfile(data, profile, userId)
              ? [profile]
              : [];
          });
        const source =
          thread.audience === "squad"
            ? data.squads.find((squad) => squad.id === thread.audience_id)?.name
            : thread.audience === "organization"
              ? data.organizations.find((org) => org.id === thread.audience_id)
                  ?.name
              : "Friends";
        const canReply =
          thread.kind === "ping" &&
          Date.parse(thread.deadline_at) > now &&
          thread.owner_id !== userId;
        return (
          <View
            key={thread.id}
            testID={`planning-prompt-${thread.id}`}
            style={[styles.card, { padding: compact ? 8 : 12, gap: compact ? 7 : 10 }]}
          >
            <Pressable
              key={thread.id}
              accessibilityRole="button"
              accessibilityLabel={`${thread.title}, ${prompt(thread, userId, now)}`}
              onPress={() => {
                onOpen?.();
                if (onOpenThread?.(thread)) return;
                router.push({
                  pathname: "/council/[id]",
                  params: { id: thread.id },
                });
              }}
              style={({ pressed }) => [
                {
                  minHeight: compact ? 42 : 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <CalendarClock size={18} color={colors.green} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text
                  numberOfLines={1}
                  style={[styles.body, { fontWeight: "700" }]}
                >
                  {thread.title}
                </Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {source ?? "Your group"} · {prompt(thread, userId, now)}
                </Text>
              </View>
              <ChevronRight size={17} color={colors.muted} />
            </Pressable>
            {thread.kind === "ping" ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View style={{ flexDirection: "row" }}>
                  {people.slice(0, 3).map((profile) => (
                    <View key={profile.id} style={{ marginRight: -5 }}>
                      <ProfileAvatar profile={profile} size={26} />
                    </View>
                  ))}
                  {people.length > 3 ? (
                    <Text style={[styles.label, { marginLeft: 8 }]}>
                      +{people.length - 3}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.muted, { flex: 1 }]}>
                  {
                    responses.filter(
                      (response) => response.response === "interested",
                    ).length
                  }{" "}
                  Interested ·{" "}
                  {
                    responses.filter(
                      (response) => response.response === "maybe",
                    ).length
                  }{" "}
                  Maybe
                </Text>
              </View>
            ) : null}
            {canReply ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["interested", "maybe", "pass"] as const).map((response) => (
                  <View key={response} style={{ flex: 1 }}>
                    <Action
                      compact
                      secondary={response !== "interested"}
                      title={response[0].toUpperCase() + response.slice(1)}
                      run={() =>
                        act("respond_planning_ping", {
                          thread_id: thread.id,
                          response,
                          auto_rsvp: false,
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
