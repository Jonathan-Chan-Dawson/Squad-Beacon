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

export function stellarDiameter(count: number) {
  return Math.min(56, Math.round(18 + 13 * Math.log10(Math.max(2, count) / 2)));
}

// All paths share a 100 × 100 view box. The colored facets meet the core.
export const STELLAR_OUTLINE = "M50 4Q57 39 96 50Q57 61 50 96Q43 61 4 50Q43 39 50 4Z";
export const ROUND_SIGNAL = "M50 7a43 43 0 1 0 0 86a43 43 0 1 0 0-86Z";
export const ROUND_SIGNAL_CORE = "M50 36a14 14 0 1 0 0 28a14 14 0 1 0 0-28Z";
export const ROUND_SIGNAL_FACETS = [
  "M50 13a7 7 0 1 0 0 14a7 7 0 1 0 0-14Z",
  "M80 60a7 7 0 1 0 0 14a7 7 0 1 0 0-14Z",
  "M20 60a7 7 0 1 0 0 14a7 7 0 1 0 0-14Z",
];
export const STELLAR_CORE = "M50 21Q56 43 79 50Q56 57 50 79Q44 57 21 50Q44 43 50 21Z";
export const STELLAR_OPACITY = 0.9;
export const STELLAR_PERSON = "M50 43a13 13 0 1 0 0-26 13 13 0 0 0 0 26M23 84V73a27 27 0 0 1 54 0v11Z";
export const STELLAR_FACETS = [
  "M50 4Q55 34 62 45L50 50L46 40Z",
  "M96 50Q66 55 55 63L50 50L60 46Z",
  "M50 96Q45 66 38 55L50 50L54 60Z",
];
export const STELLAR_PEOPLE = "M42 40a9 9 0 1 0 0-18 9 9 0 0 0 0 18m22 3a8 8 0 1 0 0-16M22 70v-5a20 20 0 0 1 40 0v5zm46 0h11v-5a15 15 0 0 0-12-15";

/** Keep geographic anchors fixed, and reserve the count before placing secondary artwork. */
function calculateBloomGeometry(item: NativeMapPresentation, allowCity = item.allowCityPetals) {
  const beaconTotal = item.beacons.length;
  const peopleCount = item.people.length;
  const friendsOnly = beaconTotal === 0;
  const grouped = beaconTotal + peopleCount > 1;
  const street = item.scale === "close";
  const cityPetals = item.scale === "far" && allowCity && grouped && !friendsOnly && beaconTotal + peopleCount <= 5;
  const distant = !cityPetals && (item.scale === "far" || item.scale === "micro");
  let markerSize = distant
    ? friendsOnly
      ? 9
      : 11
    : grouped
      ? street
        ? 29
        : cityPetals ? 22 : 24
      : friendsOnly
        ? street
          ? 34
          : 28
        : street
          ? 40
          : 30;
  const clear = (box: Box) =>
    !item.decorationObstacles?.some((obstacle) => intersects(box, obstacle));
  const baseLimit = friendsOnly ? 2 : cityPetals ? 2 : beaconPetalLimit(beaconTotal, item.scale);
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
  if (cityPetals && (primary.length !== Math.min(2, beaconTotal) || !availableCountBox))
    return calculateBloomGeometry(item, false);
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
      [dimensions.width + 4, Math.round((dimensions.height + (street ? 4 : 2)) * 1.12), 7],
      [street ? 33 : 28, street ? 19 : 16, 3],
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
  const desiredDiameter = friendsOnly ? 18 : stellarDiameter(beaconTotal + peopleCount);
  const signal = grouped && distant
    ? [...new Set([desiredDiameter, Math.max(18, desiredDiameter - 6), 18])]
        .map(diameter => ({
          x: countBox.x,
          y: countBox.y - (countBox.height + diameter) / 2 + 2,
          width: diameter,
          height: diameter,
          facets: friendsOnly ? 0 : diameter < desiredDiameter ? 1 : item.scale === "micro" ? 2 : 3,
          glow: !friendsOnly && diameter === desiredDiameter && clear({
            x: countBox.x, y: countBox.y - (countBox.height + diameter) / 2 + 2,
            width: diameter + 4, height: diameter + 4,
          }),
        }))
        .find(clear)
    : undefined;
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
      cityPetals ? 1 : friendSatelliteLimit(primary.length, item.scale),
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
          signal ? Math.max(Math.abs(signal.x), Math.abs(signal.y)) + signal.width / 2 : 0,
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
    signal,
    distant,
    projector,
  };
}
const geometryCache = new WeakMap<
  NativeMapPresentation,
  {
    obstacles: NativeMapPresentation["decorationObstacles"];
    allowCityPetals: NativeMapPresentation["allowCityPetals"];
    value: ReturnType<typeof calculateBloomGeometry>;
  }
>();
/** Immutable presentation geometry is reused by rendering, revision keys, and native overlays. */
export function bloomGeometry(item: NativeMapPresentation) {
  const cached = geometryCache.get(item);
  if (cached && cached.obstacles === item.decorationObstacles && cached.allowCityPetals === item.allowCityPetals)
    return cached.value;
  const value = calculateBloomGeometry(item);
  geometryCache.set(item, {
    obstacles: item.decorationObstacles,
    allowCityPetals: item.allowCityPetals,
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
