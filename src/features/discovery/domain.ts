import type { PublicBeaconSummary, PublicDiscoveryFilters, PublicDiscoveryOptIn } from "./types";

export function validatePublicDiscoveryOptIn(input: PublicDiscoveryOptIn) {
  if (!input.activity_id.trim()) throw new Error("Choose a beacon to publish.");
  if (!input.area_label.trim() || input.area_label.length > 120)
    throw new Error("Add a coarse area label (up to 120 characters).");
  const hasLatitude = input.coarse_lat !== undefined;
  const hasLongitude = input.coarse_lng !== undefined;
  if (hasLatitude !== hasLongitude)
    throw new Error("Choose both coarse map coordinates or neither.");
  if (
    hasLatitude &&
    (!Number.isFinite(input.coarse_lat) ||
      Math.abs(input.coarse_lat!) > 90 ||
      !Number.isFinite(input.coarse_lng) ||
      Math.abs(input.coarse_lng!) > 180)
  )
    throw new Error("Choose valid coarse map coordinates.");
}

/** Filter only the intentionally small public projection; never hydrate Activity. */
export function filterPublicBeaconSummaries(
  summaries: readonly PublicBeaconSummary[],
  filters: PublicDiscoveryFilters,
  now = Date.now(),
) {
  const query = filters.query.trim().toLocaleLowerCase();
  const interest = filters.interest.trim().toLocaleLowerCase();
  const area = filters.area.trim().toLocaleLowerCase();
  return summaries
    .filter((summary) => {
      if (summary.closed || Date.parse(summary.ends_at) <= now) return false;
      if (filters.category !== "All" && summary.category !== filters.category)
        return false;
      if (
        query &&
        !`${summary.title} ${summary.category} ${summary.interest_tags.join(" ")} ${summary.area_label}`
          .toLocaleLowerCase()
          .includes(query)
      )
        return false;
      if (
        interest &&
        !summary.interest_tags.some((tag) =>
          tag.toLocaleLowerCase().includes(interest),
        )
      )
        return false;
      if (!area || summary.area_label.toLocaleLowerCase().includes(area)) return true;
      return false;
    })
    .sort(
      (a, b) =>
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.activity_id.localeCompare(b.activity_id),
    );
}

/**
 * Rank opted-in cards using user-supplied interests and coarse area text only.
 * This is presentation ranking, never authorization or precise location math.
 */
export function rankPublicBeaconSummaries(
  summaries: readonly PublicBeaconSummary[],
  interests: readonly string[],
  coarseArea: string | null,
  now = Date.now(),
) {
  const wanted = new Set(interests.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean));
  const area = coarseArea?.trim().toLocaleLowerCase() ?? "";
  return [...summaries]
    .filter((summary) => !summary.closed && Date.parse(summary.ends_at) > now)
    .sort((a, b) => {
      const score = (summary: PublicBeaconSummary) =>
        summary.interest_tags.reduce(
          (total, tag) => total + Number(wanted.has(tag.toLocaleLowerCase())),
          0,
        ) + Number(!!area && summary.area_label.toLocaleLowerCase() === area);
      return (
        score(b) - score(a) ||
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.activity_id.localeCompare(b.activity_id)
      );
    });
}
