import { Platform } from "react-native";
import { supabase } from "@/src/shared/supabase";

export function guestSharingOrigin(): string | null {
  try {
    const url = new URL(process.env.EXPO_PUBLIC_GUEST_ORIGIN ?? "");
    return url.protocol === "https:" && url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password
      ? url.origin
      : null;
  } catch { return null; }
}

/** Member-management transport only; the guest webpage owns its HttpOnly session. */
export async function manageGuestAccess<T>(
  expectedActor: string,
  body: Record<string, unknown>,
  assertCurrent: () => void,
): Promise<T> {
  const origin = guestSharingOrigin();
  if (!origin || !supabase) throw new Error("Guest sharing is not configured yet.");
  assertCurrent();
  const { data: { session } } = await supabase.auth.getSession();
  assertCurrent();
  if (!session || session.user.id !== expectedActor) throw new Error("Your account changed. Reopen sharing.");
  const response = await fetch(`${origin}/api/guest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SB-Guest": "1",
      Authorization: `Bearer ${session.access_token}`,
      ...(Platform.OS === "web" ? {} : { Origin: origin }),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  assertCurrent();
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not update guest access.");
  return result as T;
}
