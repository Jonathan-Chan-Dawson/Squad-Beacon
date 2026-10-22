export type DiscoveryCardCapacity = {
  limit: number | null;
  strict: boolean;
  full?: boolean;
};

export type DiscoveryContextEvidence = {
  timingLabel?: string | null;
  /** Pass only when strict capacity details are visibly shown. */
  strictCapacityLabel?: string | null;
  communityLabel?: string | null;
  friendsLabel?: string | null;
};

function normalizedDiscoveryLabel(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[·•]/g, " ")
    .replace(/\s+/g, " ");
}

/** Hide only context already supported by metadata that is visibly rendered. */
export function discoveryContextLabel(
  label: string | null | undefined,
  evidence: DiscoveryContextEvidence = {},
) {
  const trimmed = label?.trim() ?? "";
  if (!trimmed) return null;

  const normalized = normalizedDiscoveryLabel(trimmed);
  const visibleLabels = [
    evidence.timingLabel,
    evidence.strictCapacityLabel,
    evidence.communityLabel,
    evidence.friendsLabel,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .map(normalizedDiscoveryLabel);
  if (visibleLabels.includes(normalized)) return null;

  if (normalized === "starts soon" && evidence.timingLabel?.trim()) return null;
  if (
    normalized === "spots available" &&
    evidence.strictCapacityLabel?.trim()
  )
    return null;
  if (
    evidence.communityLabel?.trim() &&
    /^from your (squad|organization|network|space)$/i.test(trimmed)
  )
    return null;

  return trimmed;
}

export function shouldUseAdaptiveDiscoveryShell(
  presentation: "personal-preview" | "home" | "discovery" | undefined,
  adaptiveDiscovery = false,
) {
  return presentation === "discovery" && adaptiveDiscovery;
}

export function discoveryCardMetadata({
  goingCount,
  capacity,
  friendsGoing = 0,
}: {
  goingCount: number;
  capacity?: DiscoveryCardCapacity | null;
  friendsGoing?: number;
}) {
  const count = Number.isFinite(goingCount)
    ? Math.max(0, Math.floor(goingCount))
    : 0;
  const pieces = [`${count} going`];
  const limit = capacity?.limit;

  if (Number.isFinite(limit) && limit! > 0) {
    const normalizedLimit = Math.floor(limit!);
    if (normalizedLimit > 0 && capacity?.strict) {
      const full = capacity.full === true || count >= normalizedLimit;
      if (full) pieces.push("Full");
      else {
        const remaining = Math.max(0, normalizedLimit - count);
        if (remaining > 0)
          pieces.push(`${remaining} ${remaining === 1 ? "spot" : "spots"} left`);
      }
    } else if (normalizedLimit > 0) {
      pieces.push(`Suggested ${normalizedLimit}`);
    }
  }

  const friends = Number.isFinite(friendsGoing)
    ? Math.max(0, Math.floor(friendsGoing))
    : 0;
  if (friends > 0)
    pieces.push(`${friends} ${friends === 1 ? "friend" : "friends"}`);
  return pieces.join(" · ");
}
