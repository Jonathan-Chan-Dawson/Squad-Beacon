import { friendIds } from "@/src/shared/domain";
import type { Activity, Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
export const categoryMarkerGlyphs = {
  Fitness: "🏀",
  Study: "📚",
  Gaming: "🎮",
  Creative: "🎨",
  Social: "☕",
  Other: "✦",
} as const;
/** Identity is independent of access; use only the viewer’s authorized relationships. */
export function markerIdentity(
  data: Data,
  activity: Activity,
  viewerId: string | null,
) {
  if (
    !viewerId ||
    data.viewer_id !== viewerId ||
    !canReadBeaconActivity(data, activity, viewerId)
  )
    return null;
  const host = data.activity_social_links.find(
    (row) => row.activity_id === activity.id,
  );
  if (host?.entity_type === "organization")
    return { glyph: "◈", label: "Organization", kind: "community" } as const;
  if (host?.entity_type === "space")
    return { glyph: "✺", label: "Network", kind: "community" } as const;
  if (host?.entity_type === "squad" || activity.audience === "squad")
    return { glyph: "✦", label: "Squad", kind: "social" } as const;
  if (friendIds(data, viewerId).includes(activity.owner_id))
    return { glyph: "♥", label: "Friends", kind: "social" } as const;
  return null;
}
