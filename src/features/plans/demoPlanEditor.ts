import type { Data, Payload } from "@/src/shared/types";
import { compatiblePlanActivity, planPermissions } from "./livingPlans";
import { validatePlanEditor, type PlanEditorDraft } from "./planEditorModel";

export function demoPlanEditor(
  data: Data,
  viewer: string,
  action: string,
  payload: Payload,
  base: (d: Data, a: string, p: Payload) => Data,
): Data | undefined {
  if (!["save_plan_editor", "schedule_plan_editor"].includes(action)) return;
  validatePlanEditor(payload as unknown as PlanEditorDraft);
  if (
    action === "schedule_plan_editor" &&
    !(payload.stops as unknown as PlanEditorDraft["stops"]).some(
      (s) => s.kind === "beacon" && s.include,
    )
  )
    throw new Error("Choose at least one unpublished Beacon to schedule.");
  let next = structuredClone(data),
    pid = String(payload.plan_id ?? "");
  if (!pid) {
    next = base(next, "create_living_plan", { ...payload, stops: [] });
    pid = next.plans.find(
      (p) => !data.plans.some((old) => old.id === p.id),
    )!.id;
  }
  const plan = next.plans.find((p) => p.id === pid);
  if (
    !plan ||
    !planPermissions(next, plan, viewer).editor ||
    plan.status === "cancelled"
  )
    throw new Error("Only current Plan organizers can edit this Plan.");
  if (payload.plan_id && Number(payload.revision) !== (plan.revision ?? 0))
    throw new Error(
      "This Plan changed. Your draft is preserved; review the latest version before saving.",
    );
  next.plan_beacon_drafts ??= [];
  for (const id of (payload.removed_stop_ids ?? []) as string[]) {
    if (!next.plan_stops?.some((s) => s.id === id && s.plan_id === pid))
      throw new Error("An activity changed. Review the Plan.");
    next = base(next, "remove_plan_stop", { plan_id: pid, stop_id: id });
    next.plan_beacon_drafts = next.plan_beacon_drafts?.filter(
      (d) => d.stop_id !== id,
    );
  }
  for (const [position, item] of (
    payload.stops as unknown as PlanEditorDraft["stops"]
  ).entries()) {
    let old = next.plan_stops?.find((s) => s.id === item.id);
    if (old && old.plan_id !== pid) throw new Error("Activity unavailable.");
    if (old?.activity_id || old?.thread_id) {
      if (
        (old.activity_id ?? null) !== (item.activity_id ?? null) ||
        (old.thread_id ?? null) !== (item.thread_id ?? null)
      )
        throw new Error(
          "Linked activities must be edited through their own controls.",
        );
    } else if (item.kind === "existing" || item.kind === "decision") {
      const a = next.activities.find((a) => a.id === item.activity_id);
      if (
        item.kind === "existing" &&
        (!a || !compatiblePlanActivity(next, plan, a, viewer))
      )
        throw new Error("Activity is not compatible with this Plan.");
      if (old)
        next = base(next, "link_plan_stop", {
          plan_id: pid,
          stop_id: old.id,
          activity_id: item.activity_id,
          thread_id: item.thread_id,
        });
      else {
        const before = new Set(next.plan_stops?.map((s) => s.id));
        next = base(next, "add_plan_stop", {
          plan_id: pid,
          activity_id: item.activity_id,
          thread_id: item.thread_id,
        });
        old = next.plan_stops!.find((s) => !before.has(s.id))!;
        old.id = item.id;
      }
    } else if (!old) {
      const before = new Set(next.plan_stops?.map((s) => s.id));
      next = base(next, "add_plan_stop", {
        plan_id: pid,
        title: item.title,
        details: item.details,
      });
      old = next.plan_stops!.find((s) => !before.has(s.id))!;
      old.id = item.id;
    } else Object.assign(old, { title: item.title, details: item.details });
    next.plan_stops!.find((s) => s.id === item.id)!.position = position;
    next.plan_beacon_drafts ??= [];
    next.plan_beacon_drafts = next.plan_beacon_drafts.filter(
      (d) => d.stop_id !== item.id,
    );
    if (item.kind === "beacon") {
      if (!item.beacon) throw new Error("Beacon draft unavailable.");
      if (action === "schedule_plan_editor" && item.include) {
        if (
          plan.squad_id &&
          (item.beacon.audience !== "squad" ||
            item.beacon.audience_id !== plan.squad_id)
        )
          throw new Error("Choose this Squad as the Beacon audience.");
        let publication = { ...item.beacon };
        if (
          publication.draft_timing === "Now" ||
          publication.draft_timing === "In 30 min"
        ) {
          const starts =
            Date.now() +
            (publication.draft_timing === "In 30 min" ? 1800000 : 0);
          publication = {
            ...publication,
            starts_at: new Date(starts).toISOString(),
            ends_at: new Date(
              starts + Number(publication.duration_minutes ?? 60) * 60000,
            ).toISOString(),
          };
        }
        const before = new Set(next.activities.map((a) => a.id));
        next = base(
          next,
          Array.isArray(item.beacon.invitee_ids) &&
            item.beacon.invitee_ids.length
            ? "create_activity_with_invitees"
            : "create_activity",
          { ...publication, return_plan_id: pid, plan_stop_id: item.id },
        );
        const created = next.activities.find((a) => !before.has(a.id))!;
        const listing = item.beacon.public_listing as
          { enabled?: boolean; area?: string } | undefined;
        if (listing?.enabled)
          next = base(next, "publish_beacon_discovery", {
            activity_id: created.id,
            area_label: listing.area ?? "",
            ...(item.beacon.latitude != null
              ? {
                  coarse_lat:
                    Math.round(Number(item.beacon.latitude) * 100) / 100,
                  coarse_lng:
                    Math.round(Number(item.beacon.longitude) * 100) / 100,
                }
              : {}),
          });
        if (!next.plan_stops!.find((s) => s.id === item.id)?.activity_id)
          next = base(next, "link_plan_stop", {
            plan_id: pid,
            stop_id: item.id,
            activity_id: created.id,
          });
      } else
        next.plan_beacon_drafts.push({
          stop_id: item.id,
          payload: item.beacon,
          include: item.include,
        });
    }
  }
  const target = next.plans.find((p) => p.id === pid)!;
  Object.assign(target, {
    title: payload.title,
    description: payload.description,
    timezone: payload.timezone,
    start_date: payload.start_date || null,
    revision: (target.revision ?? 0) + 1,
  });
  if (action === "schedule_plan_editor") target.status = "scheduled";
  return next;
}
