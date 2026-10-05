export type MapPointKind = "beacon" | "person";

export interface ClusterPoint {
  id: string;
  kind: MapPointKind;
  latitude: number;
  longitude: number;
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
}

export interface MapPointPriority {
  /** Lower values are more relevant. Tiers follow the map discovery policy. */
  tier: number;
  attendance?: number;
}

/**
 * Orders cluster previews consistently without coupling the marker UI to app data.
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
      (rightPriority.attendance ?? 0) - (leftPriority.attendance ?? 0) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function clusterPreviewOverflow(memberCount: number, previewCount = 3) {
  return Math.max(0, memberCount - previewCount);
}

const MAX_MERCATOR_LATITUDE = 85.05112878;
const TILE_SIZE = 256;

export function markerVisualSize(kind: MapPointKind, zoom: number) {
  const minimum = kind === "beacon" ? 28 : 22;
  const maximum = kind === "beacon" ? 36 : 30;
  const progress = Math.max(0, Math.min(1, (zoom - 12) / 5));
  return Math.round(minimum + (maximum - minimum) * progress);
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

function wrappedLongitudeDelta(longitude: number, center: number) {
  return ((longitude - center + 540) % 360) - 180;
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

/** Groups nearby map points in projected screen pixels, including across the date line. */
export function clusterMapPoints(
  points: ClusterPoint[],
  viewport: ClusterViewport,
  radius = 52,
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

  const worldSize = TILE_SIZE * 2 ** Math.min(zoom, 24);
  const centerY = mercatorY(centerLatitude);
  const projected = points.filter(validPoint).map((point) => {
    const x =
      (wrappedLongitudeDelta(point.longitude, centerLongitude) / 360) *
      worldSize;
    const y = (mercatorY(point.latitude) - centerY) * worldSize;
    return { point, x, y };
  });
  const candidates = projected.filter(
    ({ x, y }) =>
      Math.abs(x) <= width / 2 + radius && Math.abs(y) <= height / 2 + radius,
  );
  const parents = candidates.map((_, index) => index);
  const find = (index: number): number => {
    if (parents[index] !== index) parents[index] = find(parents[index]);
    return parents[index];
  };
  const join = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  const cells = new Map<string, number[]>();
  candidates.forEach(({ x, y }, index) => {
    const column = Math.floor(x / radius);
    const row = Math.floor(y / radius);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const candidate of cells.get(`${column + dx}:${row + dy}`) ?? []) {
          const other = candidates[candidate];
          if (Math.hypot(x - other.x, y - other.y) <= radius)
            join(index, candidate);
        }
      }
    }
    const key = `${column}:${row}`;
    cells.set(key, [...(cells.get(key) ?? []), index]);
  });

  const components = new Map<number, typeof candidates>();
  candidates.forEach((candidate, index) => {
    const root = find(index);
    components.set(root, [...(components.get(root) ?? []), candidate]);
  });
  return [...components.values()]
    .map((members) => {
      const memberPoints = members
        .map(({ point }) => point)
        .sort((a, b) => a.id.localeCompare(b.id));
      const x =
        members.reduce((sum, member) => sum + member.x, 0) / members.length;
      const y =
        members.reduce((sum, member) => sum + member.y, 0) / members.length;
      return {
        id: `map-group:${memberPoints.map((point) => point.id).join("|")}`,
        latitude: latitudeFromMercatorY(centerY + y / worldSize),
        longitude:
          ((centerLongitude + (x / worldSize) * 360 + 540) % 360) - 180,
        members: memberPoints,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
