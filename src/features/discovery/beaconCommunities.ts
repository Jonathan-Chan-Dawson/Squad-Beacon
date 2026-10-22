import type { Data } from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { getCommunitySummary } from "@/src/features/social/directory";
import {
  parseSocialDirectoryRows,
  type SocialDirectorySummary,
  type SocialEntityType,
} from "@/src/features/social/types";
import { demoPublicBeacons } from "./publicDirectory";

export interface BeaconCommunityAssociation {
  activity_id: string;
  relationship: "associated";
  priority: number;
  summary: SocialDirectorySummary;
}

export function parseBeaconCommunities(
  value: unknown,
  activityIds: readonly string[],
): BeaconCommunityAssociation[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(activityIds);
  const unique = new Map<string, BeaconCommunityAssociation>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.activity_id !== "string" ||
      !allowed.has(row.activity_id) ||
      row.relationship !== "associated" ||
      !Number.isInteger(row.priority) ||
      Number(row.priority) < 0 ||
      Number(row.priority) > 2
    )
      continue;
    const [summary] = parseSocialDirectoryRows([row.summary]);
    if (!summary) continue;
    const key = `${row.activity_id}:${summary.entity_type}:${summary.entity_id}`;
    const association: BeaconCommunityAssociation = {
      activity_id: row.activity_id,
      relationship: "associated",
      priority: Number(row.priority),
      summary,
    };
    if (!unique.has(key) || unique.get(key)!.priority > association.priority)
      unique.set(key, association);
  }
  return [...unique.values()].sort(compareBeaconCommunities);
}

export function compareBeaconCommunities(
  a: BeaconCommunityAssociation,
  b: BeaconCommunityAssociation,
) {
  return (
    a.activity_id.localeCompare(b.activity_id) ||
    a.priority - b.priority ||
    a.summary.entity_type.localeCompare(b.summary.entity_type) ||
    a.summary.entity_id.localeCompare(b.summary.entity_id)
  );
}

/** Demo mirrors the server projection; this never hydrates a live public Activity. */
export function demoBeaconCommunities(
  data: Data,
  viewerId: string,
  activityIds: readonly string[],
): BeaconCommunityAssociation[] {
  if (!data.is_demo || data.viewer_id !== viewerId) return [];
  const publicIds = new Set(
    demoPublicBeacons(data, viewerId, "").map((row) => row.activity_id),
  );
  const result: BeaconCommunityAssociation[] = [];
  for (const activityId of new Set(activityIds)) {
    const activity = data.activities.find((row) => row.id === activityId);
    if (
      !activity ||
      (!publicIds.has(activityId) &&
        !canReadBeaconActivity(data, activity, viewerId))
    )
      continue;
    const seen = new Map<string, BeaconCommunityAssociation>();
    const add = (type: SocialEntityType, id: string, priority: number) => {
      const summary = getCommunitySummary(type, id, data, viewerId);
      if (!summary) return;
      const key = `${type}:${id}`;
      if (!seen.has(key) || seen.get(key)!.priority > priority)
        seen.set(key, {
          activity_id: activityId,
          relationship: "associated",
          priority,
          summary,
        });
      return summary;
    };
    const link = data.activity_social_links.find(
      (row) => row.activity_id === activityId,
    );
    if (
      link?.created_by &&
      getCommunitySummary(
        link.entity_type,
        link.entity_id,
        { ...data, viewer_id: activity.owner_id },
        activity.owner_id,
      )?.membership_status === "active" &&
      getCommunitySummary(
        link.entity_type,
        link.entity_id,
        { ...data, viewer_id: link.created_by },
        link.created_by,
      )?.membership_status === "active"
    )
      add(link.entity_type, link.entity_id, 0);
    if (
      canReadBeaconActivity(data, activity, viewerId) &&
      activity.audience_id &&
      (activity.audience === "squad" || activity.audience === "organization")
    )
      add(activity.audience, activity.audience_id, 1);
    const seeds = [...seen.values()];
    for (const { summary } of seeds) {
      if (summary.entity_type === "squad") {
        for (const edge of data.organization_squads.filter(
          (row) => row.squad_id === summary.entity_id,
        ))
          add("organization", edge.organization_id, 2);
        for (const edge of data.space_squads.filter(
          (row) => row.squad_id === summary.entity_id,
        )) {
          if (add("space", edge.space_id, 2))
            for (const parent of data.organization_spaces.filter(
              (row) => row.space_id === edge.space_id,
            ))
              add("organization", parent.organization_id, 2);
        }
      } else if (summary.entity_type === "space") {
        for (const edge of data.organization_spaces.filter(
          (row) => row.space_id === summary.entity_id,
        ))
          add("organization", edge.organization_id, 2);
        for (const edge of data.space_squads.filter(
          (row) => row.space_id === summary.entity_id,
        ))
          add("squad", edge.squad_id, 2);
      } else {
        for (const edge of data.organization_spaces.filter(
          (row) => row.organization_id === summary.entity_id,
        )) {
          if (add("space", edge.space_id, 2))
            for (const child of data.space_squads.filter(
              (row) => row.space_id === edge.space_id,
            ))
              add("squad", child.squad_id, 2);
        }
        for (const edge of data.organization_squads.filter(
          (row) => row.organization_id === summary.entity_id,
        ))
          add("squad", edge.squad_id, 2);
      }
    }
    result.push(...seen.values());
  }
  return result.sort(compareBeaconCommunities);
}
