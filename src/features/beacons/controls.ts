import type { Activity, Data } from "@/src/shared/types";
import { beaconSeatCount } from "./permissions";

export const DECORATION_ACCENTS = [
  "ocean",
  "lime",
  "sunset",
  "berry",
  "neutral",
] as const;
export type DecorationAccent = (typeof DECORATION_ACCENTS)[number];
export const DECORATION_EMOJIS = [
  "✨",
  "🌿",
  "☀️",
  "🌊",
  "🎵",
  "🎮",
  "☕",
  "📚",
  "🏃",
  "🎨",
] as const;
export type DecorationEmoji = (typeof DECORATION_EMOJIS)[number];

export interface BeaconControlValues {
  capacity_limit: number | null;
  capacity_policy: "soft" | "strict";
  manual_closed: boolean;
  enable_chat: boolean;
  enable_checklist: boolean;
  enable_journal: boolean;
  enable_experiences: boolean;
  enable_focus: boolean;
  enable_reactions: boolean;
  enable_comments: boolean;
  enable_scoreboard: boolean;
  enable_music: boolean;
  checklist_edit_policy: "participants" | "managers";
  music_url: string | null;
  decoration_emoji: DecorationEmoji | null;
  decoration_accent: DecorationAccent | null;
}

export function defaultBeaconControlValues(): BeaconControlValues {
  return {
    capacity_limit: null,
    capacity_policy: "soft",
    manual_closed: false,
    enable_chat: true,
    enable_checklist: false,
    enable_journal: false,
    enable_experiences: false,
    enable_focus: false,
    enable_reactions: true,
    enable_comments: true,
    enable_scoreboard: false,
    enable_music: false,
    checklist_edit_policy: "participants",
    music_url: null,
    decoration_emoji: null,
    decoration_accent: null,
  };
}

export function beaconControlValuesFromActivity(
  activity: Partial<Activity>,
): BeaconControlValues {
  return validateBeaconControlValues({
    ...defaultBeaconControlValues(),
    ...activity,
    // Missing values in pre-module snapshots mean legacy behavior, not a new
    // Beacon's OFF-by-default recommendation.
    enable_chat: activity.enable_chat ?? true,
    enable_checklist: activity.enable_checklist ?? true,
    enable_journal: activity.enable_journal ?? true,
    enable_experiences: activity.enable_experiences ?? true,
    enable_focus: activity.enable_focus ?? true,
    enable_reactions: activity.enable_reactions ?? true,
    enable_comments:
      activity.enable_comments ?? activity.enable_experiences ?? true,
    enable_scoreboard: activity.enable_scoreboard ?? false,
    enable_music: activity.enable_music ?? !!activity.music_url,
    checklist_edit_policy: activity.checklist_edit_policy ?? "participants",
  });
}

/** Component remount key prevents an unsaved draft following a detail route switch. */
export function beaconSettingsDraftKey(activity: Activity) {
  return JSON.stringify([activity.id, beaconControlValuesFromActivity(activity)]);
}

const MUSIC_HOSTS = [
  "open.spotify.com",
  "music.youtube.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "music.apple.com",
  "soundcloud.com",
  "www.soundcloud.com",
] as const;

export function validateMusicUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 2000)
    throw new Error("Keep the music link under 2000 characters.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Enter a valid music link.");
  }
  const host = parsed.hostname.toLowerCase();
  const authority = /^https:\/\/([^/?#]+)/i.exec(value)?.[1] ?? "";
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    authority.includes(":") ||
    !MUSIC_HOSTS.includes(host as (typeof MUSIC_HOSTS)[number])
  )
    throw new Error("Use a secure link from Spotify, YouTube Music, Apple Music, or SoundCloud.");
  return parsed.toString();
}

export function validateBeaconControlValues(
  value: Record<string, unknown>,
): BeaconControlValues {
  const capacityLimit = value.capacity_limit;
  if (
    capacityLimit !== null &&
    (!Number.isInteger(capacityLimit) ||
      (capacityLimit as number) < 2 ||
      (capacityLimit as number) > 500)
  )
    throw new Error("Choose a capacity from 2 to 500, or leave it unlimited.");
  const capacityPolicy = value.capacity_policy;
  if (capacityPolicy !== "soft" && capacityPolicy !== "strict")
    throw new Error("Choose a soft or strict capacity.");
  const boolFields = [
    "manual_closed",
    "enable_chat",
    "enable_checklist",
    "enable_journal",
    "enable_experiences",
    "enable_focus",
    "enable_reactions",
    "enable_comments",
    "enable_scoreboard",
    "enable_music",
  ] as const;
  for (const field of boolFields)
    if (typeof value[field] !== "boolean")
      throw new Error("Choose whether each beacon tool is on or off.");
  const emoji = value.decoration_emoji;
  if (emoji !== null && !(DECORATION_EMOJIS as readonly unknown[]).includes(emoji))
    throw new Error("Choose one of the available beacon decorations.");
  const accent = value.decoration_accent;
  if (accent !== null && !(DECORATION_ACCENTS as readonly unknown[]).includes(accent))
    throw new Error("Choose one of the available beacon colors.");
  if (
    value.checklist_edit_policy !== "participants" &&
    value.checklist_edit_policy !== "managers"
  )
    throw new Error("Choose who can edit the checklist.");
  return {
    capacity_limit: capacityLimit as number | null,
    capacity_policy: capacityPolicy,
    manual_closed: value.manual_closed as boolean,
    enable_chat: value.enable_chat as boolean,
    enable_checklist: value.enable_checklist as boolean,
    enable_journal: value.enable_journal as boolean,
    enable_experiences: value.enable_experiences as boolean,
    enable_focus: value.enable_focus as boolean,
    enable_reactions: value.enable_reactions as boolean,
    enable_comments: value.enable_comments as boolean,
    enable_scoreboard: value.enable_scoreboard as boolean,
    enable_music: value.enable_music as boolean,
    checklist_edit_policy: value.checklist_edit_policy,
    music_url: validateMusicUrl(value.music_url),
    decoration_emoji: emoji as DecorationEmoji | null,
    decoration_accent: accent as DecorationAccent | null,
  };
}

export function canSetStrictCapacity(
  data: Data,
  activity: Activity,
  capacityLimit: number | null,
  policy: "soft" | "strict",
) {
  return policy !== "strict" || capacityLimit == null ||
    beaconSeatCount(data, activity) <= capacityLimit;
}
