import { randomUUID } from "expo-crypto";
import DateField from "./PlanningTimeField";
import { activityNoteSeed } from "@/src/features/beacons/livingActivity";
import {
  publishPlanningSession,
  planningDraftValue,
  storePlanningDraft,
  clearPlanningDraft,
  type PlanningCreationSession,
} from "./creationSession";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowUpRight,
  CalendarClock,
  CircleHelp,
  Dices,
  Vote,
} from "lucide-react-native";
import { useNow } from "@/src/shared/useNow";
import { templates } from "@/src/shared/templates";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { useBeacon } from "@/src/shared/store";
import type { Audience } from "@/src/shared/types";
import {
  Action,
  AudiencePicker,
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import {
  canReadPlanningThread,
  makeBeaconDraft,
  normalizePlanningData,
  validatePlanningThreadDraft,
  validateBeaconDraft,
} from "./domain";
import type { BeaconDraft, PlanningThread, PlanningThreadKind } from "./types";
import { PlanningResponseControls } from "./PlanningResponseControls";
import { planningInteraction } from "./planningInteraction";

const kinds = ["Ping", "Vote", "Draw"] as const;
const deadlines = ["24 hours", "3 days"] as const;
const quickRecipes = templates.slice(0, 3);
const kindName = (kind: PlanningThreadKind) =>
  kind === "ping" ? "Ping" : kind === "vote" ? "Vote" : "Draw";
const kindIcon = (kind: PlanningThreadKind) =>
  kind === "ping" ? CircleHelp : kind === "vote" ? Vote : Dices;
const shortDate = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function useSessionField<T>(
  key: string,
  field: string,
  initial: T,
): [T, (value: T) => void] {
  const [local, setLocal] = useState(() => ({
    key,
    value: planningDraftValue(key, field, () => initial),
  }));
  const value =
    local.key === key
      ? local.value
      : planningDraftValue(key, field, () => initial);
  return [
    value,
    (next) => {
      storePlanningDraft(key, field, next);
      setLocal({ key, value: next });
    },
  ];
}
export default function PlanningListScreen() {
  const quickNow = useNow();
  const [advancedPlanning, setAdvancedPlanning] = useState(false);
  const [quickThreadId, setQuickThreadId] = useState<string | null>(null);
  const { data, userId, act, getViewerEpoch } = useBeacon();
  const route = useLocalSearchParams<{
    activityNoteId?: string;
    creationKind?: string;
    featureAfter?: string;
    inviteeIds?: string;
  }>();
  const source = activityNoteSeed(data, userId, route.activityNoteId, quickNow);
  const sessionKey = `${userId}:${route.activityNoteId ?? "new"}:${route.creationKind ?? "planning"}`;
  const [proposedStart, setProposedStart] = useSessionField(
    sessionKey,
    "start",
    new Date(quickNow + 3 * 86400000).toISOString(),
  );
  const [responseDeadline, setResponseDeadline] = useSessionField(
    sessionKey,
    "deadline",
    new Date(quickNow + 86400000).toISOString(),
  );
  const [duration, setDuration] = useSessionField(sessionKey, "duration", "60");
  const [secondOption, setSecondOption] = useSessionField(
    sessionKey,
    "second",
    "",
  );
  const [sourceOption, setSourceOption] = useSessionField(
    sessionKey,
    "first",
    source?.title ?? "",
  );

  const {
    organizationId,
    squadId: squadIdParam,
    newPing,
    pingSeed,
    placeLabel,
  } = useLocalSearchParams<{
    organizationId?: string;
    squadId?: string;
    newPing?: string;
    pingSeed?: string;
    placeLabel?: string;
  }>();
  const requestedSquadId = Array.isArray(squadIdParam)
    ? squadIdParam[0]
    : squadIdParam;
  const createSquadPing = Array.isArray(newPing) ? newPing[0] : newPing;
  const pingSeedToken = Array.isArray(pingSeed) ? pingSeed[0] : pingSeed;
  const hasSquadPingRequest = createSquadPing === "yes" && !!requestedSquadId;
  const placeName =
    (Array.isArray(placeLabel) ? placeLabel[0] : placeLabel)
      ?.trim()
      .slice(0, 120) ?? "";
  const hasPlacePingRequest =
    createSquadPing === "yes" && !requestedSquadId && !!placeName;
  const seedKey = `${userId ?? "signed-out"}:${requestedSquadId ?? placeName}:${pingSeedToken ?? "direct"}`;
  const seededSquad =
    requestedSquadId &&
    userId &&
    data.squads.find((item) => item.id === requestedSquadId) &&
    canOpenSquadProfile(data, requestedSquadId, userId)
      ? data.squads.find((item) => item.id === requestedSquadId)
      : undefined;
  const organization = data.organizations.find(
    (item) =>
      item.id === organizationId &&
      (item.owner_id === userId ||
        data.organization_members.some(
          (member) =>
            member.organization_id === item.id &&
            member.user_id === userId &&
            member.status === "active",
        )),
  );
  const { colors, styles } = useTheme();
  const planning = normalizePlanningData(data);
  const [manualCreateOpen, setManualCreateOpen] = useState(
    !!organization || newPing === "yes" || !!route.creationKind,
  );
  const [dismissedSeedKey, setDismissedSeedKey] = useState<string | null>(null);
  const [kindChoice, setKindChoice] = useSessionField<(typeof kinds)[number]>(
    sessionKey,
    "kind",
    route.creationKind === "draw" ? "Draw" : route.creationKind === "council" ? "Vote" : "Ping",
  );
  const [titleDraft, setTitleDraft] = useSessionField(sessionKey, "title", {
    key: "",
    value: "",
  });
  const [bodyDraft, setBodyDraft] = useSessionField(sessionKey, "body", {
    key: "",
    value: "",
  });
  const [coownerDraft, setCoownerDraft] = useState({
    key: "",
    value: [] as string[],
  });
  const [audience, setAudience] = useSessionField<Audience>(
    sessionKey,
    "audience",
    organization ? "organization" : "friends",
  );
  const [audienceId, setAudienceId] = useSessionField<string | null>(
    sessionKey,
    "audienceId",
    organization?.id ?? null,
  );
  const [deadlineChoice, setDeadlineChoice] =
    useState<(typeof deadlines)[number]>("24 hours");
  const [recipeId, setRecipeId] = useState(quickRecipes[0].id);
  const activeSeed = !!(
    hasSquadPingRequest &&
    seededSquad &&
    dismissedSeedKey !== seedKey
  );
  const createOpen = hasSquadPingRequest
    ? activeSeed
    : (hasPlacePingRequest && dismissedSeedKey !== seedKey) || manualCreateOpen;
  const placeSeed = hasPlacePingRequest && dismissedSeedKey !== seedKey;
  const draftKey = activeSeed
    ? `squad:${seedKey}`
    : placeSeed
      ? `place:${seedKey}`
      : "normal";
  const title =
    titleDraft.key === draftKey
      ? titleDraft.value
      : placeSeed
        ? `Meet at ${placeName}`.slice(0, 120)
        : (source?.title ?? "");
  const body =
    bodyDraft.key === draftKey
      ? bodyDraft.value
      : (source?.description.slice(0, 500) ?? "");
  const coownerIds = coownerDraft.key === draftKey ? coownerDraft.value : [];
  const effectiveKindChoice = activeSeed || placeSeed ? "Ping" : kindChoice;
  const effectiveAudience: Audience = activeSeed ? "squad" : audience;
  const effectiveAudienceId = activeSeed ? seededSquad!.id : audienceId;

  function closeCreate() {
    setManualCreateOpen(false);
    if (hasSquadPingRequest || hasPlacePingRequest) {
      setDismissedSeedKey(seedKey);
      router.setParams({
        newPing: undefined,
        pingSeed: undefined,
        placeLabel: undefined,
      });
    }
  }

  const kind: PlanningThreadKind =
    effectiveKindChoice === "Ping"
      ? "ping"
      : effectiveKindChoice === "Vote"
        ? "vote"
        : "draw";
  const candidateThread: PlanningThread = {
    id: "draft",
    owner_id: userId ?? "",
    coowner_ids: [],
    kind,
    title: "",
    body: "",
    audience: effectiveAudience,
    audience_id: effectiveAudienceId,
    deadline_at: "",
    status: "open",
    payload: null,
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: "",
    resolved_at: null,
  };
  const coownerCandidates = data.profiles.filter(
    (profile) =>
      profile.id !== userId &&
      canReadPlanningThread(data, candidateThread, profile.id),
  );
  const threads = planning.planning_threads
    .filter((thread) => canReadPlanningThread(data, thread, userId ?? ""))
    .slice()
    .sort(
      (first, second) =>
        Number(first.status !== "open") - Number(second.status !== "open") ||
        first.deadline_at.localeCompare(second.deadline_at) ||
        second.created_at.localeCompare(first.created_at),
    );

  function startDeadline() {
    if (route.creationKind || route.activityNoteId) return responseDeadline;
    return new Date(
      Date.now() + (deadlineChoice === "24 hours" ? 24 : 72) * 60 * 60 * 1000,
    ).toISOString();
  }

  function pingDraft(deadlineAt: string) {
    const recipe =
      quickRecipes.find((item) => item.id === recipeId) ?? quickRecipes[0];
    const startAt = new Date(Date.parse(deadlineAt) + 24 * 60 * 60 * 1000);
    const draft = makeBeaconDraft(startAt, recipe.minutes);
    draft.title = title.trim() || source?.title || recipe.title;
    draft.description = source?.description ?? body;
    draft.category = source?.category ?? recipe.category;
    if (route.creationKind || route.activityNoteId) {
      draft.starts_at = proposedStart;
      draft.ends_at = new Date(
        Date.parse(proposedStart) + Number(duration) * 60000,
      ).toISOString();
    }
    draft.audience = effectiveAudience;
    draft.audience_id = effectiveAudienceId;
    if (placeSeed) draft.label = placeName;
    return draft;
  }

  async function createThread() {
    if (
      hasSquadPingRequest &&
      (!activeSeed ||
        !requestedSquadId ||
        !userId ||
        !canOpenSquadProfile(data, requestedSquadId, userId))
    ) {
      closeCreate();
      throw new Error(
        "You’re no longer an active member of that Squad. No Ping was shared.",
      );
    }
    if (route.inviteeIds && route.inviteeIds !== "[]")
      throw new Error(
        "Individual invitations cannot be used as a Planning audience. Return to creation and choose a supported audience.",
      );
    const deadlineAt = startDeadline();
    const payload = kind === "ping" ? pingDraft(deadlineAt) : undefined;
    validatePlanningThreadDraft(
      kind,
      title,
      body,
      effectiveAudience,
      effectiveAudienceId,
      deadlineAt,
      Date.now(),
      payload,
    );
    const options: BeaconDraft[] = [];
    if (kind !== "ping" && (source || (route.creationKind === "council" || route.creationKind === "draw"))) {
      if (!sourceOption.trim() || !secondOption.trim())
        throw new Error(
          "Add at least two actual options before finishing your Council.",
        );
      for (const optionTitle of [sourceOption, secondOption]) {
        const option = makeBeaconDraft(
          new Date(proposedStart),
          Number(duration),
        );
        Object.assign(option, {
          title: optionTitle,
          description: source?.description ?? "",
          category: source?.category ?? "Social",
          audience: effectiveAudience,
          audience_id: effectiveAudienceId,
        });
        validateBeaconDraft(option);
        if (Date.parse(option.starts_at) <= Date.parse(deadlineAt))
          throw new Error("Each option must start after responses close.");
        options.push(option);
      }
    }
    const epoch = getViewerEpoch();
    const publication = planningDraftValue<PlanningCreationSession>(
      sessionKey,
      "publication",
      () => ({}),
    );
    storePlanningDraft(sessionKey, "publication", publication);
    const id = await publishPlanningSession(
      publication,
      {
        kind,
        title: title.trim(),
        body: body.trim(),
        audience: effectiveAudience,
        audience_id: effectiveAudienceId,
        deadline_at: deadlineAt,
        coowner_ids: kind === "ping" ? [] : coownerIds,
        ...(payload ? { payload } : {}),
      },
      options,
      async (action, value, requestId) => {
        if (epoch !== getViewerEpoch())
          throw new Error(
            "Your account changed. Return to the original account to finish.",
          );
        return act(action, value, requestId);
      },
      randomUUID,
    );
    if (epoch !== getViewerEpoch()) return;
    clearPlanningDraft(sessionKey);
    closeCreate();
    router.push({ pathname: "/activity-created", params: { id, type: kind } });
  }

  return (
    <Screen title="Pings & Decisions" eyebrow="Decide with your people">
      <Txt muted>
        Ask who is free, vote on a plan, or draw from approved beacon options.
        Each decision uses the same audience privacy as a beacon.
      </Txt>
      <Button
        title="Start a ping, vote, or draw"
        onPress={() => {
          if (hasSquadPingRequest) {
            setDismissedSeedKey(seedKey);
            router.setParams({ newPing: undefined, pingSeed: undefined });
          }
          const key = "normal";
          setTitleDraft({ key, value: "" });
          setBodyDraft({ key, value: "" });
          setCoownerDraft({ key, value: [] });
          setAudience(organization ? "organization" : "friends");
          setAudienceId(organization?.id ?? null);
          setKindChoice("Ping");
          setManualCreateOpen(true);
        }}
      />
      {!threads.length ? (
        <Empty
          title="No pings or decisions yet."
          body="A ping checks interest. A vote or draw helps your group choose a beacon option."
        />
      ) : (
        threads.map((thread) => {
          const Icon = kindIcon(thread.kind);
          const optionCount =
            planningInteraction(data, userId, thread.id, quickNow)?.options
              .length ?? 0;
          return (
            <View
              key={thread.id}
              style={[
                styles.card,
                { flexDirection: "row", gap: 10, alignItems: "center" },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${thread.title}, ${kindName(thread.kind)}, ${thread.status}`}
                onPress={() =>
                  router.push({
                    pathname: "/council/[id]",
                    params: { id: thread.id },
                  })
                }
                style={({ pressed }) => [
                  { flex: 1, minWidth: 0, opacity: pressed ? 0.78 : 1, gap: 8 },
                ]}
              >
                <View style={styles.between}>
                  <View style={[styles.row, { flex: 1 }]}>
                    <Icon size={19} color={colors.green} />
                    <Text style={[styles.h2, { flex: 1 }]} numberOfLines={2}>
                      {thread.title}
                    </Text>
                  </View>
                  <ArrowUpRight size={18} color={colors.muted} />
                </View>
                <Text style={styles.muted}>
                  {kindName(thread.kind)} · {thread.status.replace("_", " ")}
                  {thread.kind !== "ping" ? ` · ${optionCount} approved` : ""}
                </Text>
                <View style={styles.row}>
                  <CalendarClock size={15} color={colors.muted} />
                  <Text
                    style={[styles.muted, { flex: 1, minWidth: 0 }]}
                    numberOfLines={2}
                  >
                    {thread.status === "open"
                      ? `Decision by ${shortDate(thread.deadline_at)}`
                      : `Updated ${shortDate(thread.resolved_at ?? thread.created_at)}`}
                  </Text>
                </View>
              </Pressable>
              {thread.kind !== "draw" &&
                !(thread.kind === "ping" && thread.owner_id === userId) && (
                  <Button
                    compact
                    secondary
                    title={
                      thread.status !== "open" ||
                      Date.parse(thread.deadline_at) <= quickNow
                        ? "Closed"
                        : thread.kind === "ping"
                          ? (planning.planning_ping_responses.find(
                              (row) =>
                                row.thread_id === thread.id &&
                                row.user_id === userId,
                            )?.response ?? "Respond")
                          : planning.planning_votes.some(
                                (row) =>
                                  row.thread_id === thread.id &&
                                  row.user_id === userId,
                              )
                            ? "Voted"
                            : "Vote"
                    }
                    disabled={
                      thread.status !== "open" ||
                      Date.parse(thread.deadline_at) <= quickNow
                    }
                    onPress={() => setQuickThreadId(thread.id)}
                  />
                )}
            </View>
          );
        })
      )}
      <Sheet
        title="Quick response"
        visible={!!quickThreadId}
        onClose={() => setQuickThreadId(null)}
      >
        {quickThreadId && (
          <Txt>
            {
              data.planning_threads.find(
                (thread) => thread.id === quickThreadId,
              )?.title
            }
          </Txt>
        )}
        {quickThreadId && (
          <PlanningResponseControls
            key={quickThreadId}
            threadId={quickThreadId}
          />
        )}
      </Sheet>
      <Sheet
        title="Start a ping or decision"
        visible={createOpen}
        onClose={closeCreate}
      >
        {activeSeed ? (
          <View style={styles.card}>
            <Text style={styles.h2}>Squad Ping</Text>
          </View>
        ) : placeSeed ? (
          <Txt muted>
            Choose who to invite. Nearby interest stays anonymous.
          </Txt>
        ) : (
          <Chips options={kinds} value={kindChoice} onChange={setKindChoice} />
        )}
        <Field
          label="Question or decision"
          value={title}
          onChangeText={(value) => setTitleDraft({ key: draftKey, value })}
          maxLength={120}
          placeholder="What should we do together?"
        />
        <Field
          label="A little context (optional)"
          value={body}
          onChangeText={(value) => setBodyDraft({ key: draftKey, value })}
          maxLength={500}
          multiline
          placeholder="Add the detail people need to decide."
        />
        {activeSeed && seededSquad ? (
          <View style={[styles.card, { gap: 4 }]}>
            <Text style={styles.h2}>Shared with {seededSquad.name}</Text>
            <Txt muted>
              Only current members of this Squad can read or respond to this
              Ping.
            </Txt>
          </View>
        ) : (
          <AudiencePicker
            value={effectiveAudience}
            id={effectiveAudienceId}
            onChange={(nextAudience, nextId) => {
              setAudience(nextAudience);
              setAudienceId(nextId);
              setCoownerDraft({ key: draftKey, value: [] });
            }}
          />
        )}
        <View style={{ gap: 7 }}>
          <Text style={styles.muted}>Decision deadline</Text>
          <Chips
            options={deadlines}
            value={deadlineChoice}
            onChange={setDeadlineChoice}
          />
        </View>
        {(route.creationKind || route.activityNoteId) && (
          <View style={{ gap: 10 }}>
            <DateField
              label="When would we do it?"
              value={proposedStart}
              onChange={setProposedStart}
            />
            <Field
              label="Duration · minutes"
              value={duration}
              keyboardType="numeric"
              onChangeText={setDuration}
            />
            <DateField
              label="Responses close"
              value={responseDeadline}
              onChange={setResponseDeadline}
            />
            {kind !== "ping" &&
              (source || (route.creationKind === "council" || route.creationKind === "draw")) && (
                <>
                  <Field
                    label="First activity option"
                    value={sourceOption}
                    onChangeText={setSourceOption}
                  />
                  <Field
                    label="Another activity option"
                    value={secondOption}
                    onChangeText={setSecondOption}
                  />
                  <Txt muted>
                    Options use the time and audience above. Review additional
                    settings in the Council.
                  </Txt>
                </>
              )}
          </View>
        )}
        {kind === "ping" && !source && (
          <View style={{ gap: 7 }}>
            <Text style={styles.muted}>
              Beacon if you turn this into a plan
            </Text>
            <Chips
              options={quickRecipes.map((recipe) => recipe.label)}
              value={
                quickRecipes.find((recipe) => recipe.id === recipeId)?.label ??
                quickRecipes[0].label
              }
              onChange={(label) =>
                setRecipeId(
                  quickRecipes.find((recipe) => recipe.label === label)?.id ??
                    quickRecipes[0].id,
                )
              }
            />
            <Txt muted>
              Starts the day after the deadline; you can review the details
              before sharing a real beacon.
            </Txt>
          </View>
        )}
        {kind !== "ping" && coownerCandidates.length > 0 && (
          <Button
            compact
            secondary
            title={advancedPlanning ? "Fewer settings" : "More settings"}
            onPress={() => setAdvancedPlanning(!advancedPlanning)}
          />
        )}
        {advancedPlanning &&
          kind !== "ping" &&
          coownerCandidates.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.muted}>Option hosts (optional)</Text>
              {coownerCandidates.map((profile) => {
                const selected = coownerIds.includes(profile.id);
                return (
                  <Button
                    key={profile.id}
                    title={`${selected ? "✓ " : "＋ "}${profile.name}`}
                    secondary={!selected}
                    onPress={() =>
                      setCoownerDraft({
                        key: draftKey,
                        value: selected
                          ? coownerIds.filter((id) => id !== profile.id)
                          : [...coownerIds, profile.id],
                      })
                    }
                  />
                );
              })}
            </View>
          )}
        <Action
          title={kind === "ping" ? "Create Ping" : "Create Council"}
          run={createThread}
        />
      </Sheet>
    </Screen>
  );
}
