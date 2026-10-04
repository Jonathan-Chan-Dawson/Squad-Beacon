import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpenText, ClipboardList, FolderOpen } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import type { BeaconNote, LibraryKind, LibrarySavedChecklist } from "@/src/shared/types";
import { Button, Chips, Empty, Field, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";
import {
  libraryCards,
  personalJournalCards,
  savedChecklistCards,
  sharedChecklistHistory,
  sharedJournalHistory,
  type LibraryFilter,
} from "./helpers";
import {
  canAddBeaconNote,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";

type LibraryTab = { kind: LibraryKind; label: string };
const tabs: readonly LibraryTab[] = [
  { kind: "journal", label: "Journals" },
  { kind: "checklist", label: "Lists" },
];

export function LibraryScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { colors, styles } = useTheme();
  const { data, userId, act } = useBeacon();
  const kind: LibraryKind = params.kind === "checklist" ? "checklist" : "journal";
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [folderDraft, setFolderDraft] = useState("");
  const [folderDraftId, setFolderDraftId] = useState(() => Crypto.randomUUID());
  const [folderNameEdit, setFolderNameEdit] = useState<string | null>(null);
  const [fileActivityId, setFileActivityId] = useState<string | null>(null);
  const [fileResourceId, setFileResourceId] = useState<string | null>(null);
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [sharedHistoryOpen, setSharedHistoryOpen] = useState(false);
  const [journalEditorOpen, setJournalEditorOpen] = useState(false);
  const [journalEditTarget, setJournalEditTarget] = useState<BeaconNote | null>(null);
  const [journalDraftId, setJournalDraftId] = useState(() => Crypto.randomUUID());
  const [journalHeadingDraft, setJournalHeadingDraft] = useState("");
  const [journalBodyDraft, setJournalBodyDraft] = useState("");
  const [journalVisibilityDraft, setJournalVisibilityDraft] = useState<"private" | "shared">("private");
  const [listEditorOpen, setListEditorOpen] = useState(false);
  const [listEditTarget, setListEditTarget] = useState<LibrarySavedChecklist | null>(null);
  const [listDraftId, setListDraftId] = useState(() => Crypto.randomUUID());
  const [listTitleDraft, setListTitleDraft] = useState("");
  const [listSectionsDraft, setListSectionsDraft] = useState("");
  const [listItemsDraft, setListItemsDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const folders = data.library_folders
    .filter((folder) => folder.owner_id === userId && folder.kind === kind)
    .sort((left, right) => left.name.localeCompare(right.name));
  const selectedFolder = folders.find((folder) => folder.id === filter);
  const historyCards = useMemo(
    () => {
      if (!userId) return [];
      return kind === "checklist"
        ? sharedChecklistHistory(data, userId, filter)
        : libraryCards(data, userId, kind, filter).filter((card) => card.entryCount > 0);
    },
    [data, filter, kind, userId],
  );
  const personalJournals = useMemo(
    () => (userId && kind === "journal" ? personalJournalCards(data, userId, filter) : []),
    [data, filter, kind, userId],
  );
  const savedLists = useMemo(
    () => (userId && kind === "checklist" ? savedChecklistCards(data, userId, filter) : []),
    [data, filter, kind, userId],
  );
  const sharedNotes = useMemo(
    () => (userId && kind === "journal" ? sharedJournalHistory(data, userId, filter) : []),
    [data, filter, kind, userId],
  );
  const fileActivity = data.activities.find((activity) => activity.id === fileActivityId);
  const folderLabel = (folderId: string | null) => {
    if (!folderId) return "Unfiled";
    const names: string[] = [];
    const visited = new Set<string>();
    let current = folders.find((item) => item.id === folderId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      names.unshift(current.name);
      current = current.parent_id
        ? folders.find((item) => item.id === current?.parent_id)
        : undefined;
    }
    return names.length ? names.join(" / ") : "Unfiled";
  };

  const run = async (callback: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await callback();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save that change.");
    } finally {
      setBusy(false);
    }
  };

  const changeKind = (next: LibraryKind) => {
    setFilter("all");
    setFolderParentId(null);
    setFolderNameEdit(null);
    router.setParams({ kind: next });
  };

  const openNewJournal = () => {
    setJournalEditTarget(null);
    setJournalDraftId(Crypto.randomUUID());
    setJournalHeadingDraft("");
    setJournalBodyDraft("");
    setJournalVisibilityDraft("private");
    setJournalEditorOpen(true);
  };

  const openEditJournal = (note: BeaconNote) => {
    setJournalEditTarget(note);
    setJournalDraftId(note.id);
    setJournalHeadingDraft(note.section_heading ?? "");
    setJournalBodyDraft(note.body);
    setJournalVisibilityDraft(note.visibility ?? "shared");
    setJournalEditorOpen(true);
  };

  const canEditJournal = (note: BeaconNote) => {
    if (!userId || note.author_id !== userId) return false;
    if (!note.activity_id) return true;
    const source = data.activities.find((activity) => activity.id === note.activity_id);
    return !!(
      source &&
      isBeaconModuleEnabled(source, "journal") &&
      canAddBeaconNote(data, source, userId)
    );
  };

  const saveJournal = async () => {
    if (!userId || !journalBodyDraft.trim())
      throw new Error("Write a journal entry first.");
    if (journalBodyDraft.trim().length > 1000)
      throw new Error("Keep a journal entry under 1000 characters.");
    const notePayload = {
      id: journalEditTarget?.id ?? journalDraftId,
      section_heading: journalHeadingDraft.trim(),
      body: journalBodyDraft.trim(),
    };
    if (journalEditTarget?.activity_id) {
      await act("save_beacon_note", {
        ...notePayload,
        activity_id: journalEditTarget.activity_id,
        visibility: journalVisibilityDraft,
        expected_revision: journalEditTarget.revision,
      });
    } else if (journalEditTarget) {
      await act("edit_beacon_note", {
        ...notePayload,
        visibility: "private",
        expected_revision: journalEditTarget.revision,
      });
    } else {
      await act("create_journal_entry", notePayload);
    }
    setJournalEditorOpen(false);
  };

  const openNewList = () => {
    setListEditTarget(null);
    setListDraftId(Crypto.randomUUID());
    setListTitleDraft("");
    setListSectionsDraft("");
    setListItemsDraft("");
    setListEditorOpen(true);
  };

  const openEditList = (checklist: LibrarySavedChecklist) => {
    setListEditTarget(checklist);
    setListDraftId(checklist.id);
    setListTitleDraft(checklist.title);
    setListSectionsDraft(checklist.sections.map((section) => section.title).join("\n"));
    setListItemsDraft(
      checklist.items
        .map((item) => {
          const section = checklist.sections.find((candidate) => candidate.id === item.section_id);
          return (section ? section.title + " :: " : "") + item.text;
        })
        .join("\n"),
    );
    setListEditorOpen(true);
  };

  const saveList = async () => {
    if (!userId || !listTitleDraft.trim()) throw new Error("Name this list first.");
    const sectionNames = listSectionsDraft
      .split("\n")
      .map((title) => title.trim())
      .filter(Boolean);
    const oldSections = listEditTarget?.sections ?? [];
    const sections = sectionNames.map((title, index) => ({
      id: oldSections[index]?.id ?? Crypto.randomUUID(),
      title,
      position: index,
    }));
    const sectionIdByName = new Map(sections.map((section) => [section.title.toLowerCase(), section.id]));
    const itemLines = listItemsDraft.split("\n").map((line) => line.trim()).filter(Boolean);
    const oldItems = listEditTarget?.items ?? [];
    const items = itemLines.map((line, index) => {
      const separator = line.indexOf(" :: ");
      const sectionName = separator >= 0 ? line.slice(0, separator).trim() : "";
      const text = separator >= 0 ? line.slice(separator + 4).trim() : line;
      const oldItem = oldItems[index];
      return {
        id: oldItem?.id ?? Crypto.randomUUID(),
        text,
        completed: oldItem?.completed ?? false,
        section_id: sectionName ? sectionIdByName.get(sectionName.toLowerCase()) ?? null : null,
        assignee_id: oldItem?.assignee_id ?? null,
      };
    });
    if (items.some((item) => item.text.length > 160))
      throw new Error("Keep each list item under 160 characters.");
    await act("save_library_checklist", {
      id: listEditTarget?.id ?? listDraftId,
      title: listTitleDraft.trim(),
      sections,
      items,
      expected_revision: listEditTarget?.revision,
    });
    setListEditorOpen(false);
  };

  const moveToFolder = async (activityId: string, folderId: string | null) => {
    if (!userId) return;
    await run(async () => {
      await act("move_library_item", {
        kind,
        activity_id: activityId,
        folder_id: folderId,
      });
      setFileActivityId(null);
    });
  };

  const moveResourceToFolder = async (folderId: string | null) => {
    if (!userId || !fileResourceId) return;
    await run(async () => {
      await act("move_library_resource", {
        kind,
        resource_id: fileResourceId,
        folder_id: folderId,
      });
      setFileResourceId(null);
    });
  };

  return (
    <Screen title="Your library" eyebrow="PAST" create={false}>
      <View style={styles.card}>
        <Txt>
          Your journal entries and saved lists are private to you. Shared Beacon history is kept separate. Folders only organize your view; they never change who can open a Beacon.
        </Txt>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {tabs.map(({ kind: tabKind, label }) => {
            const selected = kind === tabKind;
            const Icon = tabKind === "journal" ? BookOpenText : ClipboardList;
            return (
              <Pressable
                key={tabKind}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => changeKind(tabKind)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  flex: 1,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: selected ? colors.ink : colors.line,
                  backgroundColor: selected ? colors.ink : colors.white,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <Icon size={17} color={selected ? colors.white : colors.green} />
                <Text style={{ color: selected ? colors.white : colors.ink, fontWeight: "700" }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          { id: "all", label: "All" },
          { id: "unfiled", label: "Unfiled" },
          ...folders.map((folder) => ({ id: folder.id, label: folderLabel(folder.id) })),
        ].map((option) => {
          const selected = filter === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setFilter(option.id);
                setFolderNameEdit(null);
              }}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 14,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: selected ? colors.ink : colors.line,
                backgroundColor: selected ? colors.ink : colors.white,
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Text style={{ color: selected ? colors.white : colors.muted, fontSize: 13, fontWeight: "700" }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {kind === "journal" ? (
        <View style={[styles.card, { gap: 9 }]}>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>My Journal</Text>
              <Txt muted>Private entries and notes you chose to share.</Txt>
            </View>
            <Button title="New entry" compact onPress={openNewJournal} />
          </View>
          {personalJournals.length ? (
            personalJournals.map(({ note, activity, folderId }) => (
              <View key={note.id} testID={`journal-entry-${note.id}`} style={[styles.card, { gap: 7, padding: 12 }]}>
                <View style={styles.between}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.label}>
                      {note.visibility === "shared" ? "Shared with Beacon" : "Private"} · {folderLabel(folderId)}
                    </Text>
                    <Text style={styles.h2}>
                      {note.section_heading?.trim() || activity?.title || "Journal entry"}
                    </Text>
                  </View>
                  <FolderOpen size={19} color={colors.green} />
                </View>
                <Text style={styles.body}>{note.body}</Text>
                <Txt muted>Updated {new Date(note.updated_at).toLocaleDateString()}</Txt>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                  {canEditJournal(note) ? (
                    <Button title="Edit" compact secondary onPress={() => openEditJournal(note)} />
                  ) : null}
                  <Button title="File" compact secondary onPress={() => setFileResourceId(note.id)} />
                  {activity && userId && canUseBeaconModules(data, activity, userId) ? (
                    <Button
                      title="Open Beacon"
                      compact
                      onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
                    />
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Empty title="No journal entries yet" body="Beacon Notes you write and private entries you add will appear here." />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={(sharedHistoryOpen ? "Hide" : "Show") + " shared Beacon journal history"}
            accessibilityState={{ expanded: sharedHistoryOpen }}
            onPress={() => setSharedHistoryOpen((open) => !open)}
            style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.75 : 1 })}
          >
            <Text style={[styles.body, { fontWeight: "700" }]}>Shared Beacon history ({sharedNotes.length})</Text>
          </Pressable>
          {sharedHistoryOpen ? (
            sharedNotes.length ? sharedNotes.map(({ note, activity, folderId }) => (
              <View key={note.id} style={[styles.card, { padding: 12, gap: 5 }]}>
                <Text style={styles.label}>{activity?.title ?? "Beacon history"} · {folderLabel(folderId)}</Text>
                {note.section_heading ? <Text style={styles.body}>{note.section_heading}</Text> : null}
                <Text style={styles.body}>{note.body}</Text>
                {activity ? (
                  <Button compact secondary title="Open Beacon" onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })} />
                ) : null}
              </View>
            )) : <Txt muted>No shared journal history is available.</Txt>
          ) : null}
        </View>
      ) : (
        <View style={[styles.card, { gap: 9 }]}>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>My Lists</Text>
              <Txt muted>Private, editable Checklist copies.</Txt>
            </View>
            <Button title="New list" compact onPress={openNewList} />
          </View>
          {savedLists.length ? savedLists.map(({ checklist, folderId }) => (
            <View key={checklist.id} testID={`saved-checklist-${checklist.id}`} style={[styles.card, { padding: 12, gap: 7 }]}>
              <View style={styles.between}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.h2}>{checklist.title}</Text>
                  <Txt muted>{checklist.items.length} items · {checklist.sections.length} sections · {folderLabel(folderId)}</Txt>
                </View>
                <FolderOpen size={19} color={colors.green} />
              </View>
              {checklist.sections.map((section) => (
                <View key={section.id} style={{ gap: 2 }}>
                  <Text style={styles.label}>{section.title}</Text>
                  {checklist.items.filter((item) => item.section_id === section.id).map((item) => (
                    <Text key={item.id} style={styles.body}>{item.completed ? "✓ " : "• "}{item.text}</Text>
                  ))}
                </View>
              ))}
              {checklist.items.filter((item) => !item.section_id).map((item) => (
                <Text key={item.id} style={styles.body}>{item.completed ? "✓ " : "• "}{item.text}</Text>
              ))}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                <Button title="Edit list" compact secondary onPress={() => openEditList(checklist)} />
                <Button title="File" compact secondary onPress={() => setFileResourceId(checklist.id)} />
                <Button
                  title="Use for a new Beacon"
                  compact
                  onPress={() => router.push({ pathname: "/create", params: { savedChecklist: checklist.id } })}
                />
                <Button
                  title="Delete list"
                  compact
                  secondary
                  disabled={busy}
                  onPress={() => void run(async () => act("delete_saved_checklist", { id: checklist.id }))}
                />
              </View>
            </View>
          )) : (
            <Empty title="No saved lists yet" body="Save a copy from a Beacon Checklist or make a new list here." />
          )}
        </View>
      )}

      {selectedFolder && (
        <View style={styles.card}>
          <Text style={styles.h2}>Manage “{selectedFolder.name}”</Text>
          <Field
            label="Rename folder"
            value={folderNameEdit ?? selectedFolder.name}
            onChangeText={setFolderNameEdit}
            maxLength={40}
            editable={!busy}
          />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              title="Rename"
              compact
              disabled={busy || !(folderNameEdit ?? selectedFolder.name).trim()}
              onPress={() =>
                void run(async () => {
                  await act("rename_library_folder", {
                    id: selectedFolder.id,
                    kind,
                    name: (folderNameEdit ?? selectedFolder.name).trim(),
                  });
                  setFolderNameEdit(null);
                })
              }
            />
            <Button
              title="Delete folder"
              compact
              secondary
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  await act("delete_library_folder", { id: selectedFolder.id });
                  setFilter("all");
                  setFolderNameEdit(null);
                })
              }
            />
          </View>
          <Txt muted>Deleting a folder never deletes content; nested folders and their items remain available.</Txt>
        </View>
      )}

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

      {historyCards.length ? (
        <View style={[styles.card, { gap: 9 }]}>
          <Text style={styles.h2}>{kind === "journal" ? "Beacon-linked history" : "Shared Beacon checklists"}</Text>
          <Txt muted>
            {kind === "journal"
              ? "Beacon-level folder references are separate from My Journal entries."
              : "This is shared checklist history. My Lists are private editable copies."}
          </Txt>
        {historyCards.map(({ activity, folderId, entryCount }) => {
          const folder = folders.find((item) => item.id === folderId);
          return (
            <View key={activity.id} testID={`library-card-${activity.id}`} style={styles.card}>
              <View style={styles.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.label}>{activity.category} · {activity.status}</Text>
                  <Text style={styles.h2}>{activity.title}</Text>
                  <Txt muted>
                    {entryCount} {kind === "journal" ? (entryCount === 1 ? "entry" : "entries") : (entryCount === 1 ? "item" : "items")}
            {folder ? ` · ${folderLabel(folder.id)}` : " · Unfiled"}
                  </Txt>
                </View>
                <FolderOpen size={20} color={colors.green} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Button
                  title="Open beacon"
                  compact
                  onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
                />
                <Button
                  title="File"
                  compact
                  secondary
                  onPress={() => setFileActivityId(activity.id)}
                />
              </View>
            </View>
          );
        })}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.h2}>New folder</Text>
        <Field
          label="Folder name"
          value={folderDraft}
          onChangeText={(value) => {
            setFolderDraft(value);
            setFolderDraftId(Crypto.randomUUID());
          }}
          placeholder={kind === "journal" ? "Weekend memories" : "Things to bring"}
          maxLength={40}
          editable={!busy}
        />
        {folders.length ? (
          <Chips
            accessibilityPrefix="Create folder inside"
            options={["Library root", ...folders.map((folder) => folderLabel(folder.id))]}
            value={folderParentId ? folderLabel(folderParentId) : "Library root"}
            onChange={(name) => setFolderParentId(folders.find((folder) => folderLabel(folder.id) === name)?.id ?? null)}
          />
        ) : null}
        <Button
          title="Create folder"
          secondary
          disabled={busy || !folderDraft.trim()}
          onPress={() =>
            void run(async () => {
              await act("create_library_folder", {
                id: folderDraftId,
                kind,
                name: folderDraft.trim(),
                parent_id: folderParentId,
              });
              setFilter(folderDraftId);
              setFolderParentId(null);
              setFolderDraft("");
              setFolderDraftId(Crypto.randomUUID());
            })
          }
        />
        <Txt muted>Up to 30 folders per library. Beacon references, journal entries, and saved lists are filed independently.</Txt>
      </View>

      <Sheet
        title={`File ${kind === "journal" ? "journal" : "checklist"}`}
        visible={!!fileActivity || !!fileResourceId}
        onClose={() => { setFileActivityId(null); setFileResourceId(null); }}
      >
        <Txt>
          {fileActivity?.title ?? "This personal entry or list"} stays independent of Beacon access; folders organize only your library.
        </Txt>
        {fileResourceId ? (
          <>
            <Button title="Move to Unfiled" secondary disabled={busy} onPress={() => void moveResourceToFolder(null)} />
            {folders.map((folder) => (
              <Button key={folder.id} title={`Move to ${folderLabel(folder.id)}`} disabled={busy} onPress={() => void moveResourceToFolder(folder.id)} />
            ))}
          </>
        ) : null}
        {fileActivityId ? (
          <>
            <Button title="Move Beacon reference to Unfiled" secondary disabled={busy} onPress={() => void moveToFolder(fileActivityId, null)} />
            {folders.map((folder) => (
              <Button key={folder.id} title={`Move Beacon reference to ${folderLabel(folder.id)}`} disabled={busy} onPress={() => void moveToFolder(fileActivityId, folder.id)} />
            ))}
          </>
        ) : null}
      </Sheet>

      <Sheet
        title={journalEditTarget ? "Edit journal entry" : "New journal entry"}
        visible={journalEditorOpen}
        onClose={() => setJournalEditorOpen(false)}
      >
        <Field label="Heading (optional)" value={journalHeadingDraft} onChangeText={setJournalHeadingDraft} maxLength={120} editable={!busy} />
        <Field label="Journal entry" value={journalBodyDraft} onChangeText={setJournalBodyDraft} multiline maxLength={1000} editable={!busy} />
        {!journalEditTarget?.activity_id ? <Txt muted>New entries are private to you.</Txt> : null}
        {journalEditTarget?.activity_id ? (
          <Chips accessibilityPrefix="Beacon Note visibility" options={["Private", "Shared"]} value={journalVisibilityDraft === "private" ? "Private" : "Shared"} onChange={(value) => setJournalVisibilityDraft(value === "Shared" ? "shared" : "private")} />
        ) : null}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Button title="Save entry" disabled={busy || !journalBodyDraft.trim()} onPress={() => void run(saveJournal)} />
      </Sheet>

      <Sheet
        title={listEditTarget ? "Edit saved list" : "New saved list"}
        visible={listEditorOpen}
        onClose={() => setListEditorOpen(false)}
      >
        <Field label="List name" value={listTitleDraft} onChangeText={setListTitleDraft} maxLength={80} editable={!busy} />
        <Field label="Sections (one per line)" value={listSectionsDraft} onChangeText={setListSectionsDraft} multiline maxLength={2000} editable={!busy} />
        <Field label="Items (one per line; optional Section :: item)" value={listItemsDraft} onChangeText={setListItemsDraft} multiline maxLength={8000} editable={!busy} />
        <Txt muted>Each item is limited to 160 characters. Completing or editing this copy never changes the source Beacon.</Txt>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Button title="Save list" disabled={busy || !listTitleDraft.trim()} onPress={() => void run(saveList)} />
      </Sheet>
    </Screen>
  );
}
