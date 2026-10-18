import type { Data } from "@/src/shared/types";
import { canReadBeaconModuleEntry, canUseBeaconModules } from "./beaconModules";
import { isBeaconModuleEnabled } from "./permissions";
import {
  resolveActivityToolEntry,
  type BeaconToolId,
} from "./activityToolEntry";
export const cardToolLabels: Partial<Record<BeaconToolId, string>> = {
  checklist: "Checklist",
  journal: "Journal",
  focus: "Focus timer",
  experiences: "Memories",
  scoreboard: "Scoreboard",
  music: "Music link",
};
/** Independent module authorization, never inferred from being able to read a discovery card. */
export function beaconEngagement(
  data: Data,
  viewer: string | null,
  id: string,
) {
  if (!viewer || data.viewer_id !== viewer) return null;
  const activity = data.activities.find((row) => row.id === id);
  if (
    !activity ||
    activity.mode === "solo" ||
    !canUseBeaconModules(data, activity, viewer)
  )
    return null;
  const reactions = data.reactions.filter(
    (row) =>
      row.activity_id === id &&
      canReadBeaconModuleEntry(data, activity, row.user_id, viewer),
  );
  const comments = data.comments.filter(
    (row) =>
      row.activity_id === id &&
      canReadBeaconModuleEntry(data, activity, row.author_id, viewer),
  );
  const tools = (Object.keys(cardToolLabels) as BeaconToolId[]).filter(
    (tool) =>
      (tool !== "music" || !!activity.music_url) &&
      resolveActivityToolEntry(data, activity, viewer, "tools", tool).tool ===
        tool,
  );
  const uniqueReactions = [
    ...new Map(reactions.map((row) => [row.user_id, row])).values(),
  ];
  const reactionGroups = [...new Set(uniqueReactions.map((row) => row.emoji))]
    .map((emoji) => ({
      emoji,
      count: uniqueReactions.filter((row) => row.emoji === emoji).length,
    }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
    .slice(0, 3);
  return {
    activity,
    canReact:
      isBeaconModuleEnabled(activity, "reactions") &&
      activity.status !== "cancelled",
    canReadComments: isBeaconModuleEnabled(activity, "comments"),
    canChat: isBeaconModuleEnabled(activity, "chat"),
    reactionGroups,
    reactionCount: new Set(reactions.map((row) => row.user_id)).size,
    commentCount: new Set(comments.map((row) => row.id)).size,
    selectedEmoji: reactions.find((row) => row.user_id === viewer)?.emoji,
    tools,
  };
}
