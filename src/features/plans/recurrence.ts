import { addLocalDays, isLocalDate, isoWeekday } from "./routines";

export type RecurrenceFields = {
  frequency?: "daily" | "weekly" | "monthly";
  interval_count?: number;
  month_day?: number;
};
export type RecurrenceSchedule = RecurrenceFields & {
  anchor_date: string;
  weekdays: number[];
  interval_weeks: number;
  ends_on?: string | null;
};

export function nextRecurrenceDate(
  rule: RecurrenceSchedule,
  after: string,
): string | null {
  const interval = rule.interval_count ?? rule.interval_weeks;
  if (
    !isLocalDate(rule.anchor_date) ||
    !isLocalDate(after) ||
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 52 ||
    (rule.ends_on &&
      (!isLocalDate(rule.ends_on) || rule.ends_on < rule.anchor_date))
  )
    throw new Error("Check the repeat interval, start and end dates.");
  const frequency = rule.frequency ?? "weekly";
  const day = rule.month_day ?? Number(rule.anchor_date.slice(8));
  if (
    frequency === "monthly" &&
    (!Number.isInteger(day) || day < 1 || day > 31)
  )
    throw new Error("Choose a monthly day from 1 to 31.");
  if (
    frequency === "weekly" &&
    (!rule.weekdays.length ||
      rule.weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7) ||
      new Set(rule.weekdays).size !== rule.weekdays.length)
  )
    throw new Error("Choose valid weekdays.");
  const anchor = Date.parse(rule.anchor_date),
    anchorMonth =
      Number(rule.anchor_date.slice(0, 4)) * 12 +
      Number(rule.anchor_date.slice(5, 7)) -
      1;
  for (
    let candidate =
        after < rule.anchor_date ? rule.anchor_date : addLocalDays(after, 1),
      i = 0;
    i < 366 * 52;
    candidate = addLocalDays(candidate, 1), i++
  ) {
    if (rule.ends_on && candidate > rule.ends_on) return null;
    const days = Math.round((Date.parse(candidate) - anchor) / 86400000);
    if (frequency === "daily" && days % interval === 0) return candidate;
    if (
      frequency === "weekly" &&
      rule.weekdays.includes(isoWeekday(candidate)) &&
      Math.floor((days + isoWeekday(rule.anchor_date) - 1) / 7) % interval === 0
    )
      return candidate;
    if (frequency === "monthly") {
      const year = Number(candidate.slice(0, 4)),
        month = Number(candidate.slice(5, 7));
      if (
        (year * 12 + month - 1 - anchorMonth) % interval === 0 &&
        Number(candidate.slice(8)) ===
          Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())
      )
        return candidate;
    }
  }
  return null;
}
export function recurrencePreview(
  rule: RecurrenceSchedule,
  after: string,
  count = 3,
) {
  const rows: string[] = [];
  let next = nextRecurrenceDate(rule, after);
  while (next && rows.length < Math.min(10, count)) {
    rows.push(next);
    next = nextRecurrenceDate(rule, next);
  }
  return rows;
}
