import type { Activity, Checkin, Habit, Profile } from "./types";
export function localDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
function dayNumber(date: string) {
  return Math.floor(Date.parse(date + "T12:00:00Z") / 86400000);
}
function dateAt(day: number) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}
function weekday(day: number) {
  return new Date(day * 86400000).getUTCDay();
}
export function habitStats(habit: Habit, all: Checkin[], now = new Date()) {
  const dates = new Set(
    all.filter((c) => c.habit_id === habit.id).map((c) => c.local_date),
  );
  const today = dayNumber(localDate(now, habit.timezone));
  const start = dates.size ? Math.min(...[...dates].map(dayNumber)) : today;
  const monday = today - ((weekday(today) + 6) % 7);
  const weekCount = [...dates].filter(
    (d) => dayNumber(d) >= monday && dayNumber(d) <= today,
  ).length;
  let streak = 0,
    best = 0,
    run = 0;
  if (habit.schedule === "weekly") {
    const firstWeek = start - ((weekday(start) + 6) % 7);
    for (let day = firstWeek; day <= monday; day += 7) {
      const count = [...dates].filter(
        (d) =>
          dayNumber(d) >= day &&
          dayNumber(d) < day + 7 &&
          dayNumber(d) <= today,
      ).length;
      if (count >= habit.weekly_target) run++;
      else if (day < monday) run = 0;
      best = Math.max(best, run);
    }
    streak = run;
  } else {
    for (let day = start; day <= today; day++) {
      if (!habit.weekdays.includes(weekday(day))) continue;
      if (dates.has(dateAt(day))) run++;
      else if (day < today) run = 0;
      best = Math.max(best, run);
    }
    streak = run;
  }
  return {
    streak,
    best,
    weekCount,
    checkedToday: dates.has(localDate(now, habit.timezone)),
    unit: habit.schedule === "weekly" ? "weeks" : "days",
  };
}
export function featuredActivity(
  profile: Profile,
  activities: Activity[],
  now = new Date(),
) {
  if (profile.hide_featured) return undefined;
  const own = activities.filter(
    (a) => a.owner_id === profile.id && a.status !== "cancelled",
  );
  const pinned = own.find((a) => a.id === profile.featured_activity_id);
  if (pinned) return pinned;
  return (
    own.find(
      (a) =>
        a.status === "scheduled" &&
        Date.parse(a.starts_at) <= +now &&
        Date.parse(a.ends_at) > +now,
    ) ??
    own
      .filter((a) => a.status === "scheduled" && Date.parse(a.starts_at) > +now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ??
    own
      .filter((a) => a.status === "completed")
      .sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0]
  );
}
export function locationIsFresh(
  location: { expires_at: string; updated_at: string | null },
  now = new Date(),
) {
  return (
    Date.parse(location.expires_at) > +now &&
    !!location.updated_at &&
    +now - Date.parse(location.updated_at) < 300000
  );
}
export function activityWhen(activity: Activity, now = new Date()) {
  if (activity.status === "cancelled") return "Cancelled";
  if (activity.status === "completed") return "Completed";
  if (Date.parse(activity.ends_at) <= +now) return "Ended";
  if (Date.parse(activity.starts_at) <= +now) return "Happening now";
  return new Date(activity.starts_at).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
export function validateActivity(p: Record<string, unknown>) {
  if (typeof p.title !== "string" || !p.title.trim() || p.title.length > 120)
    throw new Error("Give your activity a title (up to 120 characters).");
  const start = Date.parse(String(p.starts_at)),
    end = Date.parse(String(p.ends_at));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error("The end time must be after the start time.");
  if (p.online_url && !/^https:\/\//i.test(String(p.online_url)))
    throw new Error("Online links must begin with https://.");
  if ((p.latitude == null) !== (p.longitude == null))
    throw new Error("Choose a complete map location.");
  if (
    p.latitude != null &&
    (!Number.isFinite(Number(p.latitude)) ||
      Math.abs(Number(p.latitude)) > 90 ||
      !Number.isFinite(Number(p.longitude)) ||
      Math.abs(Number(p.longitude)) > 180)
  )
    throw new Error("Choose a valid map location.");
}
export function friendIds(
  data: {
    friendships: { sender_id: string; recipient_id: string; status: string }[];
  },
  id: string,
) {
  return data.friendships
    .filter(
      (f) =>
        f.status === "accepted" && [f.sender_id, f.recipient_id].includes(id),
    )
    .map((f) => (f.sender_id === id ? f.recipient_id : f.sender_id));
}
