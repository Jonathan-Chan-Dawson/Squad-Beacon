import { CouncilProposalReview } from "./CouncilChoices";
import { PlanningLink } from "./PlanningControls";
import {
  ConnectedPlanningActions,
  OrganizerMessageEditor,
} from "./ConnectedPlanningActions";
import { useNow } from "@/src/shared/useNow";
import React, { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useReducedMotion } from "@/src/shared/design-system";
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Dices,
  CalendarClock,
  Vote,
} from "lucide-react-native";
import { router } from "expo-router";
import { Action, Txt, useTheme } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { PlanningResponseControls } from "./PlanningResponseControls";
import { planningDestination, type planningInbox } from "./inbox";

type Decision = ReturnType<typeof planningInbox>[number];
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
  const { styles, colors, semanticColors } = useTheme();
  const reduceMotion = useReducedMotion();
  const [reveal] = useState(() => new Animated.Value(expanded ? 1 : 0));
  useEffect(() => {
    Animated.timing(reveal, {
      toValue: expanded ? 1 : 0,
      duration: reduceMotion ? 0 : 160,
      useNativeDriver: false,
    }).start();
    return () => reveal.stopAnimation();
  }, [expanded, reduceMotion, reveal]);
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useNow();
  const { thread, response, vote, manages, eligible } = item;
  const kindLabel =
    thread.kind === "time"
      ? "Find a Time"
      : thread.kind === "vote"
        ? "Vote"
        : thread.kind === "draw"
          ? "Draw"
          : "Ping";
  const interested = new Set(
    item.responses
      .filter((r) => r.response === "interested")
      .map((r) => r.user_id),
  ).size;
  const Icon =
    thread.kind === "ping"
      ? CircleHelp
      : thread.kind === "vote"
        ? Vote
        : thread.kind === "time"
          ? CalendarClock
          : Dices;
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
    <Animated.View
      testID={`decision-row-${thread.id}`}
      style={{
        paddingVertical: thread.kind === "ping" ? 6 : 10,
        paddingHorizontal: 10,
        gap: thread.kind === "ping" ? 4 : 6,
        borderRadius: 12,
        marginVertical: 2,
        borderWidth: 1,
        borderColor: semanticColors.border,
        borderLeftWidth: 2,
        borderLeftColor: expanded ? colors.green : semanticColors.border,
        backgroundColor: reveal.interpolate({
          inputRange: [0, 1],
          outputRange: [semanticColors.surface, semanticColors.surfaceRaised],
        }),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${thread.title}`}
        accessibilityHint={`${kindLabel}. Expand to view details and available actions.`}
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
          <Text
            style={[
              styles.body,
              { fontWeight: "700", fontSize: 15, lineHeight: 21 },
            ]}
          >
            {thread.title}
          </Text>
          <Text style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}>
            {kindLabel} · {creator} · {audience}
          </Text>
        </View>
        {expanded ? (
          <ChevronDown size={18} color={colors.muted} />
        ) : (
          <ChevronRight size={18} color={colors.muted} />
        )}
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}
      >
        {thread.materialized_activity_id
          ? data.activities.find(
              (a) => a.id === thread.materialized_activity_id,
            )?.status === "cancelled"
            ? "Beacon cancelled"
            : "Beacon created"
          : thread.not_organized_at
            ? "Not Organized"
            : thread.continuation_closed_at
              ? "Closed without a Beacon"
              : thread.kind === "time" && thread.selected_slot_id
                ? manages
                  ? "Time selected · Ready for Beacon review"
                  : "Time selected · Waiting for Organizer"
                : saved
                  ? thread.kind === "ping"
                    ? open
                      ? `Change until ${deadline}`
                      : "Responses closed"
                    : `${saved} · ${open ? `Change until ${deadline}` : "Responses closed"}`
                  : thread.status !== "open"
                    ? thread.status.replaceAll("_", " ")
                    : open
                      ? thread.kind === "draw"
                        ? `Draw closes ${deadline} · No response needed`
                        : `Respond by ${deadline}`
                      : "Responses closed · Awaiting organizer"}
      </Text>
      {!thread.materialized_activity_id &&
      thread.status === "open" &&
      !(thread.kind === "ping" && thread.owner_id === userId) ? (
        <PlanningResponseControls
          threadId={thread.id}
          showDeadline={false}
          compactPing
          expanded={expanded}
          onBeforeRespond={onBeforeRespond}
          onOpen={onExpand}
          onOpenBeaconEditor={() =>
            router.push({
              pathname: "/create",
              params: { threadId: thread.id, editor: "yes" },
            })
          }
        />
      ) : null}
      {thread.interest_target && (
        <View style={{ gap: 6 }}>
          <Text style={styles.muted}>
            {interested} Interested ·{" "}
            {interested >= thread.interest_target
              ? "Enough interest"
              : `${thread.interest_target - interested} more needed`}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Interest target"
            accessibilityValue={{
              min: 0,
              max: thread.interest_target,
              now: Math.min(interested, thread.interest_target),
              text: `${interested} interested out of ${thread.interest_target} needed`,
            }}
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: colors.line,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 3,
                width: `${Math.min(100, (interested / thread.interest_target) * 100)}%`,
                backgroundColor: colors.green,
              }}
            />
          </View>
        </View>
      )}
      {thread.materialized_activity_id && (
        <ConnectedPlanningActions
          thread={thread}
          onBeforeAction={onBeforeRespond}
        />
      )}
      {expanded ? (
        <Animated.View style={{ gap: 8, opacity: reveal }}>
          {thread.body ? <Txt>{thread.body}</Txt> : null}
          {thread.payload &&
          thread.kind === "ping" &&
          !thread.materialized_activity_id ? (
            <>
              {thread.payload.title !== thread.title && (
                <Txt>{thread.payload.title}</Txt>
              )}
              <Txt muted>
                {new Date(thread.payload.starts_at).toLocaleString()}
                {thread.payload.label ? ` · ${thread.payload.label}` : ""}
              </Txt>
            </>
          ) : null}
          <CouncilProposalReview
            thread={thread}
            onBeforeAction={onBeforeRespond}
          />
          {!thread.materialized_activity_id && (
            <ConnectedPlanningActions
              thread={thread}
              onBeforeAction={onBeforeRespond}
            />
          )}
          <OrganizerMessageEditor
            key={`${userId}:${thread.id}`}
            thread={thread}
          />

          {manages &&
          thread.status === "open" &&
          Date.parse(thread.deadline_at) <= now &&
          thread.kind !== "ping" &&
          thread.kind !== "time" &&
          thread.resolution_policy !== "explicit" &&
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
            <PlanningLink title="Manage decision" onPress={manage} />
          ) : null}
          {!manages && thread.kind !== "ping" && !eligible ? (
            <PlanningLink title="View decision details" onPress={manage} />
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
