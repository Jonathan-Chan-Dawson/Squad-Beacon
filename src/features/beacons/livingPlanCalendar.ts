import type { Data } from "@/src/shared/types";
import { localDate } from "@/src/shared/domain";
import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import { planStops, stopActivity } from "@/src/features/plans/livingPlans";
import type { CalendarItem } from "./calendarSelectors";

export function livingPlanCalendar(
  data: Data,
  viewer: string,
  days: string[],
  timezone: string,
): CalendarItem[] {
  const followed = (id: string) =>
    data.plans.some(
      (p) =>
        p.id === id &&
        (p.owner_id === viewer ||
          data.plan_members.some(
            (m) => m.plan_id === id && m.user_id === viewer,
          )),
    );
  const plans = data.plans
    .filter(
      (p) =>
        p.status !== "cancelled" &&
        !p.routine_source &&
        canReadMapPlan(data, p, viewer) &&
        (followed(p.id) ||
          (p.routine_id &&
            data.plan_routines.some(
              (r) => r.id === p.routine_id && followed(r.plan_id),
            ))),
    )
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  const seen = new Set<string>();
  const groups: CalendarItem[] = [];
  for (const plan of plans) {
    const activities = planStops(data, plan, viewer)
      .filter((s) => s.approval === "approved" && s.state === "active")
      .map((s) => stopActivity(data, s, viewer))
      .filter(
        (a) => a && a.status !== "cancelled" && a.plan_started_at !== null,
      );
    let dated = false;
    for (const date of days) {
      const children = activities
        .filter((a) => {
          if (
            !a ||
            !Number.isFinite(Date.parse(a.starts_at)) ||
            !Number.isFinite(Date.parse(a.ends_at))
          )
            return false;
          return (
            date >= localDate(new Date(a.starts_at), timezone) &&
            date <= localDate(new Date(Date.parse(a.ends_at) - 1), timezone) &&
            !seen.has(`${a.id}:${date}`)
          );
        })
        .map((a) => ({ id: a!.id, title: a!.title, startsAt: a!.starts_at }));
      if (!children.length) continue;
      children.forEach((a) => seen.add(`${a.id}:${date}`));
      dated = true;
      groups.push({
        key: `plan:${plan.id}:${date}`,
        date,
        kind: "plan",
        id: plan.id,
        title: plan.title,
        timezone: plan.timezone,
        startsAt: children.map((a) => a.startsAt).sort()[0],
        label: plan.routine_id
          ? "Routine occurrence · attendance is separate"
          : "Plan itinerary · attendance is separate",
        activities: children,
      });
    }
    if (
      !dated &&
      plan.start_date &&
      days.includes(plan.start_date) &&
      plan.status === "draft"
    )
      groups.push({
        key: `tentative-plan:${plan.id}:${plan.start_date}`,
        date: plan.start_date,
        kind: "plan",
        id: plan.id,
        title: plan.title,
        timezone: plan.timezone,
        label: "Tentative Plan · not a confirmed commitment",
        tentative: true,
      });
  }
  return groups;
}
