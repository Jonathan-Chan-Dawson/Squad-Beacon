import { ActivityActionBar } from "@/src/features/activity/ActivityActionBar";
import {
  pendingPlanCreation,
  retainPlanCreation,
  clearPlanCreation,
  type PlanCreationAttempt,
} from "./planCreationRecovery";
import { Skeleton } from "@/src/shared/design-system";
import {
  continuePlanning,
  planDateLabel,
  planListPresentation,
} from "./planWorkspaceSelectors";
import { useDraftProtection } from "@/src/features/activity/useDraftProtection";
import { ActivityFrame } from "@/src/features/activity/ActivityFrame";
import {
  ContextTip,
  SemanticEmpty,
} from "@/src/features/onboarding/OnboardingUI";
import PlanDateField from "./PlanDateField";
import { ConnectedPlanningActions } from "@/src/features/planning/ConnectedPlanningActions";
import React, { useRef, useState } from "react";
import { View } from "react-native";
import ZonedTimeField from "@/src/features/planning/ZonedTimeField";
import {
  Eye,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Plus,
  ListChecks,
  CalendarDays,
  Map,
  Route,
  Repeat2,
  MoreHorizontal,
  Lightbulb,
  MessageCircle,
  MapPin,
  Sparkles,
} from "lucide-react-native";
import { PlanChoice, TimelineHeading, PlanProgress } from "./PlanPresentation";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Button,
  IconButton,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { ConfirmDialog, QuickChoiceDialog } from "@/src/shared/Dialogs";
import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { PlanningResponseControls } from "@/src/features/planning/PlanningResponseControls";
import {
  startCreationDraft,
  setCreationDraftField,
} from "@/src/features/beacons/socialPlanningSession";
import {
  compatiblePlanActivity,
  planPermissions,
  planSuggestedStart,
  planStarters,
  planStops,
  stopActivity,
  stopThread,
  type PlanStop,
} from "./livingPlans";
import { RoutineScheduleSheet } from "./RoutineScheduleSheet";
import { isLocalDate } from "./routines";
import { useNow } from "@/src/shared/useNow";

export function LivingPlansScreen() {
  const {
    data,
    userId,
    act,
    loading,
    error,
    refresh,
    getViewerEpoch,
    viewerEpoch,
    demo,
  } = useBeacon();
  const { styles } = useTheme();
  const params = useLocalSearchParams<{
    create?: string;
    planSeed?: string;
    squadId?: string;
    startDate?: string;
    timezone?: string;
    templates?: string;
    template?: string;
    sourcePlan?: string;
    routine?: string;
  }>();
  const recoveryScope = `${userId}:${demo}:${viewerEpoch}`;
  const recovering = pendingPlanCreation(recoveryScope);
  const squads = data.squads.filter((s) =>
    data.squad_members.some((m) => m.squad_id === s.id && m.user_id === userId),
  );
  const [creating, setCreating] = useState(
    params.create === "yes" || !!recovering,
  );
  const [templates, setTemplates] = useState(params.templates === "yes");
  const [title, setTitle] = useState(
    typeof recovering?.payload.title === "string"
      ? recovering.payload.title
      : data.viewer_id === userId
        ? (data.plan_templates.find((t) => t.id === params.template)?.title ??
          data.plans.find((p) => p.id === params.sourcePlan)?.title ??
          "")
        : "",
  );
  const [squad, setSquad] = useState(
    typeof recovering?.payload.squad_id === "string"
      ? recovering.payload.squad_id
      : squads.some((s) => s.id === params.squadId)
        ? params.squadId!
        : "Personal",
  );
  const [filter, setFilter] = useState("All");
  const [revealSequence, setRevealSequence] = useState(0);
  const [optional, setOptional] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const creation = useRef<PlanCreationAttempt | null>(recovering ?? null);
  const [creationPending, setCreationPending] = useState(!!recovering);
  const creationLock = useRef(false);
  const now = useNow();
  const continuing = continuePlanning(data, userId, now);
  const [date, setDate] = useState(
    typeof recovering?.payload.start_date === "string"
      ? recovering.payload.start_date
      : (params.startDate ?? ""),
  );
  const [starter, setStarter] = useState("Custom");
  const [templateId, setTemplateId] = useState(params.template ?? "");
  const intentKey = JSON.stringify([
    params.create,
    params.planSeed,
    params.template,
    params.sourcePlan,
    params.startDate,
    params.timezone,
    params.squadId,
    params.routine,
    params.templates,
  ]);
  const [seenIntent, setSeenIntent] = useState(intentKey);
  if (seenIntent !== intentKey) {
    setSeenIntent(intentKey);
    if (params.templates === "yes") setTemplates(true);
    if (params.create === "yes" && !creating && !creationPending) {
      setCreating(true);
      setTitle(
        data.plan_templates.find((item) => item.id === params.template)
          ?.title ??
          data.plans.find((item) => item.id === params.sourcePlan)?.title ??
          "",
      );
      setDate(params.startDate ?? "");
      setSquad(
        squads.some((item) => item.id === params.squadId)
          ? params.squadId!
          : "Personal",
      );
      setTemplateId(params.template ?? "");
      setStarter("Custom");
      setOptional(false);
    }
  }
  const plans = data.plans.filter(
    (p) =>
      userId &&
      data.viewer_id === userId &&
      !p.routine_source &&
      canReadMapPlan(data, p, userId) &&
      (filter === "All" ||
        (filter === "Personal" ? !p.squad_id : p.squad_id === filter)),
  );
  const creationGuard = useDraftProtection(
    creating && (!!title.trim() || !!date || creationPending),
    () => {
      setCreating(false);
      setTitle("");
      setDate("");
    },
    createBusy || creationPending,
  );
  let timezone =
    (typeof recovering?.payload.timezone === "string"
      ? recovering.payload.timezone
      : params.timezone) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    timezone = "UTC";
  }
  const openNewPlan = () => {
    setTitle("");
    setDate("");
    setStarter("Custom");
    setTemplateId("");
    setOptional(false);
    setSquad(squads.some((s) => s.id === filter) ? filter : "Personal");
    setCreating(true);
  };
  return (
    <ActivityFrame
      title="Plans"
      eyebrow="MAKE SOMETHING HAPPEN"
      create={false}
      scrollRequest={
        revealSequence ? { y: 0, sequence: revealSequence } : undefined
      }
    >
      <ContextTip name="plan" />
      <Chips
        value={filter === "All" || filter === "Personal" ? filter : "Squad"}
        options={["All", "Personal", "Squad"]}
        onChange={(value) =>
          setFilter(value === "Squad" ? (squads[0]?.id ?? "Squad") : value)
        }
      />
      {filter !== "All" && filter !== "Personal" && (
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          {squads.map((s) => (
            <Button
              key={s.id}
              compact
              secondary={filter !== s.id}
              title={s.name}
              onPress={() => setFilter(s.id)}
            />
          ))}
        </View>
      )}
      <ActivityActionBar
        items={[
          {
            label: "New Plan",
            accessibilityLabel: "+ New Plan",
            icon: Plus,
            primary: true,
            onPress: openNewPlan,
          },
          {
            label: "Routines",
            icon: Repeat2,
            onPress: () => router.push("/routines"),
          },
          {
            label: "Templates",
            icon: Sparkles,
            selected: templates,
            onPress: () => setTemplates(!templates),
          },
        ]}
      />
      {templates &&
        data.plan_templates
          .filter((t) => t.owner_id === userId || t.squad_id === squad)
          .map((t) => (
            <Button
              key={t.id}
              secondary
              title={t.title}
              onPress={() => {
                setTemplateId(t.id);
                setTitle(t.title);
                setCreating(true);
              }}
            />
          ))}
      {loading ? (
        <View accessibilityLabel="Loading your Plans">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : error ? (
        <>
          <Txt>{error}</Txt>
          <Action title="Retry Plans" run={refresh} />
        </>
      ) : null}
      {continuing.length > 0 && plans.length > 3 && filter === "All" && (
        <View>
          <Txt>Continue Planning</Txt>
          {continuing.map((plan) => (
            <PlanChoice
              key={plan.id}
              title={plan.title}
              detail={`${planListPresentation(data, plan, userId, now).date} · ${planListPresentation(data, plan, userId, now).context}`}
              icon={Lightbulb}
              onPress={() =>
                router.push({ pathname: "/plan/[id]", params: { id: plan.id } })
              }
            />
          ))}
        </View>
      )}
      {!loading && !error && !plans.length && (
        <SemanticEmpty
          name={filter === "All" ? "empty.plans" : "empty.planFilter"}
          illustration={filter === "All" ? "plans" : undefined}
          density="section"
          personality
          action={
            filter === "All"
              ? { label: "New Plan", onPress: openNewPlan }
              : { label: "Show all Plans", onPress: () => setFilter("All") }
          }
        />
      )}
      {plans.map((plan) => {
        const summary = planListPresentation(data, plan, userId, now);
        return (
          <PlanChoice
            key={plan.id}
            title={plan.title}
            icon={Route}
            detail={`${summary.date} · ${summary.context}\n${summary.progress}`}
            onPress={() =>
              router.push({ pathname: "/plan/[id]", params: { id: plan.id } })
            }
          />
        );
      })}
      <Sheet
        title="New Plan"
        visible={creating}
        onClose={() =>
          creationGuard.close(() => {
            setCreating(false);
            router.setParams({
              create: undefined,
              routine: undefined,
              template: undefined,
              sourcePlan: undefined,
            });
          })
        }
      >
        <Field
          label="Plan name"
          value={title}
          editable={!createBusy && !creationPending}
          onChangeText={setTitle}
          placeholder="Saturday Adventure"
        />
        <Txt>Who’s it for?</Txt>
        <Chips
          value={squads.find((s) => s.id === squad)?.name ?? "Personal"}
          options={["Personal", ...squads.map((s) => s.name)]}
          onChange={(value) =>
            !creation.current &&
            setSquad(squads.find((s) => s.name === value)?.id ?? "Personal")
          }
        />
        {squad !== "Personal" && (
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <Eye size={16} color={styles.muted.color} />
            <Txt muted>
              This Squad can see this Plan. Members can suggest stops;
              organizers manage the itinerary.
            </Txt>
          </View>
        )}
        <Button
          compact
          secondary
          title={
            optional ? "Hide optional details" : "Date & starter · optional"
          }
          disabled={createBusy || creationPending}
          onPress={() => setOptional(!optional)}
        />
        {optional && (
          <>
            <PlanDateField
              label="When? Optional"
              value={date}
              onChange={(value) => {
                if (!creation.current) setDate(value);
              }}
            />
            <Txt>Start with an idea</Txt>
            <Chips
              value={starter}
              options={planStarters.map((s) => s.title)}
              onChange={(value) => {
                if (creation.current) return;
                setStarter(value);
                setTemplateId("");
              }}
            />
          </>
        )}
        {creationPending && !createBusy && (
          <Txt muted>
            Your save needs checking. Use Check saved Plan before starting
            another.
          </Txt>
        )}
        <Action
          title={creationPending ? "Check saved Plan" : "Save Plan"}
          disabled={createBusy}
          run={async () => {
            if (creationLock.current) return;
            if (!title.trim() || title.trim().length > 100)
              throw new Error("Give your Plan a name up to 100 characters.");
            if (date && !isLocalDate(date))
              throw new Error("Choose a valid date or leave it undecided.");
            const source = data.plans.find((p) => p.id === params.sourcePlan);
            const ideas = source
              ? planStops(data, source, userId).map((s) => ({
                  title:
                    stopActivity(data, s, userId)?.title ??
                    stopThread(data, s, userId)?.title ??
                    s.title,
                  details: s.activity_id || s.thread_id ? "" : s.details,
                }))
              : (planStarters
                  .find((s) => s.title === starter)
                  ?.ideas.map((name) => ({ title: name })) ?? []);
            const epoch = getViewerEpoch();
            if (!userId || data.viewer_id !== userId)
              throw new Error("Refresh your account before saving.");
            creation.current ??= {
              id: randomUUID(),
              payload: {
                title,
                timezone,
                start_date: date || null,
                squad_id: squad === "Personal" ? null : squad,
                ...(templateId
                  ? { template_id: templateId }
                  : { stops: ideas }),
              },
            };
            retainPlanCreation(recoveryScope, creation.current);
            setCreationPending(true);
            creationLock.current = true;
            setCreateBusy(true);
            try {
              const result = creation.current.resultId
                ? { id: creation.current.resultId }
                : await act(
                    "create_living_plan",
                    creation.current.payload,
                    creation.current.id,
                  );
              if (epoch !== getViewerEpoch()) return;
              if (typeof result.id !== "string")
                throw new Error(
                  "Could not verify your Plan. Retry to finish saving.",
                );
              creation.current.resultId = result.id;
              await refresh();
              if (epoch !== getViewerEpoch()) return;
              setFilter("All");
              setRevealSequence((value) => value + 1);
              setCreating(false);
              router.setParams({
                create: undefined,
                routine: undefined,
                template: undefined,
                sourcePlan: undefined,
              });
              clearPlanCreation(recoveryScope);
              setCreationPending(false);
              creation.current = null;
              router.push({
                pathname: "/plan/[id]",
                params: {
                  id: result.id,
                  ...(params.routine === "yes" ? { repeat: "yes" } : {}),
                },
              });
            } catch (failure) {
              if (
                (failure as { definitive?: boolean }).definitive ||
                (failure instanceof Error &&
                  failure.message ===
                    "Reconnect to save changes. Nothing was queued.")
              ) {
                clearPlanCreation(recoveryScope);
                setCreationPending(false);
                creation.current = null;
              }
              throw failure;
            } finally {
              creationLock.current = false;
              setCreateBusy(false);
            }
          }}
        />
      </Sheet>
      {creationGuard.dialog}
    </ActivityFrame>
  );
}

export function LivingPlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId, loading, refresh } = useBeacon();
  const plan = data.plans.find((p) => p.id === id);
  if (!plan || !userId || !canReadMapPlan(data, plan, userId))
    return (
      <Screen title="Plan unavailable" eyebrow="PLANS" create={false}>
        {loading ? (
          <View accessibilityLabel="Loading Plan">
            <Skeleton height={90} />
          </View>
        ) : (
          <Empty
            title="This Plan is not available"
            body="Its audience may have changed. Refresh or return to Plans."
          />
        )}
        <Action title="Refresh Plan" run={refresh} />
        <Button title="Plans" onPress={() => router.replace("/plans")} />
      </Screen>
    );
  return <PlanTimeline key={`${userId}:${id}`} planId={id} />;
}

function PlanTimeline({ planId }: { planId: string }) {
  const now = useNow(1000);
  const params = useLocalSearchParams<{ repeat?: string }>();
  const { data, userId, act, getViewerEpoch, refresh } = useBeacon();
  const { styles, semanticColors: c } = useTheme();
  const plan = data.plans.find((p) => p.id === planId)!;
  const access = planPermissions(data, plan, userId);
  const [menu, setMenu] = useState(false),
    [mode, setMode] = useState<"idea" | "activity" | "decision" | null>(null);
  const [editing, setEditing] = useState<PlanStop | null>(null),
    [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState(""),
    [details, setDetails] = useState(""),
    [proposed, setProposed] = useState("");
  const [afterStop, setAfterStop] = useState<string | undefined>();
  const [editRevision, setEditRevision] = useState(0),
    [metaRevision, setMetaRevision] = useState(0);
  const [position, setPosition] = useState<number | undefined>(),
    [more, setMore] = useState(false),
    [review, setReview] = useState(false);
  const [stopMenu, setStopMenu] = useState<string | null>(null);
  const [stopMenuOpen, setStopMenuOpen] = useState(false);
  const [removeStop, setRemoveStop] = useState<{
    stop: PlanStop;
    revision: number;
  } | null>(null);
  const [saveState, setSaveState] = useState("Saved");
  const [conflictReview, setConflictReview] = useState(false);
  const mutationLock = useRef(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [meta, setMeta] = useState(false),
    [planName, setPlanName] = useState(plan.title),
    [planDate, setPlanDate] = useState(plan.start_date ?? "");
  const [repeat, setRepeat] = useState(
      params.repeat === "yes" &&
        planStops(data, plan, userId).some(
          (s) => !!stopActivity(data, s, userId),
        ),
    ),
    [cancel, setCancel] = useState(false);
  const stops = planStops(data, plan, userId, review);
  const menuStop = stops.find((stop) => stop.id === stopMenu);
  const menuIndex = stops.findIndex((stop) => stop.id === stopMenu);
  const joined = data.plan_members.some(
    (m) => m.plan_id === plan.id && m.user_id === userId,
  );
  const squad = data.squads.find((s) => s.id === plan.squad_id);
  const mutate = async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    if (mutationLock.current)
      throw new Error("Wait for the current change to finish.");
    const epoch = getViewerEpoch();
    mutationLock.current = true;
    setMutationBusy(true);
    setSaveState("Saving…");
    try {
      const result = await act(action, {
        plan_id: plan.id,
        revision: plan.revision ?? 0,
        ...payload,
      });
      if (epoch === getViewerEpoch()) setSaveState("Saved");
      return result;
    } catch (failure) {
      if (epoch === getViewerEpoch())
        setSaveState(
          "Couldn’t save · Your edits are still here. Refresh and review before retrying a conflict.",
        );
      throw failure;
    } finally {
      mutationLock.current = false;
      setMutationBusy(false);
    }
  };
  const ideaDirty =
    mode === "idea" &&
    (name !== (editing?.title ?? "") ||
      details !== (editing?.details ?? "") ||
      proposed !== (editing?.proposed_at ?? ""));
  const ideaGuard = useDraftProtection(
    ideaDirty,
    () => {
      setMode(null);
      setEditing(null);
    },
    mutationBusy,
  );

  const metaGuard = useDraftProtection(
    meta && (planName !== plan.title || planDate !== (plan.start_date ?? "")),
    () => setMeta(false),
    mutationBusy,
  );
  const openIdea = (stop?: PlanStop) => {
    setEditRevision(plan.revision ?? 0);
    setEditing(stop ?? null);
    setName(stop?.title ?? "");
    setDetails(stop?.details ?? "");
    setProposed(stop?.proposed_at ?? "");
    setMode("idea");
    setMenu(false);
  };
  const addReference = async (kind: "activity" | "thread", value: string) => {
    await mutate(selected ? "link_plan_stop" : "add_plan_stop", {
      ...(selected
        ? { stop_id: selected }
        : { position, after_stop_id: afterStop }),
      [kind === "activity" ? "activity_id" : "thread_id"]: value,
    });
    setMode(null);
    setSelected(null);
  };
  const createBeacon = () => {
    const token = startCreationDraft(userId);
    const idea = stops.find((s) => s.id === selected);
    for (const [key, value] of Object.entries({
      title: idea?.title ?? "",
      description: idea?.details ?? "",
      audience: plan.squad_id ? "squad" : "private",
      audienceId: plan.squad_id ?? "",
    }))
      setCreationDraftField(userId, token, key, value);
    setMode(null);
    router.push({
      pathname: "/create",
      params: {
        editor: "yes",
        planSession: token,
        returnPlanId: plan.id,
        ...(selected ? { planStopId: selected } : {}),
        ...(position != null ? { stopPosition: String(position) } : {}),
        ...(afterStop ? { stopAfterId: afterStop } : {}),
        ...(plan.squad_id ? { squadId: plan.squad_id } : {}),
        timezone: plan.timezone,
        ...(planSuggestedStart(plan, idea)
          ? { startsAt: planSuggestedStart(plan, idea) }
          : {}),
      },
    });
  };
  const routine = data.plan_routines.find(
    (r) =>
      r.status !== "ended" &&
      r.plan_id ===
        (plan.routine_id
          ? data.plan_routines.find((r) => r.id === plan.routine_id)?.plan_id
          : plan.id),
  );
  return (
    <Screen
      title={plan.title}
      eyebrow={squad?.name ?? "PERSONAL PLAN"}
      create={false}
    >
      <Txt muted>
        {planDateLabel(plan.start_date, now)} ·{" "}
        {data.plan_members.filter((m) => m.plan_id === plan.id).length + 1}{" "}
        following ·{" "}
        {plan.status === "cancelled"
          ? "Cancelled"
          : "Attendance is separate for each Beacon"}
      </Txt>
      {!!plan.description && <Txt>{plan.description}</Txt>}
      <View accessibilityLiveRegion="polite">
        <Txt muted>{saveState}</Txt>
      </View>
      {saveState.startsWith("Couldn’t save") && (
        <Action
          compact
          secondary
          title="Refresh & review saved version"
          run={async () => {
            await refresh();
            setConflictReview(true);
          }}
        />
      )}
      <Sheet
        title="Review saved version"
        visible={conflictReview}
        onClose={() => setConflictReview(false)}
      >
        <Txt>
          {plan.title} · {plan.start_date ?? "Date undecided"}
        </Txt>
        {editing && (
          <>
            <Txt>
              {stops.find((stop) => stop.id === editing.id)?.title ??
                "This idea is no longer available"}
            </Txt>
            <Txt muted>
              {stops.find((stop) => stop.id === editing.id)?.details ?? ""}
            </Txt>
          </>
        )}
        <Txt muted>
          Your unsaved fields remain in the editor. Compare them before choosing
          to save again.
        </Txt>
        <Button
          title="Keep my edits against this version"
          onPress={() => {
            setEditRevision(plan.revision ?? 0);
            setMetaRevision(plan.revision ?? 0);
            setConflictReview(false);
          }}
        />
      </Sheet>

      {access.contribute && (
        <ActivityActionBar
          items={[
            {
              label:
                access.editor || plan.open_collaboration
                  ? "Idea"
                  : "Suggest idea",
              accessibilityLabel:
                access.editor || plan.open_collaboration
                  ? "+ Idea"
                  : "+ Suggest idea",
              icon: Lightbulb,
              primary: true,
              onPress: () =>
                ideaGuard.close(() => {
                  setSelected(null);
                  setPosition(undefined);
                  setAfterStop(undefined);
                  openIdea();
                }),
            },
            ...(access.editor
              ? [
                  {
                    label: "Beacon",
                    accessibilityLabel: "+ Beacon",
                    icon: MapPin,
                    onPress: () =>
                      ideaGuard.close(() => {
                        setSelected(null);
                        setPosition(undefined);
                        setAfterStop(undefined);
                        setMode("activity");
                      }),
                  },
                ]
              : []),
            ...(access.editor &&
            (data.is_demo || data.capabilities?.collaborative_plans)
              ? [
                  {
                    label: "Decide",
                    accessibilityLabel: "+ Decide",
                    icon: MessageCircle,
                    onPress: () =>
                      ideaGuard.close(() => {
                        setSelected(null);
                        setPosition(undefined);
                        setAfterStop(undefined);
                        setMode("decision");
                      }),
                  },
                ]
              : []),
          ]}
        />
      )}
      {mode === "idea" && (
        <View
          testID="plan-inline-idea"
          style={{
            gap: 10,
            padding: 12,
            backgroundColor: c.surfaceRaised,
            borderRadius: 12,
          }}
        >
          <Txt>{editing ? "Edit idea" : "New idea · not saved yet"}</Txt>
          <Field
            label="What could we do?"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Details · optional"
            value={details}
            onChangeText={setDetails}
            multiline
          />
          {proposed ? (
            <ZonedTimeField
              label="Proposed time"
              value={proposed}
              timezone={plan.timezone}
              onChange={setProposed}
            />
          ) : (
            <Button
              compact
              secondary
              title="Propose a time"
              onPress={() =>
                setProposed(new Date(Date.now() + 86400000).toISOString())
              }
            />
          )}
          <Button
            compact
            secondary
            title="Decide time later"
            onPress={() => setProposed("")}
          />
          {!!proposed &&
            data.activities.some(
              (a) =>
                a.status === "scheduled" &&
                (a.owner_id === userId ||
                  data.rsvps.some(
                    (r) =>
                      r.activity_id === a.id &&
                      r.user_id === userId &&
                      r.status === "going",
                  )) &&
                Date.parse(a.starts_at) <= Date.parse(proposed) &&
                Date.parse(a.ends_at) > Date.parse(proposed),
            ) && (
              <Txt muted>
                This proposed time overlaps an activity on your calendar.
              </Txt>
            )}
          <Action
            title={
              editing
                ? "Save changes"
                : access.editor || plan.open_collaboration
                  ? "Add idea"
                  : "Suggest idea"
            }
            run={async () => {
              await mutate(editing ? "edit_plan_stop" : "add_plan_stop", {
                ...(editing
                  ? { stop_id: editing.id, revision: editRevision }
                  : { position, after_stop_id: afterStop }),
                title: name,
                details,
                proposed_at: proposed || null,
              });
              setMode(null);
              setEditing(null);
            }}
          />
          <Button
            compact
            secondary
            title="Cancel edit"
            onPress={() =>
              ideaGuard.close(() => {
                setMode(null);
                setEditing(null);
              })
            }
          />
        </View>
      )}

      {ideaGuard.dialog}
      {metaGuard.dialog}

      {plan.routine_id && (
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          <Txt muted>This occurrence · Edit its Beacons individually</Txt>
          {access.editor && (
            <Button
              compact
              secondary
              title="This occurrence"
              onPress={() => {
                setPlanName(plan.title);
                setPlanDate(plan.start_date ?? "");
                setMetaRevision(plan.revision ?? 0);
                setMeta(true);
              }}
            />
          )}
          <Button
            compact
            secondary
            title="Future repeats"
            icon={<Repeat2 size={16} color={c.accent} />}
            onPress={() =>
              router.push({
                pathname: "/routines",
                params: { planId: routine?.plan_id ?? "" },
              })
            }
          />
        </View>
      )}
      <PlanProgress
        confirmed={stops.filter((s) => !!stopActivity(data, s, userId)).length}
        ideas={stops.filter((s) => !s.activity_id && !s.thread_id).length}
        decisions={stops.filter((s) => s.thread_id && !s.activity_id).length}
      />
      {plan.squad_id && !access.owner && access.contribute && (
        <Action
          compact
          secondary
          title={joined ? "Leave Plan" : "Join Plan"}
          run={() =>
            act(joined ? "leave_plan" : "join_plan", { plan_id: plan.id })
          }
        />
      )}
      {stops.some((s) => s.approval === "pending") && (
        <Txt muted>
          {access.review
            ? "A new idea needs your review"
            : "New suggestions are waiting for an organizer"}
        </Txt>
      )}
      {!stops.length && (
        <SemanticEmpty name="empty.planStops" density="inline" />
      )}
      {stops.map((stop, index) => {
        const activity = stopActivity(data, stop, userId),
          thread = stopThread(data, stop, userId);
        const unavailable = !!(
          (stop.activity_id && !activity) ||
          (stop.thread_id && !thread)
        );
        const title = unavailable
          ? "Activity unavailable"
          : (activity?.title ?? thread?.title ?? stop.title) ||
            "Activity unavailable";
        const timing =
          activity?.plan_started_at === null
            ? `${activity.plan_step?.start_mode === "after_previous" ? "After previous ends" : "Waiting for manual start"}${activity.plan_step?.start_time ? ` · around ${activity.plan_step.start_time}` : ""}`
            : activity
              ? new Date(activity.starts_at).toLocaleString([], {
                  timeZone: plan.timezone,
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "";
        const expanded = selected === stop.id;
        return (
          <View
            key={stop.id}
            style={{
              borderLeftWidth: 2,
              borderLeftColor: expanded ? c.accent : c.border,
              backgroundColor: expanded ? c.surfaceRaised : "transparent",
              borderRadius: 10,
              paddingLeft: 14,
              paddingVertical: 8,
              gap: 6,
              opacity:
                stop.approval === "dismissed" || stop.state === "skipped"
                  ? 0.65
                  : 1,
            }}
          >
            <TimelineHeading
              title={title}
              index={index}
              kind={activity ? "beacon" : thread ? "decision" : "idea"}
              pending={stop.approval === "pending"}
              expanded={expanded}
              onPress={() => setSelected(expanded ? null : stop.id)}
            />
            <Txt muted>
              {stop.approval === "pending"
                ? "Pending approval · "
                : stop.approval === "dismissed"
                  ? "Dismissed · "
                  : ""}
              {stop.state === "skipped"
                ? "Skipped"
                : unavailable
                  ? "No longer shared with you"
                  : activity
                    ? `${activity.status === "completed" ? "Completed" : activity.status === "cancelled" ? "Cancelled" : "Linked Beacon"} · ${timing} · ${data.rsvps.filter((r) => r.activity_id === activity.id && r.status === "going").length} Going`
                    : thread
                      ? `${thread.kind === "time" ? "Find a Time" : thread.kind === "ping" ? "Ping" : thread.kind === "draw" ? "Draw" : thread.vote_method === "approval" ? "Approval Vote" : "Pick One Vote"} · ${thread.not_organized_at ? "Not organized" : thread.finalized_at && !thread.materialized_activity_id ? "Selected · awaiting confirmation" : thread.status === "open" ? "Open" : thread.status === "no_options" ? "No eligible options" : thread.status === "resolved" ? "Resolved" : thread.status === "cancelled" ? "Cancelled" : "Closed"}${thread.materialized_activity_id ? " · Result ready" : ""}`
                      : `Idea${stop.proposed_at ? ` · Proposed ${new Date(stop.proposed_at).toLocaleString()}` : " · Still deciding"}`}
            </Txt>
            {access.review && stop.approval === "pending" && (
              <View style={styles.row}>
                <Action
                  compact
                  title="Approve"
                  run={() =>
                    mutate("review_plan_stop", {
                      stop_id: stop.id,
                      approval: "approved",
                    })
                  }
                />
                <Action
                  compact
                  secondary
                  title="Dismiss"
                  run={() =>
                    mutate("review_plan_stop", {
                      stop_id: stop.id,
                      approval: "dismissed",
                    })
                  }
                />
              </View>
            )}
            {activity && (
              <Button
                compact
                secondary
                title="Open Beacon"
                onPress={() =>
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: activity.id },
                  })
                }
              />
            )}
            {!activity &&
              !thread &&
              !unavailable &&
              access.editor &&
              stop.state === "active" && (
                <View style={[styles.row, { flexWrap: "wrap" }]}>
                  <Button
                    compact
                    secondary
                    title="Edit idea"
                    onPress={() => ideaGuard.close(() => openIdea(stop))}
                  />
                  <Button
                    compact
                    title="Make it happen"
                    onPress={() =>
                      ideaGuard.close(() => {
                        setSelected(stop.id);
                        setMode("activity");
                      })
                    }
                  />
                </View>
              )}
            {expanded && (
              <>
                {!unavailable && !activity && !thread && !!stop.details && (
                  <Txt>{stop.details}</Txt>
                )}
                {thread && (
                  <PlanningResponseControls
                    threadId={thread.id}
                    onOpen={() =>
                      router.push({
                        pathname: "/council/[id]",
                        params: { id: thread.id },
                      })
                    }
                  />
                )}
                {thread && (
                  <ConnectedPlanningActions
                    thread={thread}
                    returnPlanId={plan.id}
                  />
                )}
                {thread && (
                  <Button
                    compact
                    secondary
                    title="Decision details & organizer tools"
                    onPress={() =>
                      router.push({
                        pathname: "/council/[id]",
                        params: { id: thread.id },
                      })
                    }
                  />
                )}
                {activity?.owner_id === userId &&
                  activity.status === "scheduled" &&
                  activity.plan_id && (
                    <>
                      {activity.plan_started_at === null && (
                        <Action
                          compact
                          title="Start Beacon"
                          disabled={
                            activity.plan_step?.start_mode ===
                              "after_previous" &&
                            !data.activities.some(
                              (a) =>
                                a.plan_id === activity.plan_id &&
                                a.plan_step_index ===
                                  (activity.plan_step_index ?? 0) - 1 &&
                                (a.status === "completed" ||
                                  (!!a.plan_started_at &&
                                    a.plan_step?.end_mode !== "manual" &&
                                    Date.parse(a.ends_at) <= now)),
                            )
                          }
                          run={() =>
                            act("start_plan_beacon", { id: activity.id })
                          }
                        />
                      )}
                      {activity.plan_started_at !== null &&
                        Date.parse(activity.starts_at) <= now && (
                          <Action
                            compact
                            secondary
                            title="End Beacon"
                            run={() =>
                              act("end_plan_beacon", { id: activity.id })
                            }
                          />
                        )}
                    </>
                  )}
                {access.editor && access.contribute && (
                  <IconButton
                    label="Stop options"
                    onPress={() => {
                      setStopMenu(stop.id);
                      setStopMenuOpen(true);
                    }}
                  >
                    <MoreHorizontal size={18} color={c.textSecondary} />
                  </IconButton>
                )}
              </>
            )}
          </View>
        );
      })}
      {menuStop && access.editor && access.contribute && (
        <QuickChoiceDialog
          title="Stop options"
          visible={stopMenuOpen}
          onClose={() => setStopMenuOpen(false)}
          onDismiss={() => setStopMenu(null)}
          items={[
            ...(!menuStop.activity_id && !menuStop.thread_id
              ? [
                  {
                    label: "Duplicate idea",
                    icon: <Copy size={18} color={c.textSecondary} />,
                    onPress: () => {
                      void mutate("add_plan_stop", {
                        title: menuStop.title,
                        details: menuStop.details,
                        proposed_at: menuStop.proposed_at,
                        position: menuStop.position + 1,
                      }).catch(() => {});
                    },
                  },
                ]
              : []),
            ...(menuIndex > 0
              ? [
                  {
                    label: "Move up",
                    icon: <ArrowUp size={18} color={c.textSecondary} />,
                    onPress: () => {
                      void mutate("move_plan_stop", {
                        stop_id: menuStop.id,
                        position: stops[menuIndex - 1].position,
                      }).catch(() => {});
                    },
                  },
                ]
              : []),
            ...(menuIndex < stops.length - 1
              ? [
                  {
                    label: "Move down",
                    icon: <ArrowDown size={18} color={c.textSecondary} />,
                    onPress: () => {
                      void mutate("move_plan_stop", {
                        stop_id: menuStop.id,
                        position: stops[menuIndex + 1].position,
                      }).catch(() => {});
                    },
                  },
                ]
              : []),
            {
              label: "Insert after",
              icon: <Plus size={18} color={c.textSecondary} />,
              onPress: () => {
                setSelected(null);
                setPosition(menuStop.position + 1);
                setAfterStop(menuStop.id);
                setMenu(true);
              },
            },
            {
              label:
                menuStop.activity_id || menuStop.thread_id
                  ? "Remove from Plan"
                  : "Remove idea",
              destructive: true,
              icon: <Trash2 size={18} color={c.danger} />,
              onPress: () =>
                setRemoveStop({ stop: menuStop, revision: plan.revision ?? 0 }),
            },
          ]}
        />
      )}
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        <Button
          compact
          secondary
          icon={<Map size={16} color={c.textSecondary} />}
          title="Map"
          onPress={() =>
            router.push({ pathname: "/", params: { mapPlan: plan.id } })
          }
        />
        <Button
          compact
          secondary
          icon={<CalendarDays size={16} color={c.textSecondary} />}
          title="Calendar"
          onPress={() =>
            router.push({
              pathname: "/calendar",
              params: plan.start_date ? { date: plan.start_date } : {},
            })
          }
        />
        {access.review &&
          access.contribute &&
          (data.is_demo || data.capabilities?.repeatable_plans) && (
            <Button
              compact
              secondary
              icon={<Repeat2 size={16} color={c.textSecondary} />}
              title="Repeat"
              onPress={() => setRepeat(true)}
            />
          )}
        <Button
          compact
          secondary
          icon={<MoreHorizontal size={16} color={c.textSecondary} />}
          title="More"
          onPress={() => ideaGuard.close(() => setMore(true))}
        />
        {routine && !plan.routine_id && (
          <Button
            compact
            secondary
            title="Open Routine tools"
            icon={<Repeat2 size={16} color={c.accent} />}
            onPress={() =>
              router.push({
                pathname: "/routines",
                params: { planId: routine.plan_id },
              })
            }
          />
        )}
      </View>
      <Sheet title="Add Stop" visible={menu} onClose={() => setMenu(false)}>
        {access.editor && (
          <>
            <PlanChoice
              title="Add Activity"
              detail="Create a Beacon or bring one into your adventure"
              icon={MapPin}
              onPress={() => {
                setMenu(false);
                setMode("activity");
              }}
            />
            {(data.is_demo || data.capabilities?.collaborative_plans) && (
              <PlanChoice
                title="Decide Together"
                detail="Check interest, choose an activity, or find a time"
                icon={MessageCircle}
                onPress={() => {
                  setMenu(false);
                  setMode("decision");
                }}
              />
            )}
          </>
        )}
        <PlanChoice
          title="Save an Idea"
          detail="A thought, a maybe, a place worth trying"
          icon={Lightbulb}
          onPress={() => openIdea()}
        />
      </Sheet>
      <Sheet
        title="Add Activity"
        visible={mode === "activity"}
        onClose={() => setMode(null)}
      >
        <Button title="Create Beacon" onPress={createBeacon} />
        <Txt muted>
          Choose an existing Beacon. Its audience and attendance stay the same.
        </Txt>
        {data.activities
          .filter(
            (a) =>
              userId &&
              a.status !== "cancelled" &&
              compatiblePlanActivity(data, plan, a, userId) &&
              !stops.some((s) => s.activity_id === a.id),
          )
          .map((a) => (
            <Action
              key={a.id}
              secondary
              title={a.title}
              run={() => addReference("activity", a.id)}
            />
          ))}
      </Sheet>
      <Sheet
        title="Decide Together"
        visible={mode === "decision"}
        onClose={() => setMode(null)}
      >
        {(
          [
            ["ping", "Ping"],
            ["vote", "Pick One / Approval Vote"],
            ["draw", "Surprise Us · Draw"],
            ["time", "Find a Time"],
          ] as const
        ).map(([kind, label]) => (
          <PlanChoice
            key={kind}
            title={label}
            icon={
              kind === "ping"
                ? MessageCircle
                : kind === "time"
                  ? CalendarDays
                  : kind === "draw"
                    ? Sparkles
                    : ListChecks
            }
            detail={
              kind === "ping"
                ? "Check interest without committing attendance"
                : kind === "time"
                  ? "Find a time that works together"
                  : kind === "draw"
                    ? "Choose from the group's alternatives"
                    : "Compare choices and pick together"
            }
            onPress={() => {
              setMode(null);
              router.push({
                pathname: "/planning/create",
                params: {
                  kind,
                  sessionId: randomUUID(),
                  returnPlanId: plan.id,
                  ...(selected ? { planStopId: selected } : {}),
                  ...(afterStop ? { planAfterStopId: afterStop } : {}),
                  ...(plan.squad_id
                    ? { squadId: plan.squad_id }
                    : { planAudience: "private" }),
                  timezone: plan.timezone,
                  startsAt: planSuggestedStart(
                    plan,
                    stops.find((s) => s.id === selected),
                  ),
                },
              });
            }}
          />
        ))}
        <Txt muted>Or link an existing decision</Txt>
        {data.planning_threads
          .filter(
            (t) =>
              userId &&
              canReadPlanningThread(data, t, userId) &&
              (!plan.squad_id ||
                (t.audience === "squad" && t.audience_id === plan.squad_id)) &&
              !stops.some((s) => s.thread_id === t.id),
          )
          .map((t) => (
            <Action
              key={t.id}
              secondary
              title={t.title}
              run={() => addReference("thread", t.id)}
            />
          ))}
      </Sheet>
      <Sheet title="Plan tools" visible={more} onClose={() => setMore(false)}>
        {access.editor && (
          <>
            <Button
              secondary
              title="Edit Plan details"
              onPress={() => {
                setPlanName(plan.title);
                setPlanDate(plan.start_date ?? "");
                setMetaRevision(plan.revision ?? 0);
                setMeta(true);
                setMore(false);
              }}
            />
            <Action
              secondary
              title="Save as My Template"
              run={() => mutate("save_living_plan_template")}
            />
          </>
        )}
        {squad && (
          <Action
            secondary
            title="Share in Squad chat"
            run={async () => {
              await act("send_group_message", {
                scope: "squad",
                squad_id: squad.id,
                body: `Plan: ${plan.title}`,
                plan_id: plan.id,
              });
              setMore(false);
            }}
          />
        )}
        <Button
          secondary
          title={
            review
              ? "Hide dismissed suggestions"
              : "Review dismissed suggestions"
          }
          onPress={() => {
            setReview(!review);
            setMore(false);
          }}
        />
        {access.owner && plan.squad_id && (
          <>
            <Action
              secondary
              title={`Open Collaboration · ${plan.open_collaboration ? "On" : "Off"}`}
              run={() =>
                mutate("update_living_plan", {
                  open_collaboration: !plan.open_collaboration,
                })
              }
            />
            <Txt muted>
              Members can add tentative ideas. Published activities still need
              their organizer.
            </Txt>
            <Txt>Plan co-owners</Txt>
            {data.squad_members
              .filter(
                (m) =>
                  m.squad_id === plan.squad_id && m.user_id !== plan.owner_id,
              )
              .map((m) => (
                <Action
                  key={m.user_id}
                  secondary
                  title={`${plan.coowner_ids?.includes(m.user_id) ? "✓ " : ""}${data.profiles.find((p) => p.id === m.user_id)?.name ?? "Squad member"}`}
                  run={() =>
                    mutate("update_living_plan", {
                      coowner_ids: plan.coowner_ids?.includes(m.user_id)
                        ? plan.coowner_ids.filter((v) => v !== m.user_id)
                        : [...(plan.coowner_ids ?? []), m.user_id],
                    })
                  }
                />
              ))}
          </>
        )}
        {access.owner && access.contribute && (
          <Button
            secondary
            title="Cancel Plan…"
            onPress={() => {
              setMore(false);
              setCancel(true);
            }}
          />
        )}
      </Sheet>
      <Sheet
        title={plan.routine_id ? "Edit this occurrence" : "Edit Plan details"}
        visible={meta}
        onClose={() => metaGuard.close(() => setMeta(false))}
      >
        <Field label="Plan name" value={planName} onChangeText={setPlanName} />
        <PlanDateField
          label="Plan date · optional"
          value={planDate}
          onChange={setPlanDate}
        />
        <Txt muted>
          Changing Plan details does not change published Beacon times.
        </Txt>
        <Action
          title="Save Plan"
          run={async () => {
            if (planDate && !isLocalDate(planDate))
              throw new Error("Choose a valid date.");
            await mutate("update_living_plan", {
              title: planName,
              revision: metaRevision,
              start_date: planDate || null,
            });
            setMeta(false);
          }}
        />
      </Sheet>
      <RoutineScheduleSheet
        key={`${plan.id}:${routine?.id ?? "new"}`}
        plan={plan}
        routine={plan.routine_id ? undefined : routine}
        visible={repeat}
        stepSchedule={stops
          .filter((s) => s.approval === "approved")
          .map((s) => stopActivity(data, s, userId)?.title ?? s.title)}
        act={act}
        onClose={() => setRepeat(false)}
      />
      <ConfirmDialog
        title="Remove this stop?"
        message="Linked Beacons and decisions remain available separately."
        visible={!!removeStop}
        confirmLabel="Remove from Plan"
        cancelLabel="Keep stop"
        destructive
        onClose={() => setRemoveStop(null)}
        onConfirm={async () => {
          if (removeStop)
            await mutate("remove_plan_stop", {
              stop_id: removeStop.stop.id,
              revision: removeStop.revision,
            });
          setRemoveStop(null);
        }}
      />
      <ConfirmDialog
        title="Cancel this Plan?"
        visible={cancel}
        onClose={() => setCancel(false)}
        confirmLabel="Cancel Plan only"
        cancelLabel="Keep Plan"
        onConfirm={async () => {
          await mutate("update_living_plan", { cancel: true });
          setCancel(false);
        }}
        destructive
      >
        <Txt>
          Published Beacons stay unchanged. Open each Beacon to review and
          cancel it with its own organizer controls.
        </Txt>
      </ConfirmDialog>
    </Screen>
  );
}
