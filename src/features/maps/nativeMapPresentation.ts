import { mapPointOffset as nativePointOffset } from "./mapPointOffset";
import { bloomGeometry } from "./clusterBloom";
import {
  clusterMapPoints,
  ClusterIndexCache,
  pointsInMapViewport,
  MAX_RENDERED_MAP_FEATURES,
  rankClusterMembers,
  type ClusterPoint,
  type ClusterViewport,
  type MapPointGroup,
  type MapPointPriority,
} from "./cluster";
import {
  clusterPetalOffset,
  type BloomScale,
} from "./clusterLayout";

export type NativeMapMode = "stack" | "swarm" | "atmosphere" | "micro";
export const NATIVE_STACK_LIMIT = 7;
export const NATIVE_EXPLORER_THRESHOLD = 6;
export const NATIVE_DENSITY_MINIMUM = 6;
const BUFFER = 0.35;
// Screen-space distances: allow artwork to touch before combining it. Both
// renderers use this policy; the petal artwork itself is unchanged.
const GROUP_RADIUS: Record<NativeMapMode, number> = {
  stack: 32,
  swarm: 40,
  atmosphere: 52,
  micro: 64,
};
const MIXED_RADIUS = 32;

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
  allowCityPetals?: boolean;
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
  private readonly indexes = new ClusterIndexCache();
  private partitionKey = "";
  private renderedPartitionKey = "";
  private partition: ReturnType<typeof partitionMapPoints> = { selected: [], beacons: [], people: [] };
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
    const partitionKey = JSON.stringify([
      ordered,
      ordered
        .filter((point) => priorities[point.id]?.tier === -3)
        .map((point) => point.id),
    ]);
    if (partitionKey !== this.partitionKey) {
      this.partition = partitionMapPoints(ordered, priorities);
      this.partitionKey = partitionKey;
    }
    const spatialKey = JSON.stringify([
      viewport,
      mode,
      [...owned].sort(),
      budget,
      friendsProminent,
    ]);
    const rankKey = JSON.stringify(
      ordered.map((point) => [point.id, priorities[point.id]]),
    );
    const build = () => buildMapPresentations(
      this.partition, viewport, mode, priorities, owned, budget, friendsProminent, this.indexes,
    );
    if (spatialKey !== this.spatialKey || partitionKey !== this.renderedPartitionKey) {
      this.value = build();
      this.spatialKey = spatialKey;
      this.renderedPartitionKey = partitionKey;
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
        this.value = build();
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
  return applyGeometry({
    group: { ...group, members: [...ordered, ...people] },
    mode,
    scale,
    beacons: ordered,
    people,
    satellites: [],
    visible: [],
    overflow: 0,
    owned: beacons.filter((point) => ownedIds.has(point.id)),
    friendOverflow: 0,
    friendsProminent,
    featureCost: 1,
  });
}

function applyGeometry(item: NativeMapPresentation) {
  const geometry = bloomGeometry(item);
  item.satellites = geometry.satellites;
  item.visible = [...geometry.primary, ...geometry.satellites];
  item.overflow = item.beacons.length -
    geometry.primary.filter((point) => point.kind === "beacon").length;
  item.friendOverflow = item.people.length -
    item.visible.filter((point) => point.kind === "person").length;
  item.featureCost = Math.max(1, item.visible.length +
    Number(!!geometry.signal) + Number(!!geometry.countBadge));
  return item;
}

export function presentationOpensExplorer(item: NativeMapPresentation) {
  const first = item.group.members[0];
  return !!first && item.group.members.some((member) => member.id !== first.id);
}

/** Build artwork for foreground markers and the bounded friend-avatar previews. */
export function presentationArtworkPoints(item: NativeMapPresentation) {
  return item.visible;
}

/** Declutter friend decorations after grouping; Beacon artwork and geographic groups never move. */
function avoidNeighborArtwork(
  items: NativeMapPresentation[],
  viewport: ClusterViewport,
  allowCityPetals = true,
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
      item.allowCityPetals = false;
      const geometry = bloomGeometry(item);
      const rectangles = geometry.primary.map((point, index) => ({
        ...geometry.offsets[index],
        width: geometry.markerSize,
        height: geometry.markerSize,
      }));
      if (geometry.signal) rectangles.push(geometry.signal);
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

      return { item, anchor: screen(item.group), rectangles };
    })
    .sort((a, b) => a.item.group.id.localeCompare(b.item.group.id));
  const placed: { x: number; y: number; width: number; height: number }[] = [];
  for (const entry of entries) {
    const { item, anchor } = entry;
    if (!presentationOpensExplorer(item)) continue;
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
    item.allowCityPetals = allowCityPetals;
    applyGeometry(item);
    const geometry = bloomGeometry(item);
    if (geometry.signal)
      placed.push({ ...geometry.signal, x: geometry.signal.x + anchor.x, y: geometry.signal.y + anchor.y });
    if (item.scale === "far" && !geometry.distant) {
      geometry.offsets.forEach(offset => placed.push({
        x: offset.x + anchor.x, y: offset.y + anchor.y,
        width: geometry.markerSize, height: geometry.markerSize,
      }));
      geometry.satelliteOffsets.forEach(offset => placed.push({
        x: offset.x + anchor.x, y: offset.y + anchor.y,
        width: geometry.satelliteSize, height: geometry.satelliteSize,
      }));
      if (geometry.projector) placed.push({
        x: geometry.projector.x + anchor.x,
        y: geometry.projector.top + (geometry.projector.height + 5) / 2 + anchor.y,
        width: geometry.projector.width,
        height: geometry.projector.height + 5,
      });
    }
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

function partitionMapPoints(points: ClusterPoint[], priorities: Record<string, MapPointPriority>) {
  const unique = [...new Map(points.map((point) => [point.id, point])).values()]
    .sort((a, b) => a.id.localeCompare(b.id));
  const selected: ClusterPoint[] = [];
  const beacons: ClusterPoint[] = [];
  const people: ClusterPoint[] = [];
  for (const point of unique) {
    if (priorities[point.id]?.tier === -3) selected.push(point);
    else if (point.kind === "beacon") beacons.push(point);
    else people.push(point);
  }
  return { selected, beacons, people };
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
  return buildMapPresentations(partitionMapPoints(points, priorities), viewport, mode, priorities, ownedIds, budget, friendsProminent);
}

function buildMapPresentations(
  { selected: selectedPoints, beacons, people }: ReturnType<typeof partitionMapPoints>,
  viewport: ClusterViewport,
  mode: NativeMapMode,
  priorities: Record<string, MapPointPriority>,
  ownedIds: ReadonlySet<string>,
  budget = MAX_RENDERED_MAP_FEATURES,
  friendsProminent = false,
  indexes?: ClusterIndexCache,
) {
  const selected = clusterMapPoints(
    selectedPoints,
    viewport,
    1,
    indexes,
  ).flatMap((group) => group.members);
  const eligiblePeople = pointsInMapViewport(people, viewport);
  let pressured = false;
  // Supercluster evaluates integer zooms. Compensate for fractional zoom so
  // markers do not merge at nearly twice the intended visual distance.
  const zoomScale = 2 ** (viewport.zoom - Math.floor(viewport.zoom));
  const build = (radius: number) => {
    const groups = clusterMapPoints(
      beacons,
      viewport,
      radius / zoomScale,
      indexes,
    ).flatMap((group) => {
      if (group.members.length < 2 || group.members.length > 3) return [group];
      const separated = group.members.every((point, index) =>
        group.members.slice(index + 1).every((other) => {
          const offset = nativePointOffset(point, other, viewport.zoom);
          return Math.hypot(offset.x, offset.y) >= GROUP_RADIUS.stack;
        }),
      );
      return separated
        ? group.members.map((point) => ({
            id: `map-group:${point.id}`,
            latitude: point.latitude,
            longitude: point.longitude,
            members: [point],
          }))
        : [group];
    });
    const remaining: ClusterPoint[] = [];
    // Grid lookup bounds the collision search, even with thousands of authorized friends.
    const cell = 96;
    const buckets = new Map<string, { group: MapPointGroup; x: number; y: number }[]>();
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
      const p = screen(group);
      const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
      const entry = { group, ...p };
      const bucket = buckets.get(key);
      if (bucket) bucket.push(entry);
      else buckets.set(key, [entry]);
    }
    for (const person of eligiblePeople) {
      const p = screen(person);
      let nearest: MapPointGroup | undefined,
        distance = friendsProminent ? MIXED_RADIUS - 4 : MIXED_RADIUS;
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (const anchor of buckets.get(
            `${Math.floor(p.x / cell) + x}:${Math.floor(p.y / cell) + y}`,
          ) ?? []) {
            const d = Math.hypot(p.x - anchor.x, p.y - anchor.y);
            if (
              d < distance ||
              (d === distance && nearest && anchor.group.id < nearest.id)
            ) {
              nearest = anchor.group;
              distance = d;
            }
          }
      if (nearest) nearest.members.push(person);
      else remaining.push(person);
    }
    const friendPoints = remaining.length === people.length ? people : remaining;
    groups.push(...clusterMapPoints(friendPoints, viewport, radius / zoomScale, indexes));
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
    return avoidNeighborArtwork(result, viewport, !pressured);
  };
  let radius = GROUP_RADIUS[mode];
  let result = build(radius);
  if (mode === "atmosphere" && result.reduce((sum, item) => sum + item.featureCost, 0) > budget) {
    pressured = true;
    result = avoidNeighborArtwork(result, viewport, false);
  }
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

/** Settled-camera budget for individual badges near other visible artwork. */
export function crowdedBeaconMarkers(
  items: readonly NativeMapPresentation[],
  zoom: number,
  faceSize: (id: string) => number,
): Set<string> {
  const origin = items[0]?.group;
  if (!origin) return new Set();
  const nearby = items.map(item => {
    const member = item.beacons[0];
    const single = member && item.beacons.length + item.people.length === 1;
    const size = single ? faceSize(member.id) : bloomGeometry(item).markerSize;
    return {
      id: single ? member.id : undefined,
      position: nativePointOffset(item.group, origin, zoom),
      halfWidth: size / 2 + (single ? 12 : 24),
      halfHeight: size / 2 + (single ? 23 : 16),
    };
  });
  const crowded = new Set<string>();
  for (let index = 0; index < nearby.length; index++) {
    const a = nearby[index];
    for (let second = index + 1; second < nearby.length; second++) {
      const b = nearby[second];
      if (Math.abs(a.position.x - b.position.x) >= a.halfWidth + b.halfWidth ||
          Math.abs(a.position.y - b.position.y) >= a.halfHeight + b.halfHeight) continue;
      if (a.id) crowded.add(a.id);
      if (b.id) crowded.add(b.id);
    }
  }
  return crowded;
}

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
