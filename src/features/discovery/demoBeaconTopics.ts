import type { Data, Payload } from "@/src/shared/types";
import { getCommunitySummary } from "@/src/features/social/directory";
import { canManageSpace } from "@/src/features/spaces/domain";
import { canManageOrganization } from "@/src/features/organizations/domain";
import type { CommunityTopic } from "./beaconTopics";

const actions = [
  "save_beacon_topic",
  "archive_beacon_topic",
  "follow_beacon_topic",
  "unfollow_beacon_topic",
  "update_beacon_topic_follow",
  "set_beacon_topic",
];

export function demoSetBeaconTopic(
  data: Data,
  viewer: string,
  activityId: string,
  topicId: unknown,
) {
  const activity = data.activities.find(
    (row) =>
      row.id === activityId &&
      row.owner_id === viewer &&
      row.mode !== "solo" &&
      row.status === "scheduled",
  );
  if (!activity)
    throw new Error("Only the host can change the topic of this Beacon.");
  const source = data.activity_social_links.find(
    (row) => row.activity_id === activityId,
  );
  const topic = data.beacon_topics?.find(
    (row) => row.id === topicId && !row.archived,
  );
  if (
    topicId != null &&
    (!topic ||
      !source ||
      topic.entity_type !== source.entity_type ||
      topic.entity_id !== source.entity_id ||
      getCommunitySummary(source.entity_type, source.entity_id, data, viewer)
        ?.membership_status !== "active")
  )
    throw new Error("Choose an active topic from your Beacon’s community.");
  data.beacon_topic_assignments = (data.beacon_topic_assignments ?? []).filter(
    (row) => row.activity_id !== activityId,
  );
  if (topic)
    data.beacon_topic_assignments.push({
      activity_id: activityId,
      topic_id: topic.id,
    });
}

export function demoBeaconTopics(
  data: Data,
  viewer: string,
  action: string,
  payload: Payload,
) {
  if (!actions.includes(action)) return null;
  const topics = data.beacon_topics ?? [];
  const follows = data.beacon_topic_follows ?? [];
  const next = { ...data };
  const topic = topics.find(
    (row) => row.id === payload.beacon_topic_id && !row.archived,
  );
  if (action === "set_beacon_topic") {
    demoSetBeaconTopic(
      next,
      viewer,
      String(payload.id),
      payload.beacon_topic_id,
    );
  } else if (action === "unfollow_beacon_topic") {
    next.beacon_topic_follows = follows.filter(
      (row) => row.id !== payload.follow_id,
    );
  } else if (action === "update_beacon_topic_follow") {
    next.beacon_topic_follows = follows.map((row) =>
      row.id === payload.follow_id && row.topic_id
        ? { ...row, prioritize: payload.prioritize === true }
        : row,
    );
  } else if (action === "follow_beacon_topic") {
    if (
      !topic ||
      !getCommunitySummary(topic.entity_type, topic.entity_id, data, viewer)
    )
      throw new Error("This topic is unavailable.");
    if (!follows.some((row) => row.topic_id === topic.id))
      next.beacon_topic_follows = [
        ...follows,
        {
          id: `follow:${topic.id}`,
          topic_id: topic.id,
          name: topic.name,
          prioritize: true,
        },
      ];
  } else {
    const type = payload.entity_type;
    const id = String(payload.entity_id);
    if (type !== "squad" && type !== "space" && type !== "organization")
      throw new Error("Choose a valid community.");
    const network = data.organizations.find((row) => row.id === id);
    const canManage =
      type === "space"
        ? canManageSpace(data, id, viewer)
        : type === "organization"
          ? !!network &&
            canManageOrganization(network, data.organization_members, viewer)
          : data.squad_members.some(
              (row) =>
                row.squad_id === id &&
                row.user_id === viewer &&
                ["owner", "coowner", "admin"].includes(row.role),
            );
    if (!canManage)
      throw new Error("You cannot manage topics for this community.");
    const scoped = topics.filter(
      (row) =>
        row.entity_type === type && row.entity_id === id && !row.archived,
    );
    if (
      (payload.beacon_topic_id || action === "archive_beacon_topic") &&
      !scoped.includes(topic!)
    )
      throw new Error("This topic is unavailable.");
    if (action === "archive_beacon_topic") {
      next.beacon_topics = topics.map((row) =>
        row.id === topic!.id ? { ...row, archived: true } : row,
      );
      next.beacon_topic_follows = follows.map((row) =>
        row.topic_id === topic!.id
          ? { ...row, topic_id: null, name: null }
          : row,
      );
      next.beacon_topic_assignments = (
        data.beacon_topic_assignments ?? []
      ).filter((row) => row.topic_id !== topic!.id);
    } else {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (
        !name ||
        name.length > 40 ||
        scoped.some(
          (row) =>
            row.id !== topic?.id &&
            row.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new Error("Choose a distinct topic name up to 40 characters.");
      if (!topic && scoped.length >= 6)
        throw new Error("This community already has six active topics.");
      const saved: CommunityTopic = {
        id: topic?.id ?? `topic:${Date.now()}:${Math.random()}`,
        name,
        entity_type: type,
        entity_id: id,
        archived: false,
      };
      next.beacon_topics = [
        ...topics.filter((row) => row.id !== saved.id),
        saved,
      ];
      next.beacon_topic_follows = follows.map((row) =>
        row.topic_id === saved.id ? { ...row, name } : row,
      );
    }
  }
  return next;
}
