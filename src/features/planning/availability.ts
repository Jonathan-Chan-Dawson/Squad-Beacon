/** Availability is an optional constraint on Interested, never an attendance response. */
export function validatePingAvailability(
  value: unknown,
  response: string,
): string | null {
  if (value == null) return null;
  if (response !== "interested")
    throw new Error("Availability is available with Interested.");
  if (
    typeof value !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/i.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error(
      "Choose a valid availability date/time with a timezone offset.",
    );
  return new Date(value).toISOString();
}

export function pingAvailabilityAllowsRsvp(
  availableAfter: string | null | undefined,
  startsAt: string,
) {
  return (
    availableAfter == null || Date.parse(availableAfter) <= Date.parse(startsAt)
  );
}

/** Relative choices use the device's local timezone; storage is always UTC. */
export function relativePingAvailability(
  choice: "now" | "hour" | "tomorrow",
  now = new Date(),
): string | null {
  if (choice === "now") return null;
  const value = new Date(now);
  if (choice === "hour") value.setTime(value.getTime() + 3600000);
  else value.setDate(value.getDate() + 1);
  return value.toISOString();
}
