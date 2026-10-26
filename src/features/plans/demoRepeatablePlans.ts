import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import type { Activity, Data, Payload } from "@/src/shared/types";
import { localDate } from "@/src/shared/domain";
import { canManageBeacon } from "@/src/features/beacons/permissions";
import { stepsFromPlan } from "./domain";
import { canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";
import { planPermissions, planStops, stopActivity } from "./livingPlans";
import { nextRoutineOccurrence } from "./routines";

const controls = [
  "capacity_limit",
  "capacity_policy",
  "manual_closed",
  "enable_chat",
  "enable_checklist",
  "enable_journal",
  "enable_experiences",
  "enable_focus",
  "enable_reactions",
  "enable_comments",
  "enable_scoreboard",
  "enable_music",
  "checklist_edit_policy",
  "music_url",
  "display_emoji",
  "display_accent",
] as const;

export function demoRepeatablePlan(
  previous: Data,
  viewer: string,
  action: string,
  payload: Payload,
  base: (data: Data, action: string, payload: Payload) => Data,
): Data | undefined {
  if (
    ![
      "repeat_beacon",
      "create_routine",
      "edit_routine",
      "update_routine_source",
      "run_routine_now",
      "run_routine_once",
    ].includes(action)
  )
    return;
  const next = structuredClone(previous);
  next.demo_repeat_sources ??= {};
  let routine = next.plan_routines.find((r) => r.id === payload.id);
  let pid = String(payload.plan_id ?? routine?.plan_id ?? "");
  let single: Activity | undefined;
  if (action === "repeat_beacon") {
    single = next.activities.find((a) => a.id === payload.activity_id);
    if (
      !single ||
      single.mode === "solo" ||
      single.status === "cancelled" ||
      !(single.owner_id === viewer || canManageBeacon(next, single, viewer))
    )
      throw new Error("Only authorized Beacon organizers can repeat it.");
    if (
      next.plan_routines.some(
        (r) =>
          r.status !== "ended" &&
          next.plans.some(
            (p) =>
              p.id === r.plan_id &&
              p.owner_id === viewer &&
              p.routine_source &&
              next.plan_stops?.some(
                (s) => s.plan_id === p.id && s.activity_id === single!.id,
              ),
          ),
      )
    )
      return next;
    pid = `repeat:${single.id}:${Date.now()}`;
    next.plans.push({
      id: pid,
      owner_id: viewer,
      squad_id: single.audience === "squad" ? single.audience_id : null,
      title: single.title,
      description: single.description ?? "",
      timezone: single.timezone,
      start_date: localDate(new Date(single.starts_at), single.timezone),
      status: "scheduled",
      routine_source: true,
      created_at: new Date().toISOString(),
    });
    next.plan_stops ??= [];
    next.plan_stops.push({
      id: `${pid}:stop`,
      plan_id: pid,
      author_id: viewer,
      position: 0,
      title: "",
      details: "",
      proposed_at: null,
      activity_id: single.id,
      thread_id: null,
      approval: "approved",
      state: "active",
      created_at: new Date().toISOString(),
    });
  }
  const plan = next.plans.find((p) => p.id === pid);
  if (!plan) throw new Error("Routine source unavailable.");
  const access = planPermissions(next, plan, viewer);
  const admin =
    !!plan.squad_id &&
    next.squad_members.some(
      (m) =>
        m.squad_id === plan.squad_id &&
        m.user_id === viewer &&
        ["owner", "coowner", "admin"].includes(m.role),
    );
  if (
    !access.readable ||
    (!access.editor && !admin) ||
    plan.status === "cancelled"
  )
    throw new Error("Routine unavailable.");
  if (
    action === "create_routine" &&
    next.plan_routines.some((r) => r.plan_id === pid && r.status !== "ended")
  )
    return next;
  const capture = () => {
    const stops = planStops(next, plan, viewer).filter(
      (s) => s.state === "active",
    );
    const ownerView = { ...next, viewer_id: plan.owner_id };
    const rows = stops
      .filter((s) => s.approval === "approved")
      .map((s) => stopActivity(next, s, viewer))
      .filter(
        (a): a is Activity =>
          !!a &&
          a.status !== "cancelled" &&
          canReadBeaconActivity(ownerView, a, plan.owner_id),
      );
    if (!rows.length)
      throw new Error(
        "Confirm at least one Beacon before repeating this Plan.",
      );
    if (rows.length !== stops.length && !payload.confirmed_source)
      throw new Error(
        "Review unresolved stops before repeating confirmed activities only.",
      );
    const first = rows
      .map((a) => localDate(new Date(a.starts_at), plan.timezone))
      .sort()[0];
    plan.start_date =
      plan.start_date && plan.start_date < first ? plan.start_date : first;
    plan.status = "scheduled";
    const proxy = rows.map((a, index) => ({
      ...a,
      plan_id: plan.id,
      plan_step_index: index,
      plan_step: a.plan_id === plan.id ? a.plan_step : null,
      aspiration_ids: [],
    }));
    const locationAccess = rows.map((a) =>
      canReadBeaconMeetingDetails(ownerView, a, plan.owner_id),
    );
    const steps = stepsFromPlan(
      plan,
      proxy,
      next.places.filter((place) =>
        rows.some(
          (a, index) => a.id === place.activity_id && locationAccess[index],
        ),
      ),
    );
    next.demo_repeat_sources![pid] = {
      steps,
      activity_ids: rows.map((a) => a.id),
      defaults: structuredClone(rows),
      location_access: locationAccess,
      online_urls: rows.map((a, index) =>
        locationAccess[index]
          ? (next.places.find((p) => p.activity_id === a.id)?.online_url ??
            null)
          : null,
      ),
    };
  };
  if (
    action === "create_routine" ||
    action === "repeat_beacon" ||
    action === "update_routine_source" ||
    (action === "edit_routine" && payload.update_source) ||
    !next.demo_repeat_sources[pid]
  )
    capture();
  if (action === "update_routine_source") {
    if (!routine) throw new Error("Routine unavailable.");
    routine.source_reviewed_at = new Date().toISOString();
    routine.source_stop_count = next.demo_repeat_sources[pid].steps.length;
    return next;
  }
  const source = next.demo_repeat_sources[pid];
  const temp = structuredClone(next);
  temp.activities = temp.activities.filter(
    (a) => a.plan_id !== pid && !source.activity_ids.includes(a.id),
  );
  source.activity_ids.forEach((id, index) => {
    const original = next.activities.find((a) => a.id === id);
    if (!original) throw new Error("A repeat source is no longer available.");
    temp.activities.push({
      ...original,
      ...source.defaults[index],
      plan_id: pid,
      plan_step_index: index,
      plan_step: source.steps[index],
    });
  });
  temp.places = temp.places.map((place) => {
    const index = source.activity_ids.indexOf(place.activity_id);
    if (index < 0) return place;
    const step = source.steps[index];
    return {
      ...place,
      label: step.location_name,
      latitude: step.lat,
      longitude: step.lng,
      online_url: source.online_urls[index],
    };
  });
  // The generator remains the existing Plan/Routine reducer. Restore source records afterwards.
  const generated = base(
    temp,
    action === "repeat_beacon" ? "create_routine" : action,
    { ...payload, plan_id: pid },
  );
  const originals = new Map(next.activities.map((a) => [a.id, a]));
  generated.activities = generated.activities.map(
    (a) => originals.get(a.id) ?? a,
  );
  for (const original of next.activities)
    if (!generated.activities.some((a) => a.id === original.id))
      generated.activities.push(original);
  routine =
    generated.plan_routines.find((r) => r.id === payload.id) ||
    generated.plan_routines.find(
      (r) =>
        r.plan_id === pid &&
        !previous.plan_routines.some((old) => old.id === r.id),
    );
  if (
    routine &&
    (action === "repeat_beacon" || action === "create_routine") &&
    plan.start_date
  ) {
    generated.demo_routine_occurrences ??= [];
    generated.demo_routine_occurrences.push({
      routine_id: routine.id,
      occurrence_on: plan.start_date,
      occurrence_plan_id: pid,
      status: "created",
    });
    if (routine.run_mode !== "manual")
      routine.next_occurrence_on = nextRoutineOccurrence({
        ...routine,
        after_date:
          plan.start_date > localDate(new Date(), plan.timezone)
            ? plan.start_date
            : localDate(new Date(), plan.timezone),
      });
  }
  if (
    routine &&
    (action === "repeat_beacon" ||
      action === "create_routine" ||
      payload.update_source)
  ) {
    routine.source_reviewed_at = new Date().toISOString();
    routine.source_stop_count = source.steps.length;
  }
  for (const child of generated.plans.filter(
    (p) => !next.plans.some((old) => old.id === p.id),
  )) {
    child.routine_id = routine?.id;
    if (action === "run_routine_once")
      child.routine_occurrence_on = previous.plan_routines.find(
        (r) => r.id === payload.id,
      )?.next_occurrence_on;
    for (const a of generated.activities.filter(
      (a) => a.plan_id === child.id,
    )) {
      const index = a.plan_step_index ?? 0,
        defaults = source.defaults[index];
      if (defaults) {
        Object.assign(
          a,
          {
            audience: defaults.audience,
            audience_id: defaults.audience_id,
            mode: defaults.mode,
            approval_required: defaults.approval_required,
          },
          Object.fromEntries(
            (source.location_access?.[index] ? controls : [])
              .filter((key) => key in defaults)
              .map((key) => [key, (defaults as Record<string, unknown>)[key]]),
          ),
        );
        const place = generated.places.find((p) => p.activity_id === a.id);
        if (place) place.online_url = source.online_urls[index];
      }
    }
  }
  return generated;
}
