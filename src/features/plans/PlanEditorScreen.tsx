import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import {
  router,
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Lightbulb,
  MessageCircle,
  ListChecks,
  CalendarDays,
  GripVertical,
  MoreHorizontal,
  Plus,
  Radio,
  Repeat2,
  Sparkles,
  X,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Field,
  IconButton,
  Screen,
  Sheet,
  Chips,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { ActivityActionBar } from "@/src/features/activity/ActivityActionBar";
import { PlanChoice } from "./PlanPresentation";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { QuickChoiceDialog, ConfirmDialog } from "@/src/shared/Dialogs";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import {
  startCreationDraft,
  restoreCreationDraft,
  setCreationDraftField,
} from "@/src/features/beacons/socialPlanningSession";
import { canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";
import type { Plan } from "@/src/shared/types";
import {
  compatiblePlanActivity,
  planPermissions,
  planStops,
  stopActivity,
} from "./livingPlans";
import {
  planEditorFromData,
  editorStopsFromTemplate,
  validatePlanEditor,
  type EditorStop,
  type PlanEditorDraft,
} from "./planEditorModel";
import {
  cachedPlanDraft,
  deletePlanDraft,
  planDraftKey,
  readPlanDraft,
  writePlanDraft,
} from "./planEditorStorage";
import PlanDateField from "./PlanDateField";
import { RoutineScheduleSheet } from "./RoutineScheduleSheet";
import { PlanPreparation } from "./PlanPreparation";
function InlineLink({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  const { semanticColors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon}
      <Text style={{ color: c.accent, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
function ReorderRow({
  stop,
  index,
  count,
  move,
  selected,
  onSelect,
}: {
  stop: EditorStop;
  index: number;
  count: number;
  move: (from: number, to: number) => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const { semanticColors: c } = useTheme();
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderRelease: (_, gesture) => {
          const to = Math.max(
            0,
            Math.min(count - 1, index + Math.round(gesture.dy / 64)),
          );
          if (to !== index) move(index, to);
        },
      }),
    [index, count, move],
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 64,
        borderBottomWidth: 1,
        borderColor: c.border,
      }}
    >
      <View
        {...drag.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Drag ${stop.title} to reorder`}
        accessibilityActions={[
          { name: "increment", label: "Move down" },
          { name: "decrement", label: "Move up" },
        ]}
        onAccessibilityAction={(event) =>
          move(
            index,
            Math.max(
              0,
              Math.min(
                count - 1,
                index + (event.nativeEvent.actionName === "increment" ? 1 : -1),
              ),
            ),
          )
        }
        style={{ padding: 12 }}
      >
        <GripVertical size={20} color={c.textSecondary} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reorder item ${index + 1}. ${stop.title}`}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
      >
        <Text
          numberOfLines={1}
          style={{ color: c.textPrimary, fontWeight: "600" }}
        >
          {index + 1}. {stop.title}
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          {stop.kind === "decision"
            ? "Decision"
            : stop.kind === "idea"
              ? "Idea"
              : "Beacon"}
        </Text>
      </Pressable>
      {selected && (
        <>
          <IconButton
            label={`Move ${stop.title} up`}
            disabled={index === 0}
            onPress={() => move(index, index - 1)}
          >
            <ArrowUp size={17} color={c.accent} />
          </IconButton>
          <IconButton
            label={`Move ${stop.title} down`}
            disabled={index === count - 1}
            onPress={() => move(index, index + 1)}
          >
            <ArrowDown size={17} color={c.accent} />
          </IconButton>
        </>
      )}
    </View>
  );
}
export default function PlanEditorScreen() {
  const account = useBeacon();
  const params = useLocalSearchParams<{
    id?: string;
    draftId?: string;
    beaconId?: string;
    template?: string;
    sourcePlan?: string;
    squadId?: string;
    startDate?: string;
    timezone?: string;
    repeat?: string;
    choosePlan?: string;
  }>();
  const [token] = useState(
    () => params.draftId ?? (params.id ? `plan:${params.id}` : randomUUID()),
  );
  useEffect(() => {
    if (!params.id && !params.draftId) router.setParams({ draftId: token });
  }, [params.id, params.draftId, token]);
  const plan = account.data.plans.find((p) => p.id === params.id);
  if (!account.userId || account.data.viewer_id !== account.userId)
    return (
      <Screen title="Plan" eyebrow="YOUR PLANS" create={false}>
        <Txt>Loading your Plan…</Txt>
      </Screen>
    );
  if (!account.data.is_demo && !account.data.capabilities?.plan_editor)
    return <Redirect href="/plans?create=yes" />;
  if (
    params.id &&
    (!plan || !planPermissions(account.data, plan, account.userId).editor)
  )
    return (
      <Screen title="Plan unavailable" eyebrow="YOUR PLANS" create={false}>
        <Txt>This Plan cannot be edited by this account.</Txt>
      </Screen>
    );
  return (
    <Editor
      key={`${account.userId}:${account.demo}:${token}`}
      token={token}
      plan={plan}
      params={params}
    />
  );
}
function Editor({
  token,
  plan,
  params,
}: {
  token: string;
  plan?: Plan;
  params: {
    beaconId?: string;
    template?: string;
    sourcePlan?: string;
    squadId?: string;
    startDate?: string;
    timezone?: string;
    repeat?: string;
    choosePlan?: string;
  };
}) {
  const { data, userId, demo, act, getViewerEpoch, refresh, getCurrentData } =
    useBeacon();
  const viewer = userId!;
  const { styles, semanticColors: c } = useTheme();
  const storageViewer = demo
    ? `${viewer}:${data.demo_session_id ?? "fixture"}`
    : viewer;
  const key = planDraftKey(storageViewer, demo, token);
  const initial = (): PlanEditorDraft =>
    plan
      ? planEditorFromData(data, plan, viewer, token)
      : {
          version: 1,
          token,
          revision: 0,
          title: "",
          description: "",
          timezone:
            params.timezone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone ??
            "UTC",
          start_date: params.startDate ?? "",
          squad_id: params.squadId ?? null,
          removed_stop_ids: [],
          stops: [],
        };
  const [draft, setDraft] = useState<PlanEditorDraft>(
    () => cachedPlanDraft(key) ?? initial(),
  );
  const current = useRef(draft);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [choosePlan, setChoosePlan] = useState(params.choosePlan === "yes");
  const [picker, setPicker] = useState<
      "existing" | "templates" | "decisions" | null
    >(null),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(8);
  const [composer, setComposer] = useState<"beacon" | "decision" | null>(null),
    [decisionTab, setDecisionTab] = useState("Create new");
  const [reordering, setReordering] = useState(false),
    [reorderRows, setReorderRows] = useState<EditorStop[]>([]),
    [reorderSelected, setReorderSelected] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [rowMenu, setRowMenu] = useState<string | null>(null),
    [tools, setTools] = useState(false),
    [discard, setDiscard] = useState(false);
  const [scheduling, setScheduling] = useState(false),
    [options, setOptions] = useState(false),
    [repeat, setRepeat] = useState(params.repeat === "yes"),
    [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<PlanEditorDraft | null>(null);
  const lock = useRef(false);
  const update = (next: PlanEditorDraft) => {
    if (current.current.request && next.request === current.current.request) {
      setError(
        "Check the pending save before editing. Your draft is preserved.",
      );
      return;
    }
    current.current = next;
    setDraft(next);
    setNotice("");
    void writePlanDraft(key, next).catch((e) =>
      setError(
        e instanceof Error ? e.message : "Draft storage is unavailable.",
      ),
    );
  };
  const provisional: Plan = useMemo(
    () =>
      plan ?? {
        id: "draft",
        owner_id: viewer,
        squad_id: draft.squad_id,
        title: draft.title,
        description: draft.description,
        timezone: draft.timezone,
        start_date: draft.start_date || null,
        status: "draft",
        created_at: new Date().toISOString(),
      },
    [
      plan,
      viewer,
      draft.squad_id,
      draft.title,
      draft.description,
      draft.timezone,
      draft.start_date,
    ],
  );
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const epoch = getViewerEpoch();
      void readPlanDraft(key)
        .then((saved) => {
          if (!alive || epoch !== getViewerEpoch()) return;
          if (saved) {
            if (saved.handoff === "decision") {
              const savedId = saved.plan_id;
              const latest = data.plans.find((p) => p.id === savedId);
              if (latest && planPermissions(data, latest, viewer).editor) {
                saved = planEditorFromData(data, latest, viewer, token);
                void writePlanDraft(key, saved);
              }
            }
            const a = data.activities.find((a) => a.id === params.beaconId);
            if (
              a &&
              !saved.stops.some((s) => s.activity_id === a.id) &&
              compatiblePlanActivity(data, provisional, a, viewer)
            )
              saved = {
                ...saved,
                stops: [
                  ...saved.stops,
                  {
                    id: randomUUID(),
                    kind: "existing",
                    title: a.title,
                    details: "",
                    activity_id: a.id,
                  },
                ],
              };
            current.current = saved;
            setDraft(saved);
          } else if (params.template) {
            const template = data.plan_templates.find(
              (t) =>
                t.id === params.template &&
                (t.owner_id === viewer ||
                  (!!current.current.squad_id &&
                    t.squad_id === current.current.squad_id)),
            );
            if (template) {
              const next = {
                ...current.current,
                title: template.title,
                description: template.description,
                stops: editorStopsFromTemplate(
                  template,
                  current.current.squad_id,
                  randomUUID,
                ),
              };
              current.current = next;
              setDraft(next);
              void writePlanDraft(key, next);
            }
          } else if (params.sourcePlan) {
            const source = data.plans.find((p) => p.id === params.sourcePlan);
            if (source && planPermissions(data, source, viewer).readable) {
              const next = {
                ...current.current,
                title: source.title,
                description: source.description ?? "",
                stops: planStops(data, source, viewer).map((s) => ({
                  id: randomUUID(),
                  kind: "idea" as const,
                  title: stopActivity(data, s, viewer)?.title ?? s.title,
                  details: s.activity_id || s.thread_id ? "" : s.details,
                })),
              };
              current.current = next;
              setDraft(next);
              void writePlanDraft(key, next);
            }
          } else if (params.beaconId) {
            const a = data.activities.find((a) => a.id === params.beaconId);
            if (
              a &&
              a.status !== "cancelled" &&
              compatiblePlanActivity(data, provisional, a, viewer)
            ) {
              const next = {
                ...current.current,
                title: a.title,
                stops: [
                  {
                    id: randomUUID(),
                    kind: "existing" as const,
                    title: a.title,
                    details: "",
                    activity_id: a.id,
                  },
                ],
              };
              current.current = next;
              setDraft(next);
              void writePlanDraft(key, next);
            }
          }
          setLoaded(true);
        })
        .catch((e) => {
          if (alive) {
            setError(e.message);
            setLoaded(true);
          }
        });
      return () => {
        alive = false;
      };
      // Account-scoped durable state owns unsaved fields; snapshots never overwrite them on refresh.
    }, [
      key,
      getViewerEpoch,
      data,
      params.beaconId,
      params.template,
      params.sourcePlan,
      token,
      viewer,
      provisional,
    ]),
  );
  const changeStop = (id: string, changes: Partial<EditorStop>) =>
    update({
      ...draft,
      stops: draft.stops.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    });
  const moveReorder = useCallback(
    (from: number, to: number) =>
      setReorderRows((rows) => {
        const next = [...rows];
        const [row] = next.splice(from, 1);
        next.splice(to, 0, row);
        return next;
      }),
    [],
  );
  const addIdea = () => {
    const row: EditorStop = {
      id: randomUUID(),
      kind: "idea",
      title: "",
      details: "",
    };
    update({ ...draft, stops: [...draft.stops, row] });
    setSelected(row.id);
    setComposer(null);
  };
  const editBeacon = async (stop?: EditorStop) => {
    setComposer(null);
    setPicker(null);
    const id = stop?.id ?? randomUUID();
    const next = stop
      ? draft
      : {
          ...draft,
          stops: [
            ...draft.stops,
            {
              id,
              kind: "beacon" as const,
              title: "New Beacon",
              details: "",
              beacon: {},
              include: false,
            },
          ],
        };
    await writePlanDraft(key, next);
    current.current = next;
    setDraft(next);
    const session = stop?.creation_token ?? startCreationDraft(viewer);
    if (stop?.creation_token) {
      try {
        await restoreCreationDraft(viewer, stop.creation_token);
      } catch {
        /* In-session fields remain available until their first durable checkpoint. */
      }
    }
    const retained = {
      ...next,
      stops: next.stops.map((s) =>
        s.id === id ? { ...s, creation_token: session } : s,
      ),
    };
    await writePlanDraft(key, retained);
    current.current = retained;
    setDraft(retained);
    const values = stop?.beacon ?? {
      title: stop?.title ?? "",
      description: stop?.details ?? "",
      audience: draft.squad_id ? "squad" : "private",
      audienceId: draft.squad_id ?? "",
    };
    const beacon = stop?.beacon;
    if (beacon)
      setCreationDraftField(viewer, session, "planBeaconPayload", beacon);
    const mapped = beacon
      ? {
          ...values,
          audienceId: beacon.audience_id ?? "",
          starts: beacon.starts_at,
          ends: beacon.ends_at,
          when: "Pick time",
          duration:
            beacon.starts_at && beacon.ends_at
              ? `${Math.max(5, Math.round((Date.parse(String(beacon.ends_at)) - Date.parse(String(beacon.starts_at))) / 60000))} min`
              : undefined,
          approval: beacon.approval_required ? "Host approval" : "Open joining",
          target: beacon.target_count ? String(beacon.target_count) : "",
          url: beacon.online_url ?? "",
          placeType: beacon.online_url ? "Online" : "In person",
          pin:
            beacon.latitude != null && beacon.longitude != null
              ? { latitude: beacon.latitude, longitude: beacon.longitude }
              : null,
          aspirationIds: beacon.aspiration_ids ?? [],
        }
      : values;
    for (const [field, value] of (stop?.creation_token
      ? []
      : Object.entries(mapped)
    ).filter(([, value]) => value !== undefined))
      setCreationDraftField(viewer, session, field, value);
    router.push({
      pathname: "/create",
      params: {
        editor: "yes",
        planSession: session,
        planDraftKey: key,
        planDraftStopId: id,
        timezone: draft.timezone,
        ...(Array.isArray(beacon?.invitee_ids)
          ? { inviteeIds: JSON.stringify(beacon.invitee_ids) }
          : {}),
        ...(beacon?.starts_at ? { startsAt: String(beacon.starts_at) } : {}),
        ...(draft.squad_id ? { squadId: draft.squad_id } : {}),
      },
    } as Href);
  };
  const persist = async (schedule = false) => {
    if (lock.current) throw new Error("Wait for the current save to finish.");
    validatePlanEditor(current.current);
    lock.current = true;
    setBusy(true);
    setError("");
    const epoch = getViewerEpoch();
    try {
      let next = current.current;
      if (!next.request) {
        next = {
          ...next,
          request: {
            id: randomUUID(),
            payload: {
              ...next,
              action: schedule ? "schedule_plan_editor" : "save_plan_editor",
            },
          },
        };
        update(next);
      }
      await writePlanDraft(key, next);
      const request = next.request!;
      const result = await act(
        String(request.payload.action),
        request.payload,
        request.id,
      );
      if (epoch !== getViewerEpoch()) return;
      if (typeof result.id !== "string" || typeof result.revision !== "number")
        throw new Error(
          "The saved Plan could not be verified. Check the pending save before continuing.",
        );
      const id = String(result.id),
        publications = (result.publications ?? {}) as Record<string, string>;
      const saved: PlanEditorDraft = {
        ...next,
        plan_id: id,
        revision: Number(result.revision ?? 0),
        request: undefined,
        removed_stop_ids: [],
        stops: next.stops.map((s) =>
          publications[s.id]
            ? {
                id: s.id,
                kind: "existing",
                title: s.title,
                details: "",
                activity_id: publications[s.id],
              }
            : s,
        ),
      };
      await writePlanDraft(key, saved);
      current.current = saved;
      setDraft(saved);
      setNotice(schedule ? "Plan scheduled" : "Draft saved");
      setScheduling(false);
      if (!plan) {
        await writePlanDraft(planDraftKey(storageViewer, demo, `plan:${id}`), {
          ...saved,
          token: `plan:${id}`,
        });
        await deletePlanDraft(key);
        router.replace({ pathname: "/plan/[id]", params: { id } });
      }
      return id;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not save the Plan.";
      if (
        (
          e as {
            definitive?: boolean;
          }
        ).definitive ||
        demo
      )
        update({ ...current.current, request: undefined });
      setError(message);
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const createDecision = async (kind: string) => {
    const id = await persist();
    if (!id) return;
    const savedKey = planDraftKey(storageViewer, demo, `plan:${id}`),
      saved = await readPlanDraft(savedKey);
    if (saved)
      await writePlanDraft(savedKey, { ...saved, handoff: "decision" });
    setComposer(null);
    router.push({
      pathname: "/planning/create",
      params: {
        kind,
        sessionId: randomUUID(),
        returnPlanId: id,
        ...(draft.squad_id
          ? { squadId: draft.squad_id }
          : { planAudience: "private" }),
        timezone: draft.timezone,
      },
    });
  };
  const decisions = data.planning_threads.filter(
    (t) =>
      canReadPlanningThread(data, t, viewer) &&
      t.status !== "cancelled" &&
      (!draft.squad_id ||
        (t.audience === "squad" && t.audience_id === draft.squad_id)) &&
      !draft.stops.some((s) => s.thread_id === t.id) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );
  const candidates = data.activities.filter(
    (a) =>
      a.status !== "cancelled" &&
      compatiblePlanActivity(data, provisional, a, viewer) &&
      !draft.stops.some((s) => s.activity_id === a.id) &&
      a.title.toLowerCase().includes(query.toLowerCase()),
  );
  const templates = data.plan_templates.filter(
    (t) =>
      ((t.owner_id === viewer && !t.squad_id) ||
        (!!draft.squad_id && t.squad_id === draft.squad_id)) &&
      t.title.toLowerCase().includes(query.toLowerCase()),
  );
  const picked = draft.stops.find((s) => s.id === rowMenu);
  const routine = data.plan_routines.find(
    (r) => r.plan_id === plan?.id && r.status !== "ended",
  );
  return (
    <Screen
      title={plan ? "Your Plan" : "Create Plan"}
      eyebrow="MAKE TIME TOGETHER"
      create={false}
      compactHeader
      headerAction={
        <IconButton label="Plan options" onPress={() => setTools(true)}>
          <MoreHorizontal color={c.textPrimary} size={22} />
        </IconButton>
      }
      footer={
        repeat ? undefined : (
          <Action
            title={
              draft.request
                ? "Check saved Plan"
                : scheduling
                  ? "Schedule Plan"
                  : plan?.status === "scheduled"
                    ? "Save Changes"
                    : "Save Draft"
            }
            disabled={!loaded || busy}
            run={() => persist(scheduling)}
          />
        )
      }
    >
      {!loaded ? (
        <Txt>Restoring your draft…</Txt>
      ) : (
        <>
          {choosePlan && (
            <View style={{ gap: 8 }}>
              <Txt>Add this Beacon to a Plan</Txt>
              <Field
                label="Find an eligible Plan"
                value={query}
                onChangeText={setQuery}
              />
              {
                <InlineLink
                  label={"Create a new Plan"}
                  onPress={() => setChoosePlan(false)}
                />
              }
              {data.plans
                .filter(
                  (p) =>
                    !p.routine_source &&
                    planPermissions(data, p, viewer).editor &&
                    p.title.toLowerCase().includes(query.toLowerCase()) &&
                    (!params.beaconId ||
                      data.activities.some(
                        (a) =>
                          a.id === params.beaconId &&
                          compatiblePlanActivity(data, p, a, viewer),
                      )),
                )
                .slice(0, 8)
                .map((p) => (
                  <View key={p.id}>
                    {
                      <PlanChoice
                        title={p.title}
                        detail={`${p.squad_id ? (data.squads.find((s) => s.id === p.squad_id)?.name ?? "Squad Plan") : "Personal Plan"} · ${p.status === "draft" ? "Draft" : "Saved Plan"}`}
                        icon={ListChecks}
                        onPress={() =>
                          router.replace({
                            pathname: "/plan/[id]",
                            params: { id: p.id, beaconId: params.beaconId },
                          })
                        }
                      />
                    }
                  </View>
                ))}
            </View>
          )}
          <Field
            label="Plan title"
            placeholder="A little adventure"
            value={draft.title}
            editable={!draft.request}
            onChangeText={(title) => update({ ...draft, title })}
          />
          {
            <InlineLink
              label={options ? "Hide details" : "Details & settings"}
              onPress={() => setOptions(!options)}
            />
          }
          {draft.squad_id && (
            <Txt muted>
              {data.squads.find((s) => s.id === draft.squad_id)?.name ??
                "Squad Plan"}
            </Txt>
          )}
          {options && (
            <View style={{ gap: 12 }}>
              <Field
                label="Details · optional"
                multiline
                value={draft.description}
                onChangeText={(description) =>
                  update({ ...draft, description })
                }
              />
              <PlanDateField
                label="Plan date · optional"
                value={draft.start_date}
                onChange={(start_date) => update({ ...draft, start_date })}
              />
              <Field
                label="Timezone"
                value={draft.timezone}
                onChangeText={(timezone) => update({ ...draft, timezone })}
              />
              {!plan &&
                data.squads
                  .filter((s) =>
                    data.squad_members.some(
                      (m) => m.squad_id === s.id && m.user_id === viewer,
                    ),
                  )
                  .map((s) => (
                    <InlineLink
                      key={s.id}
                      label={`${draft.squad_id === s.id ? "✓ " : ""}${s.name}`}
                      onPress={() => update({ ...draft, squad_id: s.id })}
                    />
                  ))}
              {!plan && (
                <InlineLink
                  label={"Personal Plan"}
                  onPress={() => update({ ...draft, squad_id: null })}
                />
              )}
            </View>
          )}
          {!draft.stops.length && (
            <View style={{ paddingVertical: 20, gap: 8 }}>
              <Txt>Where should this Plan take you?</Txt>
              <Txt muted>
                Add a quick idea, a Beacon you already have, or something new.
                Nothing is published until you schedule it.
              </Txt>
              {
                <InlineLink
                  label={"Use Template"}
                  onPress={() => {
                    setPicker("templates");
                    setQuery("");
                  }}
                  icon={<Sparkles size={16} color={c.accent} />}
                />
              }
            </View>
          )}
          {plan && <PlanPreparation plan={plan}/>}
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={styles.label}>Add to your Plan</Text>
              {draft.stops.length > 1 && (
                <InlineLink
                  label="Reorder"
                  onPress={() => {
                    setReorderRows([...draft.stops]);
                    setReorderSelected(null);
                    setReordering(true);
                  }}
                />
              )}
            </View>
            <ActivityActionBar
              items={[
                {
                  label: "Idea",
                  accessibilityLabel: "Add Idea",
                  icon: Lightbulb,
                  onPress: addIdea,
                },
                {
                  label: "Beacon",
                  accessibilityLabel: "Add Beacon",
                  icon: Radio,
                  onPress: () => {
                    setComposer(composer === "beacon" ? null : "beacon");
                    setPicker(null);
                  },
                },
                {
                  label: "Decide",
                  accessibilityLabel: "Add Decision",
                  icon: MessageCircle,
                  onPress: () => {
                    setComposer(composer === "decision" ? null : "decision");
                    setDecisionTab("Create new");
                    setPicker(null);
                  },
                },
              ]}
            />
          </View>
          {composer === "beacon" && (
            <View
              style={{
                gap: 4,
                padding: 12,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 16,
              }}
            >
              <Text style={styles.label}>Add a Beacon</Text>
              <PlanChoice
                title="New Beacon"
                detail="Create an unpublished activity for this Plan"
                icon={Plus}
                onPress={() =>
                  void editBeacon().catch((e) => setError(e.message))
                }
              />
              <PlanChoice
                title="Link Existing Beacon"
                detail="Search activities already available to you"
                icon={Radio}
                onPress={() => {
                  setPicker("existing");
                  setQuery("");
                  setLimit(8);
                }}
              />
            </View>
          )}
          {composer === "decision" && (
            <View
              style={{
                gap: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 16,
              }}
            >
              <Text style={styles.label}>Add a decision</Text>
              <Chips
                options={["Create new", "Link existing"]}
                value={decisionTab}
                onChange={(value) => {
                  setDecisionTab(value);
                  setPicker(value === "Link existing" ? "decisions" : null);
                  setQuery("");
                  setLimit(8);
                }}
              />
              {decisionTab === "Create new" &&
                (
                  [
                    [
                      "ping",
                      "Ping",
                      "Check interest before committing",
                      MessageCircle,
                    ],
                    [
                      "vote",
                      "Pick One / Approval Vote",
                      "Compare choices and pick together",
                      ListChecks,
                    ],
                    [
                      "draw",
                      "Surprise Us · Draw",
                      "Choose from the group’s alternatives",
                      Sparkles,
                    ],
                    [
                      "time",
                      "Find a Time",
                      "Find a time that works together",
                      CalendarDays,
                    ],
                  ] as const
                ).map(([kind, title, detail, icon]) => (
                  <PlanChoice
                    key={kind}
                    title={title}
                    detail={detail}
                    icon={icon}
                    onPress={() => {
                      // eslint-disable-next-line react-hooks/refs -- This press handler checkpoints the current draft before navigation.
                      void createDecision(kind).catch((e) =>
                        setError(e.message),
                      );
                    }}
                  />
                ))}
            </View>
          )}
          {picker && (
            <View
              testID="plan-existing-selection"
              style={{
                gap: 8,
                padding: 12,
                backgroundColor: c.surfaceRaised,
                borderRadius: 12,
              }}
            >
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={
                      picker === "existing"
                        ? "Search eligible Beacons"
                        : picker === "decisions"
                          ? "Search eligible decisions"
                          : "Search Plan templates"
                    }
                    value={query}
                    onChangeText={(value) => {
                      setQuery(value);
                      setLimit(8);
                    }}
                  />
                </View>
                <IconButton
                  label="Close selection"
                  onPress={() => setPicker(null)}
                >
                  <X size={18} color={c.textSecondary} />
                </IconButton>
              </View>
              {picker === "templates" && <PremiumPreview kind="Plan" />}
              {picker === "existing"
                ? candidates.slice(0, limit).map((a) => (
                    <PlanChoice
                      key={a.id}
                      title={a.title}
                      detail={`${a.category} · ${new Date(a.starts_at).toLocaleDateString([], { timeZone: a.timezone })} · ${a.audience === "squad" ? "Squad" : "Your eligible Beacons"}`}
                      icon={Radio}
                      onPress={() => {
                        update({
                          ...draft,
                          stops: [
                            ...draft.stops,
                            {
                              id: randomUUID(),
                              kind: "existing",
                              title: a.title,
                              details: "",
                              activity_id: a.id,
                            },
                          ],
                        });
                        setPicker(null);
                        setComposer(null);
                      }}
                    />
                  ))
                : picker === "decisions"
                  ? decisions.slice(0, limit).map((t) => (
                      <PlanChoice
                        key={t.id}
                        title={t.title}
                        detail={`${t.kind === "ping" ? "Ping" : t.kind === "vote" ? "Vote" : t.kind === "draw" ? "Draw" : "Find a Time"} · ${t.status === "open" ? "Open" : "Resolved"} · ${t.audience === "squad" ? "Squad decision" : "Available to you"}`}
                        icon={
                          t.kind === "draw"
                            ? Sparkles
                            : t.kind === "time"
                              ? CalendarDays
                              : MessageCircle
                        }
                        onPress={() => {
                          update({
                            ...draft,
                            stops: [
                              ...draft.stops,
                              {
                                id: randomUUID(),
                                kind: "decision",
                                title: t.title,
                                details: "",
                                thread_id: t.id,
                              },
                            ],
                          });
                          setPicker(null);
                          setComposer(null);
                        }}
                      />
                    ))
                  : templates.slice(0, limit).map((t) => (
                      <PlanChoice
                        key={t.id}
                        title={t.title}
                        detail={`${t.stops?.length ?? t.steps.length} activities · ${t.squad_id ? "Squad template" : "Your template"}`}
                        icon={Sparkles}
                        onPress={() => {
                          const stops = editorStopsFromTemplate(
                            t,
                            draft.squad_id,
                            randomUUID,
                          );
                          update({
                            ...draft,
                            title: draft.title || t.title,
                            stops: [...draft.stops, ...stops],
                          });
                          setPicker(null);
                        }}
                      />
                    ))}
              {(picker === "existing"
                ? candidates
                : picker === "decisions"
                  ? decisions
                  : templates
              ).length > limit && (
                <InlineLink
                  label={"Show more"}
                  onPress={() => setLimit(limit + 8)}
                />
              )}
              {!(
                picker === "existing"
                  ? candidates
                  : picker === "decisions"
                    ? decisions
                    : templates
              ).length && <Txt muted>No matches available.</Txt>}
            </View>
          )}
          <View style={{ gap: 0 }}>
            {draft.stops.map((s, index) => {
              const expanded = selected === s.id;
              const a = data.activities.find((a) => a.id === s.activity_id);
              return (
                <View
                  key={s.id}
                  style={{
                    borderLeftWidth: 2,
                    borderColor: expanded ? c.accent : c.border,
                    paddingLeft: 16,
                    paddingVertical: 12,
                    gap: 8,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${index + 1}. ${s.title || "New idea"}`}
                    onPress={() => setSelected(expanded ? null : s.id)}
                    style={{
                      minHeight: 44,
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: c.textSecondary }}>{index + 1}</Text>
                    {s.kind === "idea" ? (
                      <Lightbulb size={18} color={c.accent} />
                    ) : s.kind === "decision" ? (
                      <MessageCircle size={18} color={c.accent} />
                    ) : (
                      <Radio size={18} color={c.accent} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Txt>{s.title || "New idea"}</Txt>
                      <Txt muted>
                        {s.kind === "idea"
                          ? "Quick idea · unscheduled"
                          : s.kind === "beacon"
                            ? "Beacon draft · unpublished"
                            : s.kind === "decision"
                              ? "Decision"
                              : "Linked Beacon"}
                        {a
                          ? ` · ${new Date(a.starts_at).toLocaleString([], { timeZone: a.timezone })}`
                          : ""}
                      </Txt>
                    </View>
                    <ChevronRight size={16} color={c.textSecondary} />
                  </Pressable>
                  {expanded && (
                    <View style={{ gap: 8 }}>
                      {s.kind === "idea" ? (
                        <>
                          <Field
                            label="Activity idea"
                            value={s.title}
                            onChangeText={(title) =>
                              changeStop(s.id, { title })
                            }
                          />
                          <Field
                            label="Idea details"
                            value={s.details}
                            onChangeText={(details) =>
                              changeStop(s.id, { details })
                            }
                          />
                          {
                            <InlineLink
                              label={"Make this a Beacon"}
                              onPress={() => void editBeacon(s)}
                            />
                          }
                        </>
                      ) : s.kind === "beacon" ? (
                        <InlineLink
                          label={"Edit Beacon draft"}
                          onPress={() => void editBeacon(s)}
                        />
                      ) : s.kind === "existing" ? (
                        <InlineLink
                          label={"Open Beacon"}
                          onPress={() =>
                            router.push({
                              pathname: "/activity/[id]",
                              params: { id: s.activity_id! },
                            })
                          }
                        />
                      ) : (
                        <InlineLink
                          label={"Open decision"}
                          onPress={() =>
                            router.push({
                              pathname: "/council/[id]",
                              params: { id: s.thread_id! },
                            })
                          }
                        />
                      )}
                      <IconButton
                        label="Activity options"
                        onPress={() => setRowMenu(s.id)}
                      >
                        <MoreHorizontal size={18} color={c.textSecondary} />
                      </IconButton>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          {draft.stops.some((s) => s.kind === "beacon") && (
            <InlineLink
              label={
                scheduling ? "Save as draft instead" : "Schedule activities"
              }
              onPress={() => setScheduling(!scheduling)}
            />
          )}
          {scheduling && (
            <View style={{ gap: 12 }}>
              <Txt>Select the new Beacons to publish</Txt>
              <Txt muted>
                Linked Beacons keep their dates and audiences. Quick Ideas stay
                unscheduled.
              </Txt>
              {draft.stops
                .filter((s) => s.kind === "beacon")
                .map((s) => (
                  <InlineLink
                    key={s.id}
                    label={`${s.include ? "✓ " : ""}${s.title} · ${s.beacon?.starts_at ? new Date(String(s.beacon.starts_at)).toLocaleString() : "Choose a time"}`}
                    onPress={() => changeStop(s.id, { include: !s.include })}
                  />
                ))}
            </View>
          )}
          {plan && (
            <InlineLink
              label={
                repeat
                  ? "Close repeat settings"
                  : routine
                    ? "Repeat settings"
                    : "Repeat Plan"
              }
              onPress={() => setRepeat(!repeat)}
              icon={<Repeat2 size={16} color={c.accent} />}
            />
          )}
          {plan && (
            <RoutineScheduleSheet
              plan={plan}
              routine={routine}
              visible={repeat}
              stepSchedule={[]}
              act={act}
              onClose={() => setRepeat(false)}
            />
          )}
          {!!notice && <Txt>{notice}</Txt>}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {(/changed/.test(error) || conflict) && (
            <InlineLink
              label={
                conflict
                  ? "Restore my draft edits"
                  : "Review latest saved version"
              }
              onPress={() => {
                void (async () => {
                  if (conflict) {
                    update({
                      ...conflict,
                      revision: draft.revision,
                      request: undefined,
                    });
                    setConflict(null);
                  } else if (plan) {
                    setConflict(draft);
                    await refresh();
                    const snapshot = getCurrentData(),
                      latest = snapshot?.plans.find((p) => p.id === plan.id);
                    if (
                      !snapshot ||
                      !latest ||
                      !planPermissions(snapshot, latest, viewer).editor
                    )
                      throw new Error(
                        "This Plan is no longer available to this account.",
                      );
                    update(planEditorFromData(snapshot, latest, viewer, token));
                  }
                  setError("");
                })().catch((e) => setError(e.message));
              }}
            />
          )}
        </>
      )}
      <Sheet
        title="Reorder Plan"
        centered
        snapHeight={Math.min(620, 240 + reorderRows.length * 64)}
        visible={reordering}
        onClose={() => setReordering(false)}
        maxHeightPercent={78}
        footer={
          <Action
            title="Done"
            run={async () => {
              update({ ...draft, stops: reorderRows });
              setReordering(false);
            }}
          />
        }
      >
        <Txt muted>
          Drag a row, or select it to move it. Ideas, Beacons and decisions stay
          together.
        </Txt>
        {reorderRows.map((stop, index) => (
          <ReorderRow
            key={stop.id}
            stop={stop}
            index={index}
            count={reorderRows.length}
            move={moveReorder}
            selected={reorderSelected === stop.id}
            onSelect={() => setReorderSelected(stop.id)}
          />
        ))}
      </Sheet>
      <QuickChoiceDialog
        title={picked?.title ?? "Activity options"}
        visible={!!rowMenu}
        onClose={() => setRowMenu(null)}
        items={[
          {
            label: "Duplicate as draft",
            onPress: () => {
              if (!picked) return;
              const a = data.activities.find(
                (a) => a.id === picked.activity_id,
              );
              const place =
                a && canReadBeaconMeetingDetails(data, a, viewer)
                  ? data.places.find((p) => p.activity_id === a.id)
                  : undefined;
              const copy: EditorStop = {
                ...picked,
                id: randomUUID(),
                creation_token: undefined,
                activity_id: null,
                thread_id: null,
                kind: a
                  ? "beacon"
                  : picked.kind === "decision"
                    ? "idea"
                    : picked.kind,
                ...(a
                  ? {
                      beacon: {
                        title: a.title,
                        description: a.description,
                        category: a.category,
                        mode: "squad",
                        timezone: a.timezone,
                        starts_at: a.starts_at,
                        ends_at: a.ends_at,
                        audience: draft.squad_id ? "squad" : "private",
                        audience_id: draft.squad_id,
                        label: place?.label ?? "",
                        online_url: place?.online_url ?? null,
                        latitude: place?.latitude ?? null,
                        longitude: place?.longitude ?? null,
                        approval_required: false,
                        target_count: null,
                      },
                      include: true,
                    }
                  : {}),
              };
              update({ ...draft, stops: [...draft.stops, copy] });
            },
          },
          {
            label: "Remove from Plan",
            destructive: true,
            onPress: () => {
              if (!picked) return;
              update({
                ...draft,
                stops: draft.stops.filter((s) => s.id !== picked.id),
                removed_stop_ids: data.plan_stops?.some(
                  (s) => s.id === picked.id,
                )
                  ? [...draft.removed_stop_ids, picked.id]
                  : draft.removed_stop_ids,
              });
            },
          },
        ]}
      />
      <QuickChoiceDialog
        title="Plan options"
        visible={tools}
        onClose={() => setTools(false)}
        items={[
          {
            label: "Template limits & Premium",
            onPress: () => router.push("/settings/premium" as Href),
          },
          {
            label: "Use Template",
            onPress: () => {
              setPicker("templates");
              setQuery("");
            },
          },
          ...(routine && routine.status !== "ended"
            ? [
                {
                  label: "Manage Repeat",
                  onPress: () => {
                    setRepeat(true);
                  },
                },
              ]
            : []),
          ...(plan
            ? [
                {
                  label: "Save as Template",
                  onPress: () => {
                    void persist()
                      .then(() =>
                        act("save_living_plan_template", { plan_id: plan.id }),
                      )
                      .then(() => setNotice("Template saved"))
                      .catch((e) => setError(e.message));
                  },
                },
                {
                  label: "Sharing & permissions",
                  onPress: () => {
                    void persist()
                      .then(() =>
                        router.push({
                          pathname: "/plan/[id]",
                          params: { id: plan.id, tools: "yes" },
                        }),
                      )
                      .catch((e) => setError(e.message));
                  },
                },
                {
                  label: "Open Calendar",
                  onPress: () =>
                    router.push({
                      pathname: "/calendar",
                      params: plan.start_date ? { date: plan.start_date } : {},
                    }),
                },
                {
                  label: "Open Map",
                  onPress: () =>
                    router.push({
                      pathname: "/",
                      params: { mapPlan: plan.id },
                    }),
                },
              ]
            : []),
          {
            label: "Discard local edits",
            destructive: true,
            onPress: () => setDiscard(true),
          },
        ]}
      />
      <ConfirmDialog
        title="Discard this draft?"
        message="Your saved Plan and published Beacons stay available."
        visible={discard}
        confirmLabel="Discard draft"
        destructive
        onClose={() => setDiscard(false)}
        onConfirm={async () => {
          await deletePlanDraft(key);
          setDiscard(false);
          if (plan) update(planEditorFromData(data, plan, viewer, token));
          else router.back();
        }}
      />
    </Screen>
  );
}
