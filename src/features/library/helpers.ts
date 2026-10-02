import {
  canReadBeaconModuleEntry,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import type { Activity, Data, LibraryKind } from "@/src/shared/types";

export type LibraryFilter = "all" | "unfiled" | string;

export interface LibraryCard {
  activity: Activity;
  folderId: string | null;
  entryCount: number;
}

/** One card per authorized beacon, regardless of how many shared entries it has. */
export function libraryCards(
  data: Data,
  userId: string,
  kind: LibraryKind,
  filter: LibraryFilter = "all",
): LibraryCard[] {
  const folderFor = (activityId: string) =>
    data.library_folder_items.find(
      (item) =>
        item.owner_id === userId &&
        item.kind === kind &&
        item.activity_id === activityId,
    )?.folder_id ?? null;

  return data.activities
    .filter((activity) => canUseBeaconModules(data, activity, userId))
    .map((activity) => {
      const entries =
        kind === "journal"
          ? data.beacon_notes.filter(
              (note) =>
                note.activity_id === activity.id &&
                canReadBeaconModuleEntry(data, activity, note.author_id, userId),
            )
          : data.beacon_checklist_items.filter(
              (item) =>
                item.activity_id === activity.id &&
                canReadBeaconModuleEntry(data, activity, item.author_id, userId),
            );
      return {
        activity,
        folderId: folderFor(activity.id),
        entryCount: entries.length,
      };
    })
    .filter(({ folderId }) => {
      if (filter === "all") return true;
      if (filter === "unfiled") return folderId === null;
      return folderId === filter;
    })
    .sort(
      (left, right) =>
        right.activity.starts_at.localeCompare(left.activity.starts_at) ||
        left.activity.id.localeCompare(right.activity.id),
    );
}
