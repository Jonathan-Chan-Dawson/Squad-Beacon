import type { Activity, AspirationGoal } from "@/src/shared/types";

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function weekOrdinal(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcDay = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay - ((weekday + 6) % 7);
}

/** Copy saved goals into editable survey state without changing linkable IDs. */
export function copyAspirationGoalsForSurvey(
  goals: readonly AspirationGoal[] | null | undefined,
): AspirationGoal[] {
  return (goals ?? []).map((goal) => ({ ...goal }));
}

/** Progress is based on completed, owner-created beacons that link this goal. */
export function getAspirationProgress(
  aspiration: AspirationGoal,
  activities: readonly Activity[],
  userId: string,
  timeZone: string,
  now = new Date(),
) {
  const counts = new Map<number, number>();
  for (const activity of activities) {
    if (
      activity.owner_id !== userId ||
      activity.status !== "completed" ||
      !activity.aspiration_ids.includes(aspiration.id)
    )
      continue;
    const date = new Date(activity.starts_at);
    if (Number.isNaN(date.getTime())) continue;
    const week = weekOrdinal(localDateKey(date, timeZone));
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }

  const thisWeek = weekOrdinal(localDateKey(now, timeZone));
  const count = counts.get(thisWeek) ?? 0;
  let streak = 0;
  let week = count < aspiration.target_per_week ? thisWeek - 7 : thisWeek;
  while ((counts.get(week) ?? 0) >= aspiration.target_per_week) {
    streak += 1;
    week -= 7;
  }
  return { count, streak };
}
