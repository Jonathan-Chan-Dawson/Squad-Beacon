export function discoveryPrimaryLabel(state: {
  pending: boolean;
  opens: boolean;
  requiresApproval: boolean;
  approvalGranted?: boolean;
}) {
  return state.pending
    ? "Pending"
    : state.opens
      ? "Open"
      : state.requiresApproval && !state.approvalGranted
        ? "Request"
        : "Join";
}
const normalized = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export function cardSecondaryMetadata(
  title: string,
  location: { label: string; kind: "physical" | "online" } | null | undefined,
  host: string,
) {
  const label = location?.label.trim();
  const meaningless = new Set([
    "place to be decided",
    "place to be determined",
    "place to be arranged",
    "place to be confirmed",
    "tbd",
    "unknown",
    "location",
    "place",
  ]);
  if (
    label &&
    normalized(label) !== normalized(title) &&
    !meaningless.has(normalized(label))
  )
    return { label, kind: location!.kind };
  const name = host.trim();
  if (!name || ["beacon host", "host", "unknown"].includes(normalized(name)))
    return null;
  return {
    label: name === "You" ? "You’re hosting" : `Hosted by ${name}`,
    kind: "host" as const,
  };
}
export function compactCountdown(prefix: "Ends" | "Starts", minutes: number) {
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return `${prefix} in ${hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${Math.max(1, minutes)}m`}`;
}
