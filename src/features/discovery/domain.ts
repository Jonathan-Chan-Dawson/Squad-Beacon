import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import type { Activity, Data } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import {
  isApprovedGoing,
  beaconCapacity,
} from "@/src/features/beacons/permissions";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canViewProfile } from "@/src/features/profile/privacy";
import { matchesSearch } from "@/src/shared/search";
import { matchesWhen } from "@/src/features/maps/filtering";
import {
  matchesExplorationArea,
  type ExplorationArea,
  type ExplorationFilters,
} from "@/src/shared/exploration";
import type { BeaconCommunityAssociation } from "./beaconCommunities";
import type {
  PublicBeaconSummary,
  PublicDiscoveryFilters,
  PublicDiscoveryOptIn,
} from "./types";

export type BrowseDiscoveryEntry =
  | { kind: "activity"; activity: Activity }
  | { kind: "public"; summary: PublicBeaconSummary };

export interface BrowseDiversityContext {
  community: string | null;
  category: string | null;
  area: string | null;
}

export function browseEntryId(entry: BrowseDiscoveryEntry) {
  return entry.kind === "activity"
    ? entry.activity.id
    : entry.summary.activity_id;
}

/** Readable Activities win when an explicitly public projection overlaps them. */
export function mergeBrowseEntries(
  activities: readonly Activity[],
  summaries: readonly PublicBeaconSummary[],
): BrowseDiscoveryEntry[] {
  const entries = new Map<string, BrowseDiscoveryEntry>();
  for (const activity of activities) {
    if (!entries.has(activity.id))
      entries.set(activity.id, { kind: "activity", activity });
  }
  for (const summary of summaries) {
    if (!entries.has(summary.activity_id))
      entries.set(summary.activity_id, { kind: "public", summary });
  }
  return [...entries.values()];
}

function publicJoinFilterMatches(
  summary: PublicBeaconSummary,
  join: ExplorationFilters["join"],
) {
  switch (join ?? "Any") {
    case "Any":
      return true;
    case "Open":
      return !summary.closed && !summary.requires_approval;
    case "Needs People":
      // Public summaries deliberately omit a host target count.
      return false;
    case "I'm In":
      return summary.viewer_response === "going";
    case "Request Approval":
      return (
        !summary.closed &&
        summary.requires_approval &&
        summary.viewer_response !== "going"
      );
    case "Invited":
      // Public projections do not expose invitation state.
      return false;
    case "Spots Available":
      return (
        !summary.closed &&
        summary.capacity_policy === "strict" &&
        summary.capacity_limit != null &&
        summary.accepted_seat_count < summary.capacity_limit
      );
  }
}

/** Apply Browse filters using only fields present in the public projection. */
export function filterPublicSummariesForBrowse(
  summaries: readonly PublicBeaconSummary[],
  options: {
    period: "Active" | "Upcoming";
    query: string;
    categories: readonly string[];
    filters: ExplorationFilters;
    area: ExplorationArea | null;
    now: number;
  },
) {
  const { period, query, categories, filters, area, now } = options;
  if (
    (filters.audience !== "Everyone" && filters.audience !== "Public") ||
    filters.planId ||
    filters.format === "Virtual" ||
    filters.starredOnly
  )
    return [];
  return summaries.filter((summary) => {
    const startsAt = Date.parse(summary.starts_at);
    const endsAt = Date.parse(summary.ends_at);
    const active = startsAt <= now && endsAt > now;
    const upcoming = startsAt > now && endsAt > now;
    const involved =
      summary.viewer_response === "going" ||
      summary.viewer_response === "requested";
    if (
      (summary.closed && !involved) ||
      endsAt <= now ||
      (period === "Active" ? !active : !upcoming)
    )
      return false;
    if (filters.time === "Now" && !active) return false;
    if (filters.time === "Upcoming" && !upcoming) return false;
    if (
      filters.format === "Physical" &&
      (summary.coarse_lat == null || summary.coarse_lng == null)
    )
      return false;
    if (categories.length && !categories.includes(summary.category))
      return false;
    if (
      query.trim() &&
      !matchesSearch(
        query,
        summary.title,
        summary.category,
        summary.interest_tags.join(" "),
        summary.area_label,
      )
    )
      return false;
    if (
      filters.when &&
      filters.when !== "Any" &&
      !matchesWhen(
        {
          starts_at: summary.starts_at,
          ends_at: summary.ends_at,
          timezone: "",
        },
        filters.when,
        now,
      )
    )
      return false;
    if (!publicJoinFilterMatches(summary, filters.join)) return false;
    return matchesExplorationArea(
      area,
      summary.coarse_lat == null || summary.coarse_lng == null
        ? null
        : { latitude: summary.coarse_lat, longitude: summary.coarse_lng },
    );
  });
}

function primaryAssociation(
  activityId: string,
  associations: readonly BeaconCommunityAssociation[],
) {
  return associations
    .filter(
      (row) =>
        row.activity_id === activityId && row.relationship === "associated",
    )
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.summary.entity_type.localeCompare(b.summary.entity_type) ||
        a.summary.entity_id.localeCompare(b.summary.entity_id),
    )[0];
}

function publicInterestMatch(
  summary: PublicBeaconSummary,
  interests: ReadonlySet<string>,
) {
  return summary.interest_tags.some((tag) =>
    interests.has(tag.trim().toLocaleLowerCase()),
  );
}

function publicRankingBand(
  summary: PublicBeaconSummary,
  interests: ReadonlySet<string>,
  now: number,
) {
  if (summary.viewer_response === "going") return 0;
  if (summary.viewer_response === "requested") return 1;
  const startsAt = Date.parse(summary.starts_at);
  if (startsAt <= now && Date.parse(summary.ends_at) > now) return 2;
  if (startsAt > now && startsAt <= now + 60 * 60000) return 3;
  if (!summary.closed && publicInterestMatch(summary, interests)) return 4;
  if (!summary.closed) return 5;
  return 6;
}

function publicContext(
  summary: PublicBeaconSummary,
  associations: readonly BeaconCommunityAssociation[],
): BrowseDiversityContext {
  const community = primaryAssociation(summary.activity_id, associations);
  return {
    community: community
      ? `${community.summary.entity_type}:${community.summary.entity_id}`
      : null,
    category: summary.category.toLocaleLowerCase(),
    area: summary.area_label.trim().toLocaleLowerCase() || null,
  };
}


function activePrimaryAssociation(
  activityId: string,
  associations: readonly BeaconCommunityAssociation[],
) {
  return associations
    .filter(
      (row) =>
        row.activity_id === activityId &&
        row.relationship === "associated" &&
        row.summary.membership_status === "active",
    )
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.summary.entity_type.localeCompare(b.summary.entity_type) ||
        a.summary.entity_id.localeCompare(b.summary.entity_id),
    )[0];
}

/** One concise reason based only on the current viewer-safe data projection. */
export function browseEntryReason(
  entry: BrowseDiscoveryEntry,
  data: Data,
  viewerId: string | null,
  now: number,
  associations: readonly BeaconCommunityAssociation[] = [],
) {
  if (entry.kind === "public") {
    const summary = entry.summary;
    const startsAt = Date.parse(summary.starts_at);
    const endsAt = Date.parse(summary.ends_at);
    if (!Number.isFinite(endsAt) || endsAt <= now) return "";
    if (startsAt > now && startsAt <= now + 60 * 60000 && endsAt > now)
      return "Starts soon";
    if (
      !summary.closed &&
      summary.capacity_limit != null &&
      summary.capacity_limit > summary.accepted_seat_count
    )
      return "Spots available";
    if (data.viewer_id === viewerId && viewerId) {
      const community = activePrimaryAssociation(
        summary.activity_id,
        associations,
      );
      if (community)
        return `From your ${communityTypeLabel(community.summary.entity_type)}`;
      const interests =
        data.profiles.find((profile) => profile.id === viewerId)?.interests ??
        [];
      if (
        publicInterestMatch(
          summary,
          new Set(interests.map((tag) => tag.trim().toLocaleLowerCase())),
        )
      )
        return "Matches your interest";
    }
    return "";
  }

  const activity = entry.activity;
  if (
    !viewerId ||
    data.viewer_id !== viewerId ||
    !canReadBeaconActivity(data, activity, viewerId)
  )
    return "";
  const startsAt = Date.parse(activity.starts_at);
  const endsAt = Date.parse(activity.ends_at);
  if (!Number.isFinite(endsAt) || endsAt <= now) return "";
  if (startsAt > now && startsAt <= now + 60 * 60000 && endsAt > now)
    return "Starts soon";
  const capacity = beaconCapacity(data, activity);
  const limit = activity.capacity_limit ?? null;
  if (!capacity.closed && limit != null && limit > 0 && capacity.count < limit)
    return "Spots available";
  const community = activePrimaryAssociation(activity.id, associations);
  if (community)
    return `From your ${communityTypeLabel(community.summary.entity_type)}`;
  if (
    friendIds(data, viewerId).includes(activity.owner_id) &&
    canViewProfile(data, activity.owner_id, viewerId)
  )
    return "Friend hosting";
  const interests =
    data.profiles.find((profile) => profile.id === viewerId)?.interests ?? [];
  if (
    interests.some((interest) =>
      matchesSearch(
        interest,
        activity.title,
        activity.category,
        activity.description,
      ),
    )
  )
    return "Matches your interest";
  return "";
}

/** Reorders only inside equal priority bands, spreading repeated contexts apart. */
export function diversifyWithinBands<T>(
  entries: readonly T[],
  bandFor: (entry: T) => number,
  contextFor: (entry: T) => BrowseDiversityContext,
): T[] {
  const ordered = [...entries].sort((a, b) => bandFor(a) - bandFor(b));
  const result: T[] = [];
  for (let start = 0; start < ordered.length;) {
    const band = bandFor(ordered[start]);
    let end = start + 1;
    while (end < ordered.length && bandFor(ordered[end]) === band) end++;
    const remaining = ordered.slice(start, end);
    let previousContext: BrowseDiversityContext | null = null;
    while (remaining.length) {
      const repeatCost = (context: BrowseDiversityContext) => [
        Number(
          !!context.community &&
            context.community === previousContext?.community,
        ),
        Number(
          !!context.category && context.category === previousContext?.category,
        ),
        Number(!!context.area && context.area === previousContext?.area),
      ];
      const compareCost = (left: number[], right: number[]) =>
        left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
      let nextIndex = 0;
      if (previousContext) {
        for (let index = 1; index < remaining.length; index++) {
          if (
            compareCost(
              repeatCost(contextFor(remaining[index])),
              repeatCost(contextFor(remaining[nextIndex])),
            ) < 0
          )
            nextIndex = index;
        }
      }
      const [next] = remaining.splice(nextIndex < 0 ? 0 : nextIndex, 1);
      result.push(next);
      previousContext = contextFor(next);
    }
    start = end;
  }
  return result;
}

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
      if (!area || summary.area_label.toLocaleLowerCase().includes(area))
        return true;
      return false;
    })
    .sort(
      (a, b) =>
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.activity_id.localeCompare(b.activity_id),
    );
}

export function browseRankingBand(
  entry: BrowseDiscoveryEntry,
  data: Data,
  viewerId: string,
  now: number,
  interests: readonly string[] = data.profiles.find(
    (row) => row.id === viewerId,
  )?.interests ?? [],
  associations: readonly BeaconCommunityAssociation[] = [],
) {
  const wanted = new Set(
    interests.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean),
  );
  if (entry.kind === "public")
    return publicRankingBand(entry.summary, wanted, now);
  const activity = entry.activity;
  if (data.viewer_id !== viewerId) return 9;
  const response = data.rsvps.find(
    (row) => row.activity_id === activity.id && row.user_id === viewerId,
  );
  if (activity.owner_id === viewerId || isApprovedGoing(activity, response))
    return 0;
  if (
    response?.status === "invited" ||
    response?.status === "requested" ||
    data.beacon_invitation_grants.some(
      (row) => row.activity_id === activity.id && row.user_id === viewerId,
    )
  )
    return 1;
  const startsAt = Date.parse(activity.starts_at);
  const endsAt = Date.parse(activity.ends_at);
  if (startsAt <= now && endsAt > now) return 2;
  if (startsAt > now && startsAt <= now + 60 * 60000) return 3;
  const interestMatch = (activity.description ? [activity.description] : [])
    .concat(activity.title, activity.category)
    .some((content) => {
      const normalized = content.toLocaleLowerCase();
      return [...wanted].some(
        (interest) => interest && normalized.includes(interest),
      );
    });
  const capacity = beaconCapacity(data, activity);
  const inviteEligible =
    activity.mode !== "invite" ||
    data.beacon_invitation_grants.some(
      (row) => row.activity_id === activity.id && row.user_id === viewerId,
    );
  const joinEligible =
    activity.status === "scheduled" &&
    endsAt > now &&
    activity.mode !== "solo" &&
    !capacity.closed &&
    inviteEligible;
  if (joinEligible && interestMatch) return 4;
  if (joinEligible) return 5;
  const socialContext =
    friendIds(data, viewerId).includes(activity.owner_id) ||
    activity.audience === "squad" ||
    activity.audience === "organization" ||
    !!primaryAssociation(activity.id, associations);
  if (socialContext && interestMatch) return 6;
  if (socialContext) return 7;
  if (interestMatch) return 8;
  return 9;
}

function browseEntryContext(
  entry: BrowseDiscoveryEntry,
  associations: readonly BeaconCommunityAssociation[],
): BrowseDiversityContext {
  if (entry.kind === "public")
    return publicContext(entry.summary, associations);
  const activity = entry.activity;
  const community = primaryAssociation(activity.id, associations);
  return {
    community: community
      ? `${community.summary.entity_type}:${community.summary.entity_id}`
      : null,
    category: activity.category.toLocaleLowerCase(),
    area: null,
  };
}

export function rankBrowseEntries(
  entries: readonly BrowseDiscoveryEntry[],
  data: Data,
  viewerId: string,
  now: number,
  interests: readonly string[] = data.profiles.find(
    (row) => row.id === viewerId,
  )?.interests ?? [],
  associations: readonly BeaconCommunityAssociation[] = [],
) {
  const band = (entry: BrowseDiscoveryEntry) =>
    browseRankingBand(entry, data, viewerId, now, interests, associations);
  const ranked = [...entries].sort(
    (a, b) =>
      band(a) - band(b) ||
      Date.parse(
        a.kind === "activity" ? a.activity.starts_at : a.summary.starts_at,
      ) -
        Date.parse(
          b.kind === "activity" ? b.activity.starts_at : b.summary.starts_at,
        ) ||
      browseEntryId(a).localeCompare(browseEntryId(b)),
  );
  return diversifyWithinBands(ranked, band, (entry) =>
    browseEntryContext(entry, associations),
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
  associations: readonly BeaconCommunityAssociation[] = [],
) {
  const wanted = new Set(
    interests.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean),
  );
  const area = coarseArea?.trim().toLocaleLowerCase() ?? "";
  const eligible = [...summaries]
    .filter((summary) => !summary.closed && Date.parse(summary.ends_at) > now)
    .sort((a, b) => {
      return (
        publicRankingBand(a, wanted, now) - publicRankingBand(b, wanted, now) ||
        Number(!!area && b.area_label.toLocaleLowerCase() === area) -
          Number(!!area && a.area_label.toLocaleLowerCase() === area) ||
        Date.parse(a.starts_at) - Date.parse(b.starts_at) ||
        a.activity_id.localeCompare(b.activity_id)
      );
    });
  return diversifyWithinBands(
    eligible,
    (summary) => publicRankingBand(summary, wanted, now),
    (summary) => publicContext(summary, associations),
  );
}
