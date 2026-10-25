import {
  PlanningChoiceRow,
  PlanningDisclosure,
  PlanningLink,
  PlanningToggle,
} from "./PlanningControls";
import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import {
  planningDraftObject,
  startCreationDraft,
  setCreationDraftField,
  saveCreationDraft,
  completePlanningDraft,
} from "@/src/features/beacons/socialPlanningSession";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import {
  Action,
  Chips,
  AudiencePicker,
  Button,
  Field,
  Screen,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { useConfirmation } from "@/src/shared/Dialogs";
import type {
  AvailabilityChoice,
  BeaconDraft,
  PlanningSlot,
  PlanningThread,
} from "./types";
import {
  canManagePlanningThread,
  canReadPlanningThread,
  makeBeaconDraft,
  validateBeaconDraft,
} from "./domain";
import {
  activeSlots,
  availabilitySummary,
  connectedPlanningEnabled,
  noneAvailability,
  slotLabel,
  suggestedSlots,
  validateSlots,
} from "./connected";
import ZonedTimeField from "./ZonedTimeField";
import {
  publishPlanningSession,
  type PlanningCreationSession,
} from "./creationSession";
import {
  composerSession,
  storeComposerSession,
  completeComposerSession,
} from "./composerSession";
import { submitPlanning } from "./submission";

export function SlotFields({
  slots,
  onChange,
}: {
  slots: PlanningSlot[];
  onChange: (slots: PlanningSlot[]) => void;
}) {
  const { styles, colors } = useTheme();
  const [expanded, setExpanded] = useState<number | null>(null);
  function edit(
    slot: PlanningSlot,
    field: "starts_at" | "ends_at",
    value: string,
  ) {
    onChange(
      slots.map((s) =>
        s.id === slot.id ? { ...s, id: randomUUID(), [field]: value } : s,
      ),
    );
  }
  return (
    <View style={{ gap: 4 }}>
      <Text style={[styles.body, { fontWeight: "600" }]}>Proposed times</Text>
      {slots.map((slot, index) => (
        <View
          key={index}
          style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit time ${index + 1}`}
            accessibilityState={{ expanded: expanded === index }}
            onPress={() => setExpanded(expanded === index ? null : index)}
            style={{
              minHeight: 64,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Text style={[styles.muted, { width: 20 }]}>{index + 1}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.body, { fontSize: 14, fontWeight: "500" }]}>
                {slotLabel(slot)}
              </Text>
              <Text style={styles.muted}>{slot.timezone}</Text>
            </View>
            <Text style={{ color: colors.green, fontSize: 13 }}>
              {expanded === index ? "Done" : "Edit"}
            </Text>
          </Pressable>
          {expanded === index && (
            <View style={{ gap: 8, paddingBottom: 10 }}>
              <ZonedTimeField
                label={`Option ${index + 1} start`}
                timezone={slot.timezone}
                value={slot.starts_at}
                onChange={(v) => edit(slot, "starts_at", v)}
              />
              <ZonedTimeField
                label={`Option ${index + 1} end`}
                timezone={slot.timezone}
                value={slot.ends_at}
                onChange={(v) => edit(slot, "ends_at", v)}
              />
              {slots.length > 2 && (
                <PlanningLink
                  title={`Remove time ${index + 1}`}
                  onPress={() => {
                    onChange(slots.filter((s) => s.id !== slot.id));
                    setExpanded(null);
                  }}
                />
              )}
            </View>
          )}
        </View>
      ))}
      {slots.length < 10 && (
        <PlanningLink
          title="Add proposed time"
          onPress={() => {
            const last = slots[slots.length - 1];
            onChange([
              ...slots,
              {
                ...last,
                id: randomUUID(),
                starts_at: new Date(
                  Date.parse(last.starts_at) + 86400000,
                ).toISOString(),
                ends_at: new Date(
                  Date.parse(last.ends_at) + 86400000,
                ).toISOString(),
              },
            ]);
            setExpanded(slots.length);
          }}
        />
      )}
    </View>
  );
}

export function TimeFinderComposer({ sessionId }: { sessionId: string }) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const params = useLocalSearchParams<{
    sourceThreadId?: string;
    recoveryId?: string;
    activityNoteId?: string;
    squadId?: string;
    beaconDraftToken?: string;
    timezone?: string;
  }>();
  const source = data.planning_threads.find(
    (t) =>
      t.id === params.sourceThreadId &&
      t.owner_id === userId &&
      canReadPlanningThread(data, t, userId),
  );
  const remoteRecovery = (data.planning_recovery ?? []).find(
    (r) => r.thread_id === params.recoveryId && r.owner_id === userId,
  )?.context;
  const [recovery] = useState(() =>
    params.beaconDraftToken && userId
      ? {
          ...makeBeaconDraft(),
          timezone:
            params.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          latitude:
            planningDraftObject<{ latitude: number; longitude: number } | null>(
              userId,
              params.beaconDraftToken,
              "pin",
              () => null,
            )?.latitude ?? null,
          longitude:
            planningDraftObject<{ latitude: number; longitude: number } | null>(
              userId,
              params.beaconDraftToken,
              "pin",
              () => null,
            )?.longitude ?? null,
          online_url:
            planningDraftObject(
              userId,
              params.beaconDraftToken,
              "placeType",
              () => "In person",
            ) === "Online"
              ? planningDraftObject(
                  userId,
                  params.beaconDraftToken,
                  "url",
                  () => "",
                ) || null
              : null,
          approval_required:
            planningDraftObject(
              userId,
              params.beaconDraftToken,
              "approval",
              () => "Open joining",
            ) === "Host approval",
          ends_at: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "ends",
            () => makeBeaconDraft().ends_at,
          ),
          title: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "title",
            () => "",
          ),
          description: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "description",
            () => "",
          ),
          category: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "category",
            () => "Social" as const,
          ),
          audience: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "audience",
            () => "friends" as const,
          ),
          audience_id: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "audienceId",
            () => null,
          ),
          label: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "label",
            () => "",
          ),
          starts_at: planningDraftObject(
            userId,
            params.beaconDraftToken,
            "starts",
            () => new Date(Date.now() + 172800000).toISOString(),
          ),
        }
      : remoteRecovery,
  );
  const note = data.activities.find(
    (a) =>
      a.id === params.activityNoteId &&
      a.owner_id === userId &&
      a.mode === "solo",
  );
  const [draft, setDraft] = useState(() => {
    const restored = structuredClone(
      composerSession(userId ?? "", sessionId, () => ({
        title:
          source?.payload?.title ??
          source?.title ??
          recovery?.title ??
          note?.title ??
          "",
        body:
          source?.payload?.description ??
          source?.body ??
          recovery?.description ??
          "",
        audience:
          source?.audience ??
          recovery?.audience ??
          (params.squadId ? "squad" : "friends"),
        audienceId:
          source?.audience_id ??
          recovery?.audience_id ??
          params.squadId ??
          null,
        allowBackupHosting: source?.allow_backup_hosting,
        startsAt: new Date(Date.now() + 172800000).toISOString(),
        deadline: new Date(Date.now() + 86400000).toISOString(),
        minutes: "60",
        place: source?.payload?.label ?? recovery?.label ?? "",
        category:
          source?.payload?.category ??
          recovery?.category ??
          note?.category ??
          "Social",
        options: [],
        touched: [],
        publication: {},
        timeSlots: suggestedSlots(
          Date.now(),
          randomUUID,
          source?.payload ?? recovery,
        ),
      })),
    );
    if (!restored.timeSlots)
      restored.timeSlots = suggestedSlots(
        Date.now(),
        randomUUID,
        source?.payload ?? recovery,
      );
    return restored;
  });
  const frozen = !!draft.publication.attempt;
  const update = (value: Partial<typeof draft>) => {
    if (frozen) return;
    const next = { ...draft, ...value };
    storeComposerSession(userId ?? "", sessionId, next);
    setDraft(next);
  };
  const [publication, setPublication] = useState<PlanningCreationSession>(
    draft.publication,
  );
  const [recoveryToken] = useState(
    () => draft.recoveryToken ?? startCreationDraft(userId),
  );
  const existing = data.planning_threads.find(
    (t) => t.id === sessionId && t.kind === "time" && t.owner_id === userId,
  );
  if (existing)
    return (
      <Screen title="Find a Time" eyebrow="">
        <Txt>This Time Finder has already been created.</Txt>
        <PlanningLink
          title="View Find a Time"
          onPress={() =>
            router.replace({
              pathname: "/responses",
              params: { threadId: existing.id },
            })
          }
        />
      </Screen>
    );
  if (!connectedPlanningEnabled(data))
    return (
      <Screen title="Find a Time" eyebrow="">
        <Txt>This server needs the Connected Planning update.</Txt>
      </Screen>
    );
  return (
    <Screen title="Find a Time" eyebrow="">
      <Txt muted>Choose times together. Availability is not Going.</Txt>
      <View pointerEvents={frozen ? "none" : "auto"} style={{ gap: 12 }}>
        <Field
          label="Activity title"
          value={draft.title}
          maxLength={120}
          onChangeText={(title) => update({ title })}
        />
        <SlotFields
          slots={draft.timeSlots ?? []}
          onChange={(timeSlots) => update({ timeSlots })}
        />
        <AudiencePicker
          value={draft.audience}
          id={draft.audienceId}
          onChange={(audience, audienceId) => {
            if (!source) update({ audience, audienceId });
          }}
        />
        <ZonedTimeField
          timezone={
            draft.timeSlots?.[0]?.timezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone
          }
          label="Response deadline"
          value={draft.deadline}
          onChange={(deadline) => update({ deadline })}
        />
        <PlanningDisclosure
          title="Activity details"
          summary="Description, category and place · Optional"
        >
          <Field
            label="Description · Optional"
            value={draft.body}
            maxLength={2000}
            onChangeText={(body) => update({ body })}
          />
          <Chips
            options={
              [
                "Fitness",
                "Study",
                "Gaming",
                "Creative",
                "Social",
                "Other",
              ] as const
            }
            value={draft.category}
            onChange={(category) => update({ category })}
          />
          <Field
            label="Place · Optional"
            value={draft.place}
            maxLength={160}
            onChangeText={(place) => update({ place })}
          />
        </PlanningDisclosure>
        <PlanningDisclosure
          title="Organizer options"
          summary={`Backup hosting ${(draft.allowBackupHosting ?? draft.audience === "squad") ? "on" : "off"}`}
        >
          <PlanningToggle
            title="Allow Backup Hosting"
            description="Eligible participants may volunteer if the organizer is unavailable."
            value={draft.allowBackupHosting ?? draft.audience === "squad"}
            disabled={frozen}
            onChange={(allowBackupHosting) => update({ allowBackupHosting })}
          />
        </PlanningDisclosure>
      </View>
      <Action
        title={frozen ? "Verify creation" : "Create Find a Time"}
        run={async () => {
          if (!userId || data.viewer_id !== userId)
            throw new Error("Sign in to continue.");
          if (
            !publication.attempt &&
            (!draft.title.trim() || draft.title.trim().length > 120)
          )
            throw new Error(
              "Give this activity a title (up to 120 characters).",
            );
          if (!publication.attempt)
            validateSlots(draft.timeSlots ?? [], draft.deadline);
          if (params.sourceThreadId && !source)
            throw new Error("The source is no longer available.");
          const payload: BeaconDraft = {
            ...makeBeaconDraft(),
            ...source?.payload,
            ...recovery,
            title: draft.title,
            description: draft.body,
            category: draft.category,
            label: draft.place,
            latitude:
              draft.place === (source?.payload?.label ?? recovery?.label ?? "")
                ? (source?.payload?.latitude ?? recovery?.latitude ?? null)
                : null,
            longitude:
              draft.place === (source?.payload?.label ?? recovery?.label ?? "")
                ? (source?.payload?.longitude ?? recovery?.longitude ?? null)
                : null,
            audience: draft.audience,
            audience_id: draft.audienceId,
            starts_at:
              draft.timeSlots?.[0].starts_at ?? makeBeaconDraft().starts_at,
            ends_at: draft.timeSlots?.[0].ends_at ?? makeBeaconDraft().ends_at,
            timezone:
              draft.timeSlots?.[0].timezone ?? makeBeaconDraft().timezone,
          };
          if (!publication.attempt) validateBeaconDraft(payload);
          const epoch = getViewerEpoch();
          const attempt = publication;
          const operation = publishPlanningSession(
            attempt,
            {
              id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(sessionId)
                ? sessionId
                : randomUUID(),
              kind: "time",
              title: draft.title,
              body: draft.body.slice(0, 500),
              audience: draft.audience,
              audience_id: draft.audienceId,
              deadline_at: draft.deadline,
              payload,
              slots: draft.timeSlots,
              source_thread_id: source?.id,
              source_activity_note_id: note?.id,
              allow_backup_hosting:
                draft.allowBackupHosting ?? draft.audience === "squad",
              recovery_context: payload,
              local_draft_token: params.beaconDraftToken,
            },
            [],
            async (a, p, id) => {
              const frozenPayload = { ...p, expected_actor_id: userId };
              setCreationDraftField(
                userId,
                recoveryToken,
                "title",
                `Find a Time: ${draft.title}`,
              );
              setCreationDraftField(
                userId,
                recoveryToken,
                "pendingPublication",
                {
                  action: a,
                  payload: frozenPayload,
                  requestId: id,
                  viewer: userId,
                },
              );
              await saveCreationDraft(userId, recoveryToken, {
                planningRecovery: "time",
              });
              if (epoch !== getViewerEpoch())
                throw new Error("Your account changed.");
              return act(a, frozenPayload, id);
            },
            randomUUID,
          );
          update({ publication: attempt, recoveryToken });
          setPublication({ ...attempt });
          try {
            const id = await operation;
            if (epoch === getViewerEpoch()) {
              completePlanningDraft(userId, recoveryToken);
              completeComposerSession(userId, sessionId);
              router.replace({
                pathname: "/responses",
                params: { threadId: id },
              });
            }
          } catch (failure) {
            if (
              epoch === getViewerEpoch() &&
              (failure as { definitive?: boolean }).definitive &&
              !attempt.threadId
            ) {
              const restored = { ...draft, publication: {}, recoveryToken };
              storeComposerSession(userId, sessionId, restored);
              setDraft(restored);
              setPublication({});
              setCreationDraftField(
                userId,
                recoveryToken,
                "pendingPublication",
                null,
              );
              await saveCreationDraft(userId, recoveryToken, {
                planningRecovery: "time",
              });
            }
            throw failure;
          }
        }}
      />
    </Screen>
  );
}

export function AvailabilityControls({
  thread,
  expanded,
  onExpand,
  onBeforeRespond,
}: {
  onBeforeRespond?: () => void;
  thread: PlanningThread;
  expanded: boolean;
  onExpand: () => void;
}) {
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const now = useNow();
  const { styles, colors } = useTheme();
  const saved = (data.planning_availability ?? []).find(
    (a) => a.thread_id === thread.id && a.user_id === userId,
  );
  const slots = activeSlots(data, thread.id);
  const summary = availabilitySummary(data, thread, userId ?? "", now);
  const [answers, setAnswers] = useState<Record<string, AvailabilityChoice>>(
    () =>
      Object.fromEntries(
        Object.entries(saved?.answers ?? {}).filter(([id]) =>
          slots.some((s) => s.id === id),
        ),
      ),
  );
  const [none, setNone] = useState(saved?.none_work ?? false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const closed =
    thread.status !== "open" ||
    Date.parse(thread.deadline_at) <= now ||
    !!thread.finalized_at;
  if (!expanded)
    return (
      <View style={{ gap: 4 }}>
        <Txt muted>
          {saved ? "Availability saved" : "Choose your available times"}
        </Txt>
        {slots.slice(0, 2).map((s) => (
          <Txt key={s.id} muted>
            {slotLabel(s)}
          </Txt>
        ))}
        <PlanningLink
          title={saved ? "Edit availability" : "Choose Times"}
          onPress={onExpand}
        />
      </View>
    );
  const dirty =
    !saved ||
    slots.some((s) => answers[s.id] !== saved.answers[s.id]) ||
    none !== saved.none_work;
  return (
    <View style={{ gap: 14 }}>
      {summary.slots.map((s) => (
        <View key={s.id} style={{ gap: 6 }}>
          <Text style={[styles.body, { fontSize: 14, fontWeight: "600" }]}>
            {slotLabel(s)}
          </Text>
          <Text style={styles.muted}>
            {s.yes} Yes · {s.maybe} Maybe · {s.no} No
            {summary.recommended.includes(s.id) ? " · Recommended" : ""}
          </Text>
          {closed ? (
            <Text style={styles.muted}>
              Your answer: {saved?.answers[s.id] ?? "Unanswered"}
            </Text>
          ) : (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={`Availability for ${slotLabel(s)}`}
              style={{
                flexDirection: "row",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.line,
                overflow: "hidden",
              }}
            >
              {(["yes", "maybe", "no"] as const).map((v, index) => (
                <Pressable
                  key={v}
                  accessibilityRole="radio"
                  accessibilityLabel={v[0].toUpperCase() + v.slice(1)}
                  accessibilityState={{
                    checked: answers[s.id] === v,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => {
                    setNone(false);
                    setStatus("");
                    setAnswers({ ...answers, [s.id]: v });
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      answers[s.id] === v ? colors.green : "transparent",
                    borderLeftWidth: index ? 1 : 0,
                    borderLeftColor: colors.line,
                  }}
                >
                  <Text
                    style={[
                      styles.body,
                      {
                        fontSize: 14,
                        fontWeight: answers[s.id] === v ? "700" : "400",
                        color:
                          answers[s.id] === v ? colors.surface : colors.ink,
                      },
                    ]}
                  >
                    {v[0].toUpperCase() + v.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}
      {!closed && (
        <>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="None of these work"
            accessibilityState={{ checked: none, disabled: busy }}
            disabled={busy}
            onPress={() => {
              setAnswers(noneAvailability(slots));
              setNone(true);
              setStatus("");
            }}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
            }}
          >
            <Text
              style={{
                color: none ? colors.green : colors.muted,
                fontSize: 20,
              }}
            >
              {none ? "☑" : "□"}
            </Text>
            <Text style={[styles.body, { fontSize: 14 }]}>
              None of these work
            </Text>
          </Pressable>
          <Action
            title={saved ? "Update Availability" : "Save Availability"}
            disabled={!dirty || (!Object.keys(answers).length && !none)}
            run={async () => {
              const epoch = getViewerEpoch();
              onBeforeRespond?.();
              setBusy(true);
              try {
                await submitPlanning(userId, thread.id, () =>
                  act("save_planning_availability", {
                    thread_id: thread.id,
                    slots_revision: thread.slots_revision ?? 1,
                    answers,
                    none_work: none,
                    expected_actor_id: userId,
                  }),
                );
                if (epoch === getViewerEpoch()) setStatus("Availability saved");
              } finally {
                if (epoch === getViewerEpoch()) setBusy(false);
              }
            }}
          />
        </>
      )}
      <Text accessibilityLiveRegion="polite" style={styles.muted}>
        {status ||
          (saved ? "Saved · " : "") +
            `${summary.respondents} people answered. Unanswered is not No.`}
      </Text>
    </View>
  );
}

export function TimeFinalization({
  thread,
  onBeforeAction,
}: {
  thread: PlanningThread;
  onBeforeAction?: () => void;
}) {
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [selected, setSelected] = useState("");
  const summary = availabilitySummary(data, thread, userId ?? "", now);
  if (
    !userId ||
    !canManagePlanningThread(thread, userId) ||
    thread.status !== "open"
  )
    return null;
  const choice = summary.slots.find(
    (s) => s.id === selected && Date.parse(s.starts_at) > now,
  );
  const allowed =
    Date.parse(thread.deadline_at) <= now || summary.respondents > 0;
  return (
    <PlanningDisclosure
      title="Select final time"
      summary={
        summary.respondents
          ? `${summary.respondents} answered · Organizer decision`
          : "Collect responses, or choose after the deadline"
      }
    >
      <View accessibilityRole="radiogroup" accessibilityLabel="Final time">
        {summary.slots
          .filter((s) => Date.parse(s.starts_at) > now)
          .map((s) => (
            <PlanningChoiceRow
              key={s.id}
              title={slotLabel(s)}
              description={`${summary.recommended.includes(s.id) ? "Recommended · " : ""}${s.yes} Yes · ${s.maybe} Maybe · ${s.no} No`}
              selected={selected === s.id}
              onSelect={() => setSelected(s.id)}
            />
          ))}
      </View>
      <Button
        title="Confirm time"
        disabled={!allowed || !choice}
        onPress={() => {
          if (!choice) return;
          requestConfirmation({
            title: "Confirm selected time?",
            message: `${slotLabel(choice)}. ${choice.yes} Yes · ${choice.maybe} Maybe · ${choice.no} No. ${!summary.respondents ? "Nobody has answered. " : ""}${Date.parse(thread.deadline_at) > now ? "Responses will close early; some people may not have answered. " : ""}${!summary.recommended.includes(choice.id) ? "This is not a best-supported time. " : ""}This selects a time; it does not publish a Beacon or RSVP anyone.`,
            confirmLabel: "Use this time",
            onConfirm: () => {
              onBeforeAction?.();
              return act("finalize_planning_time", {
                thread_id: thread.id,
                slot_id: choice.id,
                slots_revision: thread.slots_revision ?? 1,
                confirmed: true,
                expected_actor_id: userId,
              });
            },
          });
        }}
      />
      {confirmationDialog}
    </PlanningDisclosure>
  );
}

export function AmendTimeSlots({ thread }: { thread: PlanningThread }) {
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const [slots, setSlots] = useState(() => activeSlots(data, thread.id));
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  if (
    !userId ||
    !canManagePlanningThread(thread, userId) ||
    thread.status !== "open" ||
    Date.parse(thread.deadline_at) <= now
  )
    return null;
  return (
    <View style={{ gap: 8 }}>
      <PlanningLink
        title="Edit proposed times"
        onPress={() => {
          setSlots(activeSlots(data, thread.id));
          setEditing(!editing);
        }}
      />
      {editing && (
        <>
          <SlotFields slots={slots} onChange={setSlots} />
          <Button
            title="Review time changes"
            onPress={() =>
              requestConfirmation({
                title: "Update proposed times?",
                message:
                  "Changed times become new options. Earlier availability stays in history and will not count for the changed times.",
                onConfirm: async () => {
                  validateSlots(slots, thread.deadline_at);
                  await act("amend_planning_slots", {
                    thread_id: thread.id,
                    slots_revision: thread.slots_revision ?? 1,
                    slots,
                    expected_actor_id: userId,
                  });
                  setEditing(false);
                },
              })
            }
          />
        </>
      )}
      {confirmationDialog}
    </View>
  );
}

export function EarlierTimeSlots({ thread }: { thread: PlanningThread }) {
  const { data, userId } = useBeacon();
  const { styles } = useTheme();
  if (
    !userId ||
    data.viewer_id !== userId ||
    !canReadPlanningThread(data, thread, userId)
  )
    return null;
  const retired = (data.planning_slots ?? []).filter(
    (s) => s.thread_id === thread.id && s.retired_at,
  );
  if (!retired.length) return null;
  return (
    <PlanningDisclosure
      title="Earlier proposed times"
      summary={`${retired.length} replaced`}
    >
      {retired.map((s) => (
        <View key={s.id} style={{ paddingVertical: 6, gap: 3 }}>
          <Text style={styles.body}>{slotLabel(s)}</Text>
          <Text style={styles.muted}>
            Replaced · Earlier availability was not carried over
          </Text>
        </View>
      ))}
    </PlanningDisclosure>
  );
}
