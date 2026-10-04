import {
  canReadBeaconModuleEntry,
  canReadBeaconNote,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import type {
  Activity,
  BeaconNote,
  Data,
  LibraryKind,
  LibrarySavedChecklist,
} from "@/src/shared/types";

export type LibraryFilter = "all" | "unfiled" | string;

export interface LibraryCard {
  activity: Activity;
  folderId: string | null;
  entryCount: number;
}

export interface PersonalJournalCard {
  note: BeaconNote;
  activity: Activity | null;
  folderId: string | null;
}

export interface SavedChecklistCard {
  checklist: LibrarySavedChecklist;
  folderId: string | null;
}

export interface SharedHistoryCard extends LibraryCard {
  kind: LibraryKind;
}

function resourceFolder(
  data: Data,
  userId: string,
  kind: LibraryKind,
  resourceId: string,
) {
  return (
    data.library_resource_folders.find(
      (entry) =>
        entry.owner_id === userId &&
        entry.kind === kind &&
        entry.resource_id === resourceId,
    )?.folder_id ?? null
  );
}

export function personalJournalCards(
  data: Data,
  userId: string,
  filter: LibraryFilter = "all",
): PersonalJournalCard[] {
  if (data.viewer_id != null && data.viewer_id !== userId) return [];
  return data.beacon_notes
    .filter((note) => note.author_id === userId)
    .map((note) => ({
      note,
      activity: note.activity_id
        ? data.activities.find((activity) => activity.id === note.activity_id) ?? null
        : null,
      folderId: resourceFolder(data, userId, "journal", note.id),
    }))
    .filter(({ folderId }) => {
      if (filter === "all") return true;
      if (filter === "unfiled") return folderId === null;
      return folderId === filter;
    })
    .sort(
      (left, right) =>
        right.note.updated_at.localeCompare(left.note.updated_at) ||
        left.note.id.localeCompare(right.note.id),
    );
}

export function savedChecklistCards(
  data: Data,
  userId: string,
  filter: LibraryFilter = "all",
): SavedChecklistCard[] {
  if (data.viewer_id != null && data.viewer_id !== userId) return [];
  return data.library_saved_checklists
    .filter((checklist) => checklist.owner_id === userId)
    .map((checklist) => ({
      checklist,
      folderId: resourceFolder(data, userId, "checklist", checklist.id),
    }))
    .filter(({ folderId }) => {
      if (filter === "all") return true;
      if (filter === "unfiled") return folderId === null;
      return folderId === filter;
    })
    .sort(
      (left, right) =>
        right.checklist.updated_at.localeCompare(left.checklist.updated_at) ||
        left.checklist.id.localeCompare(right.checklist.id),
    );
}

/** Retains readable activity-linked history even when its Beacon module is paused. */
export function sharedJournalHistory(
  data: Data,
  userId: string,
  filter: LibraryFilter = "all",
): PersonalJournalCard[] {
  if (data.viewer_id != null && data.viewer_id !== userId) return [];
  return data.beacon_notes
    .filter(
      (note) =>
        note.author_id !== userId &&
        note.activity_id !== null &&
        note.visibility === "shared" &&
        canReadBeaconNote(data, note, userId),
    )
    .map((note) => ({
      note,
      activity:
        data.activities.find((activity) => activity.id === note.activity_id) ?? null,
      folderId:
        data.library_folder_items.find(
          (entry) =>
            entry.owner_id === userId &&
            entry.kind === "journal" &&
            entry.activity_id === note.activity_id,
        )?.folder_id ?? null,
    }))
    .filter(({ folderId }) => {
      if (filter === "all") return true;
      if (filter === "unfiled") return folderId === null;
      return folderId === filter;
    })
    .sort(
      (left, right) =>
        right.note.updated_at.localeCompare(left.note.updated_at) ||
        left.note.id.localeCompare(right.note.id),
    );
}

export function sharedChecklistHistory(
  data: Data,
  userId: string,
  filter: LibraryFilter = "all",
): LibraryCard[] {
  if (data.viewer_id != null && data.viewer_id !== userId) return [];
  return data.activities
    .filter((activity) => canUseBeaconModules(data, activity, userId))
    .map((activity) => {
      const folderId =
        data.library_folder_items.find(
          (entry) =>
            entry.owner_id === userId &&
            entry.kind === "checklist" &&
            entry.activity_id === activity.id,
        )?.folder_id ?? null;
      const entries = data.beacon_checklist_items.filter(
        (item) =>
          item.activity_id === activity.id &&
          canReadBeaconModuleEntry(data, activity, item.author_id, userId),
      );
      return { activity, folderId, entryCount: entries.length };
    })
    .filter(({ folderId }) => {
      if (filter === "all") return true;
      if (filter === "unfiled") return folderId === null;
      return folderId === filter;
    })
    .filter(({ entryCount }) => entryCount > 0)
    .sort(
      (left, right) =>
        right.activity.starts_at.localeCompare(left.activity.starts_at) ||
        left.activity.id.localeCompare(right.activity.id),
    );
}

/** One card per authorized beacon, regardless of how many shared entries it has. */
export function libraryCards(
  data: Data,
  userId: string,
  kind: LibraryKind,
  filter: LibraryFilter = "all",
): LibraryCard[] {
  if (data.viewer_id != null && data.viewer_id !== userId) return [];
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
                canReadBeaconNote(data, note, userId),
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
