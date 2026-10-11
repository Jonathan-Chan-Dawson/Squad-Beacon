import type { Data } from "@/src/shared/types";
import type { PublicBeaconSummary } from "./types";
import { beaconCapacity } from "@/src/features/beacons/permissions";
import { matchesSearch } from "@/src/shared/search";

export function parsePublicBeaconRows(value: unknown): PublicBeaconSummary[] {
  if (!Array.isArray(value)) return [];
  const categories = [
    "Fitness",
    "Study",
    "Gaming",
    "Creative",
    "Social",
    "Other",
  ];
  return value.slice(0, 50).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as PublicBeaconSummary;
    if (
      typeof r.activity_id !== "string" ||
      typeof r.title !== "string" ||
      !categories.includes(r.category) ||
      typeof r.area_label !== "string" ||
      !Number.isFinite(Date.parse(r.starts_at)) ||
      !Number.isFinite(Date.parse(r.ends_at)) ||
      typeof r.requires_approval !== "boolean" ||
      typeof r.closed !== "boolean" ||
      !Number.isInteger(r.accepted_seat_count) ||
      r.accepted_seat_count < 0 ||
      (r.capacity_policy !== "soft" && r.capacity_policy !== "strict") ||
      (r.capacity_limit !== null &&
        (!Number.isInteger(r.capacity_limit) || r.capacity_limit < 1)) ||
      (r.coarse_lat === null) !== (r.coarse_lng === null) ||
      (r.coarse_lat !== null &&
        (!Number.isFinite(Number(r.coarse_lat)) ||
          Math.abs(Number(r.coarse_lat)) > 90 ||
          !Number.isFinite(Number(r.coarse_lng)) ||
          Math.abs(Number(r.coarse_lng)) > 180))
    )
      return [];
    return [
      {
        activity_id: r.activity_id,
        title: r.title,
        category: r.category,
        interest_tags: Array.isArray(r.interest_tags)
          ? r.interest_tags
              .filter((tag) => typeof tag === "string")
              .slice(0, 20)
          : [],
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        area_label: r.area_label,
        coarse_lat: r.coarse_lat === null ? null : Number(r.coarse_lat),
        coarse_lng: r.coarse_lng === null ? null : Number(r.coarse_lng),
        requires_approval: r.requires_approval,
        capacity_limit: r.capacity_limit,
        capacity_policy: r.capacity_policy,
        accepted_seat_count: r.accepted_seat_count,
        closed: r.closed,
        viewer_response:
          r.viewer_response === "going" || r.viewer_response === "requested"
            ? r.viewer_response
            : null,
      },
    ];
  });
}

/** Demo opt-ins are explicit fixtures, never all relationship-visible activities. */
export function demoPublicBeacons(
  data: Data,
  viewerId: string,
  query: string,
  now = Date.now(),
) {
  if (!data.is_demo || data.viewer_id !== viewerId) return [];
  return data.public_beacons.flatMap((summary) => {
    const activity = data.activities.find(
      (row) => row.id === summary.activity_id,
    );
    if (
      !activity ||
      activity.mode !== "squad" ||
      activity.audience === "organization" ||
      activity.status !== "scheduled" ||
      Date.parse(activity.ends_at) <= now ||
      data.activity_exclusions.some(
        (row) => row.activity_id === activity.id && row.user_id === viewerId,
      ) ||
      data.blocks.some(
        (row) =>
          (row.blocker_id === viewerId &&
            row.blocked_id === activity.owner_id) ||
          (row.blocker_id === activity.owner_id && row.blocked_id === viewerId),
      )
    )
      return [];
    const capacity = beaconCapacity(data, activity);
    const current = {
      ...summary,
      title: activity.title,
      starts_at: activity.starts_at,
      ends_at: activity.ends_at,
      accepted_seat_count: capacity.count,
      closed: capacity.closed,
      viewer_response: data.rsvps.find(
        (row) =>
          row.activity_id === activity.id &&
          row.user_id === viewerId &&
          (row.status === "requested" ||
            (row.status === "going" && row.approved)),
      )?.status as "going" | "requested" | undefined,
    };
    return matchesSearch(
      query,
      current.title,
      current.category,
      current.area_label,
      ...current.interest_tags,
    )
      ? [current]
      : [];
  });
}
