import type { Activity, Data, Plan } from "@/src/shared/types";
import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { planLocalDateTimeToISO } from "./domain";

export function planSuggestedStart(
  plan: Plan,
  stop?: PlanStop,
  now = Date.now(),
) {
  if (stop?.proposed_at && Date.parse(stop.proposed_at) > now + 120000)
    return stop.proposed_at;
  try {
    const value = plan.start_date
      ? planLocalDateTimeToISO(plan.start_date, "18:00", plan.timezone)
      : undefined;
    return value && Date.parse(value) > now + 120000 ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface PlanStop {
  id: string;
  plan_id: string;
  author_id: string;
  position: number;
  title: string;
  details: string;
  proposed_at: string | null;
  activity_id: string | null;
  thread_id: string | null;
  approval: "approved" | "pending" | "dismissed";
  state: "active" | "skipped";
  created_at: string;
}

export const livingPlansEnabled = (data: Data) =>
  data.is_demo === true || data.capabilities?.living_plans === true;

export function planPermissions(data: Data, plan: Plan, viewer: string | null) {
  const readable = !!viewer && canReadMapPlan(data, plan, viewer);
  const owner = readable && plan.owner_id === viewer;
  const editor = readable && (owner || !!plan.coowner_ids?.includes(viewer!));
  const admin =
    readable &&
    !!plan.squad_id &&
    data.squad_members.some(
      (m) =>
        m.squad_id === plan.squad_id &&
        m.user_id === viewer &&
        ["owner", "coowner", "admin"].includes(m.role),
    );
  return {
    readable,
    owner,
    editor,
    review: editor || admin,
    contribute: readable && plan.status !== "cancelled",
  };
}

/** Legacy snapshots retain their itinerary; stable server rows take precedence. */
export function planStops(
  data: Data,
  plan: Plan,
  viewer: string | null,
  includeDismissed = false,
): PlanStop[] {
  if (!viewer || !canReadMapPlan(data, plan, viewer)) return [];
  const rows = [
    ...(data.plan_stops ?? []).filter((s) => s.plan_id === plan.id),
  ];
  const legacyFallback =
    !livingPlansEnabled(data) ||
    (data.is_demo === true && plan.revision == null);
  for (const a of data.activities.filter(
    (a) =>
      legacyFallback &&
      a.plan_id === plan.id &&
      !rows.some((s) => s.activity_id === a.id),
  )) {
    rows.push({
      id: `legacy:${a.id}`,
      plan_id: plan.id,
      author_id: a.owner_id,
      position: a.plan_step_index ?? 0,
      title: "",
      details: "",
      proposed_at: null,
      activity_id: a.id,
      thread_id: null,
      approval: "approved",
      state: "active",
      created_at: plan.created_at,
    });
  }
  return rows
    .filter(
      (s) =>
        (includeDismissed || s.approval !== "dismissed") &&
        !data.blocks.some(
          (b) =>
            (b.blocker_id === viewer && b.blocked_id === s.author_id) ||
            (b.blocked_id === viewer && b.blocker_id === s.author_id),
        ),
    )
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function stopActivity(
  data: Data,
  stop: PlanStop,
  viewer: string | null,
) {
  const thread = stopThread(data, stop, viewer);
  const activity = data.activities.find(
    (a) => a.id === (thread?.materialized_activity_id ?? stop.activity_id),
  );
  return activity && viewer && canReadBeaconActivity(data, activity, viewer)
    ? activity
    : undefined;
}
export function stopThread(data: Data, stop: PlanStop, viewer: string | null) {
  const thread = data.planning_threads.find((t) => t.id === stop.thread_id);
  return thread && viewer && canReadPlanningThread(data, thread, viewer)
    ? thread
    : undefined;
}

export function compatiblePlanActivity(
  data: Data,
  plan: Plan,
  a: Activity,
  viewer: string,
) {
  return (
    canReadBeaconActivity(data, a, viewer) &&
    (plan.squad_id
      ? a.audience === "squad" && a.audience_id === plan.squad_id
      : true)
  );
}

export const planStarters = [
  { title: "Custom", ideas: [] },
  { title: "Night Out", ideas: ["Dinner", "Something fun", "Dessert"] },
  {
    title: "Mini Adventure",
    ideas: ["Meet up", "Explore somewhere new", "A snack stop"],
  },
  {
    title: "Food Crawl",
    ideas: ["First bite", "Try something new", "Something sweet"],
  },
  {
    title: "Study Sprint",
    ideas: ["Set our goals", "Focus together", "Take a break"],
  },
  { title: "Gaming Session", ideas: ["Choose a game", "Play together"] },
  {
    title: "Outdoor Day",
    ideas: ["Find a trail", "Head outside", "Picnic break"],
  },
] as const;

export function validateIdea(
  title: unknown,
  details: unknown,
  proposedAt?: unknown,
) {
  const name = String(title ?? "").trim(),
    body = String(details ?? "").trim();
  if (!name || name.length > 120 || body.length > 2000)
    throw new Error(
      "Add a title up to 120 characters and details up to 2000 characters.",
    );
  if (proposedAt && !Number.isFinite(Date.parse(String(proposedAt))))
    throw new Error("Choose a valid proposed time.");
  return {
    title: name,
    details: body,
    proposed_at: proposedAt ? new Date(String(proposedAt)).toISOString() : null,
  };
}
