import type { Activity, Category, PlanStep } from "@/src/shared/types";

export interface PlanOccurrence {
  step_index: number;
  step: PlanStep;
  starts_at: string;
  ends_at: string;
}

export interface PlanConflict {
  step_index: number;
  activity: Activity;
  suggested_starts_at: string;
  suggested_start_time: string;
}

export interface PlanStepConflict {
  first_step_index: number;
  second_step_index: number;
}

const categories = new Set<Category>([
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
]);

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Choose a valid plan start date.");
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]),
    epoch = Date.UTC(year, month - 1, day),
    parsed = new Date(epoch);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    throw new Error("Choose a valid plan start date.");
  return { year, month, day, epoch };
}

function dateWithOffset(date: string, offset: number) {
  const p = dateParts(date);
  return new Date(p.epoch + offset * 86400000).toISOString().slice(0, 10);
}

function formatter(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    throw new Error("Choose a valid timezone.");
  }
}

function partsAt(epoch: number, fmt: Intl.DateTimeFormat) {
  const fields = Object.fromEntries(
    fmt
      .formatToParts(new Date(epoch))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: fields.year,
    month: fields.month,
    day: fields.day,
    hour: fields.hour,
    minute: fields.minute,
    second: fields.second,
  };
}

/**
 * Convert a local wall-clock time to UTC using IANA timezone rules. For the
 * rare fall-back hour that occurs twice, choose the later occurrence. Spring
 * times skipped by a DST jump are rejected instead of silently shifted.
 */
export function planLocalDateTimeToISO(
  date: string,
  time: string,
  timezone: string,
) {
  const { year, month, day } = dateParts(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!timeMatch) throw new Error("Choose a valid beacon start time.");
  const hour = Number(timeMatch[1]),
    minute = Number(timeMatch[2]);
  if (hour > 23 || minute > 59)
    throw new Error("Choose a valid beacon start time.");
  const fmt = formatter(timezone),
    wallEpoch = Date.UTC(year, month - 1, day, hour, minute),
    offsets = new Set<number>();
  for (let delta = -36; delta <= 36; delta += 6) {
    const sample = wallEpoch + delta * 3600000,
      p = partsAt(sample, fmt),
      shownAsUtc = Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        p.hour,
        p.minute,
        p.second,
      );
    offsets.add(shownAsUtc - sample);
  }
  const matches = [...offsets]
    .map((offset) => wallEpoch - offset)
    .filter((candidate) => {
      const p = partsAt(candidate, fmt);
      return (
        p.year === year &&
        p.month === month &&
        p.day === day &&
        p.hour === hour &&
        p.minute === minute
      );
    })
    .sort((a, b) => a - b);
  if (!matches.length)
    throw new Error("That local time does not exist because of a clock change.");
  return new Date(matches[matches.length - 1]).toISOString();
}

export function validatePlanSteps(value: unknown): PlanStep[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30)
    throw new Error("A plan needs between 1 and 30 beacons.");
  return value.map((raw) => {
    if (!raw || typeof raw !== "object")
      throw new Error("Check each beacon in this plan.");
    const step = raw as Record<string, unknown>,
      title = typeof step.title === "string" ? step.title.trim() : "",
      description =
        typeof step.description === "string" ? step.description.trim() : "",
      location =
        typeof step.location_name === "string" ? step.location_name.trim() : "",
      category = step.category as Category,
      dayOffset = Number(step.day_offset),
      duration = Number(step.duration_minutes),
      time = typeof step.start_time === "string" ? step.start_time : "",
      lat = step.lat == null ? null : Number(step.lat),
      lng = step.lng == null ? null : Number(step.lng),
      aspirationIds = step.aspiration_ids ?? [];
    if (!title || title.length > 120)
      throw new Error("Beacon titles must be 1 to 120 characters.");
    if (description.length > 2000 || location.length > 200)
      throw new Error("Check the description and location lengths.");
    if (!categories.has(category))
      throw new Error("Choose a valid beacon category.");
    if (!Number.isInteger(dayOffset) || dayOffset < 0 || dayOffset > 365)
      throw new Error("Beacon dates must be within one year of the plan start.");
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440)
      throw new Error("Choose a duration from 1 to 1440 minutes.");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error("Choose a valid beacon start time.");
    if ((lat == null) !== (lng == null))
      throw new Error("Choose a complete map location.");
    if (
      lat != null &&
      (!Number.isFinite(lat) || Math.abs(lat) > 90 ||
        !Number.isFinite(lng) || Math.abs(lng!) > 180)
    )
      throw new Error("Choose a valid map location.");
    if (
      !Array.isArray(aspirationIds) ||
      aspirationIds.length > 20 ||
      aspirationIds.some((id) => typeof id !== "string" || !id.trim())
    )
      throw new Error("Choose valid aspirations for each beacon.");
    return {
      title,
      description,
      category,
      location_name: location,
      lat,
      lng,
      day_offset: dayOffset,
      start_time: time,
      duration_minutes: duration,
      aspiration_ids: [...new Set(aspirationIds as string[])],
    };
  });
}

export function buildPlanSchedule(
  startDate: string,
  timezone: string,
  steps: PlanStep[],
): PlanOccurrence[] {
  dateParts(startDate);
  const valid = validatePlanSteps(steps);
  return valid.map((step, step_index) => {
    const localDate = dateWithOffset(startDate, step.day_offset),
      starts = Date.parse(
        planLocalDateTimeToISO(localDate, step.start_time, timezone),
      );
    return {
      step_index,
      step,
      starts_at: new Date(starts).toISOString(),
      ends_at: new Date(starts + step.duration_minutes * 60000).toISOString(),
    };
  });
}

export function detectPlanStepOverlaps(
  occurrences: PlanOccurrence[],
): PlanStepConflict[] {
  const conflicts: PlanStepConflict[] = [];
  for (let first = 0; first < occurrences.length; first++) {
    const start = Date.parse(occurrences[first].starts_at),
      end = Date.parse(occurrences[first].ends_at);
    for (let second = first + 1; second < occurrences.length; second++) {
      if (
        start < Date.parse(occurrences[second].ends_at) &&
        end > Date.parse(occurrences[second].starts_at)
      )
        conflicts.push({
          first_step_index: occurrences[first].step_index,
          second_step_index: occurrences[second].step_index,
        });
    }
  }
  return conflicts;
}

function localParts(epoch: number, timezone: string) {
  const p = partsAt(epoch, formatter(timezone));
  return {
    date: `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
    time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
  };
}

function overlaps(start: number, end: number, activity: Activity) {
  return (
    activity.status === "scheduled" &&
    start < Date.parse(activity.ends_at) &&
    end > Date.parse(activity.starts_at)
  );
}

export function suggestPlanConflicts(
  occurrences: PlanOccurrence[],
  activities: Activity[],
  ownerId: string,
  timezone = "America/Chicago",
): PlanConflict[] {
  const owned = activities.filter((activity) => activity.owner_id === ownerId),
    result: PlanConflict[] = [];
  for (const occurrence of occurrences) {
    const start = Date.parse(occurrence.starts_at),
      end = Date.parse(occurrence.ends_at),
      collisions = owned.filter((activity) => overlaps(start, end, activity));
    if (!collisions.length) continue;
    const local = localParts(start, timezone),
      duration = end - start;
    let suggestion: number | undefined;
    for (let offset = 30; offset < 24 * 60; offset += 30) {
      const currentStart = planLocalDateTimeToISO(
        local.date,
        localParts(start, timezone).time,
        timezone,
      );
      const proposed = Date.parse(currentStart) + offset * 60000,
        proposedLocal = localParts(proposed, timezone),
        proposedEnd = proposed + duration;
      if (proposedLocal.date !== local.date) break;
      if (
        owned.every((activity) => !overlaps(proposed, proposedEnd, activity)) &&
        occurrences.every((other) =>
          other.step_index === occurrence.step_index ||
          proposed >= Date.parse(other.ends_at) ||
          proposedEnd <= Date.parse(other.starts_at),
        )
      ) {
        suggestion = proposed;
        break;
      }
    }
    if (suggestion == null) continue;
    for (const activity of collisions) {
      result.push({
        step_index: occurrence.step_index,
        activity,
        suggested_starts_at: new Date(suggestion).toISOString(),
        suggested_start_time: localParts(suggestion, timezone).time,
      });
    }
  }
  return result;
}
