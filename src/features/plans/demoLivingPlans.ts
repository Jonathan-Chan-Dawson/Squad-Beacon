import type { Data, Payload, Plan } from "@/src/shared/types";
import {
  compatiblePlanActivity,
  planPermissions,
  planStops,
  validateIdea,
} from "./livingPlans";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { isLocalDate } from "./routines";

export const livingPlanActions = new Set([
  "create_living_plan",
  "update_living_plan",
  "add_plan_stop",
  "edit_plan_stop",
  "link_plan_stop",
  "remove_plan_stop",
  "move_plan_stop",
  "review_plan_stop",
  "save_living_plan_template",
]);

export function connectDemoPlanResults(
  previous: Data,
  next: Data,
  viewer: string,
  action: string,
  payload: Payload,
): Data {
  next.plan_stops ??= [];
  for (const activity of next.activities.filter(
    (a) => a.plan_id && !previous.activities.some((old) => old.id === a.id),
  )) {
    if (
      !next.plan_stops.some(
        (s) => s.plan_id === activity.plan_id && s.activity_id === activity.id,
      )
    )
      next.plan_stops.push({
        id: `stop:${activity.id}`,
        plan_id: activity.plan_id!,
        author_id: activity.owner_id,
        position: activity.plan_step_index ?? 0,
        title: "",
        details: "",
        proposed_at: null,
        activity_id: activity.id,
        thread_id: null,
        approval: "approved",
        state: "active",
        created_at: new Date().toISOString(),
      });
  }
  if (
    [
      "create_activity",
      "create_activity_with_invitees",
      "create_planning_thread",
    ].includes(action) &&
    payload.return_plan_id
  ) {
    const thread =
      action === "create_planning_thread"
        ? next.planning_threads.find(
            (t) => !previous.planning_threads.some((old) => old.id === t.id),
          )
        : undefined;
    const activity =
      action !== "create_planning_thread"
        ? next.activities.find(
            (a) => !previous.activities.some((old) => old.id === a.id),
          )
        : undefined;
    if (thread || activity)
      next = applyDemoLivingPlan(
        next,
        viewer,
        payload.plan_stop_id ? "link_plan_stop" : "add_plan_stop",
        {
          plan_id: payload.return_plan_id,
          stop_id: payload.plan_stop_id,
          ...(thread
            ? { thread_id: thread.id }
            : { activity_id: activity!.id }),
          position: payload.stop_position,
          after_stop_id: payload.stop_after_id ?? payload.plan_after_stop_id,
        },
      )!;
  }
  if (action === "send_group_message" && payload.plan_id) {
    const plan = next.plans.find((p) => p.id === payload.plan_id);
    if (
      !plan ||
      !planPermissions(next, plan, viewer).readable ||
      payload.scope !== "squad" ||
      plan.squad_id !== payload.squad_id
    )
      throw new Error("This Plan is not shared with this chat.");
    const message = next.group_messages.find(
      (m) => !previous.group_messages.some((old) => old.id === m.id),
    );
    if (message) message.plan_id = plan.id;
  }
  for (const stop of next.plan_stops ?? []) {
    const thread = next.planning_threads.find((t) => t.id === stop.thread_id);
    const activity = next.activities.find(
      (a) => a.id === thread?.materialized_activity_id,
    );
    const plan = next.plans.find((p) => p.id === stop.plan_id);
    if (
      activity &&
      plan &&
      planPermissions(next, plan, viewer).readable &&
      compatiblePlanActivity(next, plan, activity, viewer) &&
      !next.plan_stops?.some(
        (s) =>
          s.id !== stop.id &&
          s.plan_id === stop.plan_id &&
          s.activity_id === activity.id,
      )
    )
      stop.activity_id = activity.id;
  }
  return next;
}

export function applyDemoLivingPlan(
  previous: Data,
  viewer: string,
  action: string,
  payload: Payload,
): Data | undefined {
  if (!livingPlanActions.has(action)) return;
  if (payload.expected_actor_id && payload.expected_actor_id !== viewer)
    throw new Error("Your account changed.");
  const d = structuredClone(previous),
    id = () => `plan-${Math.random().toString(36).slice(2)}`;
  d.plan_stops ??= [];
  if (action === "create_living_plan") {
    const title = String(payload.title ?? "").trim(),
      squad = payload.squad_id ? String(payload.squad_id) : null;
    if (!title || title.length > 100)
      throw new Error("Give your Plan a name up to 100 characters.");
    if (
      squad &&
      !d.squad_members.some((m) => m.squad_id === squad && m.user_id === viewer)
    )
      throw new Error("Join this Squad first.");
    new Intl.DateTimeFormat("en", { timeZone: String(payload.timezone) });
    if (payload.start_date && !isLocalDate(String(payload.start_date)))
      throw new Error("Choose a valid date.");
    const plan: Plan = {
      id: id(),
      owner_id: viewer,
      squad_id: squad,
      title,
      description: String(payload.description ?? ""),
      timezone: String(payload.timezone),
      start_date: payload.start_date ? String(payload.start_date) : null,
      status: "draft",
      revision: 0,
      coowner_ids: [],
      open_collaboration: false,
      created_at: new Date().toISOString(),
    };
    const template = payload.template_id
      ? d.plan_templates.find(
          (t) =>
            t.id === payload.template_id &&
            (t.squad_id ? t.squad_id === squad : t.owner_id === viewer),
        )
      : undefined;
    if (payload.template_id && !template)
      throw new Error("Template unavailable.");
    const ideas = template
      ? (template.stops ??
        template.steps.map((s) => ({ title: s.title, details: s.description })))
      : ((payload.stops ?? []) as { title: string; details?: string }[]);
    if (!Array.isArray(ideas) || ideas.length > 30)
      throw new Error("Use up to 30 stops.");
    d.plans.push(plan);
    ideas.forEach((idea, position) =>
      d.plan_stops!.push({
        id: id(),
        plan_id: plan.id,
        author_id: viewer,
        position,
        ...validateIdea(idea.title, idea.details),
        activity_id: null,
        thread_id: null,
        approval: "approved",
        state: "active",
        created_at: plan.created_at,
      }),
    );
    return d;
  }
  const plan = d.plans.find((p) => p.id === payload.plan_id);
  if (!plan) throw new Error("Plan unavailable.");
  const access = planPermissions(d, plan, viewer);
  if (!access.contribute) throw new Error("Plan unavailable.");
  if (
    payload.revision != null &&
    Number(payload.revision) !== (plan.revision ?? 0)
  )
    throw new Error("This Plan changed. Refresh before saving.");
  for (const stop of planStops(d, plan, viewer, true))
    if (!d.plan_stops.some((s) => s.id === stop.id)) d.plan_stops.push(stop);
  const stop = d.plan_stops.find(
    (s) => s.plan_id === plan.id && s.id === payload.stop_id,
  );
  const activity = d.activities.find((a) => a.id === payload.activity_id);
  const thread = d.planning_threads.find((t) => t.id === payload.thread_id);
  const checkReference = () => {
    if (
      payload.activity_id &&
      (!activity || !compatiblePlanActivity(d, plan, activity, viewer))
    )
      throw new Error(
        "This activity is not compatible with the Plan audience.",
      );
    if (
      payload.thread_id &&
      (!thread ||
        !canReadPlanningThread(d, thread, viewer) ||
        (plan.squad_id &&
          (thread.audience !== "squad" ||
            thread.audience_id !== plan.squad_id)))
    )
      throw new Error(
        "This decision is not compatible with the Plan audience.",
      );
    if (
      d.plan_stops!.some(
        (s) =>
          s.plan_id === plan.id &&
          s.id !== stop?.id &&
          ((payload.activity_id && s.activity_id === payload.activity_id) ||
            (payload.thread_id && s.thread_id === payload.thread_id)),
      )
    )
      throw new Error("This activity is already in the Plan.");
  };
  if (action === "add_plan_stop") {
    if ((payload.activity_id || payload.thread_id) && !access.editor)
      throw new Error("Suggest an idea for an organizer to review.");
    checkReference();
    const rows = d.plan_stops.filter((s) => s.plan_id === plan.id);
    if (rows.filter((s) => s.approval !== "dismissed").length >= 30)
      throw new Error("Use up to 30 stops.");
    const anchor = rows.find((s) => s.id === payload.after_stop_id);
    if (payload.after_stop_id && !anchor)
      throw new Error(
        "The insertion stop changed. Choose where to add this activity again.",
      );
    const position = anchor
      ? anchor.position + 1
      : payload.position == null
        ? Math.max(-1, ...rows.map((s) => s.position)) + 1
        : Math.max(0, Number(payload.position));
    rows.filter((s) => s.position >= position).forEach((s) => s.position++);
    d.plan_stops.push({
      id: id(),
      plan_id: plan.id,
      author_id: viewer,
      position,
      ...(activity || thread
        ? { title: "", details: "", proposed_at: null }
        : validateIdea(payload.title, payload.details, payload.proposed_at)),
      activity_id: activity?.id ?? null,
      thread_id: thread?.id ?? null,
      approval:
        access.editor || (plan.open_collaboration && !activity && !thread)
          ? "approved"
          : "pending",
      state: "active",
      created_at: new Date().toISOString(),
    });
  } else if (action === "update_living_plan") {
    if (!access.editor)
      throw new Error("Only Plan organizers can edit this Plan.");
    if (
      (payload.coowner_ids ||
        payload.open_collaboration != null ||
        payload.cancel) &&
      !access.owner
    )
      throw new Error("Only the owner can change Plan access.");
    if (payload.coowner_ids) {
      const coowners = payload.coowner_ids as string[];
      if (
        !Array.isArray(coowners) ||
        coowners.length > 10 ||
        coowners.some(
          (uid) =>
            !d.squad_members.some(
              (m) => m.squad_id === plan.squad_id && m.user_id === uid,
            ) ||
            d.blocks.some(
              (b) =>
                (b.blocker_id === uid && b.blocked_id === viewer) ||
                (b.blocked_id === uid && b.blocker_id === viewer),
            ),
        )
      )
        throw new Error("Choose authorized Squad members.");
      plan.coowner_ids = coowners;
    }
    if (payload.title != null) {
      const title = String(payload.title).trim();
      if (!title || title.length > 100)
        throw new Error("Give your Plan a name up to 100 characters.");
      plan.title = title;
    }
    if (payload.start_date !== undefined) {
      if (payload.start_date && !isLocalDate(String(payload.start_date)))
        throw new Error("Choose a valid date.");
      plan.start_date = payload.start_date ? String(payload.start_date) : null;
    }
    if (payload.description != null)
      plan.description = String(payload.description);
    if (payload.open_collaboration != null)
      plan.open_collaboration = !!payload.open_collaboration;
    if (payload.cancel) plan.status = "cancelled";
  } else if (action === "save_living_plan_template") {
    if (!access.editor)
      throw new Error("Only organizers can save this template.");
    d.plan_templates.push({
      id: id(),
      owner_id: viewer,
      squad_id: null,
      title: plan.title,
      description: plan.description,
      timezone: plan.timezone,
      steps: [],
      stops: d.plan_stops
        .filter(
          (s) =>
            s.plan_id === plan.id &&
            s.approval === "approved" &&
            s.state === "active",
        )
        .map((s) => ({
          title:
            d.activities.find((a) => a.id === s.activity_id)?.title ??
            d.planning_threads.find((t) => t.id === s.thread_id)?.title ??
            s.title,
          details: s.activity_id || s.thread_id ? "" : s.details,
        })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    if (!stop) throw new Error("Stop unavailable.");
    if (action === "review_plan_stop") {
      if (
        !access.review ||
        stop.approval !== "pending" ||
        !["approved", "dismissed"].includes(String(payload.approval))
      )
        throw new Error("Only organizers can review pending suggestions.");
      stop.approval = payload.approval as "approved" | "dismissed";
    } else {
      if (!access.editor)
        throw new Error("Only Plan organizers can edit stops.");
      if (action === "remove_plan_stop")
        d.plan_stops = d.plan_stops.filter((s) => s.id !== stop.id);
      if (action === "move_plan_stop") {
        const position = Math.max(0, Number(payload.position));
        d.plan_stops
          .filter((s) => s.plan_id === plan.id && s.id !== stop.id)
          .forEach((s) => {
            if (
              position < stop.position &&
              s.position >= position &&
              s.position < stop.position
            )
              s.position++;
            else if (
              position > stop.position &&
              s.position > stop.position &&
              s.position <= position
            )
              s.position--;
          });
        stop.position = position;
      }
      if (action === "edit_plan_stop") {
        if (stop.activity_id || stop.thread_id)
          throw new Error("Edit this activity through its own controls.");
        Object.assign(
          stop,
          validateIdea(payload.title, payload.details, payload.proposed_at),
        );
        if (payload.state) stop.state = payload.state as "active" | "skipped";
      }
      if (action === "link_plan_stop") {
        if (stop.activity_id || stop.thread_id || (!activity && !thread))
          throw new Error("Choose an unlinked stop and an activity.");
        checkReference();
        Object.assign(stop, {
          activity_id: activity?.id ?? null,
          thread_id: thread?.id ?? null,
          title: "",
          details: "",
          approval: "approved",
        });
      }
    }
  }
  plan.revision = (plan.revision ?? 0) + 1;
  return d;
}
