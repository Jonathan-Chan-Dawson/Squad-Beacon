import type { Data, Profile } from "./types";

export type AccountReadiness =
  | {
      state: "loading" | "signed-out" | "unavailable" | "needs-profile";
      profile?: never;
    }
  | { state: "ready"; profile: Profile };

/** Shared entry contract. Optional personalization never determines readiness. */
export function accountReadiness({
  userId,
  session,
  demo,
  data,
  loading,
  error,
}: {
  userId: string | null;
  session: { user: { id: string } } | null;
  demo: boolean;
  data: Data;
  loading: boolean;
  error: string | null;
}): AccountReadiness {
  if (loading) return { state: "loading" };
  if (!userId) return { state: "signed-out" };
  if (
    error ||
    (!demo && session?.user.id !== userId) ||
    data.viewer_id !== userId ||
    (data.is_demo === true) !== demo
  )
    return { state: "unavailable" };
  const profile = data.profiles.find((person) => person.id === userId);
  return profile ? { state: "ready", profile } : { state: "needs-profile" };
}
