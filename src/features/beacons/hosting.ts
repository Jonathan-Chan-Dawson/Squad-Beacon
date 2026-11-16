import type { Activity, Data, Payload } from "@/src/shared/types";
import { requirePremiumFeature } from "@/src/shared/entitlements";
import { canUseBeaconModules } from "./beaconModules";
import { beaconRoleFor, canManageBeacon } from "./permissions";

export type HostingSettings = {
  enabled: boolean;
  questions: { id: string; label: string }[];
  groups: string[];
  check_in: boolean;
  coordinators: string[];
};
export type AttendeeDetails = {
  activity_id: string;
  user_id: string;
  answers?: Record<string, string>;
  organizer_note?: string;
  group_label: string | null;
  checked_in_at: string | null;
  reminders?: boolean;
  revision: number;
};
export function validateHosting(value: unknown): HostingSettings {
  const h = value as HostingSettings;
  if (
    !h ||
    Object.keys(h).some(
      (k) =>
        ![
          "enabled",
          "questions",
          "groups",
          "check_in",
          "coordinators",
        ].includes(k),
    ) ||
    typeof h.enabled !== "boolean" ||
    typeof h.check_in !== "boolean" ||
    !Array.isArray(h.questions) ||
    h.questions.length > 8 ||
    h.questions.some(
      (q) =>
        !q ||
        Object.keys(q).some((k) => !["id", "label"].includes(k)) ||
        typeof q.id !== "string" ||
        !/^[\w-]{1,64}$/.test(q.id) ||
        typeof q.label !== "string" ||
        !q.label.trim() ||
        q.label.length > 160,
    ) ||
    new Set(h.questions.map((q) => q.id)).size !== h.questions.length ||
    !Array.isArray(h.groups) ||
    h.groups.length > 12 ||
    h.groups.some((g) => typeof g !== "string" || !g.trim() || g.length > 60) ||
    new Set(h.groups).size !== h.groups.length ||
    !Array.isArray(h.coordinators) ||
    h.coordinators.length > 12 ||
    h.coordinators.some((id) => typeof id !== "string" || !id) ||
    new Set(h.coordinators).size !== h.coordinators.length
  )
    throw new Error(
      "Use up to eight RSVP questions, twelve groups and twelve check-in coordinators.",
    );
  return structuredClone(h);
}
export function validateHostingLinks(
  data: Data,
  activity: Activity,
  h: HostingSettings,
  viewer: string,
) {
  if (
    h.coordinators.length &&
    !["owner", "coowner"].includes(beaconRoleFor(data, activity, viewer))
  )
    throw new Error("Only owners and co-hosts can delegate check-in.");
  if (h.coordinators.some((id) => !canUseBeaconModules(data, activity, id)))
    throw new Error("Choose current participants as coordinators.");
}
export function demoHostingAction(
  data: Data,
  action: string,
  p: Payload,
  viewer: string,
) {
  if (action === "set_recap_consent") {
    const a = data.activities.find((a) => a.id === p.activity_id);
    if (
      !a ||
      !canUseBeaconModules(data, a, viewer) ||
      typeof p.allowed !== "boolean"
    )
      throw new Error("Recap consent unavailable.");
    data.recap_consents = [
      ...(data.recap_consents ?? []).filter(
        (c) => c.activity_id !== a.id || c.user_id !== viewer,
      ),
      { activity_id: a.id, user_id: viewer, allowed: p.allowed },
    ];
    return true;
  }
  if (
    !["save_rsvp_answers", "save_host_record", "set_agenda_reminders"].includes(
      action,
    )
  )
    return false;
  const a = data.activities.find((a) => a.id === p.activity_id);
  if (!a || !canUseBeaconModules(data, a, viewer) || a.status === "cancelled")
    throw new Error("Participant details unavailable.");
  const h = data.premium_tool_configs?.find(
    (c) => c.activity_id === a.id && c.kind === "hosting",
  )?.settings.hosting;
  const target = action === "save_host_record" ? String(p.user_id) : viewer;
  if (!canUseBeaconModules(data, a, target))
    throw new Error("Choose a current participant.");
  const old = data.attendee_details?.find(
    (r) => r.activity_id === a.id && r.user_id === target,
  );
  if ((old?.revision ?? -1) !== p.revision)
    throw new Error("These participant details changed. Reopen them.");
  const row: AttendeeDetails = old
    ? { ...old }
    : {
        activity_id: a.id,
        user_id: target,
        answers: {},
        organizer_note: "",
        group_label: null,
        checked_in_at: null,
        reminders: true,
        revision: -1,
      };
  if (action === "set_agenda_reminders") {
    if (typeof p.reminders !== "boolean")
      throw new Error("Choose a reminder preference.");
    row.reminders = p.reminders;
  } else if (action === "save_rsvp_answers") {
    if (
      !h?.enabled ||
      !p.answers ||
      typeof p.answers !== "object" ||
      Array.isArray(p.answers)
    )
      throw new Error("RSVP questions unavailable.");
    const answers = p.answers as Record<string, string>;
    if (
      Object.entries(answers).some(
        ([key, v]) =>
          !h.questions.some((q) => q.id === key) ||
          typeof v !== "string" ||
          v.length > 500,
      )
    )
      throw new Error("Choose valid answers up to 500 characters.");
    row.answers = answers;
  } else {
    const manager = canManageBeacon(data, a, viewer);
    if (!h?.enabled || !(manager || h.coordinators.includes(viewer)))
      throw new Error("Organizer access required.");
    if (p.organizer_note !== undefined || p.group_label !== undefined) {
      if (!manager)
        throw new Error("Only organizers can edit private notes and groups.");
      requirePremiumFeature(data, "hosting", a);
      if (
        typeof p.organizer_note !== "string" ||
        p.organizer_note.length > 1000 ||
        (p.group_label !== null && !h.groups.includes(String(p.group_label)))
      )
        throw new Error("Choose valid organizer details.");
      row.organizer_note = p.organizer_note;
      row.group_label = p.group_label === null ? null : String(p.group_label);
    }
    if (p.checked_in !== undefined) {
      if (typeof p.checked_in !== "boolean" || !h.check_in)
        throw new Error("Check-in unavailable.");
      row.checked_in_at = p.checked_in ? new Date().toISOString() : null;
    }
  }
  row.revision++;
  data.attendee_details = [
    ...(data.attendee_details ?? []).filter(
      (r) => r.activity_id !== a.id || r.user_id !== target,
    ),
    row,
  ];
  return true;
}
