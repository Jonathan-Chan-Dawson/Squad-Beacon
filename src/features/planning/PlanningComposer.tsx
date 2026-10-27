import { ContextTip } from "@/src/features/onboarding/OnboardingUI";
import ZonedTimeField from "./ZonedTimeField";
import { interestTarget } from "./connected";
import { PlanningDisclosure, PlanningToggle } from "./PlanningControls";
import React, { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  Action,
  AudiencePicker,
  Button,
  Chips,
  Field,
  Screen,
  Txt,
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
import DateField from "./PlanningTimeField";
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
  storeComposerSession,
  completeComposerSession,
  pingStarters,
  type ComposerDraft,
} from "./composerSession";
import type { BeaconDraft, PlanningThread, PlanningThreadKind } from "./types";
import type { Payload } from "@/src/shared/types";

export function PlanningComposer({ sessionId }: { sessionId: string }) {
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
    kind === "ping"
      ? "Ping"
      : kind === "vote"
        ? "Vote Council"
        : "Draw Council";
  const now = useNow();
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const planContext = data.plans.find(
    (p) => p.id === params.returnPlanId && data.viewer_id === userId,
  );
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
        const startsAt =
          params.startsAt && Date.parse(params.startsAt) > Date.now() + 120000
            ? params.startsAt
            : new Date(Date.now() + 3 * 86400000).toISOString();
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
          deadline: new Date(
            Math.min(Date.now() + 86400000, Date.parse(startsAt) - 60000),
          ).toISOString(),
          minutes: "60",
          place: sourcePlace ?? params.placeLabel ?? "",
          coordinate: sourcePlace ? undefined : composerMapCoordinate(params.latitude, params.longitude),
          category: source?.category ?? "Social",
          options:
            kind === "ping"
              ? []
              : [0, 1].map((_, index) => ({
                  id: randomUUID(),
                  payload: {
                    ...makeBeaconDraft(new Date(startsAt), 60),
                    ...(planContext ? { timezone: planContext.timezone } : {}),
                    title: index === 0 ? (source?.title ?? "") : "",
                    description: source?.description ?? "",
                    category: source?.category ?? "Social",
                    label: sourcePlace ?? "",
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
  function update<K extends keyof ComposerDraft>(
    key: K,
    value: ComposerDraft[K],
  ) {
    if (frozen || busy) return;
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
    const payload = option.payload;
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
        const beacon = {
          ...makeBeaconDraft(new Date(draft.startsAt), Number(draft.minutes)),
          ...(planContext ? { timezone: planContext.timezone } : {}),
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
          throw new Error("Add at least two activity options.");
        options =
          kind === "ping"
            ? []
            : draft.options.map((option) => {
                const value = {
                  ...option.payload,
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
        async (action, value, requestId) => {
          if (epoch !== getViewerEpoch())
            throw new Error(
              "Your account changed. Return to the original account.",
            );
          return act(action, value, requestId);
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
    <Screen title={`Create ${name}`} eyebrow="" showDemoNotice={false}>
      {kind === "ping" || kind === "vote" ? <ContextTip name={kind} /> : null}
      <Txt muted>
        {kind === "ping"
          ? "Share an idea. Interested is not Going."
          : kind === "vote"
            ? "Choose one activity together. Votes can change until responses close."
            : "Gather alternatives. The organizer draws the result after responses close; participants do not vote."}
      </Txt>
      <View
        pointerEvents={frozen || busy ? "none" : "auto"}
        style={{ gap: 14, opacity: frozen ? 0.65 : 1 }}
      >
        {kind === "ping" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(data.is_demo === true ||
              data.capabilities?.connected_planning === true) && (
              <Button
                compact
                secondary
                title="When Works?"
                onPress={() =>
                  router.push({
                    pathname: "/planning/create",
                    params: {
                      kind: "time",
                      sessionId,
                      activityNoteId: params.activityNoteId,
                      returnPlanId: params.returnPlanId,
                      planStopId: params.planStopId,
                      planAfterStopId: params.planAfterStopId,
                      squadId: params.squadId,
                      planAudience: params.planAudience,
                    },
                  })
                }
              />
            )}
            {pingStarters.map((starter) => (
              <Button
                key={starter.id}
                compact
                secondary
                title={starter.label}
                disabled={frozen || busy}
                onPress={() => {
                  change((next) =>
                    applyPingStarter(next, starter.id, Date.now()),
                  );
                  if (starter.id === "nearby") setDetails(true);
                }}
              />
            ))}
          </View>
        ) : null}
        <Field
          label={
            kind === "ping" ? "What are you thinking?" : "What are we deciding?"
          }
          value={draft.title}
          maxLength={120}
          editable={!frozen && !busy}
          onChangeText={(value) => update("title", value)}
        />
        {kind === "ping" ? (
          planContext ? (
            <ZonedTimeField
              label="When?"
              value={draft.startsAt}
              timezone={planContext.timezone}
              onChange={(value) => update("startsAt", value)}
            />
          ) : (
            <DateField
              label="When?"
              value={draft.startsAt}
              onChange={(value) => update("startsAt", value)}
            />
          )
        ) : (
          <View style={{ gap: 10 }}>
            <Txt>Options</Txt>
            {draft.options.map((option) => (
              <View key={option.id} style={{ gap: 6 }}>
                <Field
                  label="Activity option"
                  value={option.payload.title}
                  editable={!frozen && !busy}
                  maxLength={120}
                  onChangeText={(title) => {
                    if (busy || frozen) return;
                    change((next) => {
                      next.options.find(
                        (row) => row.id === option.id,
                      )!.payload.title = title;
                    });
                    if (option.editorToken)
                      setCreationDraftField(
                        userId,
                        option.editorToken,
                        "title",
                        title,
                      );
                  }}
                />
                <Txt muted>
                  {option.payload.category} ·{" "}
                  {new Date(option.payload.starts_at).toLocaleString()}
                </Txt>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  <Button
                    compact
                    secondary
                    title={`Edit details${option.payload.title ? `: ${option.payload.title}` : ""}`}
                    disabled={frozen || busy}
                    onPress={() => editOption(option.id)}
                  />
                  <Button
                    compact
                    secondary
                    title="Remove option"
                    disabled={frozen || busy || draft.options.length <= 2}
                    onPress={() =>
                      update(
                        "options",
                        draft.options.filter((row) => row.id !== option.id),
                      )
                    }
                  />
                </View>
              </View>
            ))}
            <Button
              compact
              secondary
              title="+ Add Option"
              disabled={frozen || busy}
              onPress={() =>
                update("options", [
                  ...draft.options,
                  {
                    id: randomUUID(),
                    payload: {
                      ...makeBeaconDraft(new Date(draft.startsAt), 60),
                      ...(planContext
                        ? { timezone: planContext.timezone }
                        : {}),
                    },
                  },
                ])
              }
            />
          </View>
        )}
        {kind === "vote" &&
          (data.is_demo === true ||
            data.capabilities?.connected_planning === true) && (
            <View style={{ gap: 6 }}>
              <Txt>How should people choose?</Txt>
              <Chips
                options={["Pick One", "I'm Good With…"]}
                value={
                  draft.voteMethod === "approval"
                    ? "I'm Good With…"
                    : "Pick One"
                }
                onChange={(v) =>
                  update(
                    "voteMethod",
                    v === "Pick One" ? "pick_one" : "approval",
                  )
                }
              />
            </View>
          )}
        {(data.is_demo === true ||
          data.capabilities?.connected_planning === true) && (
          <PlanningDisclosure
            title="Organizer options"
            summary={`Backup hosting ${(draft.allowBackupHosting ?? draft.audience === "squad") ? "on" : "off"}`}
          >
            {kind === "ping" && (
              <Field
                label="Need X People · Optional"
                value={draft.interestTarget ?? ""}
                keyboardType="number-pad"
                onChangeText={(v) => update("interestTarget", v)}
              />
            )}
            <PlanningToggle
              title="Allow Backup Hosting"
              description="Eligible participants may volunteer if you are unavailable."
              value={draft.allowBackupHosting ?? draft.audience === "squad"}
              disabled={frozen || busy}
              onChange={(v) => update("allowBackupHosting", v)}
            />
          </PlanningDisclosure>
        )}
        {params.returnPlanId ? (
          <Txt muted>
            For{" "}
            {data.plans.find((p) => p.id === params.returnPlanId)?.title ??
              "your Plan"}{" "}
            ·{" "}
            {params.squadId
              ? (data.squads.find((s) => s.id === params.squadId)?.name ??
                "Squad")
              : "Personal"}
          </Txt>
        ) : (
          <AudiencePicker
            value={draft.audience}
            id={draft.audienceId}
            onChange={(audience, id) => {
              if (frozen || busy) return;
              change((next) => {
                next.audience = audience;
                next.audienceId = id;
                next.coownerIds = [];
                if (!next.touched.includes("audience"))
                  next.touched.push("audience");
              });
            }}
          />
        )}
        <DateField
          label="Responses close"
          value={draft.deadline}
          onChange={(value) => update("deadline", value)}
        />
        <Button
          compact
          secondary
          title={details ? "Fewer details" : "More details"}
          disabled={frozen || busy}
          onPress={() => setDetails(!details)}
        />
        {details ? (
          <>
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
          </>
        ) : null}
      </View>
      {frozen ? (
        <Txt muted>
          Publication is pending verification. Your submitted setup is locked.
          Retry uses the original request IDs and submitted values.
        </Txt>
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Action
        title={
          busy
            ? "Publishing…"
            : frozen
              ? "Verify / finish publication"
              : `Create ${name}`
        }
        disabled={busy}
        run={publish}
      />
      {frozen ? (
        <Action secondary title="Refresh publication state" run={refresh} />
      ) : null}
      <Txt muted>
        Draft edits are kept while navigating in this app session. They are not
        saved across app restarts.
      </Txt>
    </Screen>
  );
}
