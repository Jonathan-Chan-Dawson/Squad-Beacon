import { addLocalDays } from "@/src/features/plans/routines";
import { planLocalDateTimeToISO } from "@/src/features/plans/domain";
import { localDate } from "@/src/shared/domain";

export function formatDurationLabel(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes <= 0)
    throw new Error("Duration must be a positive number of minutes.");
  if (minutes === 30) return "30 min";
  if (minutes === 60) return "1 hour";
  if (minutes === 120) return "2 hours";
  return `${minutes} min`;
}
export function durationMinutesForLabel(
  label: string,
  startsAt: string,
  customEndsAt: string,
): number {
  if (label === "Custom")
    return Math.round(
      (Date.parse(customEndsAt) - Date.parse(startsAt)) / 60000,
    );
  if (label === "1 hour") return 60;
  if (label === "2 hours") return 120;
  const match = /^(\d+) min$/.exec(label);
  if (match) return Number(match[1]);
  throw new Error("Choose a valid duration.");
}

export function resolveActivityEndAt(
  startsAt: number,
  durationLabel: string,
  customEndsAt: string,
): string {
  if (durationLabel === "Custom") return customEndsAt;
  const minutes = durationMinutesForLabel(durationLabel, "", "");
  return new Date(startsAt + minutes * 60000).toISOString();
}

export const creationStartChoices = [
  "Now",
  "In 30 min",
  "Later today",
  "Tomorrow",
  "Choose date",
] as const;
export type CreationStartChoice = (typeof creationStartChoices)[number];
export const fixedHalfHourStart = "Fixed in 30 min";

export function resolveCreationStartAt(when: string, starts: string, now = Date.now()) {
  if (when === "Now") return now;
  // Older saved drafts used this value for a publication-relative delay.
  if (when === "In 30 min") return now + 30 * 60000;
  return Date.parse(starts);
}

export function creationPresetStart(
  choice: Exclude<CreationStartChoice, "Choose date">,
  now: number,
  timezone: string,
): number | null {
  if (choice === "Now") return now;
  if (choice === "In 30 min") return now + 30 * 60000;
  const today = localDate(new Date(now), timezone);
  if (choice === "Tomorrow")
    return Date.parse(
      planLocalDateTimeToISO(addLocalDays(today, 1), "17:00", timezone),
    );
  const lastMinute = Date.parse(
    planLocalDateTimeToISO(today, "23:59", timezone),
  );
  const start = Math.min(now + 60 * 60000, lastMinute);
  return start - now >= 15 * 60000 ? start : null;
}

export function creationScheduleSummary(
  start: number,
  end: string,
  timezone: string,
  now?: number,
) {
  const from = new Date(start);
  const to = new Date(end);
  if (!Number.isFinite(+from) || !Number.isFinite(+to)) return "Choose a time";
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  });
  const fromDay = localDate(from, timezone);
  const toDay = localDate(to, timezone);
  const today = now === undefined ? "" : localDate(new Date(now), timezone);
  const tomorrow = today ? addLocalDays(today, 1) : "";
  const dayLabel = (day: string, instant: Date) =>
    day === today ? "Today" : day === tomorrow ? "Tomorrow" : date.format(instant);
  return fromDay === toDay
    ? `${dayLabel(fromDay, from)} · ${time.format(from)}–${time.format(to)}`
    : `${dayLabel(fromDay, from)} · ${time.format(from)} – ${dayLabel(toDay, to)} · ${time.format(to)}`;
}
