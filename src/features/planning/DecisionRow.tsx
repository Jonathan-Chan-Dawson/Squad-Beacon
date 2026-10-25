import { useNow } from "@/src/shared/useNow";
import React, { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Dices,
  Vote,
} from "lucide-react-native";
import { router } from "expo-router";
import { Action, Button, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { useReducedMotion } from "@/src/shared/design-system";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { BeaconIcon } from "@/src/features/beacons/components/BeaconIcon";
import { canReadPlanningThread, visiblePlanningProposals } from "./domain";
import { PlanningResponseControls } from "./PlanningResponseControls";
import { planningDestination, type planningInbox } from "./inbox";

type Decision = ReturnType<typeof planningInbox>[number];
const revealed = new Set<string>();

function DrawResult({ item }: { item: Decision }) {
  const { data, userId } = useBeacon();
  const reduced = useReducedMotion();
  const resultKey = `${userId}:${item.thread.id}:${item.thread.winner_proposal_id}`;
  const [opacity] = useState(
    () => new Animated.Value(reduced || revealed.has(resultKey) ? 1 : 0),
  );
  useEffect(() => {
    revealed.add(resultKey);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: reduced ? 0 : 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, reduced, resultKey]);
  const activity = data.activities.find(
    (row) => row.id === item.thread.materialized_activity_id,
  );
  const winner = visiblePlanningProposals(
    data,
    data.planning_proposals,
    item.thread.id,
    userId ?? "",
  ).find(
    (row) =>
      row.id === item.thread.winner_proposal_id &&
      canReadPlanningThread(data, item.thread, row.author_id),
  );
  const readable =
    activity && userId && canReadBeaconActivity(data, activity, userId);
  return (
    <Animated.View accessibilityLiveRegion="polite" style={{ opacity, gap: 8 }}>
      <Txt>Draw result</Txt>
      {winner ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <BeaconIcon category={winner.payload.category} size={36} />
          <Txt>{winner.payload.title}</Txt>
        </View>
      ) : (
        <Txt muted>The Draw has been resolved.</Txt>
      )}
      {readable ? (
        <Button
          compact
          title="Open winning Beacon"
          onPress={() =>
            router.push({
              pathname: "/activity/[id]",
              params: { id: activity.id },
            })
          }
        />
      ) : null}
    </Animated.View>
  );
}

export function DecisionRow({
  item,
  expanded,
  onExpand,
  onBeforeRespond,
}: {
  item: Decision;
  expanded: boolean;
  onExpand: () => void;
  onBeforeRespond: () => void;
}) {
  const { styles, colors } = useTheme();
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useNow();
  const { thread, response, vote, manages, eligible } = item;
  const Icon =
    thread.kind === "ping" ? CircleHelp : thread.kind === "vote" ? Vote : Dices;
  const creator =
    data.profiles.find((row) => row.id === thread.owner_id)?.name ??
    "Organizer";
  const audience =
    thread.audience === "squad"
      ? data.squads.find((row) => row.id === thread.audience_id)?.name
      : thread.audience === "organization"
        ? data.organizations.find((row) => row.id === thread.audience_id)?.name
        : thread.audience;
  const saved = response
    ? `Your response: ${response.response}`
    : vote
      ? "Your vote saved"
      : null;
  const open = thread.status === "open" && Date.parse(thread.deadline_at) > now;
  const manage = () => router.push(planningDestination(thread.id, "manage"));
  const deadline = new Date(thread.deadline_at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  async function organizerAction(
    action: string,
    payload: Record<string, unknown>,
  ) {
    const epoch = getViewerEpoch();
    await act(action, payload);
    if (epoch !== getViewerEpoch()) throw new Error("Your account changed.");
  }
  return (
    <View
      testID={`decision-row-${thread.id}`}
      style={{
        paddingVertical: 14,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${thread.title}`}
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={onExpand}
        style={{
          minHeight: 44,
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
        }}
      >
        <Icon size={20} color={colors.green} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={[styles.body, { fontWeight: "700" }]}>
            {thread.title}
          </Text>
          <Text style={styles.muted}>
            {creator} · {audience}
          </Text>
        </View>
        {expanded ? (
          <ChevronDown size={18} color={colors.muted} />
        ) : (
          <ChevronRight size={18} color={colors.muted} />
        )}
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.muted}>
        {saved
          ? `${saved} · ${open ? `Change until ${deadline}` : "Responses closed"}`
          : thread.status !== "open"
            ? thread.status.replaceAll("_", " ")
            : open
              ? thread.kind === "draw"
                ? `Draw closes ${deadline} · No response needed`
                : `Respond by ${deadline}`
              : "Responses closed · Awaiting organizer"}
      </Text>
      {thread.status === "open" && !(thread.kind === "ping" && thread.owner_id === userId) ? (
        <PlanningResponseControls
          threadId={thread.id}
          showDeadline={false}
          expanded={expanded}
          onBeforeRespond={onBeforeRespond}
          onOpen={onExpand}
          onOpenBeaconEditor={() =>
            router.push({
              pathname: "/create",
              params: { threadId: thread.id },
            })
          }
        />
      ) : null}
      {thread.kind === "draw" && thread.status === "resolved" ? (
        <DrawResult key={thread.winner_proposal_id} item={item} />
      ) : null}
      {expanded ? (
        <View style={{ gap: 10 }}>
          {thread.body ? <Txt>{thread.body}</Txt> : null}
          <Txt muted>Responses close {deadline}</Txt>
          {thread.payload ? (
            <>
              <Txt>{thread.payload.title}</Txt>
              <Txt muted>
                {new Date(thread.payload.starts_at).toLocaleString()}
                {thread.payload.label ? ` · ${thread.payload.label}` : ""}
              </Txt>
            </>
          ) : null}
          {manages
            ? visiblePlanningProposals(
                data,
                data.planning_proposals,
                thread.id,
                userId ?? "",
              )
                .filter(
                  (row) =>
                    !row.approved &&
                    !row.disqualified_at &&
                    canReadPlanningThread(data, thread, row.author_id),
                )
                .map((proposal) => (
                  <View key={proposal.id} style={{ gap: 6 }}>
                    <Txt>{proposal.payload.title} · Pending approval</Txt>
                    <Action
                      secondary
                      title={`Approve ${proposal.payload.title}`}
                      run={() =>
                        organizerAction("approve_council_proposal", {
                          thread_id: thread.id,
                          proposal_id: proposal.id,
                          approved: true,
                        })
                      }
                    />
                  </View>
                ))
            : null}
          {manages &&
          thread.status === "open" &&
          Date.parse(thread.deadline_at) <= now &&
          thread.kind !== "ping" &&
          item.options.length ? (
            <Action
              title={
                thread.kind === "draw" ? "Draw an activity" : "Resolve vote"
              }
              run={() =>
                organizerAction("resolve_planning_thread", {
                  thread_id: thread.id,
                })
              }
            />
          ) : null}
          {manages ? (
            <Button
              compact
              secondary
              title="Manage decision"
              onPress={manage}
            />
          ) : null}
          {!manages && thread.kind !== "ping" && !eligible ? (
            <Button
              compact
              secondary
              title="View decision details"
              onPress={manage}
            />
          ) : null}
          {thread.materialized_activity_id && thread.kind !== "draw" ? (
            <Button
              compact
              secondary
              title="Open resulting Beacon"
              onPress={() =>
                router.push({
                  pathname: "/activity/[id]",
                  params: { id: thread.materialized_activity_id! },
                })
              }
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
