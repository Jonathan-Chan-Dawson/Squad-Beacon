import {
  ChevronRight,
  Clock3,
  MessageSquare,
  CheckCircle2,
} from "lucide-react-native";
import { BeaconIcon } from "@/src/features/beacons/components/BeaconIcon";
import {
  PlanningChoiceRow,
  PlanningDisclosure,
  PlanningLink,
  PlanningToggle,
} from "./PlanningControls";
import React, { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, Button, Field, Txt, useTheme } from "@/src/shared/ui";
import { useConfirmation } from "@/src/shared/Dialogs";
import { beaconParticipation } from "@/src/features/beacons/participation";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import type { PlanningThread } from "./types";
import { canManagePlanningThread, canReadPlanningThread } from "./domain";
import {
  availabilitySummary,
  backupAvailableAt,
  connectedPlanningEnabled,
  slotLabel,
} from "./connected";
import { findTimeRoute, openPlanningReview } from "./handoff";
import {
  AmendTimeSlots,
  EarlierTimeSlots,
  TimeFinalization,
} from "./TimeFinder";
import { planningInteraction } from "./planningInteraction";

export function LinkedPlanningBeacon({
  thread,
  reviewConflict = false,
}: {
  thread: PlanningThread;
  reviewConflict?: boolean;
}) {
  const { data, userId } = useBeacon();
  const now = useNow();
  const { styles, colors } = useTheme();
  if (!thread.materialized_activity_id) return null;
  const activity = data.activities.find(
    (a) => a.id === thread.materialized_activity_id,
  );
  if (!activity || !userId || !canReadBeaconActivity(data, activity, userId))
    return (
      <Txt muted>
        {reviewConflict
          ? "This plan already became a Beacon while you were reviewing. Its details are not shared with you."
          : "This plan became a Beacon. Its details are not shared with you."}
      </Txt>
    );
  const state = beaconParticipation(data, userId, activity.id, now);
  const role = data.beacon_roles.find(
    (r) => r.activity_id === activity.id && r.user_id === userId,
  );
  const label =
    activity.status === "cancelled"
      ? "Beacon cancelled"
      : state?.ended
        ? "Beacon ended"
        : state?.hosting
          ? "Host"
          : state?.going
            ? role
              ? "Organizer · Going"
              : "Going ✓"
            : state?.pending
              ? "Request Pending"
              : state?.response === "invited" || state?.invited
                ? "Invited"
                : state?.allowed.includes("join")
                  ? "Eligible to Join"
                  : "View activity";
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.muted}>
        {reviewConflict
          ? "This plan already became a Beacon while you were reviewing."
          : "This became a Beacon"}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View Beacon"
        accessibilityHint={`${activity.title}. ${label}. Opens the full Beacon.`}
        onPress={() =>
          router.push({
            pathname: "/activity/[id]",
            params: { id: activity.id },
          })
        }
        style={{
          minHeight: 64,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingVertical: 8,
        }}
      >
        <BeaconIcon category={activity.category} size={36} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.body, { fontWeight: "700" }]}>
            {activity.title}
          </Text>
          {thread.kind === "vote" && thread.result_summary && (
            <Text style={styles.muted}>
              {thread.result_summary.support}{" "}
              {thread.vote_method === "approval" ? "approvals" : "votes"}
              {thread.result_summary.tie_count > 1
                ? " · Selected from a tie"
                : ""}
            </Text>
          )}
          <Text style={styles.muted}>
            {new Date(activity.starts_at).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {label}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Text style={{ fontSize: 13, color: colors.green }}>View Beacon</Text>
          <ChevronRight size={16} color={colors.green} />
        </View>
      </Pressable>
    </View>
  );
}

function OriginPlanningLink({ thread }: { thread: PlanningThread }) {
  const { data, userId } = useBeacon();
  if (!userId) return null;
  const source = data.planning_threads.find(
    (t) =>
      t.id === thread.source_thread_id &&
      canReadPlanningThread(data, t, userId),
  );
  if (source)
    return (
      <PlanningLink
        title={`From ${source.kind === "time" ? "Find a Time" : source.kind}: ${source.title}`}
        onPress={() =>
          router.push({
            pathname: "/responses",
            params: { threadId: source.id },
          })
        }
      />
    );
  const note = data.activities.find(
    (a) =>
      a.id === thread.source_activity_note_id &&
      canReadBeaconActivity(data, a, userId),
  );
  return note ? (
    <PlanningLink
      title={`From Activity Note: ${note.title}`}
      onPress={() =>
        router.push({ pathname: "/activity/[id]", params: { id: note.id } })
      }
    />
  ) : null;
}

export function ConnectedPlanningActions({
  thread,
  onBeforeAction,
}: {
  thread: PlanningThread;
  onBeforeAction?: () => void;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useNow();
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [selected, setSelected] = useState("");
  const [claimToken, setClaimToken] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState("");
  const { styles, colors } = useTheme();
  if (!userId) return null;
  if (thread.materialized_activity_id)
    return (
      <View style={{ gap: 8 }}>
        <OriginPlanningLink thread={thread} />
        <LinkedPlanningBeacon thread={thread} />
        {connectedPlanningEnabled(data) && (
          <PlanningReplacement thread={thread} />
        )}
      </View>
    );
  if (!connectedPlanningEnabled(data)) return null;
  if (thread.continuation_closed_at || thread.not_organized_at)
    return (
      <Txt muted>
        {thread.not_organized_at ? "Not Organized" : "Closed without a Beacon"}
      </Txt>
    );
  const manages = canManagePlanningThread(thread, userId);
  const owner = thread.owner_id === userId;
  const state = planningInteraction(data, userId, thread.id, now);
  const options = state?.options ?? [];
  const ballots = (data.planning_approval_ballots ?? []).filter(
    (b) =>
      b.thread_id === thread.id &&
      canReadPlanningThread(data, thread, b.user_id),
  );
  const count = (id: string) =>
    data.planning_option_counts?.find(
      (c) => c.thread_id === thread.id && c.proposal_id === id,
    )?.total ??
    (thread.vote_method === "approval"
      ? ballots.filter(
          (b) =>
            b.proposal_ids.includes(id) &&
            !data.blocks.some((x) => {
              const author = options.find((p) => p.id === id)?.author_id;
              return (
                (x.blocker_id === b.user_id && x.blocked_id === author) ||
                (x.blocked_id === b.user_id && x.blocker_id === author)
              );
            }),
        ).length
      : (state?.votes.filter((v) => v.proposal_id === id).length ?? 0));
  const maximum = Math.max(0, ...options.map((p) => count(p.id)));
  const leaders = options.filter((p) => count(p.id) === maximum);
  const summary = availabilitySummary(data, thread, userId, now);
  const starts =
    thread.kind === "ping"
      ? [thread.payload?.starts_at ?? ""]
      : thread.kind === "time"
        ? summary.slots
            .filter(
              (s) =>
                !thread.selected_slot_id || s.id === thread.selected_slot_id,
            )
            .map((s) => s.starts_at)
        : options
            .filter(
              (p) =>
                !thread.reserved_draw_id || p.id === thread.reserved_draw_id,
            )
            .map((p) => p.payload.starts_at);
  const start = Math.min(...starts.map(Date.parse).filter((t) => t > now));
  const due = Date.parse(thread.deadline_at) <= now;
  const canBackup =
    thread.allow_backup_hosting &&
    due &&
    Number.isFinite(start) &&
    now >=
      backupAvailableAt(thread.deadline_at, new Date(start).toISOString()) &&
    !owner;
  const existingClaim = (data.planning_claims ?? []).find(
    (c) =>
      c.thread_id === thread.id &&
      c.user_id === userId &&
      Date.parse(c.expires_at) > now,
  );
  const token =
    existingClaim && (!claimToken || claimToken === existingClaim.token)
      ? existingClaim.token
      : undefined;
  const child = data.planning_threads.find(
    (t) =>
      t.source_thread_id === thread.id &&
      canReadPlanningThread(data, t, userId),
  );
  async function resolve(proposalId?: string) {
    onBeforeAction?.();
    await act("resolve_planning_thread", {
      thread_id: thread.id,
      proposal_id: proposalId,
      confirmed: true,
      expected_actor_id: userId,
    });
  }
  const chooseCouncil = due && (manages || !!token) && thread.kind === "vote";
  const selectedLeader =
    leaders.find((p) => p.id === selected) ??
    (leaders.length === 1 && maximum > 0 ? leaders[0] : undefined);
  return (
    <View style={{ gap: 8 }}>
      <OriginPlanningLink thread={thread} />
      {thread.kind === "time" && (
        <>
          {!token && (
            <TimeFinalization thread={thread} onBeforeAction={onBeforeAction} />
          )}

          <EarlierTimeSlots thread={thread} />
          {thread.selected_slot_id && (
            <View
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
            >
              <CheckCircle2 size={18} color={colors.green} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={[styles.body, { fontWeight: "600", fontSize: 14 }]}
                >
                  {summary.slots.find((s) => s.id === thread.selected_slot_id)
                    ? slotLabel(
                        summary.slots.find(
                          (s) => s.id === thread.selected_slot_id,
                        )!,
                      )
                    : "Time selected"}
                </Text>
                <Text style={styles.muted}>
                  Selected time · Beacon not published yet
                </Text>
              </View>
            </View>
          )}
        </>
      )}
      {chooseCouncil && (
        <>
          <Txt>
            {maximum
              ? "Choose the winning activity"
              : thread.vote_method === "approval"
                ? "No options received approval."
                : "No options received votes."}
          </Txt>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Winning activity"
          >
            {leaders.map((p) => (
              <PlanningChoiceRow
                key={p.id}
                title={p.payload.title}
                description={
                  maximum
                    ? `${count(p.id)} ${thread.vote_method === "approval" ? "approvals" : "votes"}`
                    : "Zero support"
                }
                selected={selected === p.id}
                onSelect={() => setSelected(p.id)}
                icon={<BeaconIcon category={p.payload.category} size={30} />}
              />
            ))}
          </View>
          {manages && !token && (
            <Button
              title="Confirm & Create Beacon"
              disabled={!selectedLeader}
              onPress={() => {
                const id = selectedLeader?.id;
                if (!id) return;
                requestConfirmation({
                  title: "Publish selected activity?",
                  message: maximum
                    ? "Create the Beacon from this eligible option. Voting does not RSVP participants."
                    : "This option received zero votes or approvals. Publish it anyway?",
                  confirmLabel: "Create Beacon",
                  onConfirm: () => resolve(id),
                });
              }}
            />
          )}
        </>
      )}
      {manages &&
        !token &&
        due &&
        thread.kind === "draw" &&
        options.length > 0 && (
          <Button
            title="Draw an activity"
            onPress={() =>
              requestConfirmation({
                title: "Run Draw & Create Beacon?",
                message:
                  "The server selects an eligible activity at random and creates its Beacon.",
                onConfirm: () => resolve(),
              })
            }
          />
        )}
      {owner && thread.kind === "ping" && thread.status === "open" && (
        <Button
          title="Review & Create Beacon"
          onPress={() => openPlanningReview(data, userId, thread)}
        />
      )}
      {owner && thread.kind === "time" && thread.selected_slot_id && (
        <Button
          title="Review & Create Beacon"
          onPress={() => openPlanningReview(data, userId, thread)}
        />
      )}
      {owner && thread.kind === "ping" && !child && (
        <PlanningLink
          title="Find a Time"
          onPress={() => router.push(findTimeRoute(thread.id))}
        />
      )}
      {child && (
        <PlanningLink
          title="Scheduling now · View Find a Time"
          onPress={() =>
            router.push({
              pathname: "/responses",
              params: { threadId: child.id },
            })
          }
        />
      )}
      {due && !manages && !token && !canBackup && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Clock3 size={16} color={colors.muted} />
          <Text style={styles.muted}>Waiting for Organizer</Text>
        </View>
      )}
      {canBackup && !token && (
        <Button
          compact
          title="I Can Host"
          onPress={() =>
            requestConfirmation({
              title: "Host this plan?",
              message:
                "You will review this plan and publish as yourself. Your claim lasts 10 minutes; nobody is automatically Going.",
              confirmLabel: "I can host",
              onConfirm: async () => {
                const epoch = getViewerEpoch();
                const result = await act("claim_planning_host", {
                  thread_id: thread.id,
                  expected_actor_id: userId,
                });
                if (epoch !== getViewerEpoch()) return;
                if (typeof result.claim_token === "string")
                  setClaimToken(result.claim_token);
              },
            })
          }
        />
      )}
      {token && (
        <>
          <Txt muted>
            You accepted hosting · Review and publish before your claim expires.
          </Txt>
          {thread.kind === "time" &&
            !thread.selected_slot_id &&
            summary.slots
              .filter((s) => Date.parse(s.starts_at) > now)
              .map((s) => (
                <PlanningChoiceRow
                  key={s.id}
                  title={slotLabel(s)}
                  description={`${s.yes} Yes · ${s.maybe} Maybe${summary.recommended.includes(s.id) ? " · Recommended" : ""}`}
                  selected={selected === s.id}
                  onSelect={() => setSelected(s.id)}
                />
              ))}
          <Button
            title="Review Beacon as Host"
            disabled={
              (thread.kind === "vote" && !selected) ||
              (thread.kind === "time" && !thread.selected_slot_id && !selected)
            }
            onPress={() =>
              requestConfirmation({
                title: "Review this plan as host?",
                message:
                  thread.kind === "time"
                    ? (() => {
                        const s = summary.slots.find(
                          (s) => s.id === (selected || thread.selected_slot_id),
                        );
                        return `${s ? slotLabel(s) : "Selected time"}. ${s?.yes ?? 0} Yes · ${s?.maybe ?? 0} Maybe · ${s?.no ?? 0} No. ${!summary.respondents ? "Nobody has answered. " : "Some participants may not have answered. "}${s && !summary.recommended.includes(s.id) ? "This is not a best-supported time. " : ""}You will host as yourself; availability does not become Going.`;
                      })()
                    : thread.kind === "vote" && !maximum
                      ? "This option received zero votes or approvals. Continue only if you intend to host it."
                      : "Review the selected activity and its audience. You will publish under your own identity.",
                confirmLabel: "Review Beacon",
                onConfirm: () =>
                  openPlanningReview(data, userId, thread, {
                    claimToken: token,
                    proposalId: thread.kind === "vote" ? selected : undefined,
                    slotId:
                      thread.kind === "time"
                        ? selected || thread.selected_slot_id || undefined
                        : undefined,
                  }),
              })
            }
          />
          <PlanningLink
            title="Release hosting claim"
            onPress={() => {
              void (async () => {
                await act("release_planning_host", {
                  thread_id: thread.id,
                  claim_token: token,
                });
                setClaimToken("");
              })().catch((e) => setBackupError((e as Error).message));
            }}
          />
        </>
      )}
      {manages && (
        <PlanningDisclosure
          title="Organizer options"
          summary={
            owner
              ? `Backup hosting ${thread.allow_backup_hosting ? "on" : "off"}`
              : undefined
          }
        >
          {thread.kind === "time" && <AmendTimeSlots thread={thread} />}
          {owner && (
            <PlanningToggle
              title="Allow Backup Hosting"
              description={
                backupBusy
                  ? "Saving…"
                  : "Eligible participants may volunteer after the grace period."
              }
              value={!!thread.allow_backup_hosting}
              disabled={backupBusy}
              onChange={(enabled) => {
                const epoch = getViewerEpoch();
                setBackupBusy(true);
                setBackupError("");
                void act("set_planning_backup", {
                  thread_id: thread.id,
                  enabled,
                  expected_actor_id: userId,
                })
                  .catch((e) => {
                    if (epoch === getViewerEpoch())
                      setBackupError((e as Error).message);
                  })
                  .finally(() => {
                    if (epoch === getViewerEpoch()) setBackupBusy(false);
                  });
              }}
            />
          )}
          {due && (
            <PlanningLink
              title="Close without a Beacon"
              onPress={() =>
                requestConfirmation({
                  title: "Close without a Beacon?",
                  message:
                    "Keep this decision in history without creating an activity.",
                  onConfirm: () => {
                    onBeforeAction?.();
                    return act("close_planning_without_beacon", {
                      thread_id: thread.id,
                      expected_actor_id: userId,
                    });
                  },
                })
              }
            />
          )}
        </PlanningDisclosure>
      )}
      {backupError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {backupError}
        </Text>
      )}
      {confirmationDialog}
    </View>
  );
}

function PlanningReplacement({ thread }: { thread: PlanningThread }) {
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState(false);
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  if (!userId || !["vote", "draw"].includes(thread.kind)) return null;
  const manages = canManagePlanningThread(thread, userId);
  const current = data.activities.find(
    (a) => a.id === thread.materialized_activity_id,
  );
  const previous = data.planning_proposals.find(
    (p) => p.id === thread.replaced_from_proposal_id,
  );
  const options =
    planningInteraction(data, userId, thread.id, now)?.options.filter(
      (p) => !p.activity_id,
    ) ?? [];
  const counts = (id: string) =>
    data.planning_option_counts?.find(
      (c) => c.thread_id === thread.id && c.proposal_id === id,
    )?.total ??
    (thread.vote_method === "approval"
      ? (data.planning_approval_ballots ?? []).filter(
          (b) =>
            b.thread_id === thread.id &&
            b.proposal_ids.includes(id) &&
            canReadPlanningThread(data, thread, b.user_id),
        ).length
      : data.planning_votes.filter(
          (v) =>
            v.thread_id === thread.id &&
            v.proposal_id === id &&
            canReadPlanningThread(data, thread, v.user_id),
        ).length);
  const maximum = Math.max(0, ...options.map((p) => counts(p.id)));
  const leaders = options.filter((p) => counts(p.id) === maximum);
  return (
    <View style={{ gap: 6 }}>
      {previous?.activity_id && (
        <>
          <Txt muted>Previous Beacon · Cancelled</Txt>
          <LinkedPlanningBeacon
            thread={{
              ...thread,
              materialized_activity_id: previous.activity_id,
            }}
          />
        </>
      )}
      {manages &&
        current?.status === "scheduled" &&
        Date.parse(current.starts_at) > now &&
        options.length > 0 && (
          <PlanningLink
            title="Replace with next option"
            onPress={() => setEditing(!editing)}
          />
        )}
      {editing && manages && (
        <>
          {thread.kind === "vote" &&
            leaders.map((p) => (
              <Button
                key={p.id}
                compact
                secondary={selected !== p.id}
                title={p.payload.title}
                onPress={() => setSelected(p.id)}
              />
            ))}
          <Button
            title="Review replacement"
            disabled={
              thread.kind === "vote" && !leaders.some((p) => p.id === selected)
            }
            onPress={() =>
              requestConfirmation({
                title: "Replace the selected Beacon?",
                message: `This cancels the current Beacon and creates a separate replacement. Existing RSVPs stay on the cancelled Beacon.${thread.kind === "vote" && !maximum ? " The replacement received zero support." : ""}`,
                confirmLabel: "Confirm replacement",
                destructive: true,
                onConfirm: () =>
                  act("replace_council_winner", {
                    thread_id: thread.id,
                    expected_winner_proposal_id: thread.winner_proposal_id,
                    proposal_id: selected || undefined,
                    confirm_cancel_previous: true,
                    expected_actor_id: userId,
                  }),
              })
            }
          />
        </>
      )}
      {confirmationDialog}
    </View>
  );
}

export function OrganizerMessageEditor({ thread }: { thread: PlanningThread }) {
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const saved = data.planning_organizer_messages?.find(
    (m) => m.thread_id === thread.id && m.user_id === userId,
  );
  const [message, setMessage] = useState(saved?.message ?? "");
  if (
    !connectedPlanningEnabled(data) ||
    !userId ||
    data.viewer_id !== userId ||
    !canReadPlanningThread(data, thread, userId)
  )
    return null;
  const manages = canManagePlanningThread(thread, userId);
  const replies = (data.planning_organizer_messages ?? []).filter(
    (m) => m.thread_id === thread.id && m.user_id !== userId,
  );
  return (
    <PlanningDisclosure
      title={
        thread.owner_id === userId
          ? "Private replies"
          : "Message to organizer (optional)"
      }
      summary={
        thread.owner_id === userId
          ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
          : saved
            ? "Your private message is saved"
            : undefined
      }
    >
      {thread.owner_id !== userId && (
        <>
          <Field
            label="Only you and authorized organizers can read this"
            value={message}
            maxLength={500}
            multiline
            onChangeText={setMessage}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.muted}>{message.length}/500</Text>
            <Action
              title={message.trim() ? "Save message" : "Delete message"}
              secondary
              disabled={message === (saved?.message ?? "")}
              run={() =>
                act("save_planning_organizer_message", {
                  thread_id: thread.id,
                  message,
                  expected_actor_id: userId,
                })
              }
            />
          </View>
        </>
      )}
      {manages &&
        replies.map((m) => (
          <View
            key={m.user_id}
            style={{
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              gap: 4,
            }}
          >
            <View
              style={{ flexDirection: "row", gap: 7, alignItems: "center" }}
            >
              <MessageSquare size={15} color={colors.muted} />
              <Text style={[styles.body, { fontWeight: "600", fontSize: 14 }]}>
                {data.profiles.find((p) => p.id === m.user_id)?.name ??
                  "Participant"}
              </Text>
            </View>
            <Text style={styles.body}>{m.message}</Text>
          </View>
        ))}
      {thread.owner_id === userId && !replies.length && (
        <Text style={styles.muted}>
          Private replies from participants will appear here.
        </Text>
      )}
    </PlanningDisclosure>
  );
}
