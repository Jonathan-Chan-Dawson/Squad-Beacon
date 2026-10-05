import type { Activity, ActivityPlace, Plan, PlanStep } from "@/src/shared/types";
import { buildPlanSchedule } from "@/src/features/plans/domain";

/** ISO weekday numbers: Monday = 1 … Sunday = 7. */
export interface PlanMember {
  plan_id: string;
  user_id: string;
  joined_at: string;
}

export type PlanRoutineStatus = "active" | "paused" | "ended";

/** A recurring Beacon Plan. Beacon steps remain the source of truth for each occurrence. */
export interface PlanRoutine {
  id: string;
  plan_id: string;
  owner_id: string;
  weekdays: number[];
  interval_weeks: number;
  anchor_date: string;
  ends_on: string | null;
  reminder_minutes: number | null;
  status: PlanRoutineStatus;
  next_occurrence_on: string | null;
  created_at: string;
  updated_at: string;
}

export type RoutineDemoAction =
  | "pause_routine"
  | "resume_routine"
  | "skip_routine_next"
  | "end_routine"
  | "edit_routine"
  | "run_routine_once";
export type PlanRoutineDemoAction = RoutineDemoAction | "create_routine" | "join_plan" | "leave_plan";

export type RoutineDemoSnapshot = {
  plans: Plan[];
  activities: Activity[];
  places: ActivityPlace[];
  squad_members?: { squad_id: string; user_id: string; role: "owner" | "coowner" | "admin" | "elder" | "member" }[];
  blocks?: { blocker_id: string; blocked_id: string }[];
  plan_routines?: PlanRoutine[];
  plan_members?: PlanMember[];
};

/** Arrays returned here are additions/replacements for the caller's demo reducer to merge. */
export interface RoutineDemoAdditions {
  plan_routines: PlanRoutine[];
  plans: Plan[];
  activities: Activity[];
  places: ActivityPlace[];
  plan_members: PlanMember[];
  remove_plan_members: { plan_id: string; user_id: string }[];
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addLocalDays(value: string, days: number): string {
  if (!isLocalDate(value) || !Number.isInteger(days)) throw new Error("Use a valid date and whole number of days.");
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isoWeekday(value: string): number {
  if (!isLocalDate(value)) throw new Error("Use a valid date.");
  const weekday = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function validateRoutineSchedule(input: {
  weekdays: number[];
  interval_weeks: number;
  anchor_date: string;
  ends_on?: string | null;
  reminder_minutes?: number | null;
}): void {
  if (!Array.isArray(input.weekdays) || !input.weekdays.length || input.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error("Choose one or more weekdays.");
  }
  if (new Set(input.weekdays).size !== input.weekdays.length) throw new Error("Each weekday can only be selected once.");
  if (!Number.isInteger(input.interval_weeks) || input.interval_weeks < 1 || input.interval_weeks > 52) {
    throw new Error("Repeat interval must be between 1 and 52 weeks.");
  }
  if (!isLocalDate(input.anchor_date)) throw new Error("Choose a valid routine start date.");
  if (input.ends_on != null && (!isLocalDate(input.ends_on) || input.ends_on < input.anchor_date)) {
    throw new Error("Routine end date must be on or after its start date.");
  }
  if (input.reminder_minutes != null && (!Number.isInteger(input.reminder_minutes) || input.reminder_minutes < 1 || input.reminder_minutes > 10080)) {
    throw new Error("Reminder timing must be between 1 minute and one week.");
  }
}

/**
 * Find the next local calendar date after `afterDate` that matches the anchored
 * interval and weekday set. Dates are compared as ISO local dates, not UTC instants.
 */
export function nextRoutineOccurrence(input: {
  anchor_date: string;
  weekdays: number[];
  interval_weeks: number;
  after_date: string;
  ends_on?: string | null;
}): string | null {
  validateRoutineSchedule({ ...input, ends_on: input.ends_on ?? null });
  if (!isLocalDate(input.after_date)) throw new Error("Choose a valid reference date.");
  const anchorMonday = addLocalDays(input.anchor_date, 1 - isoWeekday(input.anchor_date));
  let candidate = input.after_date < input.anchor_date ? input.anchor_date : addLocalDays(input.after_date, 1);
  const weekdays = new Set(input.weekdays);
  // The cap bounds malformed or unexpectedly distant requests while covering decades.
  for (let day = 0; day < 366 * 52; day++, candidate = addLocalDays(candidate, 1)) {
    if (input.ends_on && candidate > input.ends_on) return null;
    if (!weekdays.has(isoWeekday(candidate))) continue;
    const candidateMonday = addLocalDays(candidate, 1 - isoWeekday(candidate));
    const weekDelta = Math.round((Date.parse(`${candidateMonday}T00:00:00Z`) - Date.parse(`${anchorMonday}T00:00:00Z`)) / 604800000);
    if (weekDelta >= 0 && weekDelta % input.interval_weeks === 0) return candidate;
  }
  return null;
}

function dateInZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function upcomingWeekday(anchor: string, weekday: number): string {
  const delta = (weekday - isoWeekday(anchor) + 7) % 7;
  return addLocalDays(anchor, delta);
}

function emptyAdditions(): RoutineDemoAdditions {
  return { plan_routines: [], plans: [], activities: [], places: [], plan_members: [], remove_plan_members: [] };
}

function demoCanManagePlan(data: RoutineDemoSnapshot, plan: Plan, userId: string): boolean {
  if (plan.owner_id === userId) return true;
  if (!plan.squad_id) return false;
  const membership = data.squad_members?.find((member) => member.squad_id === plan.squad_id && member.user_id === userId);
  const blocked = data.blocks?.some((block) =>
    (block.blocker_id === userId && block.blocked_id === plan.owner_id) ||
    (block.blocker_id === plan.owner_id && block.blocked_id === userId));
  return !!membership && ["owner", "coowner", "admin"].includes(membership.role) && !blocked;
}

function demoCanJoinPlan(data: RoutineDemoSnapshot, plan: Plan, userId: string): boolean {
  if (!plan.squad_id || plan.status !== "scheduled" || plan.owner_id === userId) return false;
  const member = data.squad_members?.some((row) => row.squad_id === plan.squad_id && row.user_id === userId);
  const blocked = data.blocks?.some((block) =>
    (block.blocker_id === userId && block.blocked_id === plan.owner_id) ||
    (block.blocker_id === plan.owner_id && block.blocked_id === userId));
  return !!member && !blocked;
}

/** General demo reducer contract for routine creation/lifecycle and Plan membership. */
export function applyPlanRoutineDemo(
  data: RoutineDemoSnapshot,
  action: PlanRoutineDemoAction,
  payload: Record<string, unknown>,
  userId: string,
  now = new Date(),
): RoutineDemoAdditions {
  if (action !== "create_routine" && action !== "join_plan" && action !== "leave_plan") {
    return applyRoutineDemo(data, action, payload, userId, now);
  }
  const additions = emptyAdditions();
  if (action === "join_plan" || action === "leave_plan") {
    const planId = String(payload.plan_id ?? "");
    const plan = data.plans.find((item) => item.id === planId);
    const current = data.plan_members?.find((row) => row.plan_id === planId && row.user_id === userId);
    if (!plan) throw new Error("This Beacon Plan is unavailable.");
    if (plan.owner_id === userId) throw new Error("You are already the owner of this Beacon Plan.");
    if (action === "join_plan") {
      if (!demoCanJoinPlan(data, plan, userId)) throw new Error("Only a current Squad member can join this Beacon Plan.");
      if (!current) additions.plan_members.push({ plan_id: planId, user_id: userId, joined_at: now.toISOString() });
    } else {
      if (!current) throw new Error("You have not joined this Beacon Plan.");
      if (!demoCanJoinPlan(data, plan, userId)) throw new Error("This Beacon Plan is unavailable to leave.");
      additions.remove_plan_members.push({ plan_id: planId, user_id: userId });
    }
    return additions;
  }

  const planId = String(payload.plan_id ?? "");
  const source = data.plans.find((plan) => plan.id === planId);
  if (!source || source.status !== "scheduled" || !demoCanManagePlan(data, source, userId)) {
    throw new Error("Only the Plan owner or a scoped Squad admin can make this Plan a Routine.");
  }
  if (!data.activities.some((activity) => activity.plan_id === source.id)) throw new Error("A Routine needs at least one Beacon in its source Plan.");
  const weekdays = Array.isArray(payload.weekdays) ? payload.weekdays.map(Number) : [];
  const interval_weeks = Number(payload.interval_weeks ?? 1);
  const ends_on = payload.ends_on == null || payload.ends_on === "" ? null : String(payload.ends_on);
  const reminder_minutes = payload.reminder_minutes == null || payload.reminder_minutes === "" ? null : Number(payload.reminder_minutes);
  validateRoutineSchedule({ anchor_date: source.start_date, weekdays, interval_weeks, ends_on, reminder_minutes });
  const localToday = dateInZone(now, source.timezone);
  const next = nextRoutineOccurrence({ anchor_date: source.start_date, weekdays, interval_weeks, after_date: localToday, ends_on });
  if (!next) throw new Error("This Routine has no upcoming date before its end date.");
  const id = `demo-routine:${userId}:${source.id}`;
  if (data.plan_routines?.some((routine) => routine.id === id)) throw new Error("This Beacon Plan already has a Routine.");
  additions.plan_routines.push({
    id,
    plan_id: source.id,
    owner_id: source.owner_id,
    weekdays: [...weekdays].sort((a, b) => a - b),
    interval_weeks,
    anchor_date: source.start_date,
    ends_on,
    reminder_minutes,
    status: "active",
    next_occurrence_on: next,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  return additions;
}

/** A real-shaped Friday routine fixture for the demo account, with source Beacons. */
export function makeRoutineDemo(data: RoutineDemoSnapshot, userId: string, now = new Date()): RoutineDemoAdditions {
  const ids = `demo-routine:${userId}:friday`;
  if (data.plan_routines?.some((routine) => routine.id === ids) || data.plans.some((plan) => plan.id === `${ids}:plan`)) return emptyAdditions();
  const timezone = "America/Chicago";
  let anchor = dateInZone(now, timezone);
  let startDate = upcomingWeekday(anchor, 5);
  const currentFridayIsPast = startDate === anchor && now.getTime() >= Date.parse(`${startDate}T23:59:59`);
  if (currentFridayIsPast || (startDate === anchor && isoWeekday(anchor) !== 5)) startDate = addLocalDays(startDate, 7);
  // When called on Friday, keep the fixture future-dated so every sample Beacon is actionable.
  if (startDate === anchor) startDate = addLocalDays(startDate, 7);
  const steps: PlanStep[] = [
    { title: "Dinner together", description: "A relaxed start to the Friday night routine.", category: "Social", location_name: "", lat: null, lng: null, day_offset: 0, start_time: "18:30", duration_minutes: 75, aspiration_ids: [] },
    { title: "Bowling", description: "One game, no scorekeeping required.", category: "Social", location_name: "", lat: null, lng: null, day_offset: 0, start_time: "20:00", duration_minutes: 90, aspiration_ids: [] },
    { title: "Wind down", description: "A final low-key hangout.", category: "Social", location_name: "", lat: null, lng: null, day_offset: 0, start_time: "21:45", duration_minutes: 60, aspiration_ids: [] },
  ];
  const schedule = buildPlanSchedule(startDate, timezone, steps);
  const planId = `${ids}:plan`;
  const createdAt = now.toISOString();
  const plan: Plan = { id: planId, owner_id: userId, squad_id: null, title: "Friday Night Routine · First plan", description: "A recurring Friday plan. Each date becomes a fresh Beacon Plan.", timezone, start_date: startDate, status: "scheduled", created_at: createdAt };
  const activities: Activity[] = schedule.map((occurrence) => ({
    id: `${planId}:beacon:${occurrence.step_index + 1}`,
    owner_id: userId,
    title: occurrence.step.title,
    description: occurrence.step.description,
    target_count: null,
    category: occurrence.step.category,
    mode: "solo",
    starts_at: occurrence.starts_at,
    ends_at: occurrence.ends_at,
    timezone,
    approval_required: false,
    status: "scheduled",
    goal_id: null,
    habit_id: null,
    plan_id: planId,
    plan_step_index: occurrence.step_index,
    aspiration_ids: [],
    audience: "private",
    audience_id: null,
  }));
  const routine: PlanRoutine = {
    id: ids,
    plan_id: planId,
    owner_id: userId,
    weekdays: [5],
    interval_weeks: 1,
    anchor_date: startDate,
    ends_on: null,
    reminder_minutes: 30,
    status: "active",
    next_occurrence_on: nextRoutineOccurrence({ anchor_date: startDate, weekdays: [5], interval_weeks: 1, after_date: startDate }),
    created_at: createdAt,
    updated_at: createdAt,
  };
  return {
    plan_routines: [routine],
    plans: [plan],
    activities,
    places: activities.map((activity, index) => ({ activity_id: activity.id, label: steps[index].location_name, latitude: steps[index].lat, longitude: steps[index].lng, online_url: null })),
    plan_members: [],
    remove_plan_members: [],
  };
}

/** Demo-only equivalent of routine lifecycle actions; production always uses server actions. */
export function applyRoutineDemo(
  data: RoutineDemoSnapshot,
  action: RoutineDemoAction,
  payload: Record<string, unknown>,
  userId: string,
  now = new Date(),
): RoutineDemoAdditions {
  const additions = emptyAdditions();
  const routineId = String(payload.id ?? "");
  const current = data.plan_routines?.find((item) => item.id === routineId);
  const sourcePlanForAccess = current && data.plans.find((plan) => plan.id === current.plan_id);
  if (!current || !sourcePlanForAccess || !demoCanManagePlan(data, sourcePlanForAccess, userId)) throw new Error("Routine unavailable.");
  const routine: PlanRoutine = { ...current, weekdays: [...current.weekdays], updated_at: now.toISOString() };
  const patchSchedule = () => {
    const weekdayValues = Array.isArray(payload.weekdays) ? payload.weekdays.map(Number) : routine.weekdays;
    routine.weekdays = [...weekdayValues].sort((a, b) => a - b);
    routine.interval_weeks = Number(payload.interval_weeks ?? routine.interval_weeks);
    routine.ends_on = payload.ends_on == null || payload.ends_on === "" ? null : String(payload.ends_on);
    routine.reminder_minutes = payload.reminder_minutes == null || payload.reminder_minutes === "" ? null : Number(payload.reminder_minutes);
    validateRoutineSchedule(routine);
    routine.next_occurrence_on = nextRoutineOccurrence({ ...routine, after_date: addLocalDays(dateInZone(now, data.plans.find((plan) => plan.id === routine.plan_id)?.timezone ?? "UTC"), -1) });
  };
  if (action === "pause_routine") routine.status = "paused";
  else if (action === "resume_routine") {
    routine.status = "active";
    if (!routine.next_occurrence_on) patchSchedule();
  } else if (action === "end_routine") {
    routine.status = "ended";
    routine.next_occurrence_on = null;
  } else if (action === "edit_routine") patchSchedule();
  else if (action === "skip_routine_next") {
    if (routine.status !== "active" || !routine.next_occurrence_on) throw new Error("There is no upcoming routine date to skip.");
    routine.next_occurrence_on = nextRoutineOccurrence({ ...routine, after_date: routine.next_occurrence_on });
    if (!routine.next_occurrence_on) routine.status = "ended";
  } else if (action === "run_routine_once") {
    if (routine.status !== "active" || !routine.next_occurrence_on) throw new Error("There is no upcoming routine date to run.");
    const source = data.plans.find((plan) => plan.id === routine.plan_id);
    const sourceBeacons = data.activities.filter((activity) => activity.plan_id === routine.plan_id).sort((a, b) => (a.plan_step_index ?? 0) - (b.plan_step_index ?? 0));
    if (!source || !demoCanManagePlan(data, source, userId) || !sourceBeacons.length) throw new Error("The source Beacon Plan is unavailable.");
    const steps: PlanStep[] = sourceBeacons.map((activity) => {
      const place = data.places.find((item) => item.activity_id === activity.id);
      const local = new Intl.DateTimeFormat("en-GB", { timeZone: source.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(activity.starts_at));
      const sourceDate = dateInZone(new Date(activity.starts_at), source.timezone);
      return { title: activity.title, description: activity.description ?? "", category: activity.category, location_name: place?.label ?? "", lat: place?.latitude ?? null, lng: place?.longitude ?? null, day_offset: Math.round((Date.parse(`${sourceDate}T00:00:00Z`) - Date.parse(`${source.start_date}T00:00:00Z`)) / 86400000), start_time: local, duration_minutes: Math.max(1, Math.round((Date.parse(activity.ends_at) - Date.parse(activity.starts_at)) / 60000)), aspiration_ids: activity.aspiration_ids ?? [] };
    });
    const newPlanId = `${routine.id}:run:${routine.next_occurrence_on}`;
    const newPlan: Plan = { ...source, id: newPlanId, title: source.title.replace(/ · First plan$/, ""), start_date: routine.next_occurrence_on, created_at: now.toISOString() };
    additions.plans.push(newPlan);
    additions.activities.push(...buildPlanSchedule(newPlan.start_date, source.timezone, steps).map((occurrence) => ({
      ...sourceBeacons[occurrence.step_index], id: `${newPlanId}:beacon:${occurrence.step_index + 1}`, owner_id: source.owner_id,
      title: occurrence.step.title, description: occurrence.step.description, starts_at: occurrence.starts_at, ends_at: occurrence.ends_at,
      status: "scheduled" as const, plan_id: newPlanId, plan_step_index: occurrence.step_index,
    })));
    additions.places.push(...steps.map((step, index) => ({
      activity_id: `${newPlanId}:beacon:${index + 1}`,
      label: step.location_name,
      latitude: step.lat,
      longitude: step.lng,
      online_url: data.places.find((place) => place.activity_id === sourceBeacons[index].id)?.online_url ?? null,
    })));
    routine.next_occurrence_on = nextRoutineOccurrence({ ...routine, after_date: routine.next_occurrence_on });
    if (!routine.next_occurrence_on) routine.status = "ended";
  }
  additions.plan_routines.push(routine);
  return additions;
}
