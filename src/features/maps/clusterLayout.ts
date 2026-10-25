/** Logical pixels shared by native marker bitmaps and web blooms. */
export const CLUSTER_MARKER_SIZE = 32;
export const CLUSTER_SHADOW_OPACITY = 0.14;
export const CLUSTER_MICRO_SHADOW_OPACITY = 0.09;
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
  return Math.min(
    capacity,
    scale === "micro" ? 1 : scale === "far" ? 3 : capacity,
  );
}
export const friendCountLabel = (count: number) => `👥${count}`;
export const friendCountWidth = (count: number, micro = false) =>
  (micro ? 18 : 25) + (micro ? 5 : 6) * String(count).length;

/** One count label: people are totals, Beacon numbers are hidden previews only. */
export const clusterCountLabel = (people: number, beacons: number) =>
  [people ? `👥 +${people}` : "", beacons ? `+${beacons}` : ""]
    .filter(Boolean)
    .join(" · ");
export function clusterCountWidth(
  people: number,
  beacons: number,
  micro = false,
) {
  const digit = micro ? 5 : 6;
  return (
    10 +
    (people ? 20 + digit * String(people).length : 0) +
    (beacons ? digit * (String(beacons).length + 1) : 0) +
    (people && beacons ? 10 : 0)
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
      ? 5
      : far
        ? 9
        : scale === "close"
          ? 36
          : prominent
            ? 23
            : 19
    : micro
      ? 14
      : far
        ? 20
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
