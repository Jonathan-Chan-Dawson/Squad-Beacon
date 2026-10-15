import type { Data, ID } from "@/src/shared/types";
import { canReadBeaconActivity, canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { canViewProfile } from "@/src/features/profile/privacy";

export type ActivityHistoryLabel = "cancelled" | "completed" | "ended";
export type ActivityHistoryRsvpStatus = "interested" | "going" | "requested" | "invited";

export interface ActivityHistoryQuery {
  query?: string;
  cursor?: string | null;
  pageSize?: number;
}

export interface ActivityHistorySummary {
  id: ID;
  title: string;
  category: string;
  mode: "solo" | "squad" | "invite";
  status: "scheduled" | "completed" | "cancelled";
  historyLabel: ActivityHistoryLabel;
  startsAt: string;
  endsAt: string;
  timezone: string;
  ownerId: ID;
  ownerName: string | null;
  viewerRole: "host" | "attendee";
  viewerRsvpStatus: ActivityHistoryRsvpStatus | null;
}

export interface ActivityHistoryPage {
  rows: ActivityHistorySummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const ACTIVITY_HISTORY_DEFAULT_PAGE_SIZE = 3;
export const ACTIVITY_HISTORY_MAX_PAGE_SIZE = 20;

export function normalizeActivityHistoryQuery(
  input: ActivityHistoryQuery = {},
): Required<ActivityHistoryQuery> {
  const query = typeof input.query === "string" ? input.query.trim().slice(0, 80) : "";
  const pageSize = Number.isFinite(input.pageSize)
    ? Math.min(ACTIVITY_HISTORY_MAX_PAGE_SIZE, Math.max(1, Math.trunc(input.pageSize!)))
    : ACTIVITY_HISTORY_DEFAULT_PAGE_SIZE;
  const cursor = typeof input.cursor === "string" && input.cursor.length <= 180
    ? input.cursor
    : null;
  return { query, cursor, pageSize };
}

function isHistoryActivity(status: string, endsAt: string, now: number) {
  return status === "cancelled" || status === "completed" || Date.parse(endsAt) <= now;
}

function historyLabel(status: ActivityHistorySummary["status"]): ActivityHistoryLabel {
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  return "ended";
}

function canReadHistoryActivity(data: Data, activity: Data["activities"][number], viewerId: ID) {
  if (activity.mode === "solo" || !canReadBeaconActivity(data, activity, viewerId)) return false;
  if (activity.plan_id && activity.plan_step && !activity.plan_started_at && activity.status === "scheduled") return false;
  if (activity.owner_id === viewerId) return true;
  const rsvp = data.rsvps.find(
    (row) => row.activity_id === activity.id && row.user_id === viewerId,
  );
  return isApprovedGoing(activity, rsvp) && canUseBeaconModules(data, activity, viewerId);
}

function cursorFor(row: ActivityHistorySummary) {
  return `${row.startsAt}|${row.id}`;
}

function compareHistoryRows(left: ActivityHistorySummary, right: ActivityHistorySummary) {
  const byDate = Date.parse(right.startsAt) - Date.parse(left.startsAt);
  if (byDate !== 0) return byDate;
  return right.id.localeCompare(left.id);
}

function isAfterCursor(row: ActivityHistorySummary, cursor: string | null) {
  if (!cursor) return true;
  const divider = cursor.lastIndexOf("|");
  if (divider <= 0) return true;
  const cursorDate = Date.parse(cursor.slice(0, divider));
  const cursorId = cursor.slice(divider + 1);
  if (!Number.isFinite(cursorDate) || !cursorId) return true;
  const rowDate = Date.parse(row.startsAt);
  return rowDate < cursorDate || (rowDate === cursorDate && row.id.localeCompare(cursorId) < 0);
}

/** Demo selection mirrors the hosted history projection and never searches private Beacon notes. */
export function searchActivityHistoryInData(
  data: Data,
  viewerId: ID,
  input: ActivityHistoryQuery = {},
  now = Date.now(),
): ActivityHistoryPage {
  const query = normalizeActivityHistoryQuery(input);
  const needle = query.query.toLocaleLowerCase();
  const rows = data.activities.flatMap((activity) => {
    if (!canReadHistoryActivity(data, activity, viewerId) || !isHistoryActivity(activity.status, activity.ends_at, now)) return [];
    const ownerProfile = data.profiles.find((profile) => profile.id === activity.owner_id);
    const ownerName = ownerProfile && canViewProfile(data, ownerProfile, viewerId)
      ? ownerProfile.name
      : null;
    const searchable = [activity.title, activity.category, activity.description ?? "", ownerName ?? ""]
      .join(" ")
      .toLocaleLowerCase();
    if (needle && !searchable.includes(needle)) return [];
    const rsvp = data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === viewerId);
    return [{
      id: activity.id,
      title: activity.title,
      category: activity.category,
      mode: activity.mode,
      status: activity.status,
      historyLabel: historyLabel(activity.status),
      startsAt: activity.starts_at,
      endsAt: activity.ends_at,
      timezone: activity.timezone,
      ownerId: activity.owner_id,
      ownerName,
      viewerRole: activity.owner_id === viewerId ? "host" as const : "attendee" as const,
      viewerRsvpStatus: rsvp?.status ?? null,
    }];
  }).sort(compareHistoryRows).filter((row) => isAfterCursor(row, query.cursor));
  const pageRows = rows.slice(0, query.pageSize);
  const hasMore = rows.length > pageRows.length;
  return {
    rows: pageRows,
    hasMore,
    nextCursor: hasMore && pageRows.length ? cursorFor(pageRows[pageRows.length - 1]) : null,
  };
}

const allowedCategories = new Set(["Fitness", "Study", "Gaming", "Creative", "Social", "Other"]);

/** Reject malformed RPC payloads rather than letting an invalid cursor repeat or skip history. */
export function parseActivityHistoryPage(value: unknown): ActivityHistoryPage {
  if (!value || typeof value !== "object") throw new Error("Activity history returned an invalid page.");
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.rows) || page.rows.length > ACTIVITY_HISTORY_MAX_PAGE_SIZE || typeof page.has_more !== "boolean")
    throw new Error("Activity history returned an invalid page.");
  if (!(page.next_cursor === null || (typeof page.next_cursor === "string" && page.next_cursor.length <= 180)))
    throw new Error("Activity history returned an invalid cursor.");
  if (page.has_more !== (page.next_cursor !== null) || (page.has_more && page.rows.length === 0))
    throw new Error("Activity history returned an inconsistent page cursor.");
  const rows: ActivityHistorySummary[] = [];
  for (const candidate of page.rows) {
    if (!candidate || typeof candidate !== "object") throw new Error("Activity history returned an invalid row.");
    const row = candidate as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id || typeof row.title !== "string" || !row.title ||
      typeof row.category !== "string" || !allowedCategories.has(row.category) ||
      (row.mode !== "solo" && row.mode !== "squad" && row.mode !== "invite") ||
      (row.status !== "scheduled" && row.status !== "completed" && row.status !== "cancelled") ||
      (row.history_label !== "cancelled" && row.history_label !== "completed" && row.history_label !== "ended") ||
      row.history_label !== (row.status === "scheduled" ? "ended" : row.status) ||
      typeof row.starts_at !== "string" || !Number.isFinite(Date.parse(row.starts_at)) ||
      typeof row.ends_at !== "string" || !Number.isFinite(Date.parse(row.ends_at)) ||
      typeof row.timezone !== "string" || typeof row.owner_id !== "string" || !row.owner_id ||
      !(row.owner_name === null || typeof row.owner_name === "string") ||
      (row.viewer_role !== "host" && row.viewer_role !== "attendee") ||
      !(row.viewer_rsvp_status === null || row.viewer_rsvp_status === "interested" || row.viewer_rsvp_status === "going" || row.viewer_rsvp_status === "requested" || row.viewer_rsvp_status === "invited"))
      throw new Error("Activity history returned an invalid row.");
    rows.push({
      id: row.id,
      title: row.title,
      category: row.category,
      mode: row.mode,
      status: row.status,
      historyLabel: row.history_label,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      viewerRole: row.viewer_role,
      viewerRsvpStatus: row.viewer_rsvp_status,
    });
  }
  if (page.has_more) {
    const cursor = page.next_cursor as string;
    const separator = cursor.lastIndexOf("|");
    const last = rows[rows.length - 1];
    if (separator <= 0 || cursor.indexOf("|") !== separator || !last ||
      cursor.slice(separator + 1) !== last.id ||
      Date.parse(cursor.slice(0, separator)) !== Date.parse(last.startsAt))
      throw new Error("Activity history returned a cursor that does not match its page.");
  }
  return {
    rows,
    hasMore: page.has_more,
    nextCursor: page.next_cursor,
  };
}
