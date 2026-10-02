import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowUpRight, CalendarClock } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useTheme } from "@/src/shared/ui";
import { normalizePlanningData, pendingPlanningThreads } from "./domain";
import type { PlanningThread } from "./types";

function prompt(thread: PlanningThread, userId: string, now: number) {
  const manager = thread.owner_id === userId || thread.coowner_ids.includes(userId);
  if (thread.kind === "ping")
    return manager ? "Ready to make a beacon" : "Reply to this ping";
  if (manager && Date.parse(thread.deadline_at) <= now)
    return thread.kind === "vote" ? "Ready to resolve the vote" : "Ready to run the draw";
  if (manager) return "Review a proposed beacon";
  return "Cast or update your vote";
}

export function PlanningInbox() {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  if (!userId) return null;
  const pending = pendingPlanningThreads(
    data,
    normalizePlanningData(data),
    userId,
    now,
  );
  if (!pending.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.h2}>Needs your decision</Text>
      {pending.map((thread) => (
        <Pressable
          key={thread.id}
          accessibilityRole="button"
          accessibilityLabel={`${thread.title}, ${prompt(thread, userId, now)}`}
          onPress={() =>
            router.push({ pathname: "/council/[id]", params: { id: thread.id } })
          }
          style={({ pressed }) => [
            styles.card,
            {
              minHeight: 60,
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <CalendarClock size={18} color={colors.green} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>
              {thread.title}
            </Text>
            <Text numberOfLines={1} style={styles.muted}>
              {prompt(thread, userId, now)}
            </Text>
          </View>
          <ArrowUpRight size={17} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}
