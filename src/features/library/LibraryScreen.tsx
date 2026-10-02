import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpenText, ClipboardList, FolderOpen } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import type { LibraryKind } from "@/src/shared/types";
import { Button, Empty, Field, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { libraryCards, type LibraryFilter } from "./helpers";

type LibraryTab = { kind: LibraryKind; label: string };
const tabs: readonly LibraryTab[] = [
  { kind: "journal", label: "Journals" },
  { kind: "checklist", label: "Checklists" },
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const folders = data.library_folders
    .filter((folder) => folder.owner_id === userId && folder.kind === kind)
    .sort((left, right) => left.name.localeCompare(right.name));
  const selectedFolder = folders.find((folder) => folder.id === filter);
  const cards = useMemo(
    () => (userId ? libraryCards(data, userId, kind, filter) : []),
    [data, filter, kind, userId],
  );
  const fileActivity = data.activities.find((activity) => activity.id === fileActivityId);

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
    setFolderNameEdit(null);
    router.setParams({ kind: next });
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

  return (
    <Screen title="Your library" eyebrow="PAST" create={false}>
      <View style={styles.card}>
        <Txt>
          Each beacon has one shared journal and checklist. Your folders only organize your view; they never change who can open a beacon.
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
          ...folders.map((folder) => ({ id: folder.id, label: folder.name })),
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
          <Txt muted>Deleting a folder moves its beacons to Unfiled. Shared content stays in the beacon.</Txt>
        </View>
      )}

      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

      {cards.length ? (
        cards.map(({ activity, folderId, entryCount }) => {
          const folder = folders.find((item) => item.id === folderId);
          return (
            <View key={activity.id} testID={`library-card-${activity.id}`} style={styles.card}>
              <View style={styles.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.label}>{activity.category} · {activity.status}</Text>
                  <Text style={styles.h2}>{activity.title}</Text>
                  <Txt muted>
                    {entryCount} {kind === "journal" ? (entryCount === 1 ? "entry" : "entries") : (entryCount === 1 ? "item" : "items")}
                    {folder ? ` · ${folder.name}` : " · Unfiled"}
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
        })
      ) : (
        <Empty
          title={filter === "unfiled" ? "Nothing unfiled" : "No beacons here yet"}
          body={
            filter === "unfiled"
              ? "Beacons without a folder will show up here."
              : "Beacons you can access appear once they are in this library view."
          }
        />
      )}

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
              });
              setFilter(folderDraftId);
              setFolderDraft("");
              setFolderDraftId(Crypto.randomUUID());
            })
          }
        />
        <Txt muted>Up to 30 folders per library. A beacon can be filed in one folder or left Unfiled.</Txt>
      </View>

      <Sheet
        title={`File ${kind === "journal" ? "journal" : "checklist"}`}
        visible={!!fileActivity}
        onClose={() => setFileActivityId(null)}
      >
        <Txt>
          {fileActivity?.title ?? "This beacon"} stays shared with its approved participants; this folder choice is just for you.
        </Txt>
        <Button
          title="Move to Unfiled"
          secondary
          disabled={busy}
          onPress={() => void moveToFolder(fileActivityId!, null)}
        />
        {folders.map((folder) => (
          <Button
            key={folder.id}
            title={`Move to ${folder.name}`}
            disabled={busy}
            onPress={() => void moveToFolder(fileActivityId!, folder.id)}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
