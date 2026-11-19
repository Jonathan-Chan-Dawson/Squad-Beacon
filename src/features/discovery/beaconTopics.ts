import type { Data } from "@/src/shared/types";
import type { SocialEntityType } from "@/src/features/social/types";

export type BeaconTopic = { id: string; name: string };
export type CommunityTopic = BeaconTopic & {
  entity_type: SocialEntityType;
  entity_id: string;
  archived: boolean;
};
export type BeaconTopicFollow = {
  id: string;
  topic_id: string | null;
  name: string | null;
  prioritize: boolean;
};

export function followedBeaconIds(
  data: Data,
  viewerId: string | null,
  prioritize = false,
) {
  if (!viewerId || data.viewer_id !== viewerId) return new Set<string>();
  const followed = new Set(
    (data.beacon_topic_follows ?? [])
      .filter((follow) => follow.topic_id && (!prioritize || follow.prioritize))
      .map((follow) => follow.topic_id),
  );
  return new Set(
    (data.beacon_topic_assignments ?? [])
      .filter((assignment) => followed.has(assignment.topic_id))
      .map((assignment) => assignment.activity_id),
  );
}
