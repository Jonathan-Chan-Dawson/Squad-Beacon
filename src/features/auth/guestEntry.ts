import { router } from "expo-router";
import { rememberEntryIntent } from "./entryIntent";

const reasons = {
  create: "Sign in to create a Beacon and invite your people.",
  profile:
    "Sign in to see your profile, share your status, and connect with friends.",
  chats: "Sign in to start chatting.",
  squads: "Sign in to join or create a Squad.",
  places: "Sign in to search worldwide places.",
};

export function guestEntryReason(value: string | undefined) {
  return value && Object.hasOwn(reasons, value)
    ? reasons[value as keyof typeof reasons]
    : undefined;
}

export function openGuestEntry(
  destination: "/activities" | "/create" | "/profile" | "/squads" | "/",
  reason?: keyof typeof reasons,
  mode?: "create",
  params: Record<string, string> = {},
) {
  rememberEntryIntent(destination, params);
  router.push({ pathname: "/auth/sign-in", params: { reason, mode } });
}
