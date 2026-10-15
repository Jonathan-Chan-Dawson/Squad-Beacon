import type { Data } from "@/src/shared/types";
import { friendIds } from "@/src/shared/domain";

export type PeopleListSelection = "friends" | "favorites" | `custom:${string}`;

/** Personal filters always intersect current friendship and blocking eligibility. */
export function selectListPeople(
  data: Data,
  viewerId: string | null,
  selection: PeopleListSelection = "friends",
) {
  if (!viewerId || data.viewer_id !== viewerId) return new Set<string>();
  const eligible = new Set(friendIds(data, viewerId));
  for (const block of data.blocks) {
    if (block.blocker_id === viewerId) eligible.delete(block.blocked_id);
    if (block.blocked_id === viewerId) eligible.delete(block.blocker_id);
  }
  if (selection === "friends") return eligible;
  const ids =
    selection === "favorites"
      ? data.favorites
          .filter((row) => row.owner_id === viewerId && row.kind === "friend")
          .map((row) => row.target_id)
      : data.lists.some(
            (row) => row.id === selection.slice(7) && row.owner_id === viewerId,
          )
        ? data.list_members
            .filter((row) => row.list_id === selection.slice(7))
            .map((row) => row.user_id)
        : [];
  return new Set(ids.filter((id) => eligible.has(id)));
}

export function privateListName(value: unknown) {
  if (typeof value !== "string") throw new Error("Enter a list name of 1–50 characters.");
  const name = String(value ?? "").trim();
  if (!name || [...name].length > 50)
    throw new Error("Enter a list name of 1–50 characters.");
  return name;
}

export function listIsUsed(data: Data, listId: string) {
  return (
    [data.activities, data.goals, data.habits, data.planning_threads].some(
      (rows) =>
        rows.some(
          (row) => row.audience === "list" && row.audience_id === listId,
        ),
    ) ||
    data.profile_visibility_grants.some(
      (row) => row.kind === "list" && row.target_id === listId,
    )
  );
}
