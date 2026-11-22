import { connectedPlanningEnabled } from "@/src/features/planning/connected";
import { planningCreationModes } from "@/src/features/planning/PlanningKindSelector";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  type TextInput,
} from "react-native";
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
  Check,
  Lightbulb,
  MessageCircle,
  ListChecks,
  GripVertical,
  Radio,
  Repeat2,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Field, Screen, Txt, useTheme } from "@/src/shared/ui";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { PlanChoice } from "./PlanPresentation";
import { CreationPicker } from "@/src/features/beacons/components/CreationPicker";
import { PlanningDisclosure } from "@/src/features/planning/PlanningControls";
import {
  planningTimeSummary,
  planningTimezone,
} from "@/src/features/planning/creationTiming";
import { useNow } from "@/src/shared/useNow";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { ConfirmDialog } from "@/src/shared/Dialogs";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import {
  startCreationDraft,
  hasPlanningDraftField,
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
  isStagedPlanBeacon,
  movePlanEditorStop,
  planStopsForSave,
  type EditorStop,
  type PlanEditorDraft,
} from "./planEditorModel";
import {
  cachedPlanDraft,
  deletePlanDraft,
  planDraftKey,
  readPlanDraft,
  writePlanDraft,
  rememberPlanDraft,
  forgetPlanDraft,
  resumablePlanDraft,
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
function PlanAddAction({
  label,
  accessibilityLabel,
  icon: Icon,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { styles, semanticColors: colors } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 62,
        paddingHorizontal: 4,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 12,
        backgroundColor: pressed
          ? colors.surfaceSelected
          : colors.surfaceRaised,
      })}
    >
      <Icon size={17} color={colors.accent} />
      <Text
        style={[
          styles.label,
          { color: colors.textPrimary, textAlign: "center" },
        ]}
      >
        {label}
      </Text>
    </MotionPressable>
  );
}

function ReorderGrip({
  title,
  index,
  count,
  onDrop,
  onStep,
}: {
  title: string;
  index: number;
  count: number;
  onDrop: (distance: number, targetId?: string) => void;
  onStep: (direction: number) => void;
}) {
  const { semanticColors: c } = useTheme();
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ id: number; y: number } | null>(null);
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => setDragging(true),
        onPanResponderRelease: (_, gesture) => {
          setDragging(false);
          onDrop(gesture.dy);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => setDragging(false),
      }),
    [onDrop],
  );
  if (Platform.OS === "web") {
    const endDrag = () => {
      pointer.current = null;
      setDragging(false);
    };
    return (
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Reorder ${title}`}
        aria-orientation="vertical"
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={index + 1}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            onStep(event.key === "ArrowDown" ? 1 : -1);
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || pointer.current) return;
          pointer.current = { id: event.pointerId, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerUp={(event) => {
          const start = pointer.current;
          if (!start || start.id !== event.pointerId) return;
          const row = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest('[data-testid^="plan-row-"]');
          const targetId = row
            ?.getAttribute("data-testid")
            ?.slice("plan-row-".length);
          endDrag();
          onDrop(event.clientY - start.y, targetId);
        }}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: 48,
          minWidth: 44,
          borderRadius: 10,
          touchAction: "none",
          userSelect: "none",
          backgroundColor: dragging ? c.surfaceSelected : "transparent",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        <GripVertical size={19} color={dragging ? c.accent : c.textSecondary} />
      </div>
    );
  }
  return (
    <View
      {...drag.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Reorder ${title}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
      accessibilityActions={[
        { name: "decrement", label: "Move up" },
        { name: "increment", label: "Move down" },
      ]}
      onAccessibilityAction={(event) =>
        onStep(event.nativeEvent.actionName === "increment" ? 1 : -1)
      }
      style={{
        minHeight: 48,
        minWidth: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        backgroundColor: dragging ? c.surfaceSelected : "transparent",
      }}
    >
      <GripVertical size={19} color={dragging ? c.accent : c.textSecondary} />
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
  const [generated] = useState(randomUUID);
  const token = params.id ? `plan:${params.id}` : (params.draftId ?? generated);
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
  const now = useNow();
  const timezone = planningTimezone();
  const { styles, semanticColors: c } = useTheme();
  const storageViewer = demo
    ? `${viewer}:${data.demo_session_id ?? "fixture"}`
    : viewer;
  const key = planDraftKey(storageViewer, demo, token);
  const ordinary =
    !plan &&
    !params.beaconId &&
    !params.template &&
    !params.sourcePlan &&
    !params.squadId &&
    !params.startDate &&
    !params.timezone &&
    !params.repeat &&
    !params.choosePlan;
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
  const [picker, setPicker] = useState<"existing" | "templates" | "ask" | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingIdea, setAddingIdea] = useState(false);
  const [idea, setIdea] = useState("");
  const [removed, setRemoved] = useState<{
    stop: EditorStop;
    index: number;
    nextId?: string;
  } | null>(null);
  const [draftState, setDraftState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [resume, setResume] = useState<{ token: string; title: string } | null>(
    null,
  );
  const [askKind, setAskKind] = useState<
    (typeof planningCreationModes)[number]["kind"] | null
  >(null);
  const [discard, setDiscard] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [repeat, setRepeat] = useState(params.repeat === "yes");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<PlanEditorDraft | null>(null);
  const lock = useRef(false);
  const ideaInput = useRef<TextInput>(null);
  const rowOffsets = useRef(new Map<string, number>());
  const visibleStops = draft.stops.filter((stop) => !isStagedPlanBeacon(stop));
  const full = visibleStops.length >= 30;
  const locked = busy || !!draft.request;

  useEffect(() => {
    if (!ordinary) return;
    let active = true;
    void resumablePlanDraft(storageViewer, demo)
      .then((saved) => {
        if (active) setResume(saved);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ordinary, storageViewer, demo]);

  const checkpoint = async (next: PlanEditorDraft) => {
    const epoch = getViewerEpoch();
    setDraftState("saving");
    try {
      await writePlanDraft(key, next);
      if (
        ordinary &&
        !next.plan_id &&
        (next.title.trim() || next.description.trim() || next.stops.length)
      )
        await rememberPlanDraft(storageViewer, demo, token);
      if (epoch === getViewerEpoch() && current.current === next)
        setDraftState("saved");
    } catch {
      if (epoch === getViewerEpoch() && current.current === next)
        setDraftState("error");
    }
  };
  const update = (next: PlanEditorDraft) => {
    if (current.current.request && next.request === current.current.request) {
      setError(
        "Check the pending save before editing. Your draft is preserved.",
      );
      return;
    }
    if (next.handoff) next = { ...next, handoff: undefined };
    current.current = next;
    setDraft(next);
    setResume(null);
    setNotice("");
    void checkpoint(next);
  };
  const provisional: Plan = useMemo(
    () =>
      plan ?? {
        id: "draft",
        owner_id: viewer,
        squad_id: draft.squad_id,
        title: "",
        description: "",
        timezone: "UTC",
        start_date: null,
        status: "draft",
        created_at: "",
      },
    [plan, viewer, draft.squad_id],
  );
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const epoch = getViewerEpoch();
      const openingDraft = current.current;
      void readPlanDraft(key)
        .then((saved) => {
          if (
            !alive ||
            epoch !== getViewerEpoch() ||
            lock.current ||
            current.current !== openingDraft
          )
            return;
          if (saved) {
            if (saved.handoff === "decision") {
              const savedId = saved.plan_id;
              const latest = data.plans.find((p) => p.id === savedId);
              if (
                latest &&
                (latest.revision ?? 0) > saved.revision &&
                planPermissions(data, latest, viewer).editor
              ) {
                const refreshed = planEditorFromData(
                  data,
                  latest,
                  viewer,
                  token,
                );
                saved = {
                  ...refreshed,
                  stops: [
                    ...refreshed.stops,
                    ...saved.stops.filter(isStagedPlanBeacon),
                  ],
                };
                void writePlanDraft(key, saved).catch((failure) =>
                  setError(failure.message),
                );
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
            setDraftState((state) => (state === "error" ? state : "saved"));
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
  const changeStop = (id: string, changes: Partial<EditorStop>) => {
    const latest = current.current;
    update({
      ...latest,
      stops: latest.stops.map((stop) =>
        stop.id === id ? { ...stop, ...changes } : stop,
      ),
    });
  };
  const moveStop = (id: string, targetId: string) => {
    const latest = current.current;
    if (lock.current || latest.request) return;
    const stops = movePlanEditorStop(latest.stops, id, targetId);
    if (stops !== latest.stops) update({ ...latest, stops });
  };
  const dropStop = (id: string, distance: number, targetId?: string) => {
    if (Math.abs(distance) < 8) return;
    if (targetId) {
      moveStop(id, targetId);
      return;
    }
    const origin = rowOffsets.current.get(id);
    if (origin === undefined) return;
    const destination = origin + distance;
    let target = id;
    let closest = Math.abs(distance);
    for (const stop of visibleStops) {
      const top = rowOffsets.current.get(stop.id);
      if (top === undefined) continue;
      const delta = Math.abs(top - destination);
      if (delta < closest) {
        target = stop.id;
        closest = delta;
      }
    }
    moveStop(id, target);
  };
  const addIdea = () => {
    const title = idea.trim();
    const latest = current.current;
    if (
      !title ||
      lock.current ||
      latest.request ||
      latest.stops.filter((stop) => !isStagedPlanBeacon(stop)).length >= 30
    )
      return;
    update({
      ...latest,
      stops: [
        ...latest.stops,
        { id: randomUUID(), kind: "idea", title, details: "" },
      ],
    });
    setIdea("");
    ideaInput.current?.focus();
  };
  const removeStop = (id: string) => {
    const latest = current.current;
    if (lock.current || latest.request) return;
    const index = latest.stops.findIndex((row) => row.id === id);
    if (index < 0) return;
    setRemoved({
      stop: latest.stops[index],
      index,
      nextId: latest.stops[index + 1]?.id,
    });
    if (selected === id) setSelected(null);
    if (editing === id) setEditing(null);
    update({
      ...latest,
      stops: latest.stops.filter((row) => row.id !== id),
      removed_stop_ids: data.plan_stops?.some((row) => row.id === id)
        ? [...new Set([...latest.removed_stop_ids, id])]
        : latest.removed_stop_ids,
    });
  };
  const undoRemoval = () => {
    const latest = current.current;
    if (!removed || lock.current || latest.request) return;
    if (latest.stops.filter((row) => !isStagedPlanBeacon(row)).length >= 30) {
      setError("Make room for this item before undoing the removal.");
      return;
    }
    const stops = [...latest.stops];
    if (
      stops.some(
        (row) =>
          (!!removed.stop.activity_id &&
            row.activity_id === removed.stop.activity_id) ||
          (!!removed.stop.thread_id &&
            row.thread_id === removed.stop.thread_id),
      )
    ) {
      setError("This item is already linked to the Plan.");
      return;
    }
    const next = stops.findIndex((row) => row.id === removed.nextId);
    stops.splice(
      next >= 0 ? next : Math.min(removed.index, stops.length),
      0,
      removed.stop,
    );
    update({
      ...latest,
      stops,
      removed_stop_ids: latest.removed_stop_ids.filter(
        (id) => id !== removed.stop.id,
      ),
    });
    setRemoved(null);
  };
  const editBeacon = async (requested?: EditorStop) => {
    const latest = current.current;
    if (lock.current || latest.request || (!requested && full)) return;
    lock.current = true;
    setBusy(true);
    const epoch = getViewerEpoch();
    try {
      const stop = requested ?? latest.stops.find(isStagedPlanBeacon);
      const id = stop?.id ?? randomUUID();
      const session = stop?.creation_token ?? startCreationDraft(viewer);
      if (stop?.creation_token) {
        try {
          await restoreCreationDraft(viewer, stop.creation_token);
        } catch {
          // A new Beacon has no durable child draft until its first checkpoint.
        }
      }
      if (epoch !== getViewerEpoch()) return;
      const retained: PlanEditorDraft = {
        ...latest,
        stops: stop
          ? latest.stops.map((row) =>
              row.id === id ? { ...row, creation_token: session } : row,
            )
          : [
              ...latest.stops,
              {
                id,
                kind: "beacon",
                title: "New Beacon",
                details: "",
                beacon: {},
                include: false,
                awaiting_beacon: true,
                creation_token: session,
              },
            ],
      };
      await writePlanDraft(key, retained);
      if (epoch !== getViewerEpoch()) return;
      if (ordinary && !retained.plan_id)
        await rememberPlanDraft(storageViewer, demo, token);
      if (epoch !== getViewerEpoch()) return;
      current.current = retained;
      setDraft(retained);
      setDraftState("saved");
      const values = (stop && !isStagedPlanBeacon(stop)
        ? stop.beacon
        : undefined) ?? {
        title: stop && !isStagedPlanBeacon(stop) ? stop.title : "",
        description: stop?.details ?? "",
        audience: draft.squad_id ? "squad" : "private",
        audienceId: draft.squad_id ?? "",
      };
      const beacon =
        stop && !isStagedPlanBeacon(stop) ? stop.beacon : undefined;
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
            approval: beacon.approval_required
              ? "Host approval"
              : "Open joining",
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
      for (const [field, value] of (hasPlanningDraftField(
        viewer,
        session,
        "title",
      )
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
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const persist = async (schedule = false, navigate = true) => {
    if (lock.current) throw new Error("Wait for the current save to finish.");
    const { request: pending, ...local } = current.current;
    const input = { ...local, stops: planStopsForSave(local.stops) };
    if (!pending) validatePlanEditor(input);
    setRemoved(null);
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
              ...input,
              action: schedule ? "schedule_plan_editor" : "save_plan_editor",
            },
          },
        };
        current.current = next;
        setDraft(next);
      }
      await writePlanDraft(key, next);
      if (epoch !== getViewerEpoch()) return;
      const request = next.request!;
      const scheduled = request.payload.action === "schedule_plan_editor";
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
      if (epoch !== getViewerEpoch()) return;
      current.current = saved;
      setDraft(saved);
      setDraftState("saved");
      setNotice(scheduled ? "Beacons scheduled" : "");

      setScheduling(false);
      if (!plan) {
        await writePlanDraft(planDraftKey(storageViewer, demo, `plan:${id}`), {
          ...saved,
          token: `plan:${id}`,
        });
        if (ordinary) await forgetPlanDraft(storageViewer, demo, token);
        await deletePlanDraft(key);
        if (epoch !== getViewerEpoch()) return;
        if (navigate)
          router.replace({ pathname: "/plan/[id]", params: { id } });
      }
      return id;
    } catch (e) {
      if (epoch !== getViewerEpoch()) return;
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
  const createDecision = async (
    kind: (typeof planningCreationModes)[number]["kind"],
  ) => {
    const epoch = getViewerEpoch();
    const id = await persist(false, false);
    if (!id || epoch !== getViewerEpoch()) return;
    const savedKey = planDraftKey(storageViewer, demo, `plan:${id}`);
    const saved = await readPlanDraft(savedKey);
    if (!saved || epoch !== getViewerEpoch()) return;
    await writePlanDraft(savedKey, { ...saved, handoff: "decision" });
    if (epoch !== getViewerEpoch()) return;
    setPicker(null);
    setAskKind(null);
    if (!plan) router.replace({ pathname: "/plan/[id]", params: { id } });
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
  const routine = data.plan_routines.find(
    (r) => r.plan_id === plan?.id && r.status !== "ended",
  );
  const addReference = (stop: EditorStop) => {
    const latest = current.current;
    if (
      lock.current ||
      latest.request ||
      full ||
      latest.stops.some(
        (row) =>
          (stop.activity_id && row.activity_id === stop.activity_id) ||
          (stop.thread_id && row.thread_id === stop.thread_id),
      )
    )
      return;
    update({ ...latest, stops: [...latest.stops, stop] });
    setPicker(null);
  };
  const duplicate = (stop: EditorStop) => {
    const latest = current.current;
    if (lock.current || latest.request || full) return;
    const activity = data.activities.find(
      (item) => item.id === stop.activity_id,
    );
    if (
      stop.activity_id &&
      (!activity || !canReadBeaconActivity(data, activity, viewer))
    )
      return;
    if (stop.thread_id && !decisionsForView.has(stop.thread_id)) return;
    const place =
      activity && canReadBeaconMeetingDetails(data, activity, viewer)
        ? data.places.find((item) => item.activity_id === activity.id)
        : undefined;
    const copy: EditorStop = {
      ...stop,
      id: randomUUID(),
      creation_token: undefined,
      awaiting_beacon: undefined,
      activity_id: null,
      thread_id: null,
      kind: activity ? "beacon" : stop.kind === "decision" ? "idea" : stop.kind,
      ...(activity
        ? {
            include: true,
            beacon: {
              title: activity.title,
              description: activity.description,
              category: activity.category,
              mode: "squad",
              timezone: activity.timezone,
              starts_at: activity.starts_at,
              ends_at: activity.ends_at,
              audience: latest.squad_id ? "squad" : "private",
              audience_id: latest.squad_id,
              label: place?.label ?? "",
              online_url: place?.online_url ?? null,
              latitude: place?.latitude ?? null,
              longitude: place?.longitude ?? null,
              approval_required: false,
              target_count: null,
            },
          }
        : {}),
    };
    const index = latest.stops.findIndex((item) => item.id === stop.id);
    const stops = [...latest.stops];
    stops.splice(index + 1, 0, copy);
    update({ ...latest, stops });
    setSelected(copy.id);
  };
  const openPicker = (value: typeof picker) => {
    setQuery("");
    setLimit(8);
    setPicker(value);
  };
  const report = (failure: unknown) =>
    setError(
      failure instanceof Error ? failure.message : "Could not update the Plan.",
    );
  const decisionsForView = new Map(
    data.planning_threads
      .filter((thread) => canReadPlanningThread(data, thread, viewer))
      .map((thread) => [thread.id, thread]),
  );
  const matches =
    picker === "existing"
      ? candidates.length + decisions.length
      : templates.length;
  const beaconDrafts = visibleStops.filter((stop) => stop.kind === "beacon");
  const done = async () => {
    const epoch = getViewerEpoch();
    const scheduled = draft.request?.payload.action === "schedule_plan_editor";
    if (!(await persist()) || epoch !== getViewerEpoch() || !plan || scheduled)
      return;
    if (router.canGoBack()) router.back();
    else router.replace("/plans");
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen
        title={plan ? "Edit Plan" : "New Plan"}
        eyebrow=""
        create={false}
        compactHeader
        footer={
          !repeat && (
            <View style={{ gap: 4 }}>
              {removed && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[styles.muted, { flex: 1 }]}
                  >
                    Item removed
                  </Text>
                  <InlineLink label="Undo" onPress={undoRemoval} />
                </View>
              )}
              {draftState === "saved" && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <Check size={13} color={c.textSecondary} />
                  <Text accessibilityLiveRegion="polite" style={styles.muted}>
                    Draft saved
                  </Text>
                </View>
              )}
              {draftState === "error" && (
                <Button
                  secondary
                  compact
                  title="Draft could not be saved · Retry"
                  onPress={() => void checkpoint(current.current)}
                />
              )}
              <Action
                title={
                  draft.request
                    ? "Check saved Plan"
                    : plan
                      ? "Done"
                      : "Create Plan"
                }
                disabled={!loaded || busy || choosePlan}
                run={done}
              />
            </View>
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
            {!choosePlan && (
              <>
                {resume && resume.token !== token && (
                  <PlanChoice
                    title="Resume draft"
                    detail={resume.title || "Untitled Plan"}
                    icon={ListChecks}
                    onPress={() =>
                      router.replace({
                        pathname: "/plan-editor",
                        params: { draftId: resume.token },
                      })
                    }
                  />
                )}
                <Field
                  label="Plan name"
                  placeholder="A little adventure"
                  value={draft.title}
                  maxLength={100}
                  editable={!locked}
                  onChangeText={(title) =>
                    update({ ...current.current, title })
                  }
                />
                <View style={{ gap: 2 }} testID="plan-items">
                  <Text style={styles.label}>Plan items</Text>
                  {!visibleStops.length && (
                    <View style={{ paddingVertical: 10 }}>
                      <Txt muted>Add an idea to start your list.</Txt>
                    </View>
                  )}
                  {visibleStops.map((stop, index) => {
                    const expanded = selected === stop.id;
                    const linked = data.activities.find(
                      (item) => item.id === stop.activity_id,
                    );
                    const activity =
                      linked && canReadBeaconActivity(data, linked, viewer)
                        ? linked
                        : undefined;
                    const thread = stop.thread_id
                      ? decisionsForView.get(stop.thread_id)
                      : undefined;
                    const mode = planningCreationModes.find(
                      (item) => item.kind === thread?.kind,
                    );
                    const title =
                      stop.kind === "existing"
                        ? (activity?.title ?? "Unavailable Beacon")
                        : stop.kind === "decision"
                          ? (thread?.title ?? "Unavailable decision")
                          : stop.title || "Untitled idea";
                    const detail =
                      stop.kind === "idea"
                        ? "Idea · Not scheduled"
                        : stop.kind === "beacon"
                          ? "Beacon draft · Unpublished"
                          : stop.kind === "existing"
                            ? activity
                              ? `Beacon · ${activity.status === "cancelled" ? "Cancelled" : planningTimeSummary(activity.starts_at, timezone, now)}`
                              : "Beacon · Unavailable"
                            : thread
                              ? `${mode?.label ?? "Decision"} · ${thread.status === "open" && Date.parse(thread.deadline_at) > now ? "Waiting for responses" : thread.status === "cancelled" ? "Cancelled" : thread.finalized_at || thread.status === "resolved" ? "Result ready" : "Responses closed"}`
                              : "Decision · Unavailable";
                    const Icon =
                      stop.kind === "idea"
                        ? Lightbulb
                        : stop.kind === "decision"
                          ? (mode?.Icon ?? MessageCircle)
                          : Radio;
                    const before = visibleStops[index - 1];
                    const after = visibleStops[index + 1];
                    return (
                      <View
                        key={stop.id}
                        testID={`plan-row-${stop.id}`}
                        onLayout={(event) =>
                          rowOffsets.current.set(
                            stop.id,
                            event.nativeEvent.layout.y,
                          )
                        }
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          {visibleStops.length > 1 && !locked && (
                            <ReorderGrip
                              title={title}
                              index={index}
                              count={visibleStops.length}
                              onDrop={(distance, targetId) =>
                                dropStop(stop.id, distance, targetId)
                              }
                              onStep={(direction) => {
                                const target = direction === 1 ? after : before;
                                if (target) moveStop(stop.id, target.id);
                              }}
                            />
                          )}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <PlanChoice
                              title={title}
                              detail={detail}
                              icon={Icon}
                              expanded={expanded}
                              onPress={() => {
                                setSelected(expanded ? null : stop.id);
                                setEditing(null);
                              }}
                            />
                          </View>
                        </View>
                        {expanded && (
                          <View
                            style={{ paddingLeft: 12, paddingTop: 8, gap: 4 }}
                          >
                            {stop.kind === "idea" && editing === stop.id && (
                              <>
                                <Field
                                  label="Idea name"
                                  value={stop.title}
                                  maxLength={120}
                                  editable={!locked}
                                  onChangeText={(value) =>
                                    changeStop(stop.id, { title: value })
                                  }
                                />
                                <Field
                                  label="Idea details"
                                  value={stop.details}
                                  maxLength={2000}
                                  editable={!locked}
                                  onChangeText={(details) =>
                                    changeStop(stop.id, { details })
                                  }
                                />
                              </>
                            )}
                            {stop.kind === "idea" &&
                              editing !== stop.id &&
                              !!stop.details && <Txt muted>{stop.details}</Txt>}
                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                columnGap: 16,
                              }}
                            >
                              {stop.kind === "idea" && !locked && (
                                <>
                                  <InlineLink
                                    label={
                                      editing === stop.id
                                        ? "Finish editing"
                                        : "Edit"
                                    }
                                    onPress={() =>
                                      setEditing(
                                        editing === stop.id ? null : stop.id,
                                      )
                                    }
                                  />
                                  <InlineLink
                                    label="Turn into Beacon"
                                    onPress={() =>
                                      void editBeacon(stop).catch(report)
                                    }
                                  />
                                </>
                              )}
                              {stop.kind === "beacon" && !locked && (
                                <InlineLink
                                  label="Edit Beacon"
                                  onPress={() =>
                                    void editBeacon(stop).catch(report)
                                  }
                                />
                              )}
                              {activity && (
                                <InlineLink
                                  label="Open Beacon"
                                  onPress={() =>
                                    router.push({
                                      pathname: "/activity/[id]",
                                      params: { id: activity.id },
                                    })
                                  }
                                />
                              )}
                              {thread && (
                                <InlineLink
                                  label="Open decision"
                                  onPress={() =>
                                    router.push({
                                      pathname: "/council/[id]",
                                      params: { id: thread.id },
                                    })
                                  }
                                />
                              )}
                              {!locked &&
                                !full &&
                                (stop.kind === "idea" ||
                                  stop.kind === "beacon" ||
                                  activity ||
                                  thread) && (
                                  <InlineLink
                                    label={
                                      stop.kind === "idea"
                                        ? "Duplicate"
                                        : "Copy as draft"
                                    }
                                    onPress={() => duplicate(stop)}
                                  />
                                )}
                              {!locked && (
                                <InlineLink
                                  label={
                                    stop.kind === "existing" ||
                                    stop.kind === "decision"
                                      ? "Remove from Plan"
                                      : "Remove"
                                  }
                                  onPress={() => removeStop(stop.id)}
                                />
                              )}
                            </View>
                            {visibleStops.length > 1 && !locked && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  columnGap: 16,
                                }}
                              >
                                {before && (
                                  <InlineLink
                                    label="Move up"
                                    icon={
                                      <ArrowUp size={15} color={c.accent} />
                                    }
                                    onPress={() => moveStop(stop.id, before.id)}
                                  />
                                )}
                                {after && (
                                  <InlineLink
                                    label="Move down"
                                    icon={
                                      <ArrowDown size={15} color={c.accent} />
                                    }
                                    onPress={() => moveStop(stop.id, after.id)}
                                  />
                                )}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={styles.label}>Add to Plan</Text>
                  {full ? (
                    <Txt muted>This Plan has 30 items.</Txt>
                  ) : (
                    !locked && (
                      <>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <PlanAddAction
                            label="Idea"
                            accessibilityLabel="Add Idea"
                            icon={Lightbulb}
                            onPress={() => setAddingIdea(true)}
                          />
                          <PlanAddAction
                            label="Beacon"
                            accessibilityLabel="Add Beacon"
                            icon={Radio}
                            onPress={() => void editBeacon().catch(report)}
                          />
                          <PlanAddAction
                            label="Ask Group"
                            icon={MessageCircle}
                            onPress={() => openPicker("ask")}
                          />
                        </View>
                        {addingIdea && (
                          <View style={{ gap: 4 }}>
                            <Field
                              label="Activity idea"
                              placeholder="Try indoor climbing"
                              autoFocus
                              maxLength={120}
                              inputRef={ideaInput}
                              value={idea}
                              onChangeText={setIdea}
                              onSubmitEditing={addIdea}
                              returnKeyType="done"
                              submitBehavior="submit"
                            />
                            <View style={{ flexDirection: "row", gap: 12 }}>
                              <Button
                                compact
                                title="Add"
                                disabled={!idea.trim()}
                                onPress={addIdea}
                              />
                              <Button
                                compact
                                secondary
                                title="Cancel"
                                onPress={() => {
                                  setAddingIdea(false);
                                  setIdea("");
                                }}
                              />
                            </View>
                          </View>
                        )}
                        <InlineLink
                          label="Add existing"
                          onPress={() => openPicker("existing")}
                        />
                      </>
                    )
                  )}
                </View>
                {beaconDrafts.length > 0 && (
                  <InlineLink
                    label="Schedule Beacons"
                    onPress={() => setScheduling(true)}
                  />
                )}
                <PlanningDisclosure
                  title="Plan details"
                  summary={
                    draft.squad_id
                      ? (data.squads.find((item) => item.id === draft.squad_id)
                          ?.name ?? "Squad Plan")
                      : undefined
                  }
                >
                  <Field
                    label="Description · optional"
                    multiline
                    maxLength={1000}
                    value={draft.description}
                    editable={!locked}
                    onChangeText={(description) =>
                      update({ ...current.current, description })
                    }
                  />
                  <PlanDateField
                    label="Plan date · optional"
                    value={draft.start_date}
                    onChange={(start_date) => {
                      if (!locked) update({ ...current.current, start_date });
                    }}
                  />
                  <Field
                    label="Timezone"
                    value={draft.timezone}
                    editable={!locked}
                    onChangeText={(value) =>
                      update({ ...current.current, timezone: value })
                    }
                  />
                  {!plan && !draft.plan_id && !locked && (
                    <>
                      <Text style={styles.label}>Who can see this Plan?</Text>
                      {data.squads
                        .filter((item) =>
                          data.squad_members.some(
                            (member) =>
                              member.squad_id === item.id &&
                              member.user_id === viewer,
                          ),
                        )
                        .map((item) => (
                          <PlanChoice
                            key={item.id}
                            title={item.name}
                            detail="Squad Plan"
                            icon={MessageCircle}
                            selected={draft.squad_id === item.id}
                            onPress={() =>
                              update({ ...current.current, squad_id: item.id })
                            }
                          />
                        ))}
                      <PlanChoice
                        title="Personal Plan"
                        detail="Only you"
                        icon={ListChecks}
                        selected={!draft.squad_id}
                        onPress={() =>
                          update({ ...current.current, squad_id: null })
                        }
                      />
                    </>
                  )}
                  <InlineLink
                    label="Use Template"
                    icon={<Sparkles size={16} color={c.accent} />}
                    onPress={() => openPicker("templates")}
                  />
                  {plan && (
                    <>
                      <PlanPreparation plan={plan} />
                      <InlineLink
                        label={routine ? "Repeat settings" : "Repeat Plan"}
                        icon={<Repeat2 size={16} color={c.accent} />}
                        onPress={() => setRepeat(true)}
                      />
                      <InlineLink
                        label="Save as Template"
                        onPress={() =>
                          void persist()
                            .then((id) => {
                              if (!id) return;
                              return act("save_living_plan_template", {
                                plan_id: id,
                              }).then(() => setNotice("Template saved"));
                            })
                            .catch(report)
                        }
                      />
                      <InlineLink
                        label="Sharing & permissions"
                        onPress={() =>
                          void persist()
                            .then((id) => {
                              if (id)
                                router.push({
                                  pathname: "/plan/[id]",
                                  params: { id, tools: "yes" },
                                });
                            })
                            .catch(report)
                        }
                      />
                      <InlineLink
                        label="Open Calendar"
                        onPress={() =>
                          router.push({
                            pathname: "/calendar",
                            params: plan.start_date
                              ? { date: plan.start_date }
                              : {},
                          })
                        }
                      />
                      <InlineLink
                        label="Open Map"
                        onPress={() =>
                          router.push({
                            pathname: "/",
                            params: { mapPlan: plan.id },
                          })
                        }
                      />
                    </>
                  )}
                  <InlineLink
                    label="Template limits & Premium"
                    onPress={() => router.push("/settings/premium" as Href)}
                  />
                  {!locked && (
                    <InlineLink
                      label="Discard local edits"
                      onPress={() => setDiscard(true)}
                    />
                  )}
                </PlanningDisclosure>
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
              </>
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
                      update(
                        planEditorFromData(snapshot, latest, viewer, token),
                      );
                    }
                    setError("");
                  })().catch((e) => setError(e.message));
                }}
              />
            )}
          </>
        )}
        <CreationPicker
          title={
            picker === "ask"
              ? "Ask Group"
              : picker === "templates"
                ? "Use Template"
                : "Add existing"
          }
          visible={!!picker}
          onClose={() => {
            if (!busy) setPicker(null);
          }}
        >
          {picker === "ask"
            ? planningCreationModes
                .filter(
                  ({ kind }) =>
                    kind !== "time" || connectedPlanningEnabled(data),
                )
                .map(({ kind, label, description, Icon }) => (
                  <PlanChoice
                    key={kind}
                    title={label}
                    detail={description}
                    icon={Icon}
                    onPress={() => {
                      if (locked) return;
                      if (current.current.plan_id)
                        void createDecision(kind).catch(report);
                      else {
                        setPicker(null);
                        setAskKind(kind);
                      }
                    }}
                  />
                ))
            : picker && (
                <View testID="plan-existing-selection" style={{ gap: 8 }}>
                  <Field
                    label={
                      picker === "templates"
                        ? "Search Plan templates"
                        : "Search Beacons and decisions"
                    }
                    value={query}
                    onChangeText={(value) => {
                      setQuery(value);
                      setLimit(8);
                    }}
                  />
                  {picker === "templates" && <PremiumPreview kind="Plan" />}
                  {picker === "existing"
                    ? [
                        ...candidates.map((activity) => (
                          <PlanChoice
                            key={activity.id}
                            title={activity.title}
                            detail={`Beacon · ${planningTimeSummary(activity.starts_at, timezone, now)}`}
                            icon={Radio}
                            onPress={() =>
                              addReference({
                                id: randomUUID(),
                                kind: "existing",
                                title: activity.title,
                                details: "",
                                activity_id: activity.id,
                              })
                            }
                          />
                        )),
                        ...decisions.map((thread) => {
                          const mode = planningCreationModes.find(
                            (item) => item.kind === thread.kind,
                          );
                          return (
                            <PlanChoice
                              key={thread.id}
                              title={thread.title}
                              detail={`${mode?.label ?? "Decision"} · ${thread.status === "open" ? "Open" : "Responses closed"}`}
                              icon={mode?.Icon ?? MessageCircle}
                              onPress={() =>
                                addReference({
                                  id: randomUUID(),
                                  kind: "decision",
                                  title: thread.title,
                                  details: "",
                                  thread_id: thread.id,
                                })
                              }
                            />
                          );
                        }),
                      ].slice(0, limit)
                    : templates.slice(0, limit).map((template) => (
                        <PlanChoice
                          key={template.id}
                          title={template.title}
                          detail={`${template.stops?.length ?? template.steps.length} items`}
                          icon={Sparkles}
                          onPress={() => {
                            const latest = current.current;
                            const stops = editorStopsFromTemplate(
                              template,
                              latest.squad_id,
                              randomUUID,
                            );
                            if (locked) return;
                            if (
                              planStopsForSave(latest.stops).length +
                                stops.length >
                              30
                            ) {
                              setPicker(null);
                              setError(
                                "This template would take the Plan over 30 items.",
                              );
                              return;
                            }
                            update({
                              ...latest,
                              title: latest.title || template.title,
                              stops: [...latest.stops, ...stops],
                            });
                            setPicker(null);
                          }}
                        />
                      ))}
                  {matches > limit && (
                    <InlineLink
                      label="Show more"
                      onPress={() => setLimit(limit + 8)}
                    />
                  )}
                  {!matches && <Txt muted>No matches available.</Txt>}
                </View>
              )}
        </CreationPicker>
        <ConfirmDialog
          title="Save Plan and continue?"
          message="Save this Plan as a draft before opening the group question. You’ll choose when to send it."
          visible={!!askKind}
          confirmLabel="Save and continue"
          onClose={() => setAskKind(null)}
          onConfirm={async () => {
            if (askKind) await createDecision(askKind);
          }}
        />
        <CreationPicker
          title="Schedule Beacons"
          visible={scheduling}
          onClose={() => {
            if (!busy) setScheduling(false);
          }}
          footer={
            <View style={{ gap: 8 }}>
              <Action
                title={
                  draft.request?.payload.action === "schedule_plan_editor"
                    ? "Check saved Plan"
                    : "Confirm schedule"
                }
                disabled={
                  busy ||
                  (draft.request
                    ? draft.request.payload.action !== "schedule_plan_editor"
                    : !beaconDrafts.some((stop) => stop.include))
                }
                run={() => persist(true)}
              />
              <Button
                compact
                secondary
                title="Close"
                disabled={busy}
                onPress={() => setScheduling(false)}
              />
            </View>
          }
        >
          <Txt muted>Choose the Beacon drafts to publish.</Txt>
          {beaconDrafts.map((stop) => (
            <PlanChoice
              key={stop.id}
              title={stop.title}
              detail={
                typeof stop.beacon?.starts_at === "string"
                  ? planningTimeSummary(stop.beacon.starts_at, timezone, now)
                  : "Choose a time"
              }
              icon={Radio}
              selected={!!stop.include}
              onPress={() => {
                if (!locked) changeStop(stop.id, { include: !stop.include });
              }}
            />
          ))}
        </CreationPicker>
        <ConfirmDialog
          title="Discard this draft?"
          message="Your saved Plan and published Beacons stay available."
          visible={discard}
          confirmLabel="Discard draft"
          destructive
          onClose={() => setDiscard(false)}
          onConfirm={async () => {
            if (ordinary) await forgetPlanDraft(storageViewer, demo, token);
            await deletePlanDraft(key);
            setDiscard(false);
            setRemoved(null);
            if (plan) update(planEditorFromData(data, plan, viewer, token));
            else if (router.canGoBack()) router.back();
            else router.replace("/plans");
          }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
