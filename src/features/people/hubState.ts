import type { Data, Profile, SquadIconKey } from "@/src/shared/types";
import { matchesSearch } from "@/src/shared/search";
import { canViewProfile } from "@/src/features/profile/privacy";
import { squadChatRowSummary } from "./communication";
import {
  afterReadMarker,
  chatTimestamp,
  compareStoredChatMessages,
} from "@/src/features/messages/readMarkers";
import { selectListPeople } from "./privateLists";
import {
  canReadPlanningThread,
  normalizePlanningData,
  pendingPlanningThreads,
} from "@/src/features/planning/domain";
import type { PlanningThread } from "@/src/features/planning/types";

export type ChatFilter = "All" | "Squads" | "Friends" | "Unread" | "Starred";
export interface HubConversation {
  id: string;
  kind: "squad" | "friend";
  name: string;
  profile?: Profile;
  iconKey?: SquadIconKey;
  latest: string;
  preview: string;
  pingId?: string;
  unread: number;
  starred: boolean;
}

export function selectHubConversations(
  data: Data,
  viewerId: string | null,
  now = Date.now(),
): HubConversation[] {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  const blockedIds = new Set(
    data.blocks.flatMap((row) =>
      row.blocker_id === viewerId
        ? [row.blocked_id]
        : row.blocked_id === viewerId
          ? [row.blocker_id]
          : [],
    ),
  );
  const blocked = (id: string) => blockedIds.has(id);
  const memberSquads = new Set(
    data.squad_members
      .filter((row) => row.user_id === viewerId)
      .map((row) => row.squad_id),
  );
  const bannedSquads = new Set(
    data.squad_bans
      .filter((row) => row.user_id === viewerId)
      .map((row) => row.squad_id),
  );
  const planning = normalizePlanningData(data);
  const pendingSquads = new Set(
    pendingPlanningThreads(data, planning, viewerId, now)
      .filter((row) => row.audience === "squad")
      .map((row) => row.audience_id),
  );
  const squadPings = new Map<string, PlanningThread[]>();
  for (const thread of planning.planning_threads) {
    if (
      thread.kind !== "ping" ||
      thread.audience !== "squad" ||
      !thread.audience_id ||
      thread.status === "cancelled" ||
      !memberSquads.has(thread.audience_id) ||
      !canReadPlanningThread(data, thread, viewerId)
    )
      continue;
    const rows = squadPings.get(thread.audience_id) ?? [];
    rows.push(thread);
    squadPings.set(thread.audience_id, rows);
  }
  for (const rows of squadPings.values())
    rows.sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  const favorites = new Set(
    data.favorites
      .filter((row) => row.owner_id === viewerId)
      .map((row) => `${row.kind}:${row.target_id}`),
  );
  const squadMessages = new Map<string, typeof data.group_messages>();
  const dmMessages = new Map<string, typeof data.messages>();
  for (const message of data.group_messages) {
    if (
      message.scope !== "squad" ||
      !message.squad_id ||
      blocked(message.author_id)
    )
      continue;
    const rows = squadMessages.get(message.squad_id) ?? [];
    rows.push(message);
    squadMessages.set(message.squad_id, rows);
  }
  for (const message of data.messages) {
    if (message.activity_id) continue;
    const peer =
      message.author_id === viewerId
        ? message.recipient_id
        : message.recipient_id === viewerId
          ? message.author_id
          : null;
    if (!peer || blocked(peer)) continue;
    const rows = dmMessages.get(peer) ?? [];
    rows.push(message);
    dmMessages.set(peer, rows);
  }
  const groupReads = new Map(
    data.group_message_reads
      .filter((row) => row.user_id === viewerId && row.scope === "squad")
      .map((row) => [row.squad_id, row]),
  );
  const dmReads = new Map(
    (data.dm_message_reads ?? [])
      .filter((row) => row.user_id === viewerId)
      .map((row) => [row.peer_id, row]),
  );
  const starred = (kind: "squad" | "friend", id: string) =>
    favorites.has(`${kind}:${id}`);
  const squads: HubConversation[] = data.squads
    .filter(
      (squad) =>
        memberSquads.has(squad.id) &&
        !squad.archived_at &&
        !blocked(squad.owner_id) &&
        !bannedSquads.has(squad.id),
    )
    .map((squad) => {
      const messages = squadMessages.get(squad.id) ?? [];
      const latest = messages.reduce<(typeof messages)[number] | undefined>(
        (last, row) =>
          !last || compareStoredChatMessages(row, last) > 0 ? row : last,
        undefined,
      );
      const read = groupReads.get(squad.id);
      const summary = squadChatRowSummary(
        data,
        squad.id,
        viewerId,
        latest,
        squad.description.trim() || "Plan something together",
        now,
        {
          pings: squadPings.get(squad.id) ?? [],
          needsResponse: pendingSquads.has(squad.id),
        },
      );
      return {
        id: squad.id,
        iconKey: squad.icon_key,
        kind: "squad",
        name: squad.name,
        latest: summary.latest,
        preview: summary.preview,
        pingId: summary.pingId,
        starred: starred("squad", squad.id),
        unread: messages.filter(
          (message) =>
            message.author_id !== viewerId && afterReadMarker(message, read),
        ).length,
      };
    });
  const friends = selectListPeople(data, viewerId);
  const direct: HubConversation[] = data.profiles
    .filter((person) => friends.has(person.id) && !blocked(person.id))
    .flatMap((person) => {
      const messages = dmMessages.get(person.id) ?? [];
      const latest = messages.reduce<(typeof messages)[number] | undefined>(
        (last, row) =>
          !last || compareStoredChatMessages(row, last) > 0 ? row : last,
        undefined,
      );
      if (!latest) return [];
      const readable = canViewProfile(data, person, viewerId);
      return [
        {
          id: person.id,
          kind: "friend",
          name: readable ? person.name : "Friend",
          profile: readable ? person : undefined,
          latest: latest.created_at,
          preview: `${latest.author_id === viewerId ? "You: " : ""}${latest.body}`,
          unread: messages.filter(
            (row) =>
              row.author_id !== viewerId &&
              afterReadMarker(row, dmReads.get(person.id)),
          ).length,
          starred: starred("friend", person.id),
        },
      ];
    });
  return [...squads, ...direct].sort(
    (a, b) =>
      (chatTimestamp(b.latest) || 0) - (chatTimestamp(a.latest) || 0) ||
      a.name.localeCompare(b.name) ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  );
}

export function filterHubConversations(
  rows: readonly HubConversation[],
  filter: ChatFilter,
  query: string,
) {
  return rows.filter(
    (row) =>
      matchesSearch(query, row.name, row.profile?.username, row.preview) &&
      (filter === "All" ||
        (filter === "Unread"
          ? row.unread > 0
          : filter === "Starred"
            ? row.starred
            : filter === "Squads"
              ? row.kind === "squad"
              : row.kind === "friend")),
  );
}

/** Empty DMs belong in the friend tray, never fake last-message rows. */
export function selectStartChatFriends(
  data: Data,
  viewerId: string | null,
  query: string,
  conversationRows?: readonly HubConversation[],
) {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  const friends = selectListPeople(data, viewerId);
  const conversations = new Set(
    (conversationRows ?? selectHubConversations(data, viewerId))
      .filter((row) => row.kind === "friend")
      .map((row) => row.id),
  );
  return data.profiles
    .filter(
      (person) =>
        friends.has(person.id) &&
        !conversations.has(person.id) &&
        (canViewProfile(data, person, viewerId)
          ? matchesSearch(query, person.name, person.username)
          : !query.trim()),
    )
    .map((person) => ({
      id: person.id,
      name: canViewProfile(data, person, viewerId) ? person.name : "Friend",
      profile: canViewProfile(data, person, viewerId) ? person : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
