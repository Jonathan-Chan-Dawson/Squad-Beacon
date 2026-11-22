import { planLocalDateTimeToISO } from "@/src/features/plans/domain";
import { addLocalDays } from "@/src/features/plans/routines";
import { localDate } from "@/src/shared/domain";

export function planningTimezone(timezone?: string) {
  if (timezone) {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return timezone;
    } catch {
      // A deep link can supply an invalid timezone.
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function planningTimeOnDay(
  now: number,
  days: number,
  time: string,
  timezone: string,
) {
  return planLocalDateTimeToISO(
    addLocalDays(localDate(new Date(now), timezone), days),
    time,
    timezone,
  );
}

export function flexiblePlanningWindow(
  deadline: string,
  timezone: string,
  now = Date.now(),
) {
  const parsed = Date.parse(deadline);
  const starts_at = planningTimeOnDay(
    Number.isFinite(parsed) ? Math.max(parsed, now) : now,
    3,
    "18:00",
    timezone,
  );
  return {
    starts_at,
    ends_at: new Date(Date.parse(starts_at) + 3600000).toISOString(),
  };
}

export function planningZoneLabel(timezone: string, now: number) {
  return timezone === planningTimezone()
    ? undefined
    : new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        timeZoneName: "longGeneric",
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value;
}

export function planningTimeSummary(
  value: string,
  timezone: string,
  now = Date.now(),
  end?: string,
) {
  const start = new Date(value);
  if (!Number.isFinite(+start)) return "Choose a time";
  const day = localDate(start, timezone);
  const today = localDate(new Date(now), timezone);
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  });
  const label =
    day === today
      ? "Today"
      : day === addLocalDays(today, 1)
        ? "Tomorrow"
        : date.format(start);
  const finish = end && new Date(end);
  return finish && Number.isFinite(+finish)
    ? `${label} · ${time.format(start)}–${localDate(finish, timezone) === day ? "" : date.format(finish) + " · "}${time.format(finish)}`
    : `${label} · ${time.format(start)}`;
}
