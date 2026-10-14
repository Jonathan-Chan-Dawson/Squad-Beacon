import type { Data, Audience } from "@/src/shared/types";
import { canReadBeaconActivity } from "./beaconModules";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import { eligibleDefaultTargets } from "@/src/features/profile/settings/beaconDefaults";
import type { StatusDraft } from "./components/feed/statusActions";

export function legacyStatusSeed(data: Data, userId: string | null, params: Record<string, unknown>, now: number): StatusDraft {
  if (!userId || data.viewer_id !== userId) throw new Error("Refresh your profile before sharing a status.");
  if (params.inviteeIds && params.inviteeIds !== "[]") throw new Error("Clear selected friends before sharing a status. Status notes do not send invitations.");
  const saved = params.template ? data.templates.find((item) => item.id === params.template && item.owner_id === userId) : undefined;
  if (params.template && !saved) throw new Error("This status template is unavailable.");
  const sourceKey = params.statusSourceId || params.repeat;
  const source = sourceKey ? data.activities.find((item) => item.id === sourceKey && canReadBeaconActivity(data, item, userId)) : undefined;
  if (sourceKey && (!source || params.statusSourceId && (source.owner_id !== userId || source.mode !== "solo"))) throw new Error("This status source is unavailable.");
  let timezone = data.profiles.find((item) => item.id === userId)?.timezone || "UTC";
  if (params.timezone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: String(params.timezone) }); timezone = String(params.timezone); }
    catch { throw new Error("Choose a valid timezone."); }
  }
  const startsAt = typeof params.startsAt === "string" ? params.startsAt : new Date(now).toISOString();
  if (!Number.isFinite(Date.parse(startsAt))) throw new Error("Choose a valid start time.");
  let audience: Audience = source?.owner_id === userId ? source.audience : "friends";
  let audienceId = source?.owner_id === userId ? source.audience_id : null;
  if (params.squadId) { audience = "squad"; audienceId = String(params.squadId); }
  if (params.organizationId) { audience = "organization"; audienceId = String(params.organizationId); }
  if (audience !== "friends" && audience !== "private" && !eligibleDefaultTargets(data, userId, audience).some((item) => item.id === audienceId)) throw new Error("Choose an audience you can share with.");
  if (params.planId || params.threadId || params.spaceId) throw new Error("Status notes are separate from Plans, decisions and community Beacons. Open status sharing without this association.");
  const place = source && canViewBeaconMeetingDetails(data, source.id, userId) ? data.places.find((item) => item.activity_id === source.id) : undefined;
  let latitude = place?.latitude ?? null, longitude = place?.longitude ?? null, label = saved?.label ?? place?.label ?? "";
  if (params.latitude !== undefined || params.longitude !== undefined) {
    if (typeof params.latitude !== "string" || !params.latitude.trim() || typeof params.longitude !== "string" || !params.longitude.trim()) throw new Error("Choose a valid meeting point.");
    latitude = Number(params.latitude); longitude = Number(params.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new Error("Choose a valid meeting point.");
    label = typeof params.placeLabel === "string" ? params.placeLabel : label;
  }
  return { title: saved?.title ?? source?.title ?? "", description: saved?.description ?? source?.description ?? "", category: saved?.category ?? source?.category ?? "Social",
    available: source?.available === true, startsAt, endsAt: new Date(Date.parse(startsAt) + (saved?.minutes ?? 60)*60000).toISOString(), timezone, audience, audienceId,
    latitude, longitude, label, onlineUrl: place?.online_url ?? null, sourceId: source?.owner_id === userId && source.mode === "solo" ? source.id : undefined };
}

export function usesSharedStatusEditor(params: Record<string, unknown>) {
  return params.kind === "status" && params.editTemplate !== "yes" && params.saveTemplate !== "yes";
}
