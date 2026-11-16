import type { Activity, BeaconChecklistItem, Data } from "@/src/shared/types";
import { canUseBeaconModules, canReadBeaconModuleEntry } from "./beaconModules";
import { beaconRoleFor } from "./permissions";

export type AgendaStep = {
  id: string;
  label: string;
  offset: number;
  minutes: number;
  reminder: number | null;
  organizer: string | null;
  tasks: string[];
  state: "planned" | "active" | "done";
};
export type AgendaSettings = { enabled: boolean; steps: AgendaStep[] };
export function validateAgenda(value: unknown): AgendaSettings {
  const a = value as AgendaSettings;
  if (
    !a ||
    Object.keys(a).some((k) => !["enabled", "steps"].includes(k)) ||
    typeof a.enabled !== "boolean" ||
    !Array.isArray(a.steps) ||
    a.steps.length > 40
  )
    throw new Error("Use up to forty agenda items.");
  const ids = new Set<string>();
  for (const s of a.steps) {
    if (
      !s ||
      Object.keys(s).some(
        (k) =>
          ![
            "id",
            "label",
            "offset",
            "minutes",
            "reminder",
            "organizer",
            "tasks",
            "state",
          ].includes(k),
      ) ||
      typeof s.id !== "string" ||
      !/^[\w-]{1,64}$/.test(s.id) ||
      ids.has(s.id) ||
      typeof s.label !== "string" ||
      !s.label.trim() ||
      s.label.length > 100 ||
      !Number.isInteger(s.offset) ||
      Math.abs(s.offset) > 43200 ||
      !Number.isInteger(s.minutes) ||
      s.minutes < 1 ||
      s.minutes > 1440 ||
      (s.reminder !== null &&
        (!Number.isInteger(s.reminder) ||
          s.reminder < 0 ||
          s.reminder > 10080)) ||
      (s.organizer !== null &&
        (typeof s.organizer !== "string" || !s.organizer)) ||
      !Array.isArray(s.tasks) ||
      s.tasks.length > 20 ||
      s.tasks.some((t) => typeof t !== "string" || !t) ||
      new Set(s.tasks).size !== s.tasks.length ||
      !["planned", "active", "done"].includes(s.state)
    )
      throw new Error(
        "Choose valid agenda timing, responsibilities and tasks.",
      );
    ids.add(s.id);
  }
  if (a.steps.filter((s) => s.state === "active").length > 1)
    throw new Error("Only one agenda stage can be active.");
  return structuredClone(a);
}
export const agendaNeedsPro = (a: AgendaSettings) =>
  a.steps.some((s) => s.organizer || s.tasks.length || s.state !== "planned");
export function validateAgendaLinks(
  data: Data,
  activity: Activity,
  agenda: AgendaSettings,
) {
  for (const s of agenda.steps) {
    if (
      s.organizer &&
      (!["owner", "coowner", "admin"].includes(
        beaconRoleFor(data, activity, s.organizer),
      ) ||
        !canUseBeaconModules(data, activity, s.organizer))
    )
      throw new Error("Choose a current organizer.");
    if (
      s.tasks.some(
        (id) =>
          !data.beacon_checklist_items.some(
            (t) =>
              t.id === id &&
              t.activity_id === activity.id &&
              canReadBeaconModuleEntry(
                data,
                activity,
                t.author_id,
                data.viewer_id!,
              ),
          ),
      )
    )
      throw new Error("Choose tasks from this Beacon.");
  }
}
export function agendaTime(activity: Activity, step: AgendaStep) {
  return Date.parse(activity.starts_at) + step.offset * 60000;
}
export function preparationSummary(items: BeaconChecklistItem[], now: number) {
  return {
    total: items.length,
    completed: items.filter((i) => i.completed).length,
    overdue: items.filter(
      (i) =>
        !i.completed &&
        (i.due_at
          ? Date.parse(i.due_at) < now
          : i.due_on
            ? i.due_on < new Date(now).toISOString().slice(0, 10)
            : false),
    ).length,
    unassigned: items.filter((i) => !i.completed && !i.assignee_id).length,
  };
}
