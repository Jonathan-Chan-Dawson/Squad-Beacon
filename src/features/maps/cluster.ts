import Supercluster from "supercluster";
import type { Category } from "@/src/shared/types";

export type MapPointKind = "beacon" | "person";

export interface ClusterPoint {
  id: string;
  kind: MapPointKind;
  latitude: number;
  longitude: number;
  category?: Category;
}

export interface ClusterViewport {
  centerLatitude: number;
  centerLongitude: number;
  zoom: number;
  width: number;
  height: number;
}

export interface MapPointGroup {
  id: string;
  latitude: number;
  longitude: number;
  members: ClusterPoint[];
  clusterId?: number;
  expansionZoom?: number;
}

export interface ClusterCategoryCount {
  category: Category | "People";
  count: number;
}

export interface MapClusterBounds {
  north: number;
  south: number;
  east: number;
  west: number;
  longitudeSpan: number;
  centerLongitude: number;
}

export interface MapPointPriority {
  /** Lower values are more relevant. Tiers follow the map discovery policy. */
  tier: number;
  affinity?: number;
  attendance?: number;
}

export const MAX_RENDERED_MAP_FEATURES = 150;
export const CLUSTER_PREVIEW_ICON_SIZE = 28;
export const CLUSTER_PREVIEW_GAP = 2;
const CLUSTER_MIN_ZOOM = 0;
export const MAP_MAX_ZOOM = 22;
const CLUSTER_MAX_ZOOM = MAP_MAX_ZOOM;
const VIEWPORT_MARKER_BUFFER = 44;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const CATEGORIES: Category[] = [
  "Fitness",
  "Study",
  "Gaming",
  "Creative",
  "Social",
  "Other",
];

/**
 * Orders cluster previews consistently without coupling marker UI to app data.
 * Tiers: joined Beacon, Starred Friend, live Beacon, soon Beacon, busy Beacon,
 * available Friend, Close Friend, then other nearby entities.
 */
export function rankClusterMembers(
  members: ClusterPoint[],
  priorities: Record<string, MapPointPriority> = {},
) {
  return [...members].sort((left, right) => {
    const leftPriority = priorities[left.id] ?? { tier: 7, attendance: 0 };
    const rightPriority = priorities[right.id] ?? { tier: 7, attendance: 0 };
    return (
      leftPriority.tier - rightPriority.tier ||
      (rightPriority.affinity ?? 0) - (leftPriority.affinity ?? 0) ||
      (rightPriority.attendance ?? 0) - (leftPriority.attendance ?? 0) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function clusterPreviewOverflow(memberCount: number, previewCount = 3) {
  return Math.max(0, memberCount - previewCount);
}

export function markerVisualSize(kind: MapPointKind, _zoom = 0) {
  return kind === "beacon" ? 40 : 34;
}

function validPoint(point: ClusterPoint) {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function mercatorY(latitude: number) {
  const safeLatitude = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const radians = (safeLatitude * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
}

function latitudeFromMercatorY(y: number) {
  const normalized = Math.max(0, Math.min(1, y));
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * normalized))) * 180) / Math.PI;
}

function wrappedLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function wrappedLongitudeDelta(longitude: number, center: number) {
  return wrappedLongitude(longitude - center);
}

/** Collect friend candidates without rebuilding a radius-one cluster hierarchy. */
export function pointsInMapViewport(points: ClusterPoint[], viewport: ClusterViewport) {
  const buffered = {
    ...viewport,
    width: viewport.width + VIEWPORT_MARKER_BUFFER * 2,
    height: viewport.height + VIEWPORT_MARKER_BUFFER * 2,
  };
  if (!Number.isFinite(viewport.zoom) || viewport.zoom < 0 ||
      !Number.isFinite(viewport.width) || viewport.width <= 0 ||
      !Number.isFinite(viewport.height) || viewport.height <= 0) return [];
  const [[west, south, east, north]] = viewportBoxes(buffered, viewport.centerLongitude);
  return points.filter((point) => {
    if (!validPoint(point) || point.latitude < south || point.latitude > north)
      return false;
    const longitude = wrappedLongitudeDelta(point.longitude, viewport.centerLongitude);
    return longitude >= west && longitude <= east;
  });
}

function viewportBoxes(
  viewport: ClusterViewport,
  indexLongitude: number,
): [number, number, number, number][] {
  const { centerLatitude, zoom, width, height } = viewport;
  const worldSize = 256 * 2 ** Math.min(zoom, CLUSTER_MAX_ZOOM + 1);
  const longitudeRadius = Math.min(180, (width / 2 / worldSize) * 360);
  const centerY = mercatorY(centerLatitude);
  const latitudeRadius = height / 2 / worldSize;
  const north = latitudeFromMercatorY(centerY - latitudeRadius);
  const south = latitudeFromMercatorY(centerY + latitudeRadius);
  const center = wrappedLongitudeDelta(viewport.centerLongitude, indexLongitude);
  return [[center - longitudeRadius, south, center + longitudeRadius, north]];
}

function featuresInBounds(
  index: Supercluster<ClusterPoint>,
  boxes: [number, number, number, number][],
  zoom: number,
) {
  const features = boxes.flatMap((box) => index.getClusters(box, zoom));
  const unique = new Map<string, (typeof features)[number]>();
  for (const feature of features) {
    const props = feature.properties;
    const key =
      props && "cluster" in props && props.cluster
        ? `cluster:${props.cluster_id}`
        : `point:${(props as ClusterPoint | null)?.id ?? feature.id ?? ""}`;
    unique.set(key, feature);
  }
  return [...unique.values()];
}

function materializeGroups(
  index: Supercluster<ClusterPoint>,
  features: ReturnType<typeof featuresInBounds>,
  centerLongitude: number,
): MapPointGroup[] {
  return features
    .map((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      const properties = feature.properties;
      if (properties && "cluster" in properties && properties.cluster) {
        const members = index
          .getLeaves(properties.cluster_id, Infinity)
          .map((leaf) => leaf.properties)
          .filter(
            (member): member is ClusterPoint =>
              !!member && typeof member.id === "string",
          )
          .sort((a, b) => a.id.localeCompare(b.id));
        return {
          id: `map-group:${members.map((point) => point.id).join("|")}`,
          latitude,
          longitude: wrappedLongitude(longitude + centerLongitude),
          members,
          clusterId: properties.cluster_id,
          expansionZoom: index.getClusterExpansionZoom(properties.cluster_id),
        };
      }
      const point = properties as ClusterPoint;
      return {
        id: `map-group:${point.id}`,
        latitude,
        longitude: wrappedLongitude(longitude + centerLongitude),
        members: [point],
      };
    })
    .filter((group) => group.members.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildIndex(
  points: ClusterPoint[],
  radius: number,
  centerLongitude: number,
) {
  return new Supercluster<ClusterPoint>({
    minZoom: CLUSTER_MIN_ZOOM,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: 2,
    radius,
    extent: 256,
  }).load(
    points.map((point) => ({
      type: "Feature" as const,
      id: point.id,
      properties: {
        id: point.id,
        kind: point.kind,
        latitude: point.latitude,
        longitude: point.longitude,
        ...(point.category ? { category: point.category } : {}),
      },
      geometry: {
        type: "Point" as const,
        // Work in a local longitude frame centered at zero. Keeping all index
        // points inside [-180, 180] lets Supercluster query both sides of the
        // antimeridian without wrapping one side out of its search bounds.
        coordinates: [
          wrappedLongitudeDelta(point.longitude, centerLongitude),
          point.latitude,
        ] as [number, number],
      },
    })),
  );
}

/** Reuse the indexed coordinates across committed camera moves and display changes. */
export class ClusterIndexCache {
  private readonly byPoints = new WeakMap<ClusterPoint[], Map<string, Supercluster<ClusterPoint>>>();

  get(points: ClusterPoint[], radius: number, longitude: number) {
    let indexes = this.byPoints.get(points);
    if (!indexes) {
      indexes = new Map();
      this.byPoints.set(points, indexes);
    }
    const key = `${radius}:${longitude}`;
    const index = indexes.get(key) ?? buildIndex(points.filter(validPoint), radius, longitude);
    indexes.delete(key);
    indexes.set(key, index);
    const oldest = indexes.keys().next();
    if (indexes.size > 8 && !oldest.done) indexes.delete(oldest.value);
    return index;
  }
}

/**
 * Clusters valid readable points using Supercluster. If an unusually dense view
 * still has over 150 rendered features, progressively lower the cluster zoom
 * and widen its radius so points remain represented instead of being dropped.
 */
export function clusterMapPoints(
  points: ClusterPoint[],
  viewport: ClusterViewport,
  radius = 24,
  cache?: ClusterIndexCache,
): MapPointGroup[] {
  const { centerLatitude, centerLongitude, zoom, width, height } = viewport;
  if (
    !Number.isFinite(centerLatitude) ||
    !Number.isFinite(centerLongitude) ||
    !Number.isFinite(zoom) ||
    zoom < 0 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(radius) ||
    radius <= 0
  )
    return [];

  if (!points.length) return [];
  // Keep the projection seam away from the camera. Reuse one longitude frame
  // during local movement, and center wide views exactly to avoid splitting them.
  const frameLongitude = cache ? Math.round(centerLongitude / 90) * 90 : centerLongitude;
  const frameBoxes = viewportBoxes(viewport, frameLongitude);
  const useFrame = frameBoxes.every(([west, , east]) => west > -135 && east < 135);
  const indexLongitude = useFrame ? frameLongitude : centerLongitude;
  const boxes = useFrame ? frameBoxes : viewportBoxes(viewport, indexLongitude);
  const indexAt = (indexRadius: number) =>
    cache?.get(points, indexRadius, indexLongitude) ??
    buildIndex(points.filter(validPoint), indexRadius, indexLongitude);
  const requestedZoom = Math.floor(Math.min(zoom, CLUSTER_MAX_ZOOM + 1));
  let clusterRadius = Math.max(1, radius);
  let index = indexAt(clusterRadius);

  for (let level = requestedZoom; level >= CLUSTER_MIN_ZOOM; level--) {
    const features = featuresInBounds(index, boxes, level);
    if (features.length <= MAX_RENDERED_MAP_FEATURES)
      return materializeGroups(index, features, indexLongitude);
  }

  for (clusterRadius *= 2; clusterRadius <= 4096; clusterRadius *= 2) {
    index = indexAt(clusterRadius);
    const features = featuresInBounds(index, boxes, CLUSTER_MIN_ZOOM);
    if (features.length <= MAX_RENDERED_MAP_FEATURES)
      return materializeGroups(index, features, indexLongitude);
  }

  // A very large, globally dispersed data set can exceed the cap even at the
  // widest radius. Keep every point in one explicit aggregate instead of
  // silently dropping markers or exposing only an arbitrary first page.
  const allVisible = featuresInBounds(index, boxes, CLUSTER_MIN_ZOOM);
  if (allVisible.length <= MAX_RENDERED_MAP_FEATURES)
    return materializeGroups(index, allVisible, indexLongitude);
  const flattened = materializeGroups(
    index,
    allVisible,
    indexLongitude,
  ).flatMap((group) => group.members);
  return flattened.length
    ? [
        {
          id: `map-group:${flattened
            .map((point) => point.id)
            .sort()
            .join("|")}`,
          latitude: centerLatitude,
          longitude: wrappedLongitude(centerLongitude),
          members: flattened.sort((a, b) => a.id.localeCompare(b.id)),
          expansionZoom: CLUSTER_MAX_ZOOM + 1,
        },
      ]
    : [];
}

/** The exact Beacon/category/people counts used by both native and web badges. */
export function clusterCategoryMix(
  members: ClusterPoint[],
): ClusterCategoryCount[] {
  const categories = new Map<Category | "People", number>();
  for (const member of members) {
    const key = member.kind === "person" ? "People" : member.category;
    if (key) categories.set(key, (categories.get(key) ?? 0) + 1);
  }
  return [...CATEGORIES, "People" as const]
    .map((category) => ({ category, count: categories.get(category) ?? 0 }))
    .filter((item) => item.count > 0);
}

/** Produces a narrow longitude arc for clusters that cross the date line. */
export function clusterBounds(
  members: ClusterPoint[],
): MapClusterBounds | null {
  const valid = members.filter(validPoint);
  if (!valid.length) return null;
  const latitudes = valid.map((point) => point.latitude);
  const longitudes = valid
    .map((point) => ((point.longitude % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let largestGap = -1;
  let gapAfter = 0;
  for (let index = 0; index < longitudes.length; index++) {
    const current = longitudes[index];
    const next =
      index === longitudes.length - 1
        ? longitudes[0] + 360
        : longitudes[index + 1];
    const gap = next - current;
    if (gap > largestGap) {
      largestGap = gap;
      gapAfter = index;
    }
  }
  const west360 = longitudes[(gapAfter + 1) % longitudes.length];
  const east360 = longitudes[gapAfter];
  const west = wrappedLongitude(west360);
  const east = wrappedLongitude(east360);
  const longitudeSpan = Math.max(0, 360 - largestGap);
  return {
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    west,
    east,
    longitudeSpan,
    centerLongitude: wrappedLongitude(west + longitudeSpan / 2),
  };
}

/** Keep the established age-label wording while using only real session time. */
export function formatLocationAge(updatedAt: string | null, now = Date.now()) {
  if (!updatedAt) return null;
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated) || updated > now) return null;
  const minutes = Math.floor((now - updated) / 60_000);
  return minutes < 1
    ? "now"
    : minutes < 60
      ? `${minutes}m ago`
      : `${Math.floor(minutes / 60)}h ago`;
}
