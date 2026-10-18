import type { Activity, Audience, Data } from "@/src/shared/types";
import {
  eligibleDefaultTargets,
  type ViewerDeviceDefaults,
} from "@/src/features/profile/settings/beaconDefaults";
import type { StatusDraft } from "./components/feed/statusActions";

export const quickStatusMinutes = [30, 60, 120, 240, 360] as const;
export function durationLabel(minutes: number) {
  return minutes < 60
    ? `${minutes} minutes`
    : minutes % 60 === 0
      ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}`
      : `${minutes} minutes`;
}
export function statusAudienceLabel(
  data: Data,
  viewer: string | null,
  audience: Audience,
  id?: string | null,
) {
  if (!viewer || data.viewer_id !== viewer) return "Unavailable audience";
  return audience === "friends"
    ? "Friends"
    : audience === "private"
      ? "Only me"
      : (eligibleDefaultTargets(data, viewer, audience).find(
          (target) => target.id === id,
        )?.name ?? "Unavailable audience");
}
export function validQuickStatus(
  data: Data,
  viewer: string | null,
  preference: ViewerDeviceDefaults["quickStatus"],
) {
  if (
    !viewer ||
    data.viewer_id !== viewer ||
    !preference ||
    !Number.isInteger(preference.minutes) ||
    preference.minutes < 5 ||
    preference.minutes > 1440
  )
    return false;
  return (
    preference.audience === "friends" ||
    preference.audience === "private" ||
    eligibleDefaultTargets(data, viewer, preference.audience).some(
      (target) => target.id === preference.audienceId,
    )
  );
}
export function quickStatusDraft(
  source: Activity | undefined,
  audience: Audience,
  audienceId: string | null,
  minutes: number,
  now: number,
  startsAt?: string,
  endsAt?: string,
): StatusDraft {
  const start = startsAt ? Date.parse(startsAt) : now;
  const end = endsAt ? Date.parse(endsAt) : start + minutes * 60000;
  if (
    !Number.isInteger(minutes) ||
    minutes < 5 ||
    minutes > 1440 ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end <= now
  )
    throw new Error(
      "Choose valid start and end times and a duration from 5 to 1440 minutes.",
    );
  return {
    title: source?.title || "Free to hang",
    description: source?.description,
    category: source?.category,
    available: true,
    sourceId: source?.id,
    audience: source?.audience ?? audience,
    audienceId: source ? source.audience_id : audienceId,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
  };
}
