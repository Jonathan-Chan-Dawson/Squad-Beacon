import { useSyncExternalStore } from "react";

export type FriendsFilter = "All" | "Available" | "In a Beacon" | "Favorites";
export type FriendsBrowseState = {
  query: string;
  filter: FriendsFilter;
  listId: string | null;
};
const empty: FriendsBrowseState = { query: "", filter: "All", listId: null };
const sessions = new Map<
  string,
  { state: FriendsBrowseState; offset: number }
>();
const listeners = new Set<() => void>();
function session(viewer: string) {
  let value = sessions.get(viewer);
  if (!value) {
    value = { state: empty, offset: 0 };
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
  value.state = { ...value.state, ...patch };
  value.offset = 0;
  listeners.forEach((listener) => listener());
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
