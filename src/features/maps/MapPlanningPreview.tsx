import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { CouncilChoices } from "@/src/features/planning/CouncilChoices";
import { activeSlots } from "@/src/features/planning/connected";
import { canReadPlanningThread, visiblePlanningProposals } from "@/src/features/planning/domain";
import { planningCreationModes } from "@/src/features/planning/PlanningKindSelector";
import { planningInteraction } from "@/src/features/planning/planningInteraction";
import { PlanningResponseControls } from "@/src/features/planning/PlanningResponseControls";
import { AvailabilityControls } from "@/src/features/planning/TimeFinder";
import { useBeacon } from "@/src/shared/store";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import type { MapContextPoint } from "./contextFilters";
import { MapCallout } from "./MapCallout";
import { MapTooltipClose } from "./MapTooltipShell";

export function MapPlanningPreview({ point, anchor, bounds, onClose, onOpen }: {
  point: MapContextPoint;
  anchor: React.ComponentProps<typeof MapCallout>["anchor"];
  bounds: React.ComponentProps<typeof MapCallout>["bounds"];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  const [expanded, setExpanded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<"close" | "open" | null>(null);
  const state = planningInteraction(data, userId, point.threadId ?? "", now);
  if (!state) return null;
  const { thread, eligible } = state;
  const mode = planningCreationModes.find(({ kind }) => kind === thread.kind)!;
  const Icon = mode.Icon;
  const closed = thread.status !== "open" || Date.parse(thread.deadline_at) <= now || !!thread.finalized_at;
  const slots = thread.kind === "time" ? activeSlots(data, thread.id) : [];
  const drawEntries = thread.kind === "draw" && userId
    ? visiblePlanningProposals(data, data.planning_proposals, thread.id, userId).filter(
        (entry) => entry.approved && !entry.disqualified_at && canReadPlanningThread(data, thread, entry.author_id),
      )
    : [];
  const winner = thread.status === "resolved"
    ? drawEntries.find(({ id }) => id === thread.winner_proposal_id)
    : undefined;
  const leave = (action: "close" | "open") => {
    if (dirty) setPending(action);
    else if (action === "open") onOpen(thread.id);
    else onClose();
  };
  const deadline = new Date(thread.deadline_at);
  const close = () => pending ? setPending(null) : leave("close");

  return (
    <MapCallout
      anchor={anchor}
      bounds={bounds}
      compact
      pointWhenClamped
      maxWidth={368}
      maxContentHeight={Math.min(435, Math.max(180, bounds.height - bounds.top - bounds.bottom))}
      onDismiss={close}
      testID="map-planning-callout"
    >
      <View testID="map-planning-preview" style={{ flexShrink: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 4, paddingVertical: 4 }}>
          <Icon size={17} color={colors.primary} />
          <Text style={[styles.label, { flex: 1 }]}>{mode.label}</Text>
          <MapTooltipClose label={`Close ${mode.label} preview`} onClose={close} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 10 }}>
        <Text accessibilityRole="header" style={styles.h2}>{thread.title}</Text>
        {!!point.planningPlace && <Txt muted>{point.planningPlace}</Txt>}
        {point.title !== thread.title && point.title !== point.planningPlace && thread.kind !== "ping" && thread.kind !== "time" &&
          <Txt muted>Suggested option · {point.title}</Txt>}
        <Txt muted>{closed ? (thread.status === "resolved" ? "Decided" : "Responses closed")
          : !eligible && thread.kind !== "draw" ? "You can view this item"
          : Number.isFinite(deadline.getTime()) ? `Closes ${deadline.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Open"}</Txt>
        {thread.kind === "ping" && <PlanningResponseControls threadId={thread.id} expanded={false} compactPing showDeadline={false} />}
        {thread.kind === "time" && (
          <>
            {!expanded && slots.length > 2 &&
              <Button compact secondary title={`See all ${slots.length} times`} onPress={() => setExpanded(true)} />}
            <AvailabilityControls
              key={`${thread.slots_revision}:${data.planning_availability?.find((row) => row.thread_id === thread.id && row.user_id === userId)?.updated_at ?? ""}`}
              thread={thread}
              compact
              expanded
              onExpand={() => setExpanded(true)}
              previewLimit={expanded ? Infinity : 2}
              readOnly={!eligible}
              onDirtyChange={setDirty}
            />
          </>
        )}
        {thread.kind === "vote" &&
          <CouncilChoices threadId={thread.id} compact expanded={expanded} onExpand={() => setExpanded(true)} onDirtyChange={setDirty} mapPreview />}
        {thread.kind === "draw" && (
          <>
            {winner && <Text style={styles.label}>Selected · {winner.payload.title}</Text>}
            {(expanded ? drawEntries : drawEntries.slice(0, 3)).map((option) => (
              <View key={option.id} style={{ minHeight: 44, justifyContent: "center", borderBottomWidth: 1, borderColor: colors.line }}>
                <Txt>{option.payload.title}</Txt>
              </View>
            ))}
            {!expanded && drawEntries.length > 3 &&
              <Button compact secondary title={`See all ${drawEntries.length} entries`} onPress={() => setExpanded(true)} />}
            {!closed && <Txt muted>No response needed. The organizer runs the draw.</Txt>}
          </>
        )}
        </ScrollView>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: 8, gap: 6 }}>
          {pending ? (
            <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
              <Txt>Leave without saving your responses?</Txt>
              <Button compact secondary title="Keep editing" onPress={() => setPending(null)} />
              <Button compact title="Discard and leave" onPress={() => pending === "open" ? onOpen(thread.id) : onClose()} />
            </View>
          ) : (
            <Button compact secondary title={`Open ${mode.label}`} onPress={() => leave("open")} />
          )}
        </View>
      </View>
    </MapCallout>
  );
}
