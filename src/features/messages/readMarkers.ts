export interface ChatReadMarker {
  last_read_at: string;
  last_read_message_id?: string | null;
}
export interface DirectMessageRead extends ChatReadMarker {
  user_id: string;
  peer_id: string;
}

/** Preserve PostgreSQL microseconds when comparing canonical read boundaries. */
export function chatTimestamp(value: string) {
  const fraction = /\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/.exec(value)?.[1] ?? "";
  return Date.parse(value) * 1000 + Number(fraction.padEnd(6, "0").slice(3, 6));
}

export function afterReadMarker(
  message: { id: string; created_at: string },
  marker?: ChatReadMarker,
) {
  if (!marker) return true;
  const time =
    chatTimestamp(message.created_at) - chatTimestamp(marker.last_read_at);
  return (
    time > 0 ||
    (time === 0 &&
      !!marker.last_read_message_id &&
      message.id > marker.last_read_message_id)
  );
}

export function compareChatMessages(
  a: { id: string; createdAt: string },
  b: { id: string; createdAt: string },
) {
  return (
    chatTimestamp(a.createdAt) - chatTimestamp(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

export function compareStoredChatMessages(
  a: { id: string; created_at: string },
  b: { id: string; created_at: string },
) {
  return compareChatMessages(
    { id: a.id, createdAt: a.created_at },
    { id: b.id, createdAt: b.created_at },
  );
}

export function messagesAreGrouped(
  previous: { authorId: string; createdAt: string } | undefined,
  current: { authorId: string; createdAt: string },
) {
  if (!previous || previous.authorId !== current.authorId) return false;
  const gap =
    chatTimestamp(current.createdAt) - chatTimestamp(previous.createdAt);
  return (
    gap >= 0 &&
    gap <= 5 * 60_000_000 &&
    new Date(previous.createdAt).toDateString() ===
      new Date(current.createdAt).toDateString()
  );
}
