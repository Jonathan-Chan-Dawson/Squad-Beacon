import { bloomPetalOffset, clusterLayout } from "./clusterLayout";
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
export function bloomGeometry(item: NativeMapPresentation) {
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
    item.people.length <= 7 &&
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
  const satelliteSize =
    item.scale === "micro"
      ? 4
      : item.scale === "far"
        ? 7
        : item.friendsProminent
          ? 13
          : 11;
  const radius = layout.size / 2 - satelliteSize / 2 - 1;
  const overflowBox =
    item.overflow && !friendsOnly
      ? {
          x: bloomHalf - (16 + 6 * String(item.overflow).length) / 2,
          y: bloomHalf - (item.scale === "micro" ? 7 : 10),
          width: 16 + 6 * String(item.overflow).length,
          height: item.scale === "micro" ? 14 : 20,
        }
      : undefined;
  const clear = (p: Offset, width: number, height: number) => {
    const box = { ...p, width, height };
    if (overflowBox && intersects(box, overflowBox)) return false;
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
  const satelliteOffsets: Offset[] = [];
  let satellites = friendsOnly
    ? []
    : item.people.slice(
        0,
        item.scale === "micro" ? 2 : item.scale === "far" ? 3 : 7,
      );
  const limit = item.scale === "micro" ? 2 : item.scale === "far" ? 3 : 7;
  if (item.scale !== "micro" && item.people.length > limit) satellites = [];
  for (const person of satellites) {
    const angle = bearing(person);
    const candidates = Array.from({ length: 24 }, (_, i) => {
      const a = (i * Math.PI) / 12;
      return { x: Math.cos(a) * radius, y: Math.sin(a) * radius, angle: a };
    })
      .filter(
        (p) =>
          (item.scale === "micro" || clear(p, satelliteSize, satelliteSize)) &&
          satelliteOffsets.every(
            (other) =>
              Math.hypot(p.x - other.x, p.y - other.y) >= satelliteSize + 3,
          ),
      )
      .sort(
        (a, b) =>
          angularDistance(a.angle, angle) - angularDistance(b.angle, angle),
      );
    if (!candidates.length) {
      satellites = [];
      satelliteOffsets.length = 0;
      break;
    }
    satelliteOffsets.push({ x: candidates[0].x, y: candidates[0].y });
  }
  let friendBadge:
    { offset: Offset; width: number; height: number } | undefined;
  if (
    !friendsOnly &&
    item.people.length &&
    !satellites.length &&
    item.scale !== "micro"
  ) {
    const width = 22 + 6 * String(item.people.length).length,
      height = item.scale === "far" ? 16 : 18;
    const average = item.people.reduce(
      (sum, point) => {
        const p = mapPointOffset(point, item.group, 14);
        return { x: sum.x + p.x, y: sum.y + p.y };
      },
      { x: 0, y: 0 },
    );
    const angle =
      Math.hypot(average.x, average.y) < 0.01
        ? fallback
        : Math.atan2(average.y, average.x);
    const candidates: (Offset & { score: number })[] = [];
    for (let r = bloomHalf - 10; r <= bloomHalf + 24; r += 2)
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
          p = { x: Math.cos(a) * r, y: Math.sin(a) * r };
        if (
          clear(p, width, height) &&
          (!overflowBox ||
            !intersects(
              { ...p, width: 44, height: 44 },
              { ...overflowBox, width: 44, height: 44 },
            ))
        )
          candidates.push({ ...p, score: angularDistance(a, angle) * 16 + r });
      }
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0] ?? { x: -layout.size / 2 - 12, y: 0 };
    friendBadge = { offset: { x: best.x, y: best.y }, width, height };
  }
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
    friendBadge,
    overflowInset,
  };
}
export function bloomAccessibilityLabel(item: NativeMapPresentation) {
  const beacons = item.beacons.length,
    people = item.people.length;
  return `Map cluster: ${beacons} beacons, ${people} people. ${people ? "Nearby shared friend locations; proximity does not indicate Beacon attendance. " : ""}${beacons > 5 || (!beacons && people >= 5) ? "Open searchable cluster explorer" : "Expand to select an item"}`;
}
