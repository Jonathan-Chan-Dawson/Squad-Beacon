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
} from "./domain";
import type { PlanningThread, PlanningThreadKind } from "./types";

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

export default function PlanningListScreen() {
  const { data, userId, act } = useBeacon();
  const { organizationId, squadId: squadIdParam, newPing, pingSeed } = useLocalSearchParams<{
    organizationId?: string;
    squadId?: string;
    newPing?: string;
    pingSeed?: string;
  }>();
  const requestedSquadId = Array.isArray(squadIdParam)
    ? squadIdParam[0]
    : squadIdParam;
  const createSquadPing = Array.isArray(newPing) ? newPing[0] : newPing;
  const pingSeedToken = Array.isArray(pingSeed) ? pingSeed[0] : pingSeed;
  const hasSquadPingRequest = createSquadPing === "yes" && !!requestedSquadId;
  const seedKey = `${userId ?? "signed-out"}:${requestedSquadId ?? ""}:${pingSeedToken ?? "direct"}`;
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
  const [manualCreateOpen, setManualCreateOpen] = useState(!!organization);
  const [dismissedSeedKey, setDismissedSeedKey] = useState<string | null>(null);
  const [kindChoice, setKindChoice] = useState<(typeof kinds)[number]>("Ping");
  const [titleDraft, setTitleDraft] = useState({ key: "", value: "" });
  const [bodyDraft, setBodyDraft] = useState({ key: "", value: "" });
  const [coownerDraft, setCoownerDraft] = useState({ key: "", value: [] as string[] });
  const [audience, setAudience] = useState<Audience>(organization ? "organization" : "friends");
  const [audienceId, setAudienceId] = useState<string | null>(
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
    : manualCreateOpen;
  const draftKey = activeSeed ? `squad:${seedKey}` : "normal";
  const title = titleDraft.key === draftKey ? titleDraft.value : "";
  const body = bodyDraft.key === draftKey ? bodyDraft.value : "";
  const coownerIds = coownerDraft.key === draftKey ? coownerDraft.value : [];
  const effectiveKindChoice = activeSeed ? "Ping" : kindChoice;
  const effectiveAudience: Audience = activeSeed ? "squad" : audience;
  const effectiveAudienceId = activeSeed ? seededSquad!.id : audienceId;

  function closeCreate() {
    setManualCreateOpen(false);
    if (hasSquadPingRequest) {
      setDismissedSeedKey(seedKey);
      router.setParams({ newPing: undefined, pingSeed: undefined });
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
    return new Date(
      Date.now() + (deadlineChoice === "24 hours" ? 24 : 72) * 60 * 60 * 1000,
    ).toISOString();
  }

  function pingDraft(deadlineAt: string) {
    const recipe =
      quickRecipes.find((item) => item.id === recipeId) ?? quickRecipes[0];
    const startAt = new Date(Date.parse(deadlineAt) + 24 * 60 * 60 * 1000);
    const draft = makeBeaconDraft(startAt, recipe.minutes);
    draft.title = recipe.title;
    draft.category = recipe.category;
    draft.audience = effectiveAudience;
    draft.audience_id = effectiveAudienceId;
    return draft;
  }

  async function createThread() {
    if (
      hasSquadPingRequest &&
      (!activeSeed || !requestedSquadId || !userId ||
        !canOpenSquadProfile(data, requestedSquadId, userId))
    ) {
      closeCreate();
      throw new Error("You’re no longer an active member of that Squad. No Ping was shared.");
    }
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
    const result = await act("create_planning_thread", {
      kind,
      title: title.trim(),
      body: body.trim(),
      audience: effectiveAudience,
      audience_id: effectiveAudienceId,
      deadline_at: deadlineAt,
      coowner_ids: kind === "ping" ? [] : coownerIds,
      ...(payload ? { payload } : {}),
    });
    closeCreate();
    const id = typeof result.id === "string" ? result.id : "";
    if (id) router.push({ pathname: "/council/[id]", params: { id } });
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
          const optionCount = planning.planning_proposals.filter(
            (proposal) =>
              proposal.thread_id === thread.id &&
              proposal.approved &&
              proposal.disqualified_at == null,
          ).length;
          return (
            <Pressable
              key={thread.id}
              accessibilityRole="button"
              accessibilityLabel={`${thread.title}, ${kindName(thread.kind)}, ${thread.status}`}
              onPress={() =>
                router.push({
                  pathname: "/council/[id]",
                  params: { id: thread.id },
                })
              }
              style={({ pressed }) => [
                styles.card,
                { opacity: pressed ? 0.78 : 1, gap: 10 },
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
                <Text style={styles.muted}>
                  {thread.status === "open"
                    ? `Decision by ${shortDate(thread.deadline_at)}`
                    : `Updated ${shortDate(thread.resolved_at ?? thread.created_at)}`}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
      <Sheet
        title="Start a ping or decision"
        visible={createOpen}
        onClose={closeCreate}
      >
        {activeSeed ? (
          <View style={styles.card}>
            <Text style={styles.h2}>Squad Ping</Text>
          </View>
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
            <Txt muted>Only current members of this Squad can read or respond to this Ping.</Txt>
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
        {kind === "ping" && (
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
        <Action title="Create ping or decision" run={createThread} />
      </Sheet>
    </Screen>
  );
}
