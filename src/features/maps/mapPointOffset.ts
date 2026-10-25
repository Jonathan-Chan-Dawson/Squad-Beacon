import type { ClusterPoint, MapPointGroup } from "./cluster";
/** Local Mercator offsets for static swarms; derived exclusively from real positions. */
export function mapPointOffset(
  point: Pick<ClusterPoint, "latitude" | "longitude">,
  group: Pick<MapPointGroup, "latitude" | "longitude">,
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
