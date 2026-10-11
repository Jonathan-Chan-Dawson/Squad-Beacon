import React, { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Repeat2 } from "lucide-react-native";
import { PanResponder, Pressable, Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import {
  buildPlanSchedule,
  stepsFromPlan,
  suggestPlanConflicts,
} from "@/src/features/plans/domain";
import { addLocalDays } from "@/src/features/plans/routines";
import { RoutineScheduleSheet } from "@/src/features/plans/RoutineScheduleSheet";
import { beaconTemplateCatalog } from "@/src/shared/templates";
import { localDate } from "@/src/shared/domain";
import type { Category, PlanStep } from "@/src/shared/types";
import {
  Action,
  Button,
  Chips,
  Field,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

const categories: Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];
const today = (timezone: string) => localDate(new Date(), timezone);
const safeToday = (timezone: string) => {
  try {
    return today(timezone);
  } catch {
    return today(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }
};
const blankStep = (): PlanStep => ({
  start_mode: "specific",
  end_mode: "duration",
  title: "",
  description: "",
  category: "Social",
  location_name: "",
  lat: null,
  lng: null,
  day_offset: 0,
  start_time: "12:00",
  duration_minutes: 60,
  aspiration_ids: [],
});

function ReorderHandle({
  index,
  count,
  move,
}: {
  index: number;
  count: number;
  move: (from: number, to: number) => void;
}) {
  const { styles } = useTheme();
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderRelease: (_, gesture) => {
          const shift = Math.round(gesture.dy / 90);
          if (shift)
            move(index, Math.max(0, Math.min(count - 1, index + shift)));
        },
      }),
    [index, count, move],
  );
  return (
    <View
      {...responder.panHandlers}
      accessibilityLabel={`Drag Beacon ${index + 1} to reorder`}
      style={{ padding: 14 }}
    >
      <Text style={styles.h2}>↓</Text>
    </View>
  );
}

export default function PlansScreen() {
  const params = useLocalSearchParams();
  return <PlanBuilderScreen key={JSON.stringify(params)} />;
}

function PlanBuilderScreen() {
  const { styles, colors } = useTheme();
  const { data, userId, act } = useBeacon();
  const params = useLocalSearchParams<{
    squadId?: string;
    templates?: string;
    create?: string;
    template?: string;
    sourcePlan?: string;
    beaconDraft?: string;
    routine?: string;
  }>();
  const memberships = data.squad_members.filter((m) => m.user_id === userId);
  const allowedSquads = data.squads.filter((s) =>
    memberships.some((m) => m.squad_id === s.id),
  );
  const initialSquad = allowedSquads.some((s) => s.id === params.squadId)
    ? params.squadId!
    : "Personal";
  const seedTemplate = data.plan_templates.find(
    (item) => item.id === params.template,
  );
  const sourcePlan = data.plans.find((item) => item.id === params.sourcePlan);
  const seedSteps = sourcePlan
    ? stepsFromPlan(sourcePlan, data.activities, data.places)
    : seedTemplate?.steps;
  let beaconSeed: PlanStep | undefined;
  try {
    if (params.beaconDraft) beaconSeed = JSON.parse(params.beaconDraft);
  } catch {
    /* Invalid draft falls back to a blank Beacon. */
  }
  const [expanded, setExpanded] = useState(0);
  const [stepAdvanced, setStepAdvanced] = useState(false);
  const [recipeBrowser, setRecipeBrowser] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [routinePlanId, setRoutinePlanId] = useState("");
  const [scope, setScope] = useState(initialSquad);
  const scopeId = scope === "Personal" ? null : scope;
  const [editor, setEditor] = useState(params.create === "yes");
  const [templateEditor, setTemplateEditor] = useState(false);
  const [templateId, setTemplateId] = useState(seedTemplate?.id ?? "");
  const [saveTemplateId, setSaveTemplateId] = useState("");
  const [title, setTitle] = useState(
    sourcePlan?.title ?? seedTemplate?.title ?? "",
  );
  const [description, setDescription] = useState(
    sourcePlan?.description ?? seedTemplate?.description ?? "",
  );
  const [timezone, setTimezone] = useState(
    sourcePlan?.timezone ??
      seedTemplate?.timezone ??
      (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
  );
  const [startDate, setStartDate] = useState(() =>
    localDate(
      new Date(Date.now() + 86400000),
      sourcePlan?.timezone ??
        seedTemplate?.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "UTC",
    ),
  );
  const [steps, setSteps] = useState<PlanStep[]>(
    seedSteps?.length ? seedSteps : [beaconSeed ?? blankStep()],
  );
  const [showTemplates, setShowTemplates] = useState(
    params.templates === "yes",
  );
  const [conflicts, setConflicts] = useState<
    ReturnType<typeof suggestPlanConflicts>
  >([]);
  const [activityConflictNotes, setActivityConflictNotes] = useState<string[]>(
    [],
  );
  const [internalConflicts, setInternalConflicts] = useState<string[]>([]);
  const [pendingKey, setPendingKey] = useState("");

  const plans = data.plans.filter((p) =>
    scopeId
      ? p.squad_id === scopeId
      : p.owner_id === userId && p.squad_id === null,
  );
  const templates = data.plan_templates.filter((t) =>
    scopeId
      ? t.squad_id === scopeId
      : t.owner_id === userId && t.squad_id === null,
  );
  const selectedSquad = allowedSquads.find((s) => s.id === scopeId);
  const canWriteSquad =
    !scopeId ||
    memberships.some(
      (m) => m.squad_id === scopeId && ["owner", "admin"].includes(m.role),
    );
  const profile = data.profiles.find((p) => p.id === userId);
  const aspirations = profile?.aspiration_goals ?? [];
  const squadLabel = (squad: (typeof allowedSquads)[number]) =>
    `${squad.name} · ${squad.id.slice(0, 6)}`;
  const scopeOptions = ["Personal", ...allowedSquads.map(squadLabel)];
  const scopeValue =
    scope === "Personal"
      ? "Personal"
      : selectedSquad
        ? squadLabel(selectedSquad)
        : "Personal";
  const planInputKey = JSON.stringify({
    title,
    description,
    timezone,
    startDate,
    scopeId,
    steps,
  });
  function setScopeFromLabel(label: string) {
    setScope(
      label === "Personal"
        ? "Personal"
        : (allowedSquads.find((s) => squadLabel(s) === label)?.id ??
            "Personal"),
    );
  }

  function openBuilder(template?: (typeof data.plan_templates)[number]) {
    setTemplateId(template?.id ?? "");
    setSaveTemplateId("");
    setTitle(template?.title ?? "");
    setDescription(template?.description ?? "");
    setTimezone(
      template?.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        "UTC",
    );
    setStartDate(addLocalDays(safeToday(template?.timezone ?? timezone), 1));
    const ownAspirationIds = new Set(aspirations.map((goal) => goal.id));
    setSteps(
      template?.steps?.length
        ? template.steps.map((s) => ({
            ...s,
            aspiration_ids: template.squad_id
              ? []
              : (s.aspiration_ids ?? []).filter((id) =>
                  ownAspirationIds.has(id),
                ),
          }))
        : [blankStep()],
    );
    setConflicts([]);
    setActivityConflictNotes([]);
    setInternalConflicts([]);
    setPendingKey("");
    setExpanded(0);
    setEditor(true);
  }

  function openPlanBuilder(template?: (typeof data.plan_templates)[number]) {
    setTemplateEditor(false);
    openBuilder(template);
  }

  function stepOverlapNotes(occurrences: ReturnType<typeof buildPlanSchedule>) {
    const notes: string[] = [];
    for (let i = 0; i < occurrences.length; i++) {
      for (let j = i + 1; j < occurrences.length; j++) {
        const a = occurrences[i],
          b = occurrences[j];
        if (
          Date.parse(a.starts_at) < Date.parse(b.ends_at) &&
          Date.parse(a.ends_at) > Date.parse(b.starts_at)
        ) {
          notes.push(
            `Beacon ${a.step_index + 1} overlaps beacon ${b.step_index + 1}.`,
          );
        }
      }
    }
    return notes;
  }

  function updateStep(index: number, patch: Partial<PlanStep>) {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  }

  function validate() {
    if (!title.trim()) throw new Error("Name your plan.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      Number.isNaN(Date.parse(`${startDate}T12:00:00Z`))
    )
      throw new Error("Use a start date in YYYY-MM-DD format.");
    if (!timezone.trim())
      throw new Error("Choose the timezone for this itinerary.");
    if (
      !steps.length ||
      steps.length > 30 ||
      steps.some((s) => !s.title.trim())
    )
      throw new Error("A plan needs 1 to 30 titled beacons.");
    if (
      steps.some(
        (s) =>
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time) ||
          !Number.isInteger(s.day_offset) ||
          s.day_offset < 0 ||
          s.day_offset > 365 ||
          !Number.isInteger(s.duration_minutes) ||
          s.duration_minutes < 1 ||
          s.duration_minutes > 1440,
      )
    )
      throw new Error("Check each step's day, start time, and duration.");
  }

  async function createPlan() {
    validate();
    const occurrences = buildPlanSchedule(startDate, timezone, steps);
    const overlaps = suggestPlanConflicts(
      occurrences,
      data.activities,
      userId!,
      timezone,
    );
    const inside = stepOverlapNotes(occurrences);
    const againstMySchedule = occurrences.flatMap((occurrence) =>
      data.activities
        .filter(
          (activity) =>
            activity.owner_id === userId &&
            activity.status === "scheduled" &&
            Date.parse(occurrence.starts_at) < Date.parse(activity.ends_at) &&
            Date.parse(occurrence.ends_at) > Date.parse(activity.starts_at),
        )
        .map(
          (activity) =>
            `Beacon ${occurrence.step_index + 1} overlaps “${activity.title}”.`,
        ),
    );
    if (inside.length) {
      setInternalConflicts(inside);
      setPendingKey("");
      throw new Error("Beacons in a Plan cannot overlap. Change the times or use After Previous Ends.");
    }
    if (
      againstMySchedule.length &&
      pendingKey !== planInputKey
    ) {
      setConflicts(overlaps);
      setActivityConflictNotes([...new Set(againstMySchedule)]);
      setInternalConflicts(inside);
      setPendingKey(planInputKey);
      return;
    }
    const result = await act("create_plan", {
      title: title.trim(),
      description: description.trim(),
      timezone,
      start_date: startDate,
      ...(scopeId ? { squad_id: scopeId } : {}),
      ...(templateId ? { template_id: templateId } : {}),
      steps: occurrences.map(({ step: s }) => ({
        ...s,
        title: s.title.trim(),
        description: s.description.trim(),
        location_name: s.location_name.trim(),
      })),
    });
    setEditor(false);
    if (typeof result.id === "string") {
      if (params.routine === "yes") setRoutinePlanId(result.id);
      else router.push({ pathname: "/plan/[id]", params: { id: result.id } });
    }
    setConflicts([]);
    setActivityConflictNotes([]);
    setInternalConflicts([]);
    setPendingKey("");
  }

  async function saveTemplate() {
    validate();
    const ownAspirationIds = new Set(aspirations.map((goal) => goal.id));
    await act("save_plan_template", {
      ...(saveTemplateId ? { id: saveTemplateId } : {}),
      ...(scopeId ? { squad_id: scopeId } : {}),
      title: title.trim(),
      description: description.trim(),
      timezone,
      steps: steps.map((s) => ({
        ...s,
        title: s.title.trim(),
        description: s.description.trim(),
        location_name: s.location_name.trim(),
        aspiration_ids: scopeId
          ? []
          : (s.aspiration_ids ?? []).filter((id) => ownAspirationIds.has(id)),
      })),
    });
    setEditor(false);
  }

  const occurrenceCount = useMemo(
    () =>
      plans.reduce(
        (count, plan) =>
          count + data.activities.filter((a) => a.plan_id === plan.id).length,
        0,
      ),
    [plans, data.activities],
  );
  const previewOccurrences = useMemo(() => {
    try {
      return buildPlanSchedule(startDate, timezone, steps);
    } catch {
      return [];
    }
  }, [startDate, timezone, steps]);

  return (
    <Screen
      title="Beacon Plans"
      eyebrow="A set of beacons, on your schedule"
      create={false}
      headerAction={
        <IconButton label="Routines" onPress={() => router.push("/routines")}>
          <Repeat2 size={20} color={colors.ink} />
        </IconButton>
      }
    >
      <Txt muted>
        Keep a multi day itinerary together. Each step becomes a scheduled
        beacon in the plan’s timezone.
      </Txt>
      {allowedSquads.length > 0 && (
        <Chips
          options={scopeOptions}
          value={scopeValue}
          onChange={setScopeFromLabel}
        />
      )}
      {scopeId && selectedSquad && (
        <Txt muted>
          Shared with {selectedSquad.name}. Squad plan templates can be saved or
          changed by squad admins.
        </Txt>
      )}
      <Button title="Create a plan" onPress={() => openPlanBuilder()} />
      {templates.length > 0 && (
        <Button
          title="My Plan Templates →"
          secondary
          onPress={() => setShowTemplates(true)}
        />
      )}
      {plans.length === 0 ? (
        <Txt muted>
          No Beacon Plans here yet. Make one from a few scheduled beacons or
          start from a template.
        </Txt>
      ) : (
        plans.map((plan) => {
          const count = data.activities.filter(
            (a) => a.plan_id === plan.id,
          ).length;
          return (
            <View key={plan.id} style={styles.card}>
              <Text style={styles.h2}>{plan.title}</Text>
              <Txt muted>
                {plan.start_date} · {plan.timezone} · {count}{" "}
                {count === 1 ? "beacon" : "beacons"} ·{" "}
                {plan.status === "cancelled" ? "Cancelled" : "Scheduled"}
              </Txt>
              {!!plan.description && <Txt>{plan.description}</Txt>}
              <Button
                title="Open plan"
                onPress={() =>
                  router.push({
                    pathname: "/plan/[id]",
                    params: { id: plan.id },
                  })
                }
              />
            </View>
          );
        })
      )}
      <Txt muted>{occurrenceCount} scheduled beacons across these plans.</Txt>

      <Sheet
        title="Beacon Templates"
        visible={recipeBrowser}
        onClose={() => setRecipeBrowser(false)}
      >
        <Field
          label="Search"
          value={recipeSearch}
          onChangeText={setRecipeSearch}
          placeholder="Dinner, bowling, study…"
        />
        {beaconTemplateCatalog
          .filter((item) =>
            `${item.title} ${item.groupLabel}`
              .toLowerCase()
              .includes(recipeSearch.trim().toLowerCase()),
          )
          .map((item) => (
            <Button
              key={item.id}
              secondary
              title={`${item.title} · ${item.minutes} min`}
              onPress={() => {
                updateStep(expanded, {
                  title: item.title,
                  description: item.description ?? "",
                  category: item.category,
                  duration_minutes: item.minutes,
                });
                setRecipeBrowser(false);
              }}
            />
          ))}
      </Sheet>
      {data.plans.find((plan) => plan.id === routinePlanId) && (
        <RoutineScheduleSheet
          plan={data.plans.find((plan) => plan.id === routinePlanId)!}
          initialSchedule={data.plan_routines.find(
            (routine) => routine.plan_id === params.sourcePlan,
          )}
          visible={!!routinePlanId}
          stepSchedule={steps.map((step) => step.title)}
          act={act}
          onClose={() => {
            setRoutinePlanId("");
            router.replace("/routines");
          }}
        />
      )}
      <Sheet
        title="Plan templates"
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
      >
        <Button
          title="Build a template"
          disabled={!canWriteSquad}
          onPress={() => {
            setShowTemplates(false);
            setTemplateEditor(true);
            openBuilder();
          }}
        />
        {!templates.length && (
          <Txt muted>
            {scopeId
              ? "No templates for this squad yet."
              : "No personal plan templates yet."}
          </Txt>
        )}
        {templates.map((template) => {
          const writable = template.squad_id
            ? memberships.some(
                (m) =>
                  m.squad_id === template.squad_id &&
                  ["owner", "admin"].includes(m.role),
              )
            : template.owner_id === userId;
          return (
            <View key={template.id} style={styles.card}>
              <Text style={styles.h2}>{template.title}</Text>
              <Txt muted>
                {template.steps.length} beacons ·{" "}
                {template.squad_id ? "Squad template" : "Personal template"}
              </Txt>
              <Button
                title={`Use ${template.title}`}
                onPress={() => {
                  setShowTemplates(false);
                  setTemplateEditor(false);
                  openBuilder(template);
                }}
              />
              {writable && (
                <Button
                  title="Edit template"
                  secondary
                  onPress={() => {
                    setShowTemplates(false);
                    setTemplateEditor(true);
                    openBuilder(template);
                    setSaveTemplateId(template.id);
                  }}
                />
              )}
              {writable && (
                <Action
                  title="Delete template"
                  secondary
                  run={() => act("delete_plan_template", { id: template.id })}
                />
              )}
            </View>
          );
        })}
      </Sheet>
      <Sheet
        title={templateEditor ? "Plan template" : "Build a plan"}
        visible={editor}
        onClose={() => setEditor(false)}
      >
        {scopeId && selectedSquad ? (
          <Txt muted>Shared with {selectedSquad.name}</Txt>
        ) : null}
        <Field
          label="Plan name"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          placeholder="A weekend in the city"
        />
        <Field
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={1000}
          multiline
        />
        {!templateEditor && (
          <Field
            label="Start date · YYYY-MM-DD"
            value={startDate}
            onChangeText={setStartDate}
            placeholder={safeToday(timezone)}
          />
        )}
        <Field
          label="Timezone"
          value={timezone}
          onChangeText={setTimezone}
          autoCapitalize="none"
          placeholder="America/Chicago"
        />
        {!templateEditor && allowedSquads.length > 0 && (
          <>
            <Txt muted>Plan audience</Txt>
            <Chips
              options={scopeOptions}
              value={scopeValue}
              onChange={setScopeFromLabel}
            />
          </>
        )}
        <Txt muted>
          Arrange your Beacons. Drag the grip to reorder, or use Move up / Move
          down.
        </Txt>
        {steps.map((step, index) => (
          <View key={index} style={{ gap: 8 }}>
            {index > 0 && (
              <Text style={[styles.muted, { marginLeft: 20 }]}>↓</Text>
            )}
            <View style={styles.card}>
              <View style={styles.row}>
                <ReorderHandle
                  index={index}
                  count={steps.length}
                  move={(from, to) => {
                    setSteps((current) => {
                      const next = [...current];
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      if (next[0].start_mode === "after_previous")
                        next[0] = { ...next[0], start_mode: "specific" };
                      return next;
                    });
                    setExpanded(to);
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit Beacon ${index + 1}`}
                  onPress={() => setExpanded(expanded === index ? -1 : index)}
                  style={{ flex: 1, gap: 4 }}
                >
                  <Text style={styles.label}>
                    {step.start_mode === "after_previous"
                      ? "AFTER PREVIOUS ENDS"
                      : step.start_mode === "manual"
                        ? "MANUAL START"
                        : `${step.day_offset > 0 ? `Day ${step.day_offset + 1} · ` : ""}${step.start_time}`}
                  </Text>
                  <Text style={styles.h2}>
                    {step.title || `Beacon ${index + 1}`}
                  </Text>
                  <Txt muted>
                    {step.location_name || "Choose an activity and place"} ·{" "}
                    {step.end_mode === "manual"
                      ? "Manual end"
                      : step.end_mode === "specific"
                        ? `Until ${step.end_time ?? "?"}`
                        : `${step.duration_minutes} min`}
                  </Txt>
                </Pressable>
              </View>
              {expanded === index && (
                <>
                  <Field
                    label="Title / Activity"
                    value={step.title}
                    onChangeText={(v) => updateStep(index, { title: v })}
                    maxLength={120}
                    placeholder="Dinner, bowling, hangout…"
                  />
                  <Button
                    compact
                    secondary
                    title="Use a Beacon Template"
                    onPress={() => setRecipeBrowser(true)}
                  />
                  <Field
                    label="Location"
                    value={step.location_name}
                    onChangeText={(v) =>
                      updateStep(index, { location_name: v })
                    }
                    maxLength={160}
                  />
                  <Txt muted>Start</Txt>
                  <Chips
                    options={
                      index === 0
                        ? ["Specific Time", "Manual Start"]
                        : [
                            "Specific Time",
                            "After Previous Ends",
                            "Manual Start",
                          ]
                    }
                    value={
                      step.start_mode === "after_previous"
                        ? "After Previous Ends"
                        : step.start_mode === "manual"
                          ? "Manual Start"
                          : "Specific Time"
                    }
                    onChange={(v) =>
                      updateStep(index, {
                        start_mode:
                          v === "Manual Start"
                            ? "manual"
                            : v === "After Previous Ends"
                              ? "after_previous"
                              : "specific",
                      })
                    }
                  />
                  {step.start_mode !== "after_previous" && (
                    <Field
                      label={
                        step.start_mode === "manual"
                          ? "Estimated time · HH:mm"
                          : "Start time · HH:mm"
                      }
                      value={step.start_time}
                      onChangeText={(v) => updateStep(index, { start_time: v })}
                      placeholder="18:30"
                    />
                  )}
                  <Txt muted>End</Txt>
                  <Chips
                    options={["Duration", "Specific Time", "Manual End"]}
                    value={
                      step.end_mode === "manual"
                        ? "Manual End"
                        : step.end_mode === "specific"
                          ? "Specific Time"
                          : "Duration"
                    }
                    onChange={(v) =>
                      updateStep(index, {
                        end_mode:
                          v === "Manual End"
                            ? "manual"
                            : v === "Specific Time"
                              ? "specific"
                              : "duration",
                        ...(v === "Specific Time" && !step.end_time
                          ? { end_time: "20:00" }
                          : {}),
                      })
                    }
                  />
                  {step.end_mode === "specific" ? (
                    <Field
                      label="End time · HH:mm"
                      value={step.end_time ?? ""}
                      onChangeText={(v) => updateStep(index, { end_time: v })}
                    />
                  ) : (
                    <Field
                      label={
                        step.end_mode === "manual"
                          ? "Estimated duration (minutes)"
                          : "Duration (minutes)"
                      }
                      value={String(step.duration_minutes)}
                      onChangeText={(v) =>
                        updateStep(index, { duration_minutes: Number(v) })
                      }
                      keyboardType="number-pad"
                    />
                  )}
                  <Button
                    compact
                    secondary
                    title={stepAdvanced ? "Fewer details ↑" : "More details ↓"}
                    onPress={() => setStepAdvanced(!stepAdvanced)}
                  />
                  {stepAdvanced && (
                    <>
                      <Field
                        label="Details (optional)"
                        value={step.description}
                        onChangeText={(v) =>
                          updateStep(index, { description: v })
                        }
                        maxLength={2000}
                        multiline
                      />
                      <Chips
                        options={categories}
                        value={step.category}
                        onChange={(v) => updateStep(index, { category: v })}
                      />
                      <Field
                        label="Days after Plan starts"
                        value={String(step.day_offset)}
                        onChangeText={(v) =>
                          updateStep(index, { day_offset: Number(v) })
                        }
                        keyboardType="number-pad"
                      />
                      {aspirations.map((aspiration) => {
                        const checked = (step.aspiration_ids ?? []).includes(
                          aspiration.id,
                        );
                        return (
                          <Button
                            key={aspiration.id}
                            secondary={!checked}
                            title={aspiration.title}
                            onPress={() =>
                              updateStep(index, {
                                aspiration_ids: checked
                                  ? step.aspiration_ids?.filter(
                                      (id) => id !== aspiration.id,
                                    )
                                  : [
                                      ...(step.aspiration_ids ?? []),
                                      aspiration.id,
                                    ],
                              })
                            }
                          />
                        );
                      })}
                    </>
                  )}
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {index > 0 && (
                      <Button
                        compact
                        secondary
                        title="Move up"
                        onPress={() => {
                          setSteps((current) => {
                            const next = [...current];
                            [next[index - 1], next[index]] = [
                              next[index],
                              next[index - 1],
                            ];
                            if (next[0].start_mode === "after_previous")
                              next[0] = { ...next[0], start_mode: "specific" };
                            return next;
                          });
                          setExpanded(index - 1);
                        }}
                      />
                    )}
                    {index < steps.length - 1 && (
                      <Button
                        compact
                        secondary
                        title="Move down"
                        onPress={() => {
                          setSteps((current) => {
                            const next = [...current];
                            [next[index], next[index + 1]] = [
                              next[index + 1],
                              next[index],
                            ];
                            if (next[0].start_mode === "after_previous")
                              next[0] = { ...next[0], start_mode: "specific" };
                            return next;
                          });
                          setExpanded(index + 1);
                        }}
                      />
                    )}
                    {steps.length > 1 && (
                      <Button
                        compact
                        secondary
                        title="Remove"
                        onPress={() =>
                          setSteps((current) => {
                            const next = current.filter((_, i) => i !== index);
                            if (next[0].start_mode === "after_previous")
                              next[0] = { ...next[0], start_mode: "specific" };
                            return next;
                          })
                        }
                      />
                    )}
                    <Button
                      compact
                      title="Done"
                      onPress={() => setExpanded(-1)}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        ))}
        {previewOccurrences.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.h2}>Schedule preview</Text>
            {previewOccurrences.map((occurrence) => (
              <Txt key={occurrence.step_index}>
                Day {occurrence.step.day_offset + 1} ·{" "}
                {new Date(occurrence.starts_at).toLocaleString([], {
                  timeZone: timezone,
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                →{" "}
                {new Date(occurrence.ends_at).toLocaleTimeString([], {
                  timeZone: timezone,
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Txt>
            ))}
          </View>
        )}
        {steps.length < 30 && (
          <Button
            title="+ Add Beacon"
            secondary
            onPress={() => {
              setExpanded(steps.length);
              setSteps((current) => [
                ...current,
                { ...blankStep(), start_mode: "after_previous" },
              ]);
            }}
          />
        )}
        {(activityConflictNotes.length > 0 || internalConflicts.length > 0) && (
          <View style={styles.card}>
            <Text style={styles.h2}>Time conflicts</Text>
            <Txt muted>
              Review the overlaps and suggested local start times. For a squad
              plan, check the alternate time with your squad.
            </Txt>
            {internalConflicts.map((note) => (
              <Txt key={note}>{note}</Txt>
            ))}
            {activityConflictNotes.map((note) => (
              <Txt key={note}>{note}</Txt>
            ))}
            {conflicts.map((conflict, i) => (
              <Txt key={`${conflict.step_index}-${i}`}>
                Beacon {conflict.step_index + 1} has an available alternate
                start: {conflict.suggested_start_time}.
              </Txt>
            ))}
          </View>
        )}
        {!templateEditor && (
          <Action
            title={
              pendingKey === planInputKey
                ? "Create Plan anyway"
                : params.routine === "yes"
                  ? "Next · Repeat Schedule"
                  : "Create Plan"
            }
            run={createPlan}
          />
        )}
        <Action
          title={templateEditor ? "Save template" : "Save as template"}
          secondary
          disabled={!canWriteSquad}
          run={saveTemplate}
        />
      </Sheet>
    </Screen>
  );
}
