import { mapPointOffset as nativePointOffset } from "./mapPointOffset";
import { bloomGeometry } from "./clusterBloom";
import {
  clusterMapPoints,
  MAX_RENDERED_MAP_FEATURES,
  rankClusterMembers,
  type ClusterPoint,
  type ClusterViewport,
  type MapPointGroup,
  type MapPointPriority,
} from "./cluster";
import {
  clusterPetalOffset,
  beaconPetalLimit,
  friendGroupUsesCount,
  type BloomScale,
} from "./clusterLayout";

export type NativeMapMode = "stack" | "swarm" | "atmosphere" | "micro";
export const NATIVE_STACK_LIMIT = 7;
export const NATIVE_EXPLORER_THRESHOLD = 6;
export const NATIVE_DENSITY_MINIMUM = 6;
const BUFFER = 0.35;

/** Only committed camera changes change the tier; retain it inside the buffer. */
export function nativeMapMode(
  zoom: number,
  previous?: NativeMapMode,
): NativeMapMode {
  const thresholds = {
    stack: [16 - BUFFER, Infinity],
    swarm: [12 - BUFFER, 16 + BUFFER],
    atmosphere: [9 - BUFFER, 12 + BUFFER],
    micro: [-Infinity, 9 + BUFFER],
  };
  if (
    previous &&
    zoom >= thresholds[previous][0] &&
    zoom < thresholds[previous][1]
  )
    return previous;
  return zoom >= 16
    ? "stack"
    : zoom >= 12
      ? "swarm"
      : zoom >= 9
        ? "atmosphere"
        : "micro";
}

export type NativeMapPresentation = {
  group: MapPointGroup;
  mode: NativeMapMode;
  visible: ClusterPoint[];
  overflow: number;
  owned: ClusterPoint[];
  featureCost: number;
  scale: BloomScale;
  beacons: ClusterPoint[];
  people: ClusterPoint[];
  satellites: ClusterPoint[];
  friendOverflow: number;
  friendsProminent: boolean;
  forceExplorer?: boolean;
  decorationObstacles?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};

export function nativeStackOpensExplorer(count: number) {
  return count >= NATIVE_EXPLORER_THRESHOLD;
}

/** Fixed circular petals. Priority changes depth, never randomizes slots. */
export function nativePetalOffset(index: number, expanded = false, count = 10) {
  if (expanded) {
    const slots = [
      [35, 45],
      [-40, 22],
      [0, -48],
      [-72, -48],
      [72, -30],
    ] as const;
    const [x, y] = slots[index % slots.length];
    return { x, y };
  }
  return clusterPetalOffset(index, count);
}

/** Spatial queries ignore names, labels and availability. Ranking changes reuse the groups. */
export class MapPresentationCache {
  private spatialKey = "";
  private rankKey = "";
  private value: NativeMapPresentation[] = [];
  readonly stats = { spatialBuilds: 0, hits: 0 };
  select(...args: Parameters<typeof nativeMapPresentations>) {
    const [
      points,
      viewport,
      mode,
      priorities = {},
      owned = new Set<string>(),
      budget,
      friendsProminent,
    ] = args;
    const ordered = [...points].sort((a, b) => a.id.localeCompare(b.id));
    const spatialKey = JSON.stringify([
      ordered,
      viewport,
      mode,
      [...owned].sort(),
      budget,
      friendsProminent,
      ordered
        .filter((point) => priorities[point.id]?.tier === -3)
        .map((point) => point.id),
    ]);
    const rankKey = JSON.stringify(
      ordered.map((point) => [point.id, priorities[point.id]]),
    );
    if (spatialKey !== this.spatialKey) {
      this.value = nativeMapPresentations(...args);
      this.spatialKey = spatialKey;
      this.stats.spatialBuilds++;
    } else if (rankKey !== this.rankKey) {
      this.value = this.value.map((item) =>
        nativePresentation(
          item.group,
          item.mode,
          priorities,
          owned,
          friendsProminent,
        ),
      );
      avoidNeighborArtwork(this.value, viewport);
      if (
        this.value.reduce((sum, item) => sum + item.featureCost, 0) >
        (budget ?? MAX_RENDERED_MAP_FEATURES)
      ) {
        this.value = nativeMapPresentations(...args);
        this.stats.spatialBuilds++;
      }
    } else this.stats.hits++;
    this.rankKey = rankKey;
    return this.value;
  }
}

export function nativePresentation(
  group: MapPointGroup,
  mode: NativeMapMode,
  priorities: Record<string, MapPointPriority>,
  ownedIds: ReadonlySet<string>,
  friendsProminent = false,
): NativeMapPresentation {
  const ranked = rankClusterMembers(group.members, priorities);
  const score = (point: ClusterPoint) =>
    priorities[point.id]?.tier === -3
      ? 0
      : ownedIds.has(point.id)
        ? 1
        : (priorities[point.id]?.tier ?? 7) === 0
          ? 2
          : 3;
  const beacons = ranked
    .filter((point) => point.kind === "beacon")
    .sort((a, b) => score(a) - score(b));
  const people = ranked.filter((point) => point.kind === "person");
  const scale: BloomScale =
    mode === "stack"
      ? "close"
      : mode === "swarm"
        ? "medium"
        : mode === "atmosphere"
          ? "far"
          : "micro";
  const important = beacons.filter(
    (point) => ownedIds.has(point.id) || (priorities[point.id]?.tier ?? 7) <= 0,
  );
  const importantIds = new Set(important.map((point) => point.id));
  const rest = beacons.filter((point) => !importantIds.has(point.id));
  const categories = new Set(important.map((point) => point.category));
  const variety: ClusterPoint[] = [],
    repeated: ClusterPoint[] = [];
  for (const point of rest) {
    if (!categories.has(point.category)) {
      variety.push(point);
      categories.add(point.category);
    } else repeated.push(point);
  }
  const ordered = [...important, ...variety, ...repeated];
  const beaconVisible = ordered.slice(
    0,
    beaconPetalLimit(beacons.length, scale),
  );
  const satellites = beacons.length
    ? people.slice(0, scale === "micro" ? 2 : scale === "far" ? 3 : 7)
    : [];
  const friendVisible = beacons.length
    ? []
    : people.slice(
        0,
        friendGroupUsesCount(people.length, scale)
          ? 0
          : scale === "micro"
            ? 2
            : scale === "far"
              ? 3
              : 4,
      );
  const visible = [...beaconVisible, ...friendVisible, ...satellites];
  const overflow = beacons.length ? beacons.length - beaconVisible.length : 0;
  const item: NativeMapPresentation = {
    group: { ...group, members: [...ordered, ...people] },
    mode,
    scale,
    beacons: ordered,
    people,
    satellites,
    visible,
    overflow,
    owned: beacons.filter((point) => ownedIds.has(point.id)),
    friendOverflow: Math.max(
      0,
      people.length - satellites.length - friendVisible.length,
    ),
    friendsProminent,
    featureCost:
      Math.max(1, visible.length) +
      Number(overflow > 0) +
      Number(people.length > 0 && (beacons.length > 0 || people.length >= 5)),
  };
  const geometry = bloomGeometry(item);
  item.satellites = geometry.satellites;
  item.visible = [...beaconVisible, ...friendVisible, ...item.satellites];
  item.friendOverflow = Math.max(
    0,
    people.length - item.satellites.length - friendVisible.length,
  );
  item.featureCost =
    Math.max(1, item.visible.length) +
    Number(
      !!geometry.countBadge ||
        (!beacons.length && friendGroupUsesCount(people.length, scale)),
    );
  return item;
}

export function presentationOpensExplorer(item: NativeMapPresentation) {
  return (
    item.forceExplorer ||
    (item.beacons.length > 1 || item.people.length > 1)
  );
}

/** Small blooms expand every primary member even when the far-tier preview is truncated. */
export function presentationArtworkPoints(item: NativeMapPresentation) {
  if (presentationOpensExplorer(item)) return item.visible;
  return item.beacons.length
    ? [...item.beacons, ...item.satellites]
    : item.people;
}

/** Declutter friend decorations after grouping; Beacon artwork and geographic groups never move. */
function avoidNeighborArtwork(
  items: NativeMapPresentation[],
  viewport: ClusterViewport,
) {
  const screen = (point: { latitude: number; longitude: number }) =>
    nativePointOffset(
      point,
      {
        latitude: viewport.centerLatitude,
        longitude: viewport.centerLongitude,
      },
      viewport.zoom,
    );
  const entries = items
    .map((item) => {
      item.decorationObstacles = undefined;
      const geometry = bloomGeometry(item);
      const rectangles = geometry.primary.map((point, index) => ({
        ...geometry.offsets[index],
        width: geometry.markerSize,
        height: geometry.markerSize,
      }));
      for (const point of item.owned) {
        const index = geometry.primary.findIndex(
          (member) => member.id === point.id,
        );
        if (index >= 0)
          rectangles.push({
            x: geometry.offsets[index].x + (13 * geometry.markerSize) / 32,
            y: geometry.offsets[index].y + (12 * geometry.markerSize) / 32,
            width: (12 * geometry.markerSize) / 32,
            height: (12 * geometry.markerSize) / 32,
          });
      }

      if (
        geometry.friendsOnly &&
        friendGroupUsesCount(item.people.length, item.scale)
      )
        rectangles.push({
          x: 0,
          y: 0,
          width: 25 + 6 * String(item.people.length).length,
          height: 20,
        });
      return { item, anchor: screen(item.group), rectangles };
    })
    .sort((a, b) => a.item.group.id.localeCompare(b.item.group.id));
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  for (const entry of entries) {
    const { item, anchor } = entry;
    if (!item.beacons.length || (!item.people.length && !item.overflow))
      continue;
    const neighbors = entries
      .filter(
        (other) =>
          other !== entry &&
          Math.hypot(other.anchor.x - anchor.x, other.anchor.y - anchor.y) <
            200,
      )
      .flatMap((other) =>
        other.rectangles.map((rect) => ({
          ...rect,
          x: rect.x + other.anchor.x - anchor.x,
          y: rect.y + other.anchor.y - anchor.y,
        })),
      );
    neighbors.push(
      ...placed
        .filter(
          (rect) => Math.hypot(rect.x - anchor.x, rect.y - anchor.y) < 200,
        )
        .map((rect) => ({
          ...rect,
          x: rect.x - anchor.x,
          y: rect.y - anchor.y,
        })),
    );
    const left = -viewport.width / 2 - anchor.x + 4,
      right = viewport.width / 2 - anchor.x - 4,
      top = -viewport.height / 2 - anchor.y + 4,
      bottom = viewport.height / 2 - anchor.y - 4;
    neighbors.push(
      { x: left - 5000, y: 0, width: 10000, height: 10000 },
      { x: right + 5000, y: 0, width: 10000, height: 10000 },
      { x: 0, y: top - 5000, width: 10000, height: 10000 },
      { x: 0, y: bottom + 5000, width: 10000, height: 10000 },
    );
    item.decorationObstacles = neighbors;
    const geometry = bloomGeometry(item);
    item.satellites = geometry.satellites;
    item.visible = [
      ...item.visible.filter((point) => point.kind === "beacon"),
      ...item.satellites,
    ];
    item.friendOverflow = item.people.length - item.satellites.length;
    item.featureCost =
      Math.max(1, item.visible.length) + Number(!!geometry.countBadge);
    placed.push(
      ...geometry.satelliteOffsets.map((offset) => ({
        x: offset.x + anchor.x,
        y: offset.y + anchor.y,
        width: geometry.satelliteSize,
        height: geometry.satelliteSize,
      })),
    );
    if (geometry.countBadge)
      placed.push({
        x: geometry.countBadge.offset.x + anchor.x,
        y: geometry.countBadge.offset.y + anchor.y,
        width: geometry.countBadge.width,
        height: geometry.countBadge.height,
      });
  }
  return items;
}

/** Authorized coordinates only. Beacon clustering is independent of friend positions. */
export function nativeMapPresentations(
  points: ClusterPoint[],
  viewport: ClusterViewport,
  mode: NativeMapMode,
  priorities: Record<string, MapPointPriority> = {},
  ownedIds: ReadonlySet<string> = new Set(),
  budget = MAX_RENDERED_MAP_FEATURES,
  friendsProminent = false,
) {
  const unique = [
    ...new Map(points.map((point) => [point.id, point])).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const selected = clusterMapPoints(
    unique.filter((point) => priorities[point.id]?.tier === -3),
    viewport,
    1,
  ).flatMap((group) => group.members);
  const ordinary = unique.filter((point) => priorities[point.id]?.tier !== -3);
  const beacons = ordinary.filter((point) => point.kind === "beacon");
  const people = ordinary.filter((point) => point.kind === "person");
  let pressured = false;
  const build = (radius: number) => {
    const groups = clusterMapPoints(beacons, viewport, radius).flatMap(group => {
      if (group.members.length < 2 || group.members.length > 3) return [group];
      const separated = group.members.every((point, index) => group.members.slice(index + 1).every(other => {
        const offset = nativePointOffset(point, other, viewport.zoom);
        return Math.hypot(offset.x, offset.y) >= 48;
      }));
      return separated ? group.members.map(point => ({ id: `map-group:${point.id}`, latitude: point.latitude, longitude: point.longitude, members: [point] })) : [group];
    });
    const remaining: ClusterPoint[] = [];
    // Grid lookup bounds the collision search, even with thousands of authorized friends.
    const cell = 96,
      buckets = new Map<string, MapPointGroup[]>();
    const screen = (point: { latitude: number; longitude: number }) =>
      nativePointOffset(
        point,
        {
          latitude: viewport.centerLatitude,
          longitude: viewport.centerLongitude,
        },
        viewport.zoom,
      );
    for (const group of groups) {
      const p = screen(group),
        key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
      buckets.set(key, [...(buckets.get(key) ?? []), group]);
    }
    // Materialize the friend viewport once so distant/offscreen people cannot attach to an on-screen bloom.
    const eligiblePeople = clusterMapPoints(people, viewport, 1).flatMap(
      (group) => group.members,
    );
    for (const person of eligiblePeople) {
      const p = screen(person);
      let nearest: MapPointGroup | undefined,
        distance = friendsProminent ? 42 : 48;
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (const group of buckets.get(
            `${Math.floor(p.x / cell) + x}:${Math.floor(p.y / cell) + y}`,
          ) ?? []) {
            const anchor = screen(group),
              d = Math.hypot(p.x - anchor.x, p.y - anchor.y);
            if (
              d < distance ||
              (d === distance && nearest && group.id < nearest.id)
            ) {
              nearest = group;
              distance = d;
            }
          }
      if (nearest) nearest.members.push(person);
      else remaining.push(person);
    }
    groups.push(...clusterMapPoints(remaining, viewport, radius));
    const requested = pressured && mode === "stack" ? "swarm" : mode;
    const result = groups.map((group) =>
      nativePresentation(
        group,
        requested,
        priorities,
        ownedIds,
        friendsProminent,
      ),
    );
    for (const point of selected)
      result.push(
        nativePresentation(
          {
            id: `map-group:${point.id}`,
            latitude: point.latitude,
            longitude: point.longitude,
            members: [point],
          },
          "stack",
          priorities,
          ownedIds,
          friendsProminent,
        ),
      );
    return avoidNeighborArtwork(result, viewport);
  };
  let radius =
    mode === "stack"
      ? 48
      : mode === "swarm"
        ? 80
        : mode === "atmosphere"
          ? 120
          : 160;
  let result = build(radius);
  while (
    result.reduce((sum, item) => sum + item.featureCost, 0) > budget &&
    radius < 65536
  ) {
    pressured = true;
    radius *= 2;
    result = build(radius);
  }
  return result;
}

export { mapPointOffset as nativePointOffset } from "./mapPointOffset";

export function nativeAtmosphereRadius(group: MapPointGroup, zoom = 14) {
  const latitudeScale = Math.cos((group.latitude * Math.PI) / 180);
  return Math.max(
    180,
    (22 * 156543.03392 * Math.max(0.09, latitudeScale)) / 2 ** zoom,
    ...group.members.map((point) =>
      Math.hypot(
        (((point.longitude - group.longitude + 540) % 360) - 180) *
          latitudeScale *
          111_320,
        (point.latitude - group.latitude) * 111_320,
      ),
    ),
  );
}
