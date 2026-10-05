import type { Data, ID, Profile } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { matchesSearch } from "@/src/shared/search";
import type { PlanningThread } from "@/src/features/planning/types";
import {
  canReadPlanningThread,
  normalizePlanningData,
  pendingPlanningThreads,
} from "@/src/features/planning/domain";
import {
  selectSquadChatPings,
  visibleSquadPingResponses,
} from "@/src/features/organizations/squadChat";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";

export type SquadChatRowSummary = {
  preview: string;
  latest: string;
  pingId?: ID;
  needsResponse: boolean;
};

/** Merge the canonical latest Squad Ping into a row without treating it as a chat message. */
export function squadChatRowSummary(
  data: Data,
  squadId: ID,
  userId: ID | null,
  latestMessage: { body: string; created_at: string } | undefined,
  fallback: string,
  now = Date.now(),
): SquadChatRowSummary {
  if (!userId || !canOpenSquadProfile(data, squadId, userId)) {
    return { preview: fallback, latest: "", needsResponse: false };
  }

  const pings = selectSquadChatPings(data, squadId, userId);
  const latestPing = pings.at(-1);
  const messageTime = Date.parse(latestMessage?.created_at ?? "");
  const pingTime = Date.parse(latestPing?.created_at ?? "");
  const pingIsNewer =
    !!latestPing &&
    Number.isFinite(pingTime) &&
    (!Number.isFinite(messageTime) || pingTime > messageTime);
  const needsResponse = pendingPlanningThreads(
    data,
    normalizePlanningData(data),
    userId,
    now,
  ).some(
    (thread) => thread.audience === "squad" && thread.audience_id === squadId,
  );

  if (pingIsNewer && latestPing) {
    const response = visibleSquadPingResponses(data, latestPing, userId).find(
      (item) => item.user_id === userId,
    );
    const responseLabel = response
      ? {
          interested: "Interested",
          maybe: "Maybe",
          pass: "Pass",
        }[response.response]
      : undefined;
    return {
      preview: `Ping · ${latestPing.title}${responseLabel ? ` · You replied ${responseLabel}` : ""}`,
      latest: latestPing.created_at,
      pingId: latestPing.id,
      needsResponse,
    };
  }

  return {
    preview: latestMessage?.body ?? fallback,
    latest: latestMessage?.created_at ?? "",
    needsResponse,
  };
}

/** Only route to an exact Squad Ping card when the live snapshot still grants access. */
export function canOpenSquadPing(
  data: Data,
  thread: PlanningThread,
  userId: ID | null,
) {
  const squadId = thread.audience_id;
  return !!(
    userId &&
    data.viewer_id === userId &&
    thread.kind === "ping" &&
    thread.audience === "squad" &&
    squadId &&
    canOpenSquadProfile(data, squadId, userId) &&
    canReadPlanningThread(data, thread, userId)
  );
}

/** Search-only People results are limited to current-snapshot readable profiles. */
export function searchablePeople(
  data: Data,
  userId: ID | null,
  query: string,
): Profile[] {
  if (!userId || data.viewer_id !== userId || !query.trim()) return [];
  const friends = new Set(friendIds(data, userId));
  return data.profiles
    .filter(
      (profile) =>
        profile.id !== userId &&
        !friends.has(profile.id) &&
        canViewProfile(data, profile, userId) &&
        matchesSearch(query, profile.name, profile.username),
    )
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 6);
}

/** Count durable responses, not informational notifications or chat messages. */
export function pendingSocialCount(
  data: Data,
  userId: ID | null,
  now = Date.now(),
) {
  if (!userId || data.viewer_id !== userId) return 0;
  return (
    pendingPlanningThreads(data, normalizePlanningData(data), userId, now)
      .length +
    data.friendships.filter(
      (row) => row.recipient_id === userId && row.status === "pending",
    ).length +
    data.squad_invites.filter((row) => row.recipient_id === userId).length +
    (data.organization_members ?? []).filter(
      (row) => row.user_id === userId && row.status === "invited",
    ).length +
    data.rsvps.filter((row) => {
      const beacon = data.activities.find(
        (activity) => activity.id === row.activity_id,
      );
      return (
        beacon?.status === "scheduled" &&
        Date.parse(beacon.ends_at) > now &&
        ((row.user_id === userId && row.status === "invited") ||
          (beacon.owner_id === userId && row.status === "requested"))
      );
    }).length
  );
}
