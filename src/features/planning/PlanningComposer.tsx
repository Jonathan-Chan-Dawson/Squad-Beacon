import { PlanningKindSelector } from "./PlanningKindSelector";
import {
  PlanningAudienceField,
  PlanningDateField,
} from "./PlanningCreationFields";
import { PlanningChoicesEditor } from "./PlanningChoicesEditor";
import { flexiblePlanningWindow, planningTimezone } from "./creationTiming";
import { Chip } from "@/src/shared/design-system";
import { interestTarget } from "./connected";
import { PlanningDisclosure, PlanningToggle } from "./PlanningControls";
import React, { useCallback, useRef, useState } from "react";
import { Text, View, type TextInput } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  Action,
  Button,
  Chips,
  Field,
  Screen,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import { useBeacon } from "@/src/shared/store";
import { activityNoteSeed } from "@/src/features/beacons/livingActivity";
import { eligibleDefaultTargets } from "@/src/features/profile/settings/beaconDefaults";
import {
  hasPlanningDraftField,
  setCreationDraftField,
  startCreationDraft,
} from "@/src/features/beacons/socialPlanningSession";
import {
  canReadPlanningThread,
  makeBeaconDraft,
  validateBeaconDraft,
  validatePlanningThreadDraft,
} from "./domain";
import { publishPlanningSession } from "./creationSession";
import {
  applyPingStarter,
  composerSession,
  composerMapCoordinate,
  composerTiming,
  storeComposerSession,
  completeComposerSession,
  pingStarters,
  type ComposerDraft,
} from "./composerSession";
import type { BeaconDraft, PlanningThread, PlanningThreadKind } from "./types";
import type { Payload } from "@/src/shared/types";

export function PlanningComposer({ sessionId }: { sessionId: string }) {
  const { styles } = useTheme();
  const { data, userId, act, getViewerEpoch, refresh } = useBeacon();
  const params = useLocalSearchParams<{
    timezone?: string;
    startsAt?: string;
    kind?: string;
    creationKind?: string;
    squadId?: string;
    organizationId?: string;
    placeLabel?: string;
    latitude?: string;
    longitude?: string;
    activityNoteId?: string;
    inviteeIds?: string;
    featureAfter?: string;
    returnPlanId?: string;
    planStopId?: string;
    planAfterStopId?: string;
    planAudience?: string;
  }>();
  const kind: PlanningThreadKind =
    params.kind === "draw" || params.creationKind === "draw"
      ? "draw"
      : params.kind === "vote" || params.creationKind === "council"
        ? "vote"
        : "ping";
  const name =
    kind === "ping" ? "Ping" : kind === "vote" ? "Vote" : "Random Draw";
  const action =
    kind === "ping"
      ? "Send Ping"
      : kind === "vote"
        ? "Start Vote"
        : "Start Draw";
  const now = useNow();
  const titleInput = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const planContext = data.plans.find(
    (p) => p.id === params.returnPlanId && data.viewer_id === userId,
  );
  const timezone = planningTimezone(planContext?.timezone ?? params.timezone);
  const planIdea = data.plan_stops?.find(
    (s) => s.id === params.planStopId && s.plan_id === planContext?.id,
  );
  const source = activityNoteSeed(data, userId, params.activityNoteId, now);
  const sourceNote = source
    ? data.activities.find((row) => row.id === params.activityNoteId)
    : undefined;
  const sourcePlace = sourceNote
    ? data.places.find((row) => row.activity_id === sourceNote.id)?.label
    : undefined;
  const [draft, setDraft] = useState(() =>
    structuredClone(
      composerSession(userId ?? "signed-out", sessionId, () => {
        const createdAt = Date.now();
        const { startsAt, deadline } = composerTiming(
          createdAt,
          params.startsAt,
          timezone,
        );
        return {
          title:
            source?.title ??
            planIdea?.title ??
            (params.placeLabel ? `Meet at ${params.placeLabel}` : ""),
          body: source?.description ?? "",
          audience: params.squadId
            ? "squad"
            : params.organizationId
              ? "organization"
              : params.planAudience === "private"
                ? "private"
                : (sourceNote?.audience ?? "friends"),
          audienceId:
            params.squadId ??
            params.organizationId ??
            sourceNote?.audience_id ??
            null,
          startsAt,
          flexibleTime: startsAt !== params.startsAt,
          deadline:
            kind === "ping"
              ? new Date(
                  Math.min(
                    Date.parse(deadline),
                    Math.ceil((createdAt + 3600000) / 900000) * 900000,
                  ),
                ).toISOString()
              : deadline,
          minutes: "60",
          place: sourcePlace ?? params.placeLabel ?? "",
          coordinate: sourcePlace
            ? undefined
            : composerMapCoordinate(params.latitude, params.longitude),
          category: source?.category ?? "Social",
          options:
            kind === "ping"
              ? []
              : [0, 1].map((_, index) => ({
                  id: randomUUID(),
                  payload: {
                    ...makeBeaconDraft(new Date(startsAt), 60),
                    timezone,
                    flexible_time: true,
                    title: index === 0 ? (source?.title ?? "") : "",
                    description: source?.description ?? "",
                    category: source?.category ?? "Social",
                    label: sourcePlace ?? (index === 0 ? params.placeLabel ?? "" : ""),
                    ...(index === 0 ? composerMapCoordinate(params.latitude, params.longitude) : undefined),
                  },
                })),
          touched: [],
          publication: {},
          coownerIds: [],
        };
      }),
    ),
  );
  useFocusEffect(
    useCallback(() => {
      setDraft(
        structuredClone(
          composerSession(userId ?? "signed-out", sessionId, () => {
            throw new Error("Draft unavailable");
          }),
        ),
      );
    }, [userId, sessionId]),
  );
  const frozen = !!draft.publication.attempt;
  const flexibleTime =
    draft.flexibleTime ??
    (!params.startsAt && !draft.touched.includes("startsAt"));
  const optionStarts = draft.options
    .filter((row) => !row.payload.flexible_time)
    .map((row) => Date.parse(row.payload.starts_at));
  const deadlineLimit =
    kind === "ping"
      ? flexibleTime
        ? undefined
        : Date.parse(draft.startsAt)
      : optionStarts.length
        ? Math.min(...optionStarts)
        : undefined;
  const titleMissing = error === "Add an idea." || error === "Add a question.";
  const choicesError =
    error === "Add at least two choices." ||
    error === "Give each choice a name.";
  function update<K extends keyof ComposerDraft>(
    key: K,
    value: ComposerDraft[K],
  ) {
    if (frozen || busy) return;
    setError("");
    change((next) => {
      next[key] = value;
      if (key === "place") next.coordinate = undefined;
      if (!next.touched.includes(key)) next.touched.push(key);
    });
  }
  function change(mutate: (next: ComposerDraft) => void) {
    const next = structuredClone(draft);
    mutate(next);
    storeComposerSession(userId ?? "signed-out", sessionId, next);
    setDraft(next);
  }

  const candidate: PlanningThread = {
    id: sessionId,
    owner_id: userId ?? "",
    coowner_ids: [],
    kind,
    title: draft.title,
    body: draft.body,
    audience: draft.audience,
    audience_id: draft.audienceId,
    deadline_at: draft.deadline,
    status: "open",
    payload: null,
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: "",
    resolved_at: null,
  };
  const coowners = data.profiles.filter(
    (profile) =>
      profile.id !== userId &&
      canReadPlanningThread(data, candidate, profile.id),
  );

  function editOption(id: string) {
    const next = structuredClone(draft);
    const option = next.options.find((row) => row.id === id);
    if (!option || busy || frozen) return;
    const reuse =
      option.editorToken &&
      hasPlanningDraftField(userId, option.editorToken, "title");
    const token = reuse ? option.editorToken : startCreationDraft(userId);
    if (!token) return;
    option.editorToken = token;
    storeComposerSession(userId ?? "signed-out", sessionId, next);
    setDraft(next);
    const payload = option.payload.flexible_time
      ? {
          ...option.payload,
          ...flexiblePlanningWindow(draft.deadline, option.payload.timezone),
        }
      : option.payload;
    if (!reuse)
      for (const [key, value] of Object.entries({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        starts: payload.starts_at,
        ends: payload.ends_at,
        when: "Pick time",
        duration: `${(Date.parse(payload.ends_at) - Date.parse(payload.starts_at)) / 60000} min`,
        approval: payload.approval_required ? "Host approval" : "Open joining",
        pin:
          payload.latitude !== null && payload.longitude !== null
            ? { latitude: payload.latitude, longitude: payload.longitude }
            : null,
        placeType: payload.online_url ? "Online" : "In person",
        url: payload.online_url ?? "",
        label: payload.label,
      }))
        setCreationDraftField(userId, token, key, value);
    setCreationDraftField(userId, token, "audience", draft.audience);
    setCreationDraftField(userId, token, "audienceId", draft.audienceId);
    router.push({
      pathname: "/create",
      params: {
        editor: "yes",
        planSession: token,
        planningSessionId: sessionId,
        planningOptionId: id,
        planningKind: kind,
        timezone: payload.timezone,
      },
    });
  }

  async function publish() {
    if (lock.current) return;
    if (!userId || data.viewer_id !== userId)
      throw new Error("Sign in before creating a decision.");
    lock.current = true;
    setBusy(true);
    setError("");
    const epoch = getViewerEpoch();
    let completed = false;
    const publication = structuredClone(draft.publication);
    const checkpoint = () => {
      const next = { ...draft, publication: structuredClone(publication) };
      storeComposerSession(userId!, sessionId, next);
      setDraft(next);
    };
    try {
      let payload: Payload;
      let options: BeaconDraft[] = [];
      if (publication.attempt) payload = publication.attempt.payload;
      else {
        if (!draft.title.trim()) {
          titleInput.current?.focus();
          throw new Error(kind === "ping" ? "Add an idea." : "Add a question.");
        }
        if (params.activityNoteId && !source)
          throw new Error(
            "This Activity Note is no longer available. Return and start a new decision.",
          );
        if (params.inviteeIds && params.inviteeIds !== "[]")
          throw new Error(
            "Choose a supported group audience. Individual invitations cannot be used for Planning.",
          );
        if (
          !["friends", "private"].includes(draft.audience) &&
          !eligibleDefaultTargets(data, userId, draft.audience).some(
            (row) => row.id === draft.audienceId,
          )
        )
          throw new Error("Choose an audience you can share with.");
        const fallback = flexiblePlanningWindow(draft.deadline, timezone);
        const beacon = {
          ...makeBeaconDraft(
            new Date(flexibleTime ? fallback.starts_at : draft.startsAt),
            kind === "ping" ? Number(draft.minutes) : 60,
          ),
          timezone,
          ...(flexibleTime ? { flexible_time: true } : {}),
          title: draft.title.trim(),
          description: draft.body,
          category: draft.category,
          label: draft.place,
          ...(draft.coordinate ? draft.coordinate : {}),
          audience: draft.audience,
          audience_id: draft.audienceId,
        };
        validatePlanningThreadDraft(
          kind,
          draft.title,
          draft.body,
          draft.audience,
          draft.audienceId,
          draft.deadline,
          now,
          kind === "ping" ? beacon : undefined,
        );
        if (kind !== "ping" && draft.options.length < 2)
          throw new Error("Add at least two choices.");
        if (
          kind !== "ping" &&
          draft.options.some((option) => !option.payload.title.trim())
        )
          throw new Error("Give each choice a name.");
        options =
          kind === "ping"
            ? []
            : draft.options.map((option) => {
                const value = {
                  ...option.payload,
                  ...(option.payload.flexible_time ? fallback : {}),
                  title: option.payload.title.trim(),
                  audience: draft.audience,
                  audience_id: draft.audienceId,
                };
                validateBeaconDraft(value);
                if (Date.parse(value.starts_at) <= Date.parse(draft.deadline))
                  throw new Error(
                    "Every option must start after responses close.",
                  );
                return value;
              });
        if (
          (draft.coownerIds ?? []).some(
            (id) => !coowners.some((profile) => profile.id === id),
          )
        )
          throw new Error(
            "Review the co-organizers after changing the audience.",
          );
        payload = {
          kind,
          return_plan_id: params.returnPlanId,
          plan_stop_id: params.planStopId,
          plan_after_stop_id: params.planAfterStopId,
          title: draft.title.trim(),
          body: draft.body,
          audience: draft.audience,
          audience_id: draft.audienceId,
          deadline_at: draft.deadline,
          coowner_ids:
            data.plans.find((p) => p.id === params.returnPlanId)?.coowner_ids ??
            (kind === "ping" ? [] : (draft.coownerIds ?? [])),
          source_activity_note_id: params.activityNoteId,
          connected_version: 1,
          vote_method: draft.voteMethod ?? "pick_one",
          interest_target: interestTarget(draft.interestTarget),
          allow_backup_hosting:
            draft.allowBackupHosting ?? draft.audience === "squad",
          ...(kind === "ping" ? { payload: beacon } : {}),
        };
      }
      const operation = publishPlanningSession(
        publication,
        payload,
        options,
        async (action, value, requestId, deferRefresh) => {
          if (epoch !== getViewerEpoch())
            throw new Error(
              "Your account changed. Return to the original account.",
            );
          return act(action, value, requestId, deferRefresh);
        },
        randomUUID,
      );
      checkpoint();
      const id = await operation;
      if (epoch !== getViewerEpoch()) return;
      completed = true;
      completeComposerSession(userId, sessionId);
      if (params.returnPlanId) {
        router.dismissTo({
          pathname: "/plan/[id]",
          params: { id: params.returnPlanId },
        });
        return;
      }
      router.replace({
        pathname: "/activity-created",
        params: {
          id,
          type: kind,
          ...(params.featureAfter ? { featureAfter: params.featureAfter } : {}),
        },
      });
    } catch (failure) {
      if (epoch === getViewerEpoch()) {
        if (publication.options?.some((option) => !option.id))
          void refresh();
        if (
          (failure as { definitive?: boolean })?.definitive &&
          !publication.threadId
        ) {
          delete publication.attempt;
          delete publication.options;
        }
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not verify publication. Your setup is preserved.",
        );
      }
    } finally {
      lock.current = false;
      if (epoch === getViewerEpoch()) {
        setBusy(false);
        if (!completed) checkpoint();
      }
    }
  }

  return (
    <Screen
      title={name}
      eyebrow=""
      showDemoNotice={false}
      compactHeader
      footer={
        <View style={{ gap: 6 }}>
          {!!error && !titleMissing && !choicesError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <Action
            title={frozen ? "Verify publication" : action}
            disabled={busy}
            run={publish}
          />
          {frozen && (
            <Action
              secondary
              compact
              title="Refresh publication state"
              run={refresh}
            />
          )}
        </View>
      }
    >
      <PlanningKindSelector
        kind={kind}
        sessionId={sessionId}
        disabled={frozen || busy}
      />
      <View
        pointerEvents={frozen || busy ? "none" : "auto"}
        accessibilityElementsHidden={frozen || busy}
        importantForAccessibility={
          frozen || busy ? "no-hide-descendants" : "auto"
        }
        style={{ gap: 8, opacity: frozen ? 0.65 : 1 }}
      >
        <Field
          inputRef={titleInput}
          label={
            kind === "ping"
              ? "What’s the idea?"
              : kind === "vote"
                ? "What are we deciding?"
                : "What should we pick at random?"
          }
          placeholder={
            kind === "ping"
              ? "Anyone down for basketball tonight?"
              : kind === "vote"
                ? "Where should we eat?"
                : "What should we play?"
          }
          value={draft.title}
          maxLength={120}
          editable={!frozen && !busy}
          onChangeText={(value) => update("title", value)}
        />
        {titleMissing && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {kind === "ping" ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {pingStarters.map((starter) => (
                <Chip
                  key={starter.id}
                  label={starter.label}
                  selected={draft.title === starter.title}
                  disabled={
                    frozen ||
                    busy ||
                    (draft.title.trim() !== "" &&
                      !pingStarters.some((row) => row.title === draft.title))
                  }
                  onPress={() => {
                    setError("");
                    change((next) => applyPingStarter(next, starter.id));
                  }}
                />
              ))}
            </View>
            <Txt muted>
              Replies are about interest: Interested · Maybe · Pass.
            </Txt>
          </>
        ) : (
          <>
            <PlanningChoicesEditor
              options={draft.options}
              disabled={frozen || busy}
              onDetails={editOption}
              onChange={(options) => update("options", options)}
              onTitle={(option, title) => {
                setError("");
                change((next) => {
                  const row = next.options.find(
                    (value) => value.id === option.id,
                  );
                  if (row) row.payload.title = title;
                });
                if (option.editorToken)
                  setCreationDraftField(
                    userId,
                    option.editorToken,
                    "title",
                    title,
                  );
              }}
              onAdd={() =>
                update("options", [
                  ...draft.options,
                  {
                    id: randomUUID(),
                    payload: {
                      ...makeBeaconDraft(new Date(draft.startsAt), 60),
                      timezone,
                      flexible_time: true,
                    },
                  },
                ])
              }
            />
            {choicesError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </>
        )}
        {kind === "vote" &&
          (data.is_demo === true ||
            data.capabilities?.connected_planning === true) && (
            <View style={{ gap: 6 }}>
              <Txt>How can people vote?</Txt>
              <Chips
                options={["Choose one", "Choose any that work"]}
                value={
                  draft.voteMethod === "approval"
                    ? "Choose any that work"
                    : "Choose one"
                }
                onChange={(value) =>
                  update(
                    "voteMethod",
                    value === "Choose one" ? "pick_one" : "approval",
                  )
                }
              />
            </View>
          )}
        <PlanningAudienceField
          value={draft.audience}
          id={draft.audienceId}
          fixedLabel={
            params.returnPlanId
              ? (planContext?.title ?? "Your Plan")
              : undefined
          }
          onChange={(audience, id) => {
            if (frozen || busy) return;
            setError("");
            change((next) => {
              next.audience = audience;
              next.audienceId = id;
              next.coownerIds = [];
              if (!next.touched.includes("audience"))
                next.touched.push("audience");
            });
          }}
        />
        {kind === "ping" && (
          <PlanningDateField
            label="Activity time"
            value={flexibleTime ? "" : draft.startsAt}
            seed={draft.startsAt}
            timezone={timezone}
            now={now}
            min={Math.max(now, Date.parse(draft.deadline))}
            allowFlexible
            onChange={(value) => {
              change((next) => {
                next.flexibleTime = !value;
                if (value) next.startsAt = value;
                if (!next.touched.includes("startsAt"))
                  next.touched.push("startsAt");
              });
              setError("");
            }}
          />
        )}
        <PlanningDateField
          label={kind === "draw" ? "Entries close" : "Responses close"}
          value={draft.deadline}
          timezone={timezone}
          now={now}
          min={now}
          max={deadlineLimit}
          onChange={(value) => update("deadline", value)}
        />
        {kind === "draw" && (
          <Txt muted>
            After entries close, you can draw one eligible choice at random.
          </Txt>
        )}
        <PlanningDisclosure title="More options">
          <Field
            label="Description · Optional"
            value={draft.body}
            multiline
            maxLength={500}
            editable={!frozen && !busy}
            onChangeText={(value) => update("body", value)}
          />
          {kind === "ping" ? (
            <>
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
                onChange={(value) => update("category", value)}
              />
              <Field
                label="Duration · minutes"
                value={draft.minutes}
                keyboardType="numeric"
                editable={!frozen && !busy}
                onChangeText={(value) => update("minutes", value)}
              />
              <Field
                label="Place · Optional"
                value={draft.place}
                editable={!frozen && !busy}
                onChangeText={(value) => update("place", value)}
              />
            </>
          ) : (
            <View style={{ gap: 6 }}>
              <Txt>Co-organizers · Optional</Txt>
              {coowners.map((profile) => (
                <Button
                  key={profile.id}
                  compact
                  secondary={!draft.coownerIds?.includes(profile.id)}
                  title={`${draft.coownerIds?.includes(profile.id) ? "✓ " : ""}${profile.name}`}
                  disabled={busy || frozen}
                  onPress={() =>
                    update(
                      "coownerIds",
                      draft.coownerIds?.includes(profile.id)
                        ? draft.coownerIds.filter((id) => id !== profile.id)
                        : [...(draft.coownerIds ?? []), profile.id],
                    )
                  }
                />
              ))}
            </View>
          )}
          {(data.is_demo === true ||
            data.capabilities?.connected_planning === true) && (
            <>
              {kind === "ping" && (
                <Field
                  label="Interest target · Optional"
                  value={draft.interestTarget ?? ""}
                  keyboardType="number-pad"
                  onChangeText={(value) => update("interestTarget", value)}
                />
              )}
              <PlanningToggle
                title="Allow backup hosting"
                description="Eligible participants may volunteer if you are unavailable."
                value={draft.allowBackupHosting ?? draft.audience === "squad"}
                disabled={frozen || busy}
                onChange={(value) => update("allowBackupHosting", value)}
              />
            </>
          )}
        </PlanningDisclosure>
      </View>
      {frozen && (
        <Txt muted>
          Verification will retry with your original submitted values.
        </Txt>
      )}
    </Screen>
  );
}
