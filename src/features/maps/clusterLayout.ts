/** Shared logical pixels: native and web use the exact same circle and anchors. */
export const CLUSTER_MARKER_SIZE = 32;
export const CLUSTER_SHADOW_OPACITY = 0.22;
export const CLUSTER_COUNT_ANCHOR = { right: 0, bottom: 0 } as const;
export const CLUSTER_OWNERSHIP_ANCHOR = { right: 0, top: 0 } as const;

export function clusterLayout(count: number) {
  const size = count >= 6 ? 88 : 72;
  return {
    size,
    center: size / 2,
    markerSize: CLUSTER_MARKER_SIZE,
    shadowSize: size - 4,
    shadowLeft: 2,
    shadowTop: 4,
  };
}

// Count-specific circles are generated once, never fitted to geographic positions.
const petals = Array.from({ length: 11 }, (_, count) => {
  const ring = Math.max(1, count - 1),
    radius = count >= 6 ? 22 : 14;
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    if (index === 0) return { x: 0, y: 0 };
    const angle = -Math.PI / 2 + ((index - 1) * 2 * Math.PI) / ring;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
});

export function clusterPetalOffset(index: number, count: number) {
  return petals[Math.max(1, Math.min(10, count))][index] ?? { x: 0, y: 0 };
}
