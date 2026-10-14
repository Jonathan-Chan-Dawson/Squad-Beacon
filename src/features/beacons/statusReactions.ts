export const STATUS_REACTIONS = [
  {
    "emoji": "🙌",
    "name": "Raised hands"
  },
  {
    "emoji": "❤️",
    "name": "Heart"
  },
  {
    "emoji": "👍",
    "name": "Thumbs up"
  },
  {
    "emoji": "🔥",
    "name": "Fire"
  },
  {
    "emoji": "😂",
    "name": "Laughing"
  },
  {
    "emoji": "🎉",
    "name": "Celebration"
  },
  {
    "emoji": "👋",
    "name": "Wave"
  },
  {
    "emoji": "✅",
    "name": "Check mark"
  },
  {
    "emoji": "😊",
    "name": "Smile"
  },
  {
    "emoji": "😍",
    "name": "Heart eyes"
  },
  {
    "emoji": "🤩",
    "name": "Star eyes"
  },
  {
    "emoji": "🤗",
    "name": "Hug"
  },
  {
    "emoji": "😎",
    "name": "Cool"
  },
  {
    "emoji": "🤔",
    "name": "Thinking"
  },
  {
    "emoji": "😮",
    "name": "Surprised"
  },
  {
    "emoji": "😢",
    "name": "Sad"
  },
  {
    "emoji": "💪",
    "name": "Strong"
  },
  {
    "emoji": "👏",
    "name": "Applause"
  },
  {
    "emoji": "🤝",
    "name": "Handshake"
  },
  {
    "emoji": "☕",
    "name": "Coffee"
  },
  {
    "emoji": "📚",
    "name": "Books"
  },
  {
    "emoji": "🏀",
    "name": "Basketball"
  },
  {
    "emoji": "🎮",
    "name": "Gaming"
  },
  {
    "emoji": "🚶",
    "name": "Walking"
  }
] as const;
export const QUICK_STATUS_REACTIONS = STATUS_REACTIONS.slice(0, 5);
export function statusReactionEmoji(value: unknown): string {
  const emoji = value === undefined ? "🙌" : value;
  if (!STATUS_REACTIONS.some((item) => item.emoji === emoji)) throw new Error("Choose a supported status reaction.");
  return emoji as string;
}
export function searchStatusReactions(query: string) {
  const text = query.trim().toLocaleLowerCase();
  return STATUS_REACTIONS.filter((item) => item.name.toLocaleLowerCase().includes(text) || item.emoji.includes(text));
}
