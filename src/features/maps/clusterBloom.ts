import {
  beaconPetalLimit,
  bloomPetalOffset,
  friendSatelliteLimit,
  clusterCountLabel,
  clusterCountWidth,
  clusterCountParts,
} from "./clusterLayout";
import type { NativeMapPresentation } from "./nativeMapPresentation";
import type { ClusterPoint } from "./cluster";
import { beaconProjectionDimensions } from "./projector";

type Offset = { x: number; y: number };
type Box = Offset & { width: number; height: number };
const intersects = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 2 &&
  Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 2;

/** Category marks are composition cues with fixed slots relative to the count. */
function constellationDots(
  item: NativeMapPresentation,
  count: Box,
  clear: (box: Box) => boolean,
) {
  const regional = item.scale === "micro";
  const categories = [
    ...new Set(item.beacons.map((point) => point.category ?? "Other")),
  ];
  const candidates = (categories.length ? categories : [null]).slice(
    0,
    regional ? 2 : 3,
  );
  for (let length = candidates.length; length > 0; length--) {
    const dots = candidates.slice(0, length).map((category, index) => ({
      category,
      size: regional ? 4 : index === 0 ? 7 : 5,
      offset: {
        x: count.x + (index - (length - 1) / 2) * (regional ? 9 : 12),
        y:
          count.y -
          count.height / 2 -
          7 -
          (length === 3 && index === 1 ? 3 : 0),
      },
    }));
    if (
      dots.every(({ offset, size }) =>
        clear({ ...offset, width: size, height: size }),
      )
    )
      return dots;
  }
  return [];
}

/** Keep geographic anchors fixed, and reserve the count before placing secondary artwork. */
function calculateBloomGeometry(item: NativeMapPresentation) {
  const beaconTotal = item.beacons.length;
  const peopleCount = item.people.length;
  const friendsOnly = beaconTotal === 0;
  const grouped = beaconTotal + peopleCount > 1;
  const street = item.scale === "close";
  const distant = item.scale === "far" || item.scale === "micro";
  let markerSize = distant
    ? friendsOnly
      ? 5
      : 8
    : grouped
      ? street
        ? 29
        : 24
      : friendsOnly
        ? street
          ? 34
          : 28
        : street
          ? 40
          : 30;
  const clear = (box: Box) =>
    !item.decorationObstacles?.some((obstacle) => intersects(box, obstacle));
  const baseLimit = friendsOnly ? 2 : beaconPetalLimit(beaconTotal, item.scale);
  const members = friendsOnly ? item.people : item.beacons;
  let primary = grouped
    ? distant
      ? []
      : members.slice(0, baseLimit)
    : members;
  const petalOffsets = (count: number) =>
    primary
      .slice(0, count)
      .map((_, index) => bloomPetalOffset(index, count, markerSize));
  let offsets = petalOffsets(primary.length);
  const petalBox = (point: Offset): Box => ({
    ...point,
    width: markerSize,
    height: markerSize,
  });
  const fontSize = 10;
  const width = clusterCountWidth(peopleCount, beaconTotal, fontSize);
  const height = item.scale === "micro" ? 18 : 20;
  const countY = () =>
    distant
      ? 0
      : Math.ceil(
          Math.max(0, ...offsets.map(({ y }) => y + markerSize / 2)) +
            height / 2 +
            5,
        );
  const countBoxes = () => {
    const y = countY();
    return [
      { x: 0, y },
      { x: 0, y: -y },
      { x: -width / 3, y },
      { x: width / 3, y },
      { x: -width / 3, y: -y },
      { x: width / 3, y: -y },
      { x: 0, y: y + 20 },
      { x: 0, y: y - 20 },
      { x: -width / 3, y: y + 20 },
      { x: width / 3, y: y + 20 },
    ].map((offset) => ({ ...offset, width, height }));
  };
  const findCount = () =>
    countBoxes().find(
      (box) =>
        clear(box) &&
        !offsets.some((offset) => intersects(box, petalBox(offset))),
    );
  let availableCountBox = grouped ? findCount() : undefined;
  while (
    grouped &&
    primary.length > 0 &&
    (!availableCountBox || offsets.some((offset) => !clear(petalBox(offset))))
  ) {
    primary = primary.slice(0, -1);
    offsets = petalOffsets(primary.length);
    availableCountBox = findCount();
  }
  let countBox: Box = availableCountBox ?? { x: 0, y: countY(), width, height };
  if (grouped && !distant && !primary.length && item.decorationObstacles) {
    const previewSize = 24;
    const lift = countBox.y - height / 2 - previewSize / 2 - 5;
    const offset = [
      { x: countBox.x, y: lift },
      { x: countBox.x - 20, y: lift },
      { x: countBox.x + 20, y: lift },
    ].find((slot) =>
      clear({ ...slot, width: previewSize, height: previewSize }),
    );
    if (offset) {
      markerSize = previewSize;
      primary = members.slice(0, 1);
      offsets = [offset];
    }
  }
  if (
    grouped &&
    street &&
    item.decorationObstacles &&
    !friendsOnly &&
    beaconTotal >= 4 &&
    primary.length === 3
  ) {
    const fourthOffsets = item.beacons
      .slice(0, 4)
      .map((_, index) => bloomPetalOffset(index, 4, markerSize));
    if (
      fourthOffsets.every(
        (offset) =>
          clear(petalBox(offset)) && !intersects(petalBox(offset), countBox),
      )
    ) {
      primary = item.beacons.slice(0, 4);
      offsets = fourthOffsets;
    }
  }
  const projector = (() => {
    if (distant || friendsOnly || !primary.length) return undefined;
    const x =
      offsets.reduce((sum, offset) => sum + offset.x, 0) / offsets.length;
    const bottom = Math.max(...offsets.map(({ y }) => y + markerSize / 2));
    const dimensions = beaconProjectionDimensions(street ? "close" : "medium");
    if (!grouped) return { x, top: bottom - 5, ...dimensions };
    // Try the larger projection first and fall back when its base would crowd the count.
    for (const [width, height, belowFace] of [
      [dimensions.width + 4, dimensions.height + 2, 7],
      [street ? 33 : 28, street ? 17 : 14, 3],
    ]) {
      const top = bottom + belowFace - height;
      const box = { x, y: top + (height + 5) / 2, width, height: height + 5 };
      if (!clear(box)) continue;
      if (intersects(box, countBox)) {
        const lowerCount = { ...countBox, y: countBox.y + belowFace + 2 };
        if (
          countBox.y < bottom ||
          intersects(box, lowerCount) ||
          !clear(lowerCount)
        )
          continue;
        countBox = lowerCount;
      }
      return { x, top, width, height, opacity: dimensions.opacity };
    }
    return undefined;
  })();

  const countBadge = grouped
    ? {
        offset: { x: countBox.x, y: countBox.y },
        width,
        height,
        text: clusterCountLabel(peopleCount, beaconTotal),
        parts: clusterCountParts(peopleCount, beaconTotal),
        activation: friendsOnly ? ("friends" as const) : ("cluster" as const),
        peopleCount,
        beaconTotal,
        fontSize,
      }
    : undefined;
  const dots =
    grouped && distant ? constellationDots(item, countBox, clear) : [];
  const satellites: ClusterPoint[] = [];
  const satelliteOffsets: Offset[] = [];
  const satelliteSize = street ? 17 : 14;
  if (grouped && !friendsOnly && !distant && primary.length) {
    const reach = Math.ceil(markerSize / 2 + satelliteSize / 2 + 3);
    const slots = [
      { x: -reach, y: -12 },
      { x: reach, y: -12 },
      { x: -reach, y: 5 },
      { x: reach, y: 5 },
      { x: -11, y: -reach },
      { x: 11, y: -reach },
    ];
    const identities = primary.flatMap((point, index) =>
      item.owned.some((owned) => owned.id === point.id)
        ? [
            {
              x: offsets[index].x + markerSize * 0.4,
              y: offsets[index].y + markerSize * 0.38,
              width: 10,
              height: 10,
            },
          ]
        : [],
    );
    for (const point of item.people.slice(
      0,
      friendSatelliteLimit(primary.length, item.scale),
    )) {
      const offset = slots.find((slot) => {
        const box = { ...slot, width: satelliteSize, height: satelliteSize };
        return (
          clear(box) &&
          !intersects(box, countBox) &&
          !identities.some((identity) => intersects(box, identity)) &&
          !offsets.some(
            (petal) =>
              Math.hypot(slot.x - petal.x, slot.y - petal.y) <
              (markerSize + satelliteSize) / 2 + 1,
          ) &&
          !satelliteOffsets.some(
            (other) =>
              Math.hypot(slot.x - other.x, slot.y - other.y) <
              satelliteSize + 2,
          )
        );
      });
      if (!offset) break;
      satellites.push(point);
      satelliteOffsets.push(offset);
    }
  }

  const center = grouped
    ? Math.ceil(
        Math.max(
          30,
          ...offsets.map(
            ({ x, y }) => Math.max(Math.abs(x), Math.abs(y)) + markerSize / 2,
          ),
          ...satelliteOffsets.map(
            ({ x, y }) =>
              Math.max(Math.abs(x), Math.abs(y)) + satelliteSize / 2,
          ),
          Math.abs(countBox.x) + width / 2,
          Math.abs(countBox.y) + height / 2,
          projector
            ? Math.max(
                Math.abs(projector.x) + projector.width / 2,
                Math.abs(projector.top),
                Math.abs(projector.top + projector.height + 5),
              )
            : 0,
          ...dots.map(
            ({ offset, size }) =>
              Math.max(Math.abs(offset.x), Math.abs(offset.y)) + size / 2,
          ),
        ),
      ) + 2
    : Math.max(
        22,
        projector ? Math.ceil(projector.top + projector.height + 5) : 0,
      );
  const shadowSize =
    grouped &&
    !distant &&
    primary.length &&
    !item.decorationObstacles?.some((box) =>
      intersects(box, {
        x: 0,
        y: 0,
        width: markerSize + 30,
        height: markerSize + 30,
      }),
    )
      ? markerSize + 30
      : 0;
  return {
    size: center * 2,
    center,
    markerSize,
    primary,
    offsets,
    friendsOnly,
    shadowSize,
    shadowLeft: center - shadowSize / 2,
    shadowTop: center - shadowSize / 2 + 1,
    satellites,
    satelliteOffsets,
    satelliteSize,
    countBadge,
    dots,
    distant,
    projector,
  };
}
const geometryCache = new WeakMap<
  NativeMapPresentation,
  {
    obstacles: NativeMapPresentation["decorationObstacles"];
    value: ReturnType<typeof calculateBloomGeometry>;
  }
>();
/** Immutable presentation geometry is reused by rendering, revision keys, and native overlays. */
export function bloomGeometry(item: NativeMapPresentation) {
  const cached = geometryCache.get(item);
  if (cached && cached.obstacles === item.decorationObstacles)
    return cached.value;
  const value = calculateBloomGeometry(item);
  geometryCache.set(item, {
    obstacles: item.decorationObstacles,
    value,
  });
  return value;
}

/** Hide new decorations when existing artwork occupies their corner; never move petals. */
export function petalBookmarkVisible(
  geometry: ReturnType<typeof bloomGeometry>,
  index: number,
) {
  const size = geometry.markerSize;
  const origin = geometry.offsets[index];
  if (size < 24 || !origin) return false;
  const x = origin.x + size * 0.4;
  const y = origin.y - size * 0.35;
  const radius = size * 0.22;
  return (
    !geometry.offsets.some(
      (other, i) =>
        i !== index && Math.hypot(other.x - x, other.y - y) < size / 2 + radius,
    ) &&
    !geometry.satelliteOffsets.some(
      (other) =>
        Math.hypot(other.x - x, other.y - y) <
        geometry.satelliteSize / 2 + radius,
    )
  );
}

export function bloomAccessibilityLabel(item: NativeMapPresentation) {
  const beacons = item.beacons.length,
    people = item.people.length;
  if (new Set(item.group.members.map((member) => member.id)).size <= 1)
    return beacons
      ? "Map Beacon. Open Beacon preview"
      : "Map person. Open person preview";
  return `Map cluster: ${beacons} beacons, ${people} nearby friends. ${people ? "Nearby shared friend locations; proximity does not indicate Beacon attendance. " : ""}${beacons + people > 5 ? "Open searchable cluster explorer" : "Open nearby cluster explorer"}`;
}
