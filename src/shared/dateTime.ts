import { planLocalDateTimeToISO } from "@/src/features/plans/domain";

export type DateTimeFieldProps = {
  label: string;
  value: string;
  timezone?: string;
  onChange(value: string): void;
  onValidityChange?(valid: boolean): void;
};

export function localDateTimeField(value: string, timezone: string) {
  if (!Number.isFinite(Date.parse(value))) return "";
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
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parseLocalDateTimeField(value: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Choose a valid date and time.");
  const [day, time] = value.split("T");
  return planLocalDateTimeToISO(day, time, timezone);
}

export function timingMinutes(starts: string, ends: string) {
  return Math.round((Date.parse(ends) - Date.parse(starts)) / 60000);
}
