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
    return Math.round((Date.parse(customEndsAt) - Date.parse(startsAt)) / 60000);
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
