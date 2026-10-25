/** Logical pixels shared by native marker bitmaps and web blooms. */
export const CLUSTER_MARKER_SIZE = 32;
export const CLUSTER_SHADOW_OPACITY = 0.14;
export const CLUSTER_MICRO_SHADOW_OPACITY = 0.08;
export const CLUSTER_FAR_SHADOW_OPACITY = 0.16;
export const CLUSTER_FRIEND_SHADOW_OPACITY = 0.07;
export const CLUSTER_COUNT_ANCHOR = { right: 0, bottom: 0 } as const;
export const CLUSTER_OWNERSHIP_ANCHOR = { right: 0, top: 0 } as const;
export type BloomScale = "close" | "medium" | "far" | "micro";

export function beaconPetalLimit(count: number, scale: BloomScale = "medium") {
  if (scale === "micro") return Math.min(count, 2);
  if (scale === "far") return Math.min(count, 3);
  return count <= 5 ? count : count <= 10 ? 6 : 7;
}
/** Preview capacity follows Beacon petals; distant tiers deliberately use fewer marks. */
export function friendSatelliteLimit(petals: number, scale: BloomScale) {
  const capacity = petals <= 2 ? 3 : petals <= 5 ? 5 : 7;
  return scale === "far" || scale === "micro" ? 0 : capacity;
}
export const friendGroupUsesCount = (count: number, scale: BloomScale) =>
  count >= 5 || ((scale === "far" || scale === "micro") && count > 1);
export const friendCountLabel = (count: number, micro = false) =>
  micro ? `•${count}` : `👥${count}`;
export const friendCountWidth = (count: number, micro = false) =>
  (micro ? 14 : 25) + (micro ? 5 : 6) * String(count).length;

/** Count segments always describe totals, independent of hidden preview capacity. */
export type ClusterCountPart = { kind: "friends" | "beacons"; count: number };
export type ClusterCountAction = "expand" | "cluster" | "friends";
export const CLUSTER_COUNT_PATHS = {
  friends:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  beacons: "M12 3 14.5 9.5 21 12 14.5 14.5 12 21 9.5 14.5 3 12 9.5 9.5Z",
} as const;
export function clusterCountParts(
  people: number,
  beacons: number,
): ClusterCountPart[] {
  return [
    ...(people > 0 ? [{ kind: "friends" as const, count: people }] : []),
    ...(beacons > 0 ? [{ kind: "beacons" as const, count: beacons }] : []),
  ];
}
export const clusterCountLabel = (people: number, beacons: number) =>
  clusterCountParts(people, beacons)
    .map((part) => `${part.kind === "friends" ? "👥" : "✦"} ${part.count}`)
    .join(" · ");
export const clusterCountAccessibilityLabel = (
  people: number,
  beacons: number,
) =>
  [
    people ? `${people} nearby friends` : "",
    beacons ? `${beacons} Beacons` : "",
  ]
    .filter(Boolean)
    .join(". ");
export function clusterCountWidth(
  people: number,
  beacons: number,
  fontSize = 10,
) {
  const parts = clusterCountParts(people, beacons);
  return (
    10 +
    parts.reduce(
      (width, part) =>
        width +
        fontSize +
        3 +
        (fontSize < 10 ? 5 : 6) * String(part.count).length,
      0,
    ) +
    Math.max(0, parts.length - 1) * 8
  );
}

export function clusterLayout(
  count: number,
  scale: BloomScale = "medium",
  friendsOnly = false,
  prominent = false,
) {
  const micro = scale === "micro",
    far = scale === "far";
  const markerSize = friendsOnly
    ? micro
      ? 3
      : far
        ? 6
        : scale === "close"
          ? 36
          : prominent
            ? 23
            : 19
    : micro
      ? 12
      : far
        ? 18
        : 32;
  const size = friendsOnly
    ? micro
      ? 44
      : far
        ? 44
        : count >= 5
          ? 44
          : scale === "close"
            ? 72
            : prominent
              ? 60
              : 52
    : micro
      ? 44
      : far
        ? 54
        : count >= 6
          ? 88
          : 72;
  return {
    size,
    center: size / 2,
    markerSize,
    shadowSize: micro
      ? friendsOnly
        ? 12
        : 26
      : friendsOnly
        ? size - 14
        : size - 4,
    shadowLeft: micro ? (friendsOnly ? 16 : 9) : friendsOnly ? 7 : 2,
    shadowTop: micro ? (friendsOnly ? 18 : 11) : friendsOnly ? 9 : 4,
  };
}
/** Two balanced lobes; three equilateral petals; four/five full rings; larger blooms have a centre. */
export function clusterPetalOffset(index: number, count: number) {
  count = Math.max(1, Math.min(7, count));
  if (count === 1) return { x: 0, y: 0 };
  if (count === 2) return { x: index === 0 ? -10 : 10, y: 0 };
  const centered = count >= 6;
  if (centered && index === 0) return { x: 0, y: 0 };
  const ring = centered ? count - 1 : count;
  const radius = count === 3 ? 13 : count === 4 ? 16 : count === 5 ? 18 : 22;
  const angle =
    -Math.PI / 2 +
    (count === 4 ? Math.PI / 4 : 0) +
    ((index - Number(centered)) * 2 * Math.PI) / ring;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
export function bloomPetalOffset(
  index: number,
  count: number,
  markerSize = 32,
) {
  const offset = clusterPetalOffset(index, count);
  return { x: (offset.x * markerSize) / 32, y: (offset.y * markerSize) / 32 };
}
