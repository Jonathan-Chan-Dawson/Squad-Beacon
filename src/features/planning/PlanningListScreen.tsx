import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowUpRight, CalendarClock, CircleHelp, Dices, Vote } from "lucide-react-native";
import { templates } from "@/src/shared/templates";
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
  const { colors, styles } = useTheme();
  const planning = normalizePlanningData(data);
  const [createOpen, setCreateOpen] = useState(false);
  const [kindChoice, setKindChoice] = useState<(typeof kinds)[number]>("Ping");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("friends");
  const [audienceId, setAudienceId] = useState<string | null>(null);
  const [deadlineChoice, setDeadlineChoice] =
    useState<(typeof deadlines)[number]>("24 hours");
  const [recipeId, setRecipeId] = useState(quickRecipes[0].id);
  const [coownerIds, setCoownerIds] = useState<string[]>([]);

  const kind: PlanningThreadKind =
    kindChoice === "Ping" ? "ping" : kindChoice === "Vote" ? "vote" : "draw";
  const candidateThread: PlanningThread = {
      id: "draft",
      owner_id: userId ?? "",
      coowner_ids: [],
      kind,
      title: "",
      body: "",
      audience,
      audience_id: audienceId,
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
    const recipe = quickRecipes.find((item) => item.id === recipeId) ?? quickRecipes[0];
    const startAt = new Date(Date.parse(deadlineAt) + 24 * 60 * 60 * 1000);
    const draft = makeBeaconDraft(startAt, recipe.minutes);
    draft.title = recipe.title;
    draft.category = recipe.category;
    draft.audience = audience;
    draft.audience_id = audienceId;
    return draft;
  }

  async function createThread() {
    const deadlineAt = startDeadline();
    const payload = kind === "ping" ? pingDraft(deadlineAt) : undefined;
    validatePlanningThreadDraft(
      kind,
      title,
      body,
      audience,
      audienceId,
      deadlineAt,
      Date.now(),
      payload,
    );
    const result = await act("create_planning_thread", {
      kind,
      title: title.trim(),
      body: body.trim(),
      audience,
      audience_id: audienceId,
      deadline_at: deadlineAt,
      coowner_ids: kind === "ping" ? [] : coownerIds,
      ...(payload ? { payload } : {}),
    });
    setCreateOpen(false);
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
          setTitle("");
          setBody("");
          setCoownerIds([]);
          setCreateOpen(true);
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
                router.push({ pathname: "/council/[id]", params: { id: thread.id } })
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
        onClose={() => setCreateOpen(false)}
      >
        <Chips options={kinds} value={kindChoice} onChange={setKindChoice} />
        <Field
          label="Question or decision"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="What should we do together?"
        />
        <Field
          label="A little context (optional)"
          value={body}
          onChangeText={setBody}
          maxLength={500}
          multiline
          placeholder="Add the detail people need to decide."
        />
        <AudiencePicker
          value={audience}
          id={audienceId}
          onChange={(nextAudience, nextId) => {
            setAudience(nextAudience);
            setAudienceId(nextId);
            setCoownerIds([]);
          }}
        />
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
            <Text style={styles.muted}>Beacon if you turn this into a plan</Text>
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
                    setCoownerIds((current) =>
                      selected
                        ? current.filter((id) => id !== profile.id)
                        : [...current, profile.id],
                    )
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
