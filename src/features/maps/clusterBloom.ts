import {
  bloomPetalOffset,
  clusterLayout,
  friendSatelliteLimit,
  clusterCountLabel,
  clusterCountWidth,
  clusterCountParts,
  type ClusterCountAction,
} from "./clusterLayout";
import { mapPointOffset } from "./mapPointOffset";
import type { NativeMapPresentation } from "./nativeMapPresentation";

type Offset = { x: number; y: number };
const angularDistance = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const intersects = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 2 &&
  Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 2;
/** Preserve Beacon geometry. Only friend decorations adapt to the available perimeter. */
function calculateBloomGeometry(item: NativeMapPresentation) {
  const friendsOnly = item.beacons.length === 0;
  const primary = item.visible.filter(
    (point) => point.kind === (friendsOnly ? "person" : "beacon"),
  );
  const layout = clusterLayout(
    item.beacons.length || item.people.length,
    item.scale,
    friendsOnly,
    item.friendsProminent,
  );
  const bloomHalf = layout.size / 2;
  // Transparent satellite room preserves the map-centered Beacon artwork and its original shadow.
  const overflowInset =
    !friendsOnly &&
    item.people.length > 0 &&
    (item.scale === "close" || item.scale === "medium")
      ? 8
      : 0;
  layout.size += overflowInset * 2;
  layout.center += overflowInset;
  layout.shadowLeft += overflowInset;
  layout.shadowTop += overflowInset;
  const fullBeacon =
    !friendsOnly && item.scale === "close" && item.beacons.length === 1;
  const markerSize = fullBeacon ? 40 : layout.markerSize;
  const offsets = primary.map((_, index) =>
    bloomPetalOffset(index, primary.length, markerSize),
  );
  const ownedIds = new Set(item.owned.map((point) => point.id));
  const occupiedCircles = offsets.map((center) => ({
    ...center,
    radius: markerSize / 2,
  }));
  primary.forEach((point, index) => {
    if (ownedIds.has(point.id))
      occupiedCircles.push({
        x: offsets[index].x + (13 * markerSize) / 32,
        y: offsets[index].y + (12 * markerSize) / 32,
        radius: (6 * markerSize) / 32,
      });
  });
  if (!friendsOnly) {
    layout.shadowSize = Math.min(
      layout.shadowSize,
      Math.ceil(
        markerSize +
          2 * Math.max(0, ...offsets.map((p) => Math.hypot(p.x, p.y))) +
          8,
      ),
    );
    layout.shadowLeft = layout.center - layout.shadowSize / 2;
    layout.shadowTop = layout.center - layout.shadowSize / 2 + 2;
  }
  const satelliteSize =
    item.scale === "micro"
      ? 3
      : item.scale === "far"
        ? 5
        : item.friendsProminent
          ? 12
          : 11;
  const radius = layout.size / 2 - satelliteSize / 2 - 1;
  const clear = (p: Offset, width: number, height: number) => {
    const box = { ...p, width, height };
    if (fullBeacon && intersects(box, { x: 0, y: 25, width: 16, height: 18 }))
      return false;
    if (item.decorationObstacles?.some((obstacle) => intersects(box, obstacle)))
      return false;
    return occupiedCircles.every(
      (center) =>
        Math.hypot(
          Math.max(0, Math.abs(p.x - center.x) - width / 2),
          Math.max(0, Math.abs(p.y - center.y) - height / 2),
        ) >=
        center.radius + 1,
    );
  };
  let hash = 0;
  for (const char of item.group.id)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const fallback = ((hash % 24) * Math.PI) / 12;
  const bearing = (point: { latitude: number; longitude: number }) => {
    const p = mapPointOffset(point, item.group, 14);
    return Math.hypot(p.x, p.y) < 0.01 ? fallback : Math.atan2(p.y, p.x);
  };
  const limit = friendSatelliteLimit(primary.length, item.scale);
  const micro = item.scale === "micro";
  const makeCountBadge = (peopleCount: number) => {
    if (friendsOnly || (!peopleCount && !item.overflow)) return undefined;
    const beaconTotal = item.beacons.length;
    const displayedPeople = micro && !item.friendsProminent ? 0 : peopleCount;
    const fontSize = micro ? 8 : item.scale === "far" ? 9 : 10;
    const width = Math.max(
      micro ? 18 : 24,
      clusterCountWidth(displayedPeople, beaconTotal, fontSize),
    );
    const height = micro ? 14 : item.scale === "far" ? 18 : 20;
    const activation: ClusterCountAction =
      displayedPeople && !item.overflow
        ? "friends"
        : beaconTotal <= 5 && !displayedPeople
          ? "expand"
          : "cluster";
    const artworkBottom = Math.max(
      fullBeacon ? 36 : 0,
      ...occupiedCircles.map((point) => point.y + point.radius),
    );
    const top = Math.max(bloomHalf - height, artworkBottom + 4);
    const preferred = { x: bloomHalf - width / 2, y: top + height / 2 };
    // Stay on the bottom-right edge. Only move outward/down to clear nearby artwork.
    const candidates: (Offset & { score: number })[] = [];
    for (let down = 0; down <= 80; down += 4)
      for (let right = 0; right <= 64; right += 4) {
        const offset = { x: preferred.x + right, y: preferred.y + down };
        if (clear(offset, width, height))
          candidates.push({ ...offset, score: down + right * 2 });
      }
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0] ?? preferred;
    return {
      offset: { x: best.x, y: best.y },
      width,
      height,
      text: clusterCountLabel(displayedPeople, beaconTotal),
      parts: clusterCountParts(displayedPeople, beaconTotal),
      activation,
      peopleCount,
      beaconTotal,
      fontSize,
    };
  };
  let countBadge: ReturnType<typeof makeCountBadge>;
  let satellites: NativeMapPresentation["people"] = [];
  let satelliteOffsets: Offset[] = [];
  let effectiveLimit = limit;
  if (
    !friendsOnly &&
    !item.overflow &&
    item.people.length &&
    item.people.length <= limit
  ) {
    const positions: Offset[] = [];
    for (const person of item.people) {
      const angle = bearing(person);
      const candidates = Array.from({ length: 36 }, (_, i) => {
        const a = (i * Math.PI) / 18;
        return { x: Math.cos(a) * radius, y: Math.sin(a) * radius, angle: a };
      })
        .filter(
          (p) =>
            clear(p, satelliteSize, satelliteSize) &&
            (!countBadge ||
              !intersects(
                { ...p, width: satelliteSize, height: satelliteSize },
                {
                  ...countBadge.offset,
                  width: countBadge.width,
                  height: countBadge.height,
                },
              )) &&
            positions.every(
              (other) =>
                Math.hypot(p.x - other.x, p.y - other.y) >= satelliteSize + 4,
            ),
        )
        .sort(
          (a, b) =>
            angularDistance(a.angle, angle) - angularDistance(b.angle, angle),
        );
      if (!candidates.length) break;
      positions.push({ x: candidates[0].x, y: candidates[0].y });
    }
    if (positions.length === item.people.length) {
      satellites = item.people;
      satelliteOffsets = positions;
    } else effectiveLimit = positions.length;
  }
  if (
    !friendsOnly &&
    (item.overflow || (item.people.length && !satellites.length))
  )
    countBadge = makeCountBadge(item.people.length);
  return {
    ...layout,
    markerSize,
    primary,
    offsets,
    fullBeacon,
    friendsOnly,
    satellites,
    satelliteOffsets,
    satelliteSize,
    satelliteLimit: effectiveLimit,
    countBadge,
    overflowInset,
  };
}
const geometryCache = new WeakMap<
  NativeMapPresentation,
  {
    visible: NativeMapPresentation["visible"];
    obstacles: NativeMapPresentation["decorationObstacles"];
    value: ReturnType<typeof calculateBloomGeometry>;
  }
>();
/** Immutable presentation geometry is reused by rendering, revision keys, and native overlays. */
export function bloomGeometry(item: NativeMapPresentation) {
  const cached = geometryCache.get(item);
  if (
    cached &&
    cached.visible === item.visible &&
    cached.obstacles === item.decorationObstacles
  )
    return cached.value;
  const value = calculateBloomGeometry(item);
  geometryCache.set(item, {
    visible: item.visible,
    obstacles: item.decorationObstacles,
    value,
  });
  return value;
}

export function bloomAccessibilityLabel(item: NativeMapPresentation) {
  const beacons = item.beacons.length,
    people = item.people.length;
  return `Map cluster: ${beacons} beacons, ${people} people. ${people ? "Nearby shared friend locations; proximity does not indicate Beacon attendance. " : ""}${beacons > 5 || (!beacons && people >= 5) ? "Open searchable cluster explorer" : "Expand to select an item"}`;
}
