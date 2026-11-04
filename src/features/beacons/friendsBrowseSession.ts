import { useSyncExternalStore } from "react";
import type { PeopleListSelection } from "@/src/features/people/privateLists";

export type FriendsFilter = "All" | "Available" | "In a Beacon";
export type FriendsBrowseState = {
  query: string;
  filter: FriendsFilter;
  scope: PeopleListSelection;
};
const empty: FriendsBrowseState = {
  query: "",
  filter: "All",
  scope: "friends",
};
const sessions = new Map<
  string,
  { state: FriendsBrowseState; offset: number; scopeInitialized: boolean }
>();
const listeners = new Set<() => void>();
function session(viewer: string) {
  let value = sessions.get(viewer);
  if (!value) {
    value = { state: empty, offset: 0, scopeInitialized: false };
    sessions.set(viewer, value);
  }
  return value;
}
export function friendsBrowseState(viewer: string | null) {
  return viewer ? session(viewer).state : empty;
}
export function updateFriendsBrowseState(
  viewer: string | null,
  patch: Partial<FriendsBrowseState>,
) {
  if (!viewer) return;
  const value = session(viewer);
  if (patch.scope !== undefined) value.scopeInitialized = true;
  value.state = { ...value.state, ...patch };
  value.offset = 0;
  listeners.forEach((listener) => listener());
}
/** Called only after the current account's snapshot is ready. Explicit choices win. */
export function initializeFriendsScope(
  viewer: string | null,
  hasFavorites: boolean,
  ownedListIds: readonly string[],
) {
  if (!viewer) return;
  const value = session(viewer);
  if (!value.scopeInitialized) {
    updateFriendsBrowseState(viewer, {
      scope: hasFavorites ? "favorites" : "friends",
    });
  } else if (
    value.state.scope.startsWith("custom:") &&
    !ownedListIds.includes(value.state.scope.slice(7))
  ) {
    updateFriendsBrowseState(viewer, { scope: "friends" });
  }
}
export function friendsScrollOffset(viewer: string | null) {
  return viewer ? session(viewer).offset : 0;
}
export function rememberFriendsScrollOffset(
  viewer: string | null,
  offset: number,
) {
  if (viewer)
    session(viewer).offset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
}
/** Account-scoped, in-memory browsing only; never writes preferences or records. */
export function useFriendsBrowseState(viewer: string | null) {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => friendsBrowseState(viewer),
    () => empty,
  );
  return [
    state,
    (patch: Partial<FriendsBrowseState>) =>
      updateFriendsBrowseState(viewer, patch),
  ] as const;
}
