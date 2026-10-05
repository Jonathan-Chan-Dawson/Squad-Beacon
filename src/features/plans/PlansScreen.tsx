import React, { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Repeat2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { buildPlanSchedule, suggestPlanConflicts } from "@/src/features/plans/domain";
import { localDate } from "@/src/shared/domain";
import type { Category, PlanStep } from "@/src/shared/types";
import { Action, Button, Chips, Field, IconButton, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";

const categories: Category[] = ["Fitness", "Study", "Gaming", "Creative", "Social", "Other"];
const today = (timezone: string) => localDate(new Date(), timezone);
const safeToday = (timezone: string) => {
  try { return today(timezone); }
  catch { return today(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); }
};
const blankStep = (): PlanStep => ({
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

export default function PlansScreen() {
  const { styles, colors } = useTheme();
  const { data, userId, act } = useBeacon();
  const params = useLocalSearchParams<{ squadId?: string; templates?: string; create?: string }>();
  const memberships = data.squad_members.filter((m) => m.user_id === userId);
  const allowedSquads = data.squads.filter((s) => memberships.some((m) => m.squad_id === s.id));
  const initialSquad = allowedSquads.some((s) => s.id === params.squadId) ? params.squadId! : "Personal";
  const [scope, setScope] = useState(initialSquad);
  const scopeId = scope === "Personal" ? null : scope;
  const [editor, setEditor] = useState(params.create === "yes");
  const [templateEditor, setTemplateEditor] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [saveTemplateId, setSaveTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [startDate, setStartDate] = useState(() => today(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));
  const [steps, setSteps] = useState<PlanStep[]>([blankStep()]);
  const [showTemplates, setShowTemplates] = useState(params.templates === "yes");
  const [conflicts, setConflicts] = useState<ReturnType<typeof suggestPlanConflicts>>([]);
  const [activityConflictNotes, setActivityConflictNotes] = useState<string[]>([]);
  const [internalConflicts, setInternalConflicts] = useState<string[]>([]);
  const [pendingKey, setPendingKey] = useState("");

  const plans = data.plans.filter((p) => scopeId ? p.squad_id === scopeId : p.owner_id === userId && p.squad_id === null);
  const templates = data.plan_templates.filter((t) => scopeId ? t.squad_id === scopeId : t.owner_id === userId && t.squad_id === null);
  const selectedSquad = allowedSquads.find((s) => s.id === scopeId);
  const canWriteSquad = !scopeId || memberships.some((m) => m.squad_id === scopeId && ["owner", "admin"].includes(m.role));
  const profile = data.profiles.find((p) => p.id === userId);
  const aspirations = profile?.aspiration_goals ?? [];
  const squadLabel = (squad: (typeof allowedSquads)[number]) => `${squad.name} · ${squad.id.slice(0, 6)}`;
  const scopeOptions = ["Personal", ...allowedSquads.map(squadLabel)];
  const scopeValue = scope === "Personal" ? "Personal" : (selectedSquad ? squadLabel(selectedSquad) : "Personal");
  const planInputKey = JSON.stringify({ title, description, timezone, startDate, scopeId, steps });
  function setScopeFromLabel(label: string) {
    setScope(label === "Personal" ? "Personal" : (allowedSquads.find((s) => squadLabel(s) === label)?.id ?? "Personal"));
  }

  function openBuilder(template?: (typeof data.plan_templates)[number]) {
    setTemplateId(template?.id ?? "");
    setSaveTemplateId("");
    setTitle(template?.title ?? "");
    setDescription(template?.description ?? "");
    setTimezone(template?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
    setStartDate(safeToday(template?.timezone ?? timezone));
    const ownAspirationIds = new Set(aspirations.map((goal) => goal.id));
    setSteps(template?.steps?.length ? template.steps.map((s) => ({
      ...s,
      aspiration_ids: template.squad_id ? [] : (s.aspiration_ids ?? []).filter((id) => ownAspirationIds.has(id)),
    })) : [blankStep()]);
    setConflicts([]);
    setActivityConflictNotes([]);
    setInternalConflicts([]);
    setPendingKey("");
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
        const a = occurrences[i], b = occurrences[j];
        if (Date.parse(a.starts_at) < Date.parse(b.ends_at) && Date.parse(a.ends_at) > Date.parse(b.starts_at)) {
          notes.push(`Beacon ${a.step_index + 1} overlaps beacon ${b.step_index + 1}.`);
        }
      }
    }
    return notes;
  }

  function updateStep(index: number, patch: Partial<PlanStep>) {
    setSteps((current) => current.map((step, i) => i === index ? { ...step, ...patch } : step));
  }

  function validate() {
    if (!title.trim()) throw new Error("Name your plan.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T12:00:00Z`))) throw new Error("Use a start date in YYYY-MM-DD format.");
    if (!timezone.trim()) throw new Error("Choose the timezone for this itinerary.");
    if (!steps.length || steps.length > 30 || steps.some((s) => !s.title.trim())) throw new Error("A plan needs 1 to 30 titled beacons.");
    if (steps.some((s) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time) || !Number.isInteger(s.day_offset) || s.day_offset < 0 || s.day_offset > 365 || !Number.isInteger(s.duration_minutes) || s.duration_minutes < 1 || s.duration_minutes > 1440)) throw new Error("Check each step's day, start time, and duration.");
  }

  async function createPlan() {
    validate();
    const occurrences = buildPlanSchedule(startDate, timezone, steps);
    const overlaps = suggestPlanConflicts(occurrences, data.activities, userId!, timezone);
    const inside = stepOverlapNotes(occurrences);
    const againstMySchedule = occurrences.flatMap((occurrence) => data.activities
      .filter((activity) => activity.owner_id === userId && activity.status === "scheduled" &&
        Date.parse(occurrence.starts_at) < Date.parse(activity.ends_at) &&
        Date.parse(occurrence.ends_at) > Date.parse(activity.starts_at))
      .map((activity) => `Beacon ${occurrence.step_index + 1} overlaps “${activity.title}”.`));
    if ((againstMySchedule.length || inside.length) && pendingKey !== planInputKey) {
      setConflicts(overlaps);
      setActivityConflictNotes([...new Set(againstMySchedule)]);
      setInternalConflicts(inside);
      setPendingKey(planInputKey);
      return;
    }
    await act("create_plan", {
      title: title.trim(),
      description: description.trim(),
      timezone,
      start_date: startDate,
      ...(scopeId ? { squad_id: scopeId } : {}),
      ...(templateId ? { template_id: templateId } : {}),
      steps: steps.map((s) => ({ ...s, title: s.title.trim(), description: s.description.trim(), location_name: s.location_name.trim() })),
    });
    setEditor(false);
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
      title: title.trim(), description: description.trim(), timezone,
      steps: steps.map((s) => ({
        ...s,
        title: s.title.trim(), description: s.description.trim(), location_name: s.location_name.trim(),
        aspiration_ids: scopeId ? [] : (s.aspiration_ids ?? []).filter((id) => ownAspirationIds.has(id)),
      })),
    });
    setEditor(false);
  }

  const occurrenceCount = useMemo(() => plans.reduce((count, plan) => count + data.activities.filter((a) => a.plan_id === plan.id).length, 0), [plans, data.activities]);
  const previewOccurrences = useMemo(() => {
    try { return buildPlanSchedule(startDate, timezone, steps); }
    catch { return []; }
  }, [startDate, timezone, steps]);

  return (
    <Screen title="Beacon Plans" eyebrow="A set of beacons, on your schedule" create={false}
      headerAction={<IconButton label="Routines" onPress={() => router.push("/routines")}><Repeat2 size={20} color={colors.ink} /></IconButton>}>
      <Txt muted>Keep a multi day itinerary together. Each step becomes a scheduled beacon in the plan’s timezone.</Txt>
      {allowedSquads.length > 0 && <Chips options={scopeOptions} value={scopeValue} onChange={setScopeFromLabel} />}
      {scopeId && selectedSquad && <Txt muted>Shared with {selectedSquad.name}. Squad plan templates can be saved or changed by squad admins.</Txt>}
      <Button title="Create a plan" onPress={() => openPlanBuilder()} />
      <Button title="Browse plan templates" secondary onPress={() => setShowTemplates(true)} />
      {plans.length === 0 ? <Txt muted>No Beacon Plans here yet. Make one from a few scheduled beacons or start from a template.</Txt> : plans.map((plan) => {
        const count = data.activities.filter((a) => a.plan_id === plan.id).length;
        return <View key={plan.id} style={styles.card}>
          <Text style={styles.h2}>{plan.title}</Text>
          <Txt muted>{plan.start_date} · {plan.timezone} · {count} {count === 1 ? "beacon" : "beacons"} · {plan.status === "cancelled" ? "Cancelled" : "Scheduled"}</Txt>
          {!!plan.description && <Txt>{plan.description}</Txt>}
          <Button title="Open plan" onPress={() => router.push({ pathname: "/plan/[id]", params: { id: plan.id } })} />
        </View>;
      })}
      <Txt muted>{occurrenceCount} scheduled beacons across these plans.</Txt>

      <Sheet title="Plan templates" visible={showTemplates} onClose={() => setShowTemplates(false)}>
        <Button title="Build a template" disabled={!canWriteSquad} onPress={() => { setShowTemplates(false); setTemplateEditor(true); openBuilder(); }} />
        {!templates.length && <Txt muted>{scopeId ? "No templates for this squad yet." : "No personal plan templates yet."}</Txt>}
        {templates.map((template) => {
          const writable = template.squad_id ? memberships.some((m) => m.squad_id === template.squad_id && ["owner", "admin"].includes(m.role)) : template.owner_id === userId;
          return <View key={template.id} style={styles.card}>
            <Text style={styles.h2}>{template.title}</Text>
            <Txt muted>{template.steps.length} beacons · {template.squad_id ? "Squad template" : "Personal template"}</Txt>
            <Button title={`Use ${template.title}`} onPress={() => { setShowTemplates(false); setTemplateEditor(false); openBuilder(template); }} />
            {writable && <Button title="Edit template" secondary onPress={() => { setShowTemplates(false); setTemplateEditor(true); openBuilder(template); setSaveTemplateId(template.id); }} />}
            {writable && <Action title="Delete template" secondary run={() => act("delete_plan_template", { id: template.id })} />}
          </View>;
        })}
      </Sheet>
      <Sheet title={templateEditor ? "Plan template" : "Build a plan"} visible={editor} onClose={() => setEditor(false)}>
        {scopeId && selectedSquad ? <Txt muted>Shared with {selectedSquad.name}</Txt> : null}
        <Field label="Plan name" value={title} onChangeText={setTitle} maxLength={100} placeholder="A weekend in the city" />
        <Field label="Description (optional)" value={description} onChangeText={setDescription} maxLength={1000} multiline />
        {!templateEditor && <Field label="Start date · YYYY-MM-DD" value={startDate} onChangeText={setStartDate} placeholder={safeToday(timezone)} />}
        <Field label="Timezone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" placeholder="America/Chicago" />
        {!templateEditor && allowedSquads.length > 0 && <>
          <Txt muted>Plan audience</Txt>
          <Chips options={scopeOptions} value={scopeValue} onChange={setScopeFromLabel} />
        </>}
        {steps.map((step, index) => <View key={index} style={styles.card}>
          <Text style={styles.h2}>Beacon {index + 1}</Text>
          <Field label="What are you doing?" value={step.title} onChangeText={(v) => updateStep(index, { title: v })} maxLength={120} placeholder="Breakfast, a walk, a museum…" />
          <Field label="Details (optional)" value={step.description} onChangeText={(v) => updateStep(index, { description: v })} maxLength={2000} multiline />
          <Chips options={categories} value={step.category} onChange={(v) => updateStep(index, { category: v })} />
          <Field label="Day offset from start" value={String(step.day_offset)} onChangeText={(v) => updateStep(index, { day_offset: Number(v) })} keyboardType="number-pad" />
          <Field label="Local start time · HH:mm" value={step.start_time} onChangeText={(v) => updateStep(index, { start_time: v })} placeholder="09:30" />
          <Field label="Duration in minutes" value={String(step.duration_minutes)} onChangeText={(v) => updateStep(index, { duration_minutes: Number(v) })} keyboardType="number-pad" />
          <Field label="Meeting place (optional)" value={step.location_name} onChangeText={(v) => updateStep(index, { location_name: v })} maxLength={160} />
          {aspirations.length > 0 && <>
            <Txt muted>Connect this beacon to an aspiration</Txt>
            {aspirations.map((aspiration) => {
              const checked = (step.aspiration_ids ?? []).includes(aspiration.id);
              return <Button key={aspiration.id} secondary={!checked} title={`${checked ? "✓ " : ""}${aspiration.title}`} onPress={() => updateStep(index, { aspiration_ids: checked ? step.aspiration_ids?.filter((id) => id !== aspiration.id) : [...(step.aspiration_ids ?? []), aspiration.id] })} />;
            })}
          </>}
          {steps.length > 1 && <Button title="Remove this beacon" secondary onPress={() => setSteps((current) => current.filter((_, i) => i !== index))} />}
        </View>)}
        {previewOccurrences.length > 0 && <View style={styles.card}>
          <Text style={styles.h2}>Schedule preview</Text>
          {previewOccurrences.map((occurrence) => <Txt key={occurrence.step_index}>Day {occurrence.step.day_offset + 1} · {new Date(occurrence.starts_at).toLocaleString([], { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} → {new Date(occurrence.ends_at).toLocaleTimeString([], { timeZone: timezone, hour: "numeric", minute: "2-digit" })}</Txt>)}
        </View>}
        {steps.length < 30 && <Button title="Add another beacon" secondary onPress={() => setSteps((current) => [...current, blankStep()])} />}
        {(activityConflictNotes.length > 0 || internalConflicts.length > 0) && <View style={styles.card}>
          <Text style={styles.h2}>Time conflicts</Text>
          <Txt muted>Review the overlaps and suggested local start times. For a squad plan, check the alternate time with your squad.</Txt>
          {internalConflicts.map((note) => <Txt key={note}>{note}</Txt>)}
          {activityConflictNotes.map((note) => <Txt key={note}>{note}</Txt>)}
          {conflicts.map((conflict, i) => <Txt key={`${conflict.step_index}-${i}`}>Beacon {conflict.step_index + 1} has an available alternate start: {conflict.suggested_start_time}.</Txt>)}
        </View>}
        {!templateEditor && <Action title={pendingKey === planInputKey ? "Create plan anyway" : "Create plan"} run={createPlan} />}
        <Action title={templateEditor ? "Save template" : "Save as template"} secondary disabled={!canWriteSquad} run={saveTemplate} />
      </Sheet>
    </Screen>
  );
}
