import {
  clusterMapPoints,
  MAX_RENDERED_MAP_FEATURES,
  rankClusterMembers,
  type ClusterPoint,
  type ClusterViewport,
  type MapPointGroup,
  type MapPointPriority,
} from "./cluster";

export type NativeMapMode = "stack" | "swarm" | "atmosphere";
export const NATIVE_STACK_LIMIT = 10;
export const NATIVE_EXPLORER_THRESHOLD = 6;
export const NATIVE_DENSITY_MINIMUM = 6;
const BUFFER = 0.35;

/** Only committed camera changes change the tier; retain it inside the buffer. */
export function nativeMapMode(
  zoom: number,
  previous?: NativeMapMode,
): NativeMapMode {
  if (previous === "stack" && zoom >= 16 - BUFFER) return "stack";
  if (previous === "atmosphere" && zoom < 12 + BUFFER) return "atmosphere";
  if (previous === "swarm" && zoom >= 12 - BUFFER && zoom < 16 + BUFFER)
    return "swarm";
  return zoom >= 16 ? "stack" : zoom >= 12 ? "swarm" : "atmosphere";
}

export type NativeMapPresentation = {
  group: MapPointGroup;
  mode: NativeMapMode;
  visible: ClusterPoint[];
  overflow: number;
  owned: ClusterPoint[];
  featureCost: number;
};

export function nativeStackOpensExplorer(count: number) {
  return count >= NATIVE_EXPLORER_THRESHOLD;
}

/** Fixed, loosely fanned petals. Priority changes depth, never randomizes slots. */
const PETALS = [
  [18, 12],
  [-12, 7],
  [4, -16],
  [-26, -11],
  [31, -13],
  [-6, 29],
  [38, 20],
  [-35, 23],
  [-19, -35],
  [21, -36],
] as const;
export function nativePetalOffset(index: number, expanded = false) {
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
  const [x, y] = PETALS[index % PETALS.length];
  return { x, y };
}

export function nativePresentation(
  group: MapPointGroup,
  requestedMode: NativeMapMode,
  priorities: Record<string, MapPointPriority>,
  ownedIds: ReadonlySet<string>,
): NativeMapPresentation {
  const members = rankClusterMembers(group.members, priorities).sort((a, b) => {
    const score = (point: ClusterPoint) =>
      (priorities[point.id]?.tier ?? 7) === -3
        ? 0
        : ownedIds.has(point.id)
          ? 1
          : point.kind === "person"
            ? 2
            : 3;
    return score(a) - score(b);
  });
  const owned = members.filter((point) => ownedIds.has(point.id));
  // People are never inputs to Beacon density, including under budget pressure.
  const mode =
    requestedMode !== "stack" &&
    members.length >= NATIVE_DENSITY_MINIMUM &&
    members.every((point) => point.kind === "beacon")
      ? requestedMode
      : "stack";
  const visible = members.slice(0, mode === "stack" ? NATIVE_STACK_LIMIT : 24);
  return {
    group: { ...group, members },
    mode,
    visible,
    overflow: Math.max(0, members.length - visible.length),
    owned,
    // Stack artwork is one bitmap, but count each visual conservatively too.
    featureCost:
      mode === "atmosphere"
        ? 3 + Number(owned.length > 0)
        : mode === "stack"
          ? visible.length
          : 1,
  };
}

/** Receives only the screen's already-authorized, filtered, current entities. */
export function nativeMapPresentations(
  points: ClusterPoint[],
  viewport: ClusterViewport,
  mode: NativeMapMode,
  priorities: Record<string, MapPointPriority> = {},
  ownedIds: ReadonlySet<string> = new Set(),
  budget = MAX_RENDERED_MAP_FEATURES,
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
  let budgetPressure = false;
  const build = (radius: number, separatePeople: boolean) => {
    const sets = separatePeople
      ? [
          ordinary.filter((point) => point.kind === "beacon"),
          ordinary.filter((point) => point.kind === "person"),
        ]
      : [ordinary];
    const groups = sets.flatMap((set) =>
      clusterMapPoints(set, viewport, radius),
    );
    for (const point of selected)
      groups.push({
        id: `map-group:${point.id}`,
        latitude: point.latitude,
        longitude: point.longitude,
        members: [point],
      });
    return groups.map((group) =>
      nativePresentation(
        group,
        budgetPressure && mode === "stack" ? "swarm" : mode,
        priorities,
        ownedIds,
      ),
    );
  };
  let radius = mode === "stack" ? 40 : mode === "swarm" ? 72 : 96;
  let presentations = build(radius, mode !== "stack");
  if (presentations.reduce((sum, item) => sum + item.featureCost, 0) > budget) {
    budgetPressure = true;
    presentations = build(radius, true);
  }
  while (
    presentations.reduce((sum, item) => sum + item.featureCost, 0) > budget &&
    radius < 4096
  ) {
    radius *= 2;
    presentations = build(radius, mode !== "stack" || budgetPressure);
  }
  // Mixed fallback stays a stack, so private friend positions cannot affect density.
  if (presentations.reduce((sum, item) => sum + item.featureCost, 0) > budget) {
    // Reserve four primitives per potential atmospheric group. Querying the
    // same viewport with a larger radius preserves its geographic membership.
    presentations = build(radius, false);
    while (
      presentations.reduce((sum, item) => sum + item.featureCost, 0) > budget &&
      radius < 65536
    ) {
      radius *= 2;
      presentations = build(radius, false);
    }
  }
  return presentations;
}

/** Local Mercator offsets for static swarms; derived exclusively from real positions. */
export function nativePointOffset(
  point: ClusterPoint,
  group: MapPointGroup,
  zoom: number,
) {
  const world = 256 * 2 ** zoom;
  const y = (latitude: number) =>
    Math.asinh(
      Math.tan((Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180),
    );
  return {
    x:
      ((((point.longitude - group.longitude + 540) % 360) - 180) / 360) * world,
    y: ((y(group.latitude) - y(point.latitude)) / (2 * Math.PI)) * world,
  };
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
