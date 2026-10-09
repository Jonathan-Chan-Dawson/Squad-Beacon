import {
  beaconCapacity,
  isApprovedGoing,
} from "@/src/features/beacons/permissions";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { friendIds } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { matchesSearch } from "@/src/shared/search";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import type { Activity, Data, ID } from "@/src/shared/types";
import type { ExplorationFilters } from "@/src/shared/exploration";

function zonedDateParts(value: string | number, timeZone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  const formatter = (zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatter(timeZone || "UTC").formatToParts(date);
  } catch {
    parts = formatter("UTC").formatToParts(date);
  }
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    millisecond: date.getUTCMilliseconds(),
  };
}

function localStamp(parts: NonNullable<ReturnType<typeof zonedDateParts>>) {
  return `${parts.date}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}.${String(parts.millisecond).padStart(3, "0")}`;
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return [
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  ]
    .map((value, index) =>
      index === 0 ? String(value) : String(value).padStart(2, "0"),
    )
    .join("-");
}

function overlapsDate(
  start: ReturnType<typeof zonedDateParts>,
  end: ReturnType<typeof zonedDateParts>,
  date: string,
) {
  if (!start || !end) return false;
  const dayStart = `${date}T00:00:00.000`;
  const dayEnd = `${shiftDate(date, 1)}T00:00:00.000`;
  return localStamp(start) < dayEnd && localStamp(end) > dayStart;
}

function matchesWhen(
  activity: Activity,
  when: ExplorationFilters["when"],
  now: number,
) {
  if (!when || when === "Any") return true;
  const starts = zonedDateParts(activity.starts_at, activity.timezone);
  const ends = zonedDateParts(activity.ends_at, activity.timezone);
  const current = zonedDateParts(now, activity.timezone);
  if (!starts || !ends || !current) return false;
  switch (when) {
    case "Today":
      return overlapsDate(starts, ends, current.date);
    case "Tonight": {
      const tomorrow = shiftDate(current.date, 1);
      return (
        localStamp(starts) < `${tomorrow}T05:00:00.000` &&
        localStamp(ends) > `${current.date}T17:00:00.000`
      );
    }
    case "Tomorrow":
      return overlapsDate(starts, ends, shiftDate(current.date, 1));
    case "Weekend": {
      const weekdayNumber: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const currentDay = weekdayNumber[current.weekday];
      const daysToFriday =
        currentDay === 6
          ? -1
          : currentDay === 0
            ? -2
            : (5 - currentDay + 7) % 7;
      const friday = shiftDate(current.date, daysToFriday);
      const sunday = shiftDate(friday, 2);
      return (
        localStamp(starts) < `${shiftDate(sunday, 1)}T00:00:00.000` &&
        localStamp(ends) > `${friday}T00:00:00.000`
      );
    }
    default:
      return true;
  }
}

function matchesAudience(
  data: Data,
  activity: Activity,
  userId: ID,
  audience: string,
) {
  if (audience === "Everyone") return true;
  if (audience === "Friends")
    return friendIds(data, userId).includes(activity.owner_id);
  if (audience === "Squads") return activity.audience === "squad";
  if (audience === "Public") return String(activity.audience) === "public";
  return activity.audience_id === audience;
}

function matchesJoin(
  data: Data,
  activity: Activity,
  userId: ID,
  join: ExplorationFilters["join"],
  now: number,
) {
  if (!join || join === "Any") return true;
  const currentRsvp = data.rsvps.find(
    (rsvp) => rsvp.activity_id === activity.id && rsvp.user_id === userId,
  );
  const capacity = beaconCapacity(data, activity);
  switch (join) {
    case "Open":
      return (
        activity.status === "scheduled" &&
        activity.mode !== "solo" &&
        Date.parse(activity.ends_at) > now &&
        !capacity.closed &&
        !activity.approval_required &&
        activity.mode !== "invite"
      );
    case "Needs People":
      return (
        activity.status === "scheduled" &&
        activity.mode !== "solo" &&
        Date.parse(activity.ends_at) > now &&
        !capacity.closed &&
        activity.target_count != null &&
        activity.target_count > capacity.count
      );
    case "I'm In":
      return (
        activity.owner_id === userId || isApprovedGoing(activity, currentRsvp)
      );
    case "Request Approval":
      return (
        (activity.approval_required || activity.mode === "invite") &&
        activity.status === "scheduled" &&
        activity.mode !== "solo" &&
        Date.parse(activity.ends_at) > now &&
        !capacity.closed &&
        !isApprovedGoing(activity, currentRsvp) &&
        (activity.mode !== "invite" ||
          currentRsvp?.status === "invited" ||
          data.beacon_invitation_grants.some(
            (grant) =>
              grant.activity_id === activity.id && grant.user_id === userId,
          ))
      );
    case "Invited":
      return currentRsvp?.status === "invited";
    case "Spots Available":
      return (
        activity.status === "scheduled" &&
        activity.mode !== "solo" &&
        Date.parse(activity.ends_at) > now &&
        !capacity.closed &&
        capacity.strict &&
        capacity.remaining != null &&
        capacity.remaining > 0
      );
    default:
      return true;
  }
}

/** Meeting details are hidden from approval/invite-only viewers until admitted. */
export function canReadBeaconMeetingDetails(
  data: Data,
  activity: Activity,
  userId: ID,
) {
  return (
    data.viewer_id === userId &&
    canViewBeaconMeetingDetails(data, activity.id, userId)
  );
}

/** Apply canonical visibility plus the current shared discovery filters. */
export function matchesBeaconFilters(
  data: Data,
  activity: Activity,
  userId: ID | null,
  filters: ExplorationFilters,
  now = Date.now(),
  options: { includeBaseFilters?: boolean; query?: string } = {},
) {
  if (
    !userId ||
    data.viewer_id !== userId ||
    !canReadBeaconActivity(data, activity, userId)
  )
    return false;
  const includeBase = options.includeBaseFilters !== false;
  if (
    includeBase &&
    filters.category !== "All categories" &&
    activity.category !== filters.category
  )
    return false;
  if (includeBase && !matchesAudience(data, activity, userId, filters.audience))
    return false;
  if (includeBase && filters.time === "Now") {
    if (!(
      Date.parse(activity.starts_at) <= now &&
      Date.parse(activity.ends_at) > now
    ))
      return false;
  } else if (includeBase && filters.time === "Upcoming") {
    if (!(
      Date.parse(activity.starts_at) > now && Date.parse(activity.ends_at) > now
    ))
      return false;
  }
  if (includeBase && filters.planId && activity.plan_id !== filters.planId)
    return false;
  if (!matchesWhen(activity, filters.when, now)) return false;
  if (!matchesJoin(data, activity, userId, filters.join, now)) return false;
  if (filters.format && filters.format !== "Any") {
    if (!canReadBeaconMeetingDetails(data, activity, userId)) return false;
    const place = data.places.find((row) => row.activity_id === activity.id);
    const virtual = !!place?.online_url;
    if (filters.format === "Virtual" ? !virtual : !place || virtual)
      return false;
  }
  if (filters.starredOnly) {
    const ownerStarred = data.favorites.some(
      (favorite) =>
        favorite.owner_id === userId &&
        favorite.kind === "friend" &&
        favorite.target_id === activity.owner_id,
    );
    const squadStarred =
      activity.audience === "squad" &&
      data.favorites.some(
        (favorite) =>
          favorite.owner_id === userId &&
          favorite.kind === "squad" &&
          favorite.target_id === activity.audience_id,
      );
    if (!ownerStarred && !squadStarred) return false;
  }
  if (options.query) {
    const owner = data.profiles.find(
      (profile) => profile.id === activity.owner_id,
    );
    const canReadDetails = canReadBeaconMeetingDetails(data, activity, userId);
    const place = canReadDetails
      ? data.places.find((row) => row.activity_id === activity.id)
      : undefined;
    if (
      !matchesSearch(
        options.query,
        activity.title,
        activity.category,
        owner && canViewProfile(data, owner, userId) ? owner.name : undefined,
        place?.label,
      )
    )
      return false;
  }
  return true;
}

export function explorationFilterCount(filters: ExplorationFilters) {
  return (
    Number(filters.audience !== "Everyone") +
    Number(filters.category !== "All categories") +
    Number(filters.time !== "All") +
    Number(!!filters.planId) +
    Number(!!filters.when && filters.when !== "Any") +
    Number(!!filters.join && filters.join !== "Any") +
    Number(!!filters.format && filters.format !== "Any") +
    Number(filters.starredOnly === true)
  );
}
