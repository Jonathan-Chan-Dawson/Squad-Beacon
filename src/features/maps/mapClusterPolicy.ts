import type { Activity, ActivityPlace } from "@/src/shared/types";
import {
  clusterMapPoints,
  MAX_RENDERED_MAP_FEATURES,
  type ClusterPoint,
  type ClusterViewport,
  type MapPointGroup,
  type MapPointPriority,
} from "./cluster";

export const MAP_AREA_SUMMARY_ZOOM = 12;
export const MAP_INDIVIDUAL_ZOOM = 16;
export const CLUSTER_PREVIEW_LIMIT = 3;

export function mapClusterTier(zoom: number) {
  return zoom < MAP_AREA_SUMMARY_ZOOM
    ? "area"
    : zoom < MAP_INDIVIDUAL_ZOOM
      ? "cluster"
      : "individual";
}

/** Keep all authorized items represented while reducing objects at city scale. */
export function mapClusterGroups(
  points: ClusterPoint[],
  viewport: ClusterViewport,
  priorities: Record<string, MapPointPriority> = {},
) {
  const tier = mapClusterTier(viewport.zoom);
  const radius = tier === "area" ? 96 : tier === "cluster" ? 72 : 40;
  const protectedPoints = points.filter(
    (point) => (priorities[point.id]?.tier ?? 7) < 0,
  );
  const protectedIds = new Set(protectedPoints.map((point) => point.id));
  let groups = clusterMapPoints(
    points.filter((point) => !protectedIds.has(point.id)),
    viewport,
    radius,
  );
  if (tier === "area") {
    for (
      let distance = radius * 2;
      groups.length > 24 && distance <= 1536;
      distance *= 2
    )
      groups = clusterMapPoints(
        points.filter((point) => !protectedIds.has(point.id)),
        viewport,
        distance,
      );
  }
  const protectedGroups = clusterMapPoints(
    protectedPoints,
    viewport,
    1,
  ).flatMap((group) =>
    group.members.map((point) => ({
      id: `map-group:${point.id}`,
      latitude: point.latitude,
      longitude: point.longitude,
      members: [point],
    })),
  );
  if (groups.length + protectedGroups.length > MAX_RENDERED_MAP_FEATURES)
    return clusterMapPoints(points, viewport, radius);
  // An aggregate's badge can move slightly; individual coordinates remain exact.
  const world = 256 * 2 ** viewport.zoom;
  for (const group of groups) {
    if (group.members.length < 2) continue;
    for (const protectedGroup of protectedGroups) {
      const dx =
        ((((group.longitude - protectedGroup.longitude + 540) % 360) - 180) /
          360) *
        world;
      const dy =
        ((group.latitude - protectedGroup.latitude) /
          (360 * Math.cos((viewport.centerLatitude * Math.PI) / 180))) *
        world;
      if (Math.hypot(dx, dy) < 54)
        group.longitude =
          ((protectedGroup.longitude +
            ((dx < 0 ? -54 : 54) / world) * 360 +
            540) %
            360) -
          180;
    }
  }
  return [...groups, ...protectedGroups];
}

/** Use known area/landmark names without a new geocoding request. */
export function clusterAreaSummary(
  group: MapPointGroup,
  activities: readonly Activity[],
  places: readonly ActivityPlace[],
  now: number,
  areaName?: string,
  viewerId?: string | null,
) {
  const ids = new Set(
    group.members
      .filter((point) => point.kind === "beacon")
      .map((point) => point.id.slice(7)),
  );
  const beacons = activities.filter((activity) => ids.has(activity.id));
  const live = beacons.filter(
    (activity) =>
      activity.status === "scheduled" &&
      Date.parse(activity.starts_at) <= now &&
      Date.parse(activity.ends_at) > now,
  ).length;
  const landmark = places.find(
    (place) =>
      ids.has(place.activity_id) &&
      /\b(park|campus|downtown|district|neighborhood|university)\b/i.test(
        place.label,
      ) &&
      place.latitude != null &&
      place.longitude != null &&
      Math.abs(place.latitude - group.latitude) < 0.015 &&
      Math.abs(place.longitude - group.longitude) < 0.02,
  );
  return {
    name: (landmark?.label || areaName || "Nearby").slice(0, 32),
    ownedCount: viewerId
      ? beacons.filter((activity) => activity.owner_id === viewerId).length
      : 0,
    reason: ids.size
      ? `${ids.size} Beacon${ids.size === 1 ? "" : "s"}${live ? ` · ${live} live` : ""}`
      : `${group.members.length} Friend${group.members.length === 1 ? "" : "s"}`,
  };
}
