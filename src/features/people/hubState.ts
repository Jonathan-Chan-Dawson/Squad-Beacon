import type { Data, Profile } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";
import { matchesSearch } from "@/src/shared/search";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canOpenSquadProfile } from "./squadProfile";
import { squadChatRowSummary } from "./communication";

export type ChatFilter = "All" | "Squads" | "Friends" | "Unread" | "Starred";
export interface HubConversation {
  id: string;
  kind: "squad" | "friend";
  name: string;
  profile?: Profile;
  latest: string;
  preview: string;
  pingId?: string;
  unread: number;
  starred: boolean;
}

export function selectHubConversations(data: Data, viewerId: string | null, now = Date.now()): HubConversation[] {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  const blocked = (id: string) => data.blocks.some((row) =>
    (row.blocker_id === viewerId && row.blocked_id === id) || (row.blocked_id === viewerId && row.blocker_id === id),
  );
  const starred = (kind: "squad" | "friend", id: string) => data.favorites.some((row) =>
    row.owner_id === viewerId && row.kind === kind && row.target_id === id,
  );
  const squads: HubConversation[] = data.squads.filter((squad) => canOpenSquadProfile(data, squad.id, viewerId)).map((squad) => {
    const messages = data.group_messages.filter((message) =>
      message.scope === "squad" && message.squad_id === squad.id && !blocked(message.author_id),
    ).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const read = data.group_message_reads.find((row) => row.scope === "squad" && row.squad_id === squad.id && row.user_id === viewerId);
    const summary = squadChatRowSummary(data, squad.id, viewerId, messages[0], squad.description.trim() || "Plan something together", now);
    return { id: squad.id, kind: "squad", name: squad.name, latest: summary.latest, preview: summary.preview,
      pingId: summary.pingId, starred: starred("squad", squad.id),
      unread: messages.filter((message) => message.author_id !== viewerId && (!read || message.created_at > read.last_read_at)).length };
  });
  const friends = new Set(friendIds(data, viewerId));
  const direct: HubConversation[] = data.profiles.filter((person) => friends.has(person.id) && !blocked(person.id)).flatMap((person) => {
    const latest = data.messages.filter((message) => !message.activity_id &&
      ((message.author_id === person.id && message.recipient_id === viewerId) ||
       (message.author_id === viewerId && message.recipient_id === person.id)),
    ).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!latest) return [];
    const readable = canViewProfile(data, person, viewerId);
    return [{ id: person.id, kind: "friend", name: readable ? person.name : "Friend", profile: readable ? person : undefined,
      latest: latest.created_at, preview: `${latest.author_id === viewerId ? "You: " : ""}${latest.body}`, unread: 0,
      starred: starred("friend", person.id) }];
  });
  return [...squads, ...direct].sort((a, b) => b.latest.localeCompare(a.latest) || Number(b.starred) - Number(a.starred) || a.name.localeCompare(b.name));
}

export function filterHubConversations(rows: readonly HubConversation[], filter: ChatFilter, query: string) {
  return rows.filter((row) => matchesSearch(query, row.name, row.preview) &&
    (filter === "All" || (filter === "Unread" ? row.unread > 0 : filter === "Starred" ? row.starred : filter === "Squads" ? row.kind === "squad" : row.kind === "friend")));
}

/** Empty DMs belong in the friend tray, never fake last-message rows. */
export function selectStartChatFriends(data: Data, viewerId: string | null, query: string) {
  if (!viewerId || data.viewer_id !== viewerId) return [];
  const friends = new Set(friendIds(data, viewerId));
  const conversations = new Set(selectHubConversations(data, viewerId).filter((row) => row.kind === "friend").map((row) => row.id));
  return data.profiles.filter((person) => friends.has(person.id) && !conversations.has(person.id) &&
    canViewProfile(data, person, viewerId) && matchesSearch(query, person.name, person.username)).sort((a, b) => a.name.localeCompare(b.name));
}
