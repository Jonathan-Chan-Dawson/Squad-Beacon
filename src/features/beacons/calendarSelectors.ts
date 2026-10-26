import { livingPlanCalendar } from "./livingPlanCalendar";
import { personalCalendarRoutine, type RoutineCalendarRow } from "./calendarRoutineProjection";
import type { Data } from "@/src/shared/types";
import { localDate } from "@/src/shared/domain";
import { confirmedHubActivities } from "./hubSelectors";
import { canReadBeaconActivity } from "./beaconModules";
import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import { addLocalDays, isLocalDate, isoWeekday } from "@/src/features/plans/routines";
import { planLocalDateTimeToISO } from "@/src/features/plans/domain";
import { getAspirationProgress } from "@/src/features/profile/aspirations";

export type CalendarItem = { activities?: {id:string;title:string;startsAt:string}[]; tentative?: boolean; routineId?: string; key: string; date: string; title: string; kind: "beacon" | "plan" | "routine"; id: string; startsAt?: string; timezone?: string; label: string };

export function calendarTimezone(data: Data, userId: string | null, fallback = "UTC") {
  const zone = data.viewer_id === userId ? data.profiles.find((profile) => profile.id === userId)?.timezone : undefined;
  try { localDate(new Date(), zone || fallback); return zone || fallback; }
  catch { return "UTC"; }
}

export function calendarMonthDates(month: string) {
  if (!isLocalDate(`${month}-01`)) throw new Error("Choose a valid calendar month.");
  const first = `${month}-01`;
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = addLocalDays(next.toISOString().slice(0, 10), -1);
  const days: string[] = [];
  for (let date = first; date <= last; date = addLocalDays(date, 1)) days.push(date);
  return { first, last, days, leading: isoWeekday(first) - 1 };
}

export function calendarWeekDates(selected: string) {
  const first = addLocalDays(selected, 1 - isoWeekday(selected));
  return Array.from({ length: 7 }, (_, index) => addLocalDays(first, index));
}

/** Calendar dates are local wall dates; conversion reuses the existing DST-aware Plan helper. */
export function calendarScheduleStart(date: string, now: number, timezone: string) {
  if (!isLocalDate(date)) throw new Error("Choose a valid date.");
  const today = localDate(new Date(now), timezone);
  if (date < today) throw new Error("Choose today or a future date to schedule.");
  if (date === today) return new Date(now).toISOString();
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(now));
  return planLocalDateTimeToISO(date, clock, timezone);
}

/** Personal commitments bypass discovery filters, but retain all existing read/approval gates. */
export function selectCalendarItems(data: Data, userId: string | null, month: string, timezone: string, now: number, projections: RoutineCalendarRow[] = []): CalendarItem[] {
  if (!userId || data.viewer_id !== userId) return [];
  const { first, last, days } = calendarMonthDates(month);
  const items: CalendarItem[] = [];
  for (const activity of confirmedHubActivities(data, userId)) {
    if (activity.status === "cancelled" || activity.plan_id && activity.plan_started_at === null) continue;
    const start = Date.parse(activity.starts_at), end = Date.parse(activity.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const firstDay = localDate(new Date(start), timezone), lastDay = localDate(new Date(end - 1), timezone);
    for (const date of days.filter((day) => day >= firstDay && day <= lastDay)) items.push({
      key: `beacon:${activity.id}:${date}`, date, id: activity.id, title: activity.title, kind: "beacon", startsAt: activity.starts_at,
      label: activity.status === "completed" || end <= now ? "History" : activity.owner_id === userId ? "Hosting" : "Confirmed Going",
    });
  }
  const modern=data.is_demo===true||data.capabilities?.living_plans===true;
  if(modern) {
    const groups=livingPlanCalendar(data,userId,days,timezone);
    const grouped=new Set(groups.flatMap(g=>g.activities?.map(a=>`${a.id}:${g.date}`)??[]));
    for(let index=items.length-1;index>=0;index--)if(items[index].kind==="beacon"&&grouped.has(`${items[index].id}:${items[index].date}`))items.splice(index,1);
    items.push(...groups);
  }
  const plans = (modern ? [] : data.plans).filter((plan) => plan.status === "scheduled" && canReadMapPlan(data, plan, userId) &&
    (plan.owner_id === userId || data.plan_members.some((member) => member.plan_id === plan.id && member.user_id === userId)));
  for (const plan of plans) {
    const source = data.activities.filter((activity) => activity.plan_id === plan.id && activity.mode !== "solo" && activity.status !== "cancelled" && canReadBeaconActivity(data, activity, userId));
    const dates = new Set(source.flatMap((activity) => Number.isFinite(Date.parse(activity.starts_at)) ? [localDate(new Date(activity.starts_at), timezone)] : []));
    for (const date of dates) if (date >= first && date <= last) items.push({ key: `plan:${plan.id}:${date}`, date, kind: "plan", id: plan.id, title: plan.title, timezone: plan.timezone, label: "Plan schedule · attendance is separate" });
  }
  for (const row of projections) {
    if (row.date<first || row.date>last) continue;
    const readable=personalCalendarRoutine(data,userId,row.routineId);
    if (!readable || readable.plan.id!==row.planId) continue;
    const {plan}=readable;
    if (row.state==="materialized") {
      const child=data.plans.find((item)=>item.id===row.occurrencePlanId && item.status==="scheduled" && canReadMapPlan(data,item,userId));
      if (!child) continue;
      if (child.routine_source && items.some(item=>item.date===row.date&&item.kind==="beacon"&&(data.plan_stops??[]).some(stop=>stop.plan_id===child.id&&stop.activity_id===item.id))) continue;
      if (items.some((item)=>item.date===row.date && (item.kind==="plan" && item.id===child.id || item.kind==="beacon" && data.activities.some((activity)=>activity.id===item.id && activity.plan_id===child.id)))) continue;
      items.push({key:`routine-plan:${row.routineId}:${row.date}`,date:row.date,kind:"plan",id:child.id,title:child.title,timezone:child.timezone,label:"Scheduled Routine Plan - attendance is separate"});
    } else {
      if (data.activities.some((activity)=>activity.plan_id===plan.id && activity.status==="scheduled" && canReadBeaconActivity(data,activity,userId) && Number.isFinite(Date.parse(activity.starts_at)) && localDate(new Date(activity.starts_at),plan.timezone)===row.date)) continue;
      items.push({key:`routine:${row.routineId}:${row.date}`,date:row.date,kind:"routine",id:plan.id,routineId:row.routineId,title:plan.title,timezone:plan.timezone,label:"Projected Routine - attendance is separate"});
    }
  }
  return items.sort((left, right) => left.date.localeCompare(right.date) || (left.startsAt ?? "").localeCompare(right.startsAt ?? "") || left.key.localeCompare(right.key));
}

export function calendarWeeklyProgress(data: Data, userId: string | null, timezone: string, now: number) {
  if (!userId || data.viewer_id !== userId) return [];
  const goals = data.profiles.find((profile) => profile.id === userId)?.aspiration_goals ?? [];
  const readable = data.activities.filter((activity) => canReadBeaconActivity(data, activity, userId));
  return goals.filter((goal) => Number.isInteger(goal.target_per_week) && goal.target_per_week > 0)
    .map((goal) => ({ title: goal.title, current: getAspirationProgress(goal, readable, userId, timezone, new Date(now)).count, target: goal.target_per_week }));
}

/** A visible week spans at most two months; keep its neighboring dates populated. */
export function selectCalendarWeekItems(data: Data, userId: string | null, selected: string, timezone: string, now: number, projections: RoutineCalendarRow[] = []) {
  const dates = new Set(calendarWeekDates(selected));
  const months = [...new Set([...dates].map((date) => date.slice(0, 7)))];
  return months.flatMap((month) => selectCalendarItems(data, userId, month, timezone, now, projections)).filter((item) => dates.has(item.date));
}
