import type { Data } from "@/src/shared/types";
import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import { addLocalDays, isLocalDate, nextRoutineOccurrence } from "@/src/features/plans/routines";
import { localDate } from "@/src/shared/domain";

export type RoutineCalendarRange = { startOn: string; endOn: string };
export type RoutineCalendarRow = { routineId: string; planId: string; date: string; state: "projected" | "materialized"; occurrencePlanId?: string };
export type RoutineCalendarResult = { rows: RoutineCalendarRow[]; truncated: boolean };
export type DemoRoutineOccurrence = { routine_id: string; occurrence_on: string; status: "created" | "skipped"; occurrence_plan_id: string | null };
export function validateRoutineCalendarRange(range: RoutineCalendarRange) {
  if (!isLocalDate(range.startOn) || !isLocalDate(range.endOn) || range.endOn < range.startOn || (Date.parse(range.endOn)-Date.parse(range.startOn))/86400000 > 61) throw new Error("Choose a calendar range of 1 to 62 days.");
  return range;
}
export function personalCalendarRoutine(data: Data, userId: string | null, routineId: string) {
  if (!userId || data.viewer_id !== userId) return undefined;
  const routine=data.plan_routines.find((item)=>item.id===routineId && item.status==="active" && item.run_mode!=="manual");
  const plan=routine && data.plans.find((item)=>item.id===routine.plan_id && item.status==="scheduled" && canReadMapPlan(data,item,userId) &&
    (item.owner_id===userId || data.plan_members.some((member)=>member.plan_id===item.id && member.user_id===userId)));
  return plan && routine ? {plan,routine} : undefined;
}
export function parseRoutineCalendarResult(value: unknown, userId: string, range: RoutineCalendarRange): RoutineCalendarResult {
  validateRoutineCalendarRange(range);
  const result=value as Record<string,unknown> | null;
  if (!result || result.viewer_id!==userId || !Array.isArray(result.rows) || result.rows.length>500 || typeof result.truncated!=="boolean" || result.limit!==500) throw new Error("Your Routine calendar could not be verified. Refresh and try again.");
  const rows: RoutineCalendarRow[]=[];
  const seen=new Set<string>();
  for (const value of result.rows) {
    const row=value as Record<string,unknown>;
    if (!row || typeof row.routine_id!=="string" || !row.routine_id || typeof row.plan_id!=="string" || !row.plan_id || typeof row.occurrence_on!=="string" || !isLocalDate(row.occurrence_on) || row.occurrence_on<range.startOn || row.occurrence_on>range.endOn || !["projected","materialized"].includes(String(row.state)) || row.state==="materialized" && (typeof row.occurrence_plan_id!=="string" || !row.occurrence_plan_id)) throw new Error("Your Routine calendar returned an invalid occurrence. Refresh and try again.");
    const key=row.routine_id+":"+row.occurrence_on;
    if (seen.has(key)) throw new Error("Your Routine calendar returned a duplicate occurrence. Refresh and try again.");
    seen.add(key);
    rows.push({routineId:row.routine_id,planId:row.plan_id,date:row.occurrence_on,state:row.state as RoutineCalendarRow["state"],...(row.state==="materialized" ? {occurrencePlanId:row.occurrence_plan_id as string}: {})});
  }
  return {rows,truncated:result.truncated};
}
/** Demo-only adapter: lifecycle actions retain an internal occurrence ledger, never hosted data. */
export function demoRoutineCalendar(data: Data, userId: string, range: RoutineCalendarRange, now: number): RoutineCalendarResult {
  validateRoutineCalendarRange(range);
  const rows: RoutineCalendarRow[]=[];
  for (const routine of [...data.plan_routines].sort((a,b)=>a.id.localeCompare(b.id))) {
    const readable=personalCalendarRoutine(data,userId,routine.id);
    if (!readable) continue;
    const {plan}=readable;
    const today=localDate(new Date(now),plan.timezone);
    const first=range.startOn>today ? range.startOn : today;
    let next=nextRoutineOccurrence({...routine,after_date:addLocalDays(first,-1)});
    while (next && next<=range.endOn) {
      const record=data.demo_routine_occurrences?.find((item)=>item.routine_id===routine.id && item.occurrence_on===next);
      let row: RoutineCalendarRow | undefined;
      if (record) {
        const child=record.status==="created" && data.plans.find((item)=>item.id===record.occurrence_plan_id && item.status==="scheduled" && canReadMapPlan(data,item,userId));
        if (child) row={routineId:routine.id,planId:plan.id,date:next,state:"materialized",occurrencePlanId:child.id};
      } else if (routine.next_occurrence_on && next>=routine.next_occurrence_on) row={routineId:routine.id,planId:plan.id,date:next,state:"projected"};
      if (row) { if (rows.length===500) return {rows,truncated:true}; rows.push(row); }
      next=nextRoutineOccurrence({...routine,after_date:next});
    }
  }
  return {rows,truncated:false};
}
