export const availabilityColors = {
  available: "#79DDB0",
  busy: "#F0B574",
  expiring: "#E99B66",
};

export type AvailabilityDetails = {
  availability: "available" | "busy" | null;
  availability_until?: string | null;
  availability_started_at?: string | null;
  availability_mode?: "timed" | "indefinite" | null;
  availability_note?: string | null;
};

export const availabilityOptions = [
  "30 min",
  "1 hour",
  "2 hours",
  "4 hours",
  "Tonight",
  "Until cleared",
  "Custom",
] as const;
export type AvailabilityOption = (typeof availabilityOptions)[number];
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function nextAvailabilityExpiry(
  rows: readonly AvailabilityDetails[] | undefined,
  now: number,
) {
  let nearest = Infinity;
  for (const row of rows ?? []) {
    const end = Date.parse(row.availability_until ?? "");
    if (row.availability && end > now) nearest = Math.min(nearest, end);
  }
  return nearest;
}

export function availabilityEnd(
  option: AvailabilityOption,
  now: number,
  custom = "",
) {
  if (option === "Until cleared") return null;
  const minutes = {
    "30 min": 30,
    "1 hour": 60,
    "2 hours": 120,
    "4 hours": 240,
  };
  const tonight = new Date(now);
  tonight.setHours(23, 59, 0, 0);
  const end =
    option === "Tonight"
      ? tonight.getTime()
      : option === "Custom"
        ? Date.parse(custom)
        : now + minutes[option] * 60000;
  if (!Number.isFinite(end) || end <= now || end > now + 86400000)
    throw new Error("Choose a time within the next 24 hours.");
  return new Date(end).toISOString();
}

export function activeAvailability(
  details: AvailabilityDetails | null | undefined,
  now: number,
) {
  if (!details?.availability) return null;
  const indefinite = details.availability_mode === "indefinite";
  const end = Date.parse(details.availability_until ?? "");
  if (!indefinite && (!Number.isFinite(end) || end <= now)) return null;
  const start = Date.parse(details.availability_started_at ?? "");
  const duration = end - start;
  const remaining = end - now;
  const progress = indefinite
    ? 1
    : duration > 0
      ? Math.min(1, remaining / duration)
      : null;
  const hotWindow = Math.min(900000, duration * 0.2);
  const warmth =
    !indefinite && hotWindow > 0 ? Math.max(0, 1 - remaining / hotWindow) : 0;
  const color = availabilityColors[details.availability];
  const arcColor =
    warmth === 0
      ? color
      : `#${[1, 3, 5]
          .map((index) => {
            const from = parseInt(color.slice(index, index + 2), 16);
            const to = parseInt(
              availabilityColors.expiring.slice(index, index + 2),
              16,
            );
            return Math.round(from + (to - from) * warmth)
              .toString(16)
              .padStart(2, "0");
          })
          .join("")}`;
  const endLabel = !indefinite ? timeFormatter.format(end) : null;
  return {
    status: details.availability,
    indefinite,
    end: indefinite ? null : end,
    color,
    arcColor,
    progress,
    label: `${details.availability === "available" ? "Free" : "Busy"}${endLabel ? ` until ${endLabel}` : ""}`,
    note: details.availability_note?.trim() || undefined,
  };
}
