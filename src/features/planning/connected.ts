import type { Data } from "@/src/shared/types";
import type { PlanningThread, PlanningSlot, AvailabilityChoice } from "./types";
import { canReadPlanningThread } from "./domain";
import { planLocalDateTimeToISO } from "@/src/features/plans/domain";
import { localDate } from "@/src/shared/domain";
import { addLocalDays } from "@/src/features/plans/routines";

export const connectedPlanningEnabled = (data: Data) =>
  data.is_demo === true || data.capabilities?.connected_planning === true;

export function interestTarget(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const count = Number(value);
  if (!Number.isInteger(count) || count < 2 || count > 100)
    throw new Error(
      "Choose an interest target from 2 to 100, or leave it blank.",
    );
  return count;
}

export function suggestedSlots(
  now: number,
  newId: () => string,
  context?: Partial<import("./types").BeaconDraft>,
): PlanningSlot[] {
  const timezone =
    context?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const duration =
    context?.starts_at && context.ends_at
      ? Date.parse(context.ends_at) - Date.parse(context.starts_at)
      : 3600000;
  const minutes =
    duration >= 300000 && duration <= 86400000 ? duration : 3600000;
  return Array.from({ length: 3 }, (_, i) => {
    const day = addLocalDays(localDate(new Date(now), timezone), i + 2);
    const start = planLocalDateTimeToISO(day, "18:00", timezone);
    return {
      id: newId(),
      thread_id: "",
      starts_at: start,
      ends_at: new Date(Date.parse(start) + minutes).toISOString(),
      timezone,
      retired_at: null,
    };
  });
}
export function activeSlots(data: Data, id: string) {
  return (data.planning_slots ?? []).filter(
    (s) => s.thread_id === id && !s.retired_at,
  );
}
export function availabilitySummary(
  data: Data,
  thread: PlanningThread,
  viewer: string,
  now: number,
) {
  const rows = (data.planning_availability ?? []).filter(
    (a) =>
      a.thread_id === thread.id &&
      canReadPlanningThread(data, thread, a.user_id) &&
      !data.blocks.some(
        (b) =>
          (b.blocker_id === viewer && b.blocked_id === a.user_id) ||
          (b.blocked_id === viewer && b.blocker_id === a.user_id),
      ),
  );
  const slots = activeSlots(data, thread.id).map((slot) => ({
    ...slot,
    yes: rows.filter((a) => a.answers[slot.id] === "yes").length,
    maybe: rows.filter((a) => a.answers[slot.id] === "maybe").length,
    no: rows.filter((a) => a.answers[slot.id] === "no").length,
  }));
  const viable = slots.filter((s) => Date.parse(s.starts_at) > now);
  const topYes = Math.max(0, ...viable.map((s) => s.yes));
  const topMaybe = Math.max(
    0,
    ...viable.filter((s) => s.yes === topYes).map((s) => s.maybe),
  );
  return {
    slots,
    respondents: rows.filter((a) =>
      slots.some((s) => a.answers[s.id] !== undefined),
    ).length,
    recommended: viable
      .filter(
        (s) => s.yes === topYes && s.maybe === topMaybe && s.yes + s.maybe > 0,
      )
      .map((s) => s.id),
  };
}
export function validateSlots(
  slots: Pick<PlanningSlot, "id" | "starts_at" | "ends_at" | "timezone">[],
  deadline: string,
  now = Date.now(),
) {
  if (slots.length < 2 || slots.length > 10)
    throw new Error("Choose 2 to 10 proposed times.");
  if (!Number.isFinite(Date.parse(deadline)) || Date.parse(deadline) <= now)
    throw new Error("Choose a future response deadline.");
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const s of slots) {
    new Intl.DateTimeFormat("en", { timeZone: s.timezone });
    const start = Date.parse(s.starts_at),
      end = Date.parse(s.ends_at);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start <= Math.max(now, Date.parse(deadline)) ||
      end - start < 300000 ||
      end - start > 86400000
    )
      throw new Error(
        "Times must follow the deadline and last 5 minutes to 24 hours.",
      );
    const key = `${start}:${end}`;
    if (seen.has(key) || ids.has(s.id))
      throw new Error("Choose distinct proposed times.");
    seen.add(key);
    ids.add(s.id);
  }
}
export function wallTimeToInstant(value: string, timezone: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return planLocalDateTimeToISO(
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    timezone,
  );
}
export function instantToWallField(value: string, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  );
  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`,
  ).toISOString();
}
export function slotLabel(
  s: Pick<PlanningSlot, "starts_at" | "ends_at" | "timezone">,
) {
  return `${new Date(s.starts_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })} – ${new Date(s.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}
export function backupAvailableAt(deadline: string, starts: string) {
  const d = Date.parse(deadline),
    gap = Date.parse(starts) - d;
  return (
    d +
    Math.min(86400000, Math.max(900000, gap / 4), Math.max(0, gap - 1500000))
  );
}
export function noneAvailability(
  slots: PlanningSlot[],
): Record<string, AvailabilityChoice> {
  return Object.fromEntries(slots.map((s) => [s.id, "no"]));
}
