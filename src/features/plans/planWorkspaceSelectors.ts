import type { Data, Plan } from "@/src/shared/types";
import {
  planPermissions,
  planStops,
  stopActivity,
  stopThread,
} from "./livingPlans";
import { isLocalDate } from "./routines";

export function planDateLabel(value: string | null, now = Date.now()) {
  if (!value || !isLocalDate(value)) return "Date undecided";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(value.slice(0, 4) !== String(new Date(now).getUTCFullYear())
      ? { year: "numeric" as const }
      : {}),
  });
}

export function planListPresentation(
  data: Data,
  plan: Plan,
  viewer: string | null,
  now: number,
) {
  if (
    data.viewer_id !== viewer ||
    !planPermissions(data, plan, viewer).readable
  )
    return {
      date: "Date unavailable",
      context: "Plan unavailable",
      progress: "",
    };
  const stops = planStops(data, plan, viewer).filter(
    (stop) => stop.state === "active",
  );
  const linked = stops.filter(
    (stop) => !!stopActivity(data, stop, viewer),
  ).length;
  const ideas = stops.filter(
    (stop) => !stop.activity_id && !stop.thread_id,
  ).length;
  const decisions = stops.filter(
    (stop) =>
      !!stopThread(data, stop, viewer) && !stopActivity(data, stop, viewer),
  ).length;
  const pending = stops.filter((stop) => stop.approval === "pending").length;
  const progress =
    [
      linked ? `${linked} linked ${linked === 1 ? "Beacon" : "Beacons"}` : "",
      ideas ? `${ideas} ${ideas === 1 ? "idea" : "ideas"}` : "",
      decisions
        ? `${decisions} ${decisions === 1 ? "decision" : "decisions"}`
        : "",
      pending
        ? `${pending} ${pending === 1 ? "suggestion" : "suggestions"} pending`
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || (stops.length ? "Stops unavailable" : "No stops yet");
  return {
    date: planDateLabel(plan.start_date, now),
    context: plan.squad_id
      ? (data.squads.find((squad) => squad.id === plan.squad_id)?.name ??
        "Squad")
      : "Personal",
    progress:
      plan.status === "cancelled" ? `Cancelled · ${progress}` : progress,
  };
}

/** Uses readable lifecycle records; missing references never imply work to do. */
export function hasUnfinishedPlanWork(
  data: Data,
  plan: Plan,
  viewer: string | null,
  now: number,
) {
  if (
    data.viewer_id !== viewer ||
    !planPermissions(data, plan, viewer).contribute ||
    plan.routine_source
  )
    return false;
  const stops = planStops(data, plan, viewer).filter(
    (stop) => stop.state === "active" && stop.approval !== "dismissed",
  );
  const activities = stops.flatMap((stop) => {
    const activity = stopActivity(data, stop, viewer);
    return activity ? [activity] : [];
  });
  const historical =
    activities.length > 0 &&
    activities.every(
      (activity) =>
        activity.status !== "scheduled" ||
        (activity.plan_started_at !== null &&
          Date.parse(activity.ends_at) <= now),
    );
  if (!stops.length) return plan.status === "draft";
  return stops.some((stop) => {
    if (stop.approval === "pending") return true;
    const activity = stopActivity(data, stop, viewer);
    if (activity)
      return (
        activity.status === "scheduled" && activity.plan_started_at === null
      );
    const thread = stopThread(data, stop, viewer);
    if (thread)
      return (
        !thread.not_organized_at &&
        !thread.continuation_closed_at &&
        !thread.materialized_activity_id &&
        ((thread.status === "open" && Date.parse(thread.deadline_at) > now) ||
          (!!thread.finalized_at && thread.status === "resolved"))
      );
    return !stop.activity_id && !stop.thread_id && !historical;
  });
}

export function continuePlanning(
  data: Data,
  viewer: string | null,
  now: number,
) {
  return data.plans
    .filter((plan) => hasUnfinishedPlanWork(data, plan, viewer, now))
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
    )
    .slice(0, 3);
}
