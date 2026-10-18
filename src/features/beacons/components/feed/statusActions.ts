import type { Activity, Category, Audience, Data, Payload, Profile } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";

export type StatusDraft = {
  startsAt?: string;
  timezone?: string;
  label?: string;
  latitude?: number | null;
  longitude?: number | null;
  onlineUrl?: string | null;
  sourceId?: string;
  title: string;
  available: boolean;
  endsAt: string;
  description?: string;
  category?: Category;
  audience?: Audience;
  audienceId?: string | null;
};
export type StatusAction = (action: string, payload?: Payload) => Promise<Record<string, unknown>>;
export type StatusMutationResult = { savedId?: string; failedIds: string[]; message: string };

export function liveOwnedStatuses(data: Data, userId: string | null, now: number) {
  if (!userId || data.viewer_id !== userId) return [];
  return data.activities.filter((activity) => activity.owner_id === userId && activity.mode === "solo" &&
    activity.status === "scheduled" && Date.parse(activity.starts_at) <= now && Date.parse(activity.ends_at) > now &&
    canReadBeaconActivity(data, activity, userId))
    .sort((left, right) => right.starts_at.localeCompare(left.starts_at));
}

export function statusEndAt(preset: "hour" | "tonight" | "busy" | "custom", customMinutes: string, preservedEndsAt: string | null, now: number) {
  if (preset === "custom" && preservedEndsAt) {
    if (!Number.isFinite(Date.parse(preservedEndsAt)) || Date.parse(preservedEndsAt) <= now) throw new Error("Choose an end time in the future.");
    return preservedEndsAt;
  }
  if (preset === "tonight") {
    const evening = new Date(now);
    evening.setHours(23, 59, 0, 0);
    if (evening.getTime() <= now) evening.setDate(evening.getDate() + 1);
    return evening.toISOString();
  }
  const minutes = preset === "hour" || preset === "busy" ? 60 : Number(customMinutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) throw new Error("Choose a duration from 5 to 1440 minutes.");
  return new Date(now + minutes * 60_000).toISOString();
}

export function statusCreatePayload(value: StatusDraft, source: Activity | undefined, profile: Profile | undefined, now: number): Payload {
  const title = value.title.trim();
  if (!title) throw new Error("Add a short status note.");
  if (!Number.isFinite(Date.parse(value.endsAt)) || Date.parse(value.endsAt) <= now) throw new Error("Choose an end time in the future.");
  const start = value.startsAt ? Date.parse(value.startsAt) : now;
  if (!Number.isFinite(start) || Date.parse(value.endsAt) <= start) throw new Error("Choose valid status dates.");
  if (value.timezone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: value.timezone }); }
    catch { throw new Error("Choose a valid timezone."); }
  }
  const lat = value.latitude ?? null, lng = value.longitude ?? null;
  if ((lat === null) !== (lng === null) || lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90) || lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180)) throw new Error("Choose a valid meeting point.");
  const audience = value.audience ?? source?.audience ?? "friends";
  const audienceId = audience === "friends" || audience === "private" ? null : value.audienceId ?? source?.audience_id ?? null;
  return {
    title, description: value.description ?? source?.description ?? "", available: value.available,
    category: value.category ?? source?.category ?? "Social", mode: "solo", starts_at: new Date(start).toISOString(), ends_at: value.endsAt,
    source_id: value.sourceId ?? source?.id,
    timezone: value.timezone || source?.timezone || profile?.timezone || "UTC", audience, audience_id: audienceId,
    target_count: null, approval_required: false, aspiration_ids: source?.aspiration_ids ?? [],
    enable_reactions: source?.enable_reactions !== false,
    label: value.label ?? "", online_url: value.onlineUrl ?? null, latitude: value.latitude ?? null, longitude: value.longitude ?? null,
  };
}

function requireViewer(data: Data, userId: string | null): asserts userId is string {
  if (!userId || data.viewer_id !== userId) throw new Error("Refresh your profile before editing a status.");
}

/** The server validates and replaces/cancels current status records in one transaction. */
export async function saveOwnStatus(data: Data, userId: string | null, value: StatusDraft, act: StatusAction, now: number): Promise<StatusMutationResult> {
  requireViewer(data, userId);
  const source = value.sourceId ? data.activities.find((item) => item.id === value.sourceId && item.owner_id === userId && item.mode === "solo") : liveOwnedStatuses(data, userId, now)[0];
  if (value.sourceId && !source) throw new Error("Choose your own status note.");
  const place = source ? data.places.find((item) => item.activity_id === source.id) : undefined;
  const preserved = { label: place?.label, latitude: place?.latitude, longitude: place?.longitude, onlineUrl: place?.online_url, ...value };
  const result = await act("save_status_note", statusCreatePayload(preserved, source, data.profiles.find((profile) => profile.id === userId), now));
  if (result.event !== "save_status_note" || typeof result.id !== "string" || !Number.isInteger(result.cleared_count)) throw new Error("Your status could not be verified. Refresh before trying again.");
  // The atomic writer intentionally lets scheduled statuses coexist. Replace the
  // explicitly edited future note through the existing owner-only cancellation.
  if (source && Date.parse(source.starts_at) > now && source.id !== result.id) {
    try { await act("activity_status", { id: source.id, status: "cancelled" }); }
    catch { return { savedId: result.id, failedIds: [source.id], message: "Your new status was saved. The previous scheduled status could not be removed; open scheduled statuses to clear it." }; }
  }
  return { savedId: result.id, failedIds: [], message: "" };
}

export async function clearOwnStatuses(data: Data, userId: string | null, act: StatusAction, _now: number, sourceId?: string): Promise<StatusMutationResult> {
  requireViewer(data, userId);
  const source = sourceId ? data.activities.find((item) => item.id === sourceId && item.owner_id === userId && item.mode === "solo" && item.status === "scheduled" && Date.parse(item.starts_at) > _now) : undefined;
  if (source) {
    await act("activity_status", { id: source.id, status: "cancelled" });
    return { failedIds: [], message: "" };
  }
  const result = await act("clear_status_notes");
  if (result.event !== "clear_status_notes" || !Number.isInteger(result.cleared_count)) throw new Error("Clearing your status could not be verified. Refresh before trying again.");
  return { failedIds: [], message: "" };
}
