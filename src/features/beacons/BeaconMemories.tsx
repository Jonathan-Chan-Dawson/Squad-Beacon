import React, { useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { Pencil, Play, Trash } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { Button, Field, Txt, useTheme } from "@/src/shared/ui";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
import {
  canReadMemory,
  canManageMemory,
  MAX_BEACON_MEMORIES,
  MAX_MEMORY_CAPTION_LENGTH,
  mediaForActivity,
} from "./models";
import {
  memoryObjectPath,
  pickBeaconMedia,
  removeBeaconMedia,
  signedBeaconMediaUrl,
  uploadBeaconMedia,
  type PickedBeaconMedia,
} from "./beaconMedia";
import type { Activity } from "@/src/shared/types";

export function BeaconMemories({ activity }: { activity: Activity }) {
  const { colors, styles } = useTheme();
  const { data, userId, act } = useBeacon();
  const [caption, setCaption] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>(
    {},
  );
  const [draft, setDraft] = useState<{
    media: PickedBeaconMedia;
    path: string;
    caption: string;
    uploaded: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cleanupPath, setCleanupPath] = useState<string | null>(null);
  const canRead =
    !!userId &&
    data.viewer_id === userId &&
    isBeaconModuleEnabled(activity, "experiences") &&
    canUseBeaconModules(data, activity, userId);
  const memories = useMemo(
    () =>
      canRead
        ? mediaForActivity(data, activity.id).filter((memory) =>
            canReadMemory(data, activity, memory, userId!),
          )
        : [],
    [activity, canRead, data, userId],
  );

  useEffect(() => {
    let current = true;
    void Promise.all(
      memories.map(async (memory) => {
        if (memory.object_path.startsWith("demo://")) return null;
        try {
          return [
            memory.id,
            await signedBeaconMediaUrl(memory.object_path),
          ] as const;
        } catch {
          return [memory.id, null] as const;
        }
      }),
    ).then((results) => {
      if (!current) return;
      setUrls(
        Object.fromEntries(
          results.filter(
            (entry): entry is readonly [string, string] => !!entry?.[1],
          ),
        ),
      );
    });
    return () => {
      current = false;
    };
  }, [memories]);

  if (!canRead) return null;
  const canWrite = activity.status !== "cancelled";

  const saveMemory = async () => {
    if (!userId) return;
    setBusy(true);
    setError("");
    try {
      let currentDraft = draft;
      if (!currentDraft) {
        const picked = await pickBeaconMedia();
        if (!picked) return;
        currentDraft = {
          media: picked,
          path: data.is_demo
            ? `demo://${activity.id}/${userId}/${picked.id}`
            : memoryObjectPath(activity.id, userId, picked),
          caption: caption.trim(),
          uploaded: false,
        };
        setDraft(currentDraft);
      }
      if (!data.is_demo && !currentDraft.uploaded) {
        await uploadBeaconMedia(currentDraft.path, currentDraft.media);
        currentDraft = { ...currentDraft, uploaded: true };
        setDraft(currentDraft);
      }
      await act("create_beacon_memory", {
        id: currentDraft.media.id,
        activity_id: activity.id,
        object_path: currentDraft.path,
        media_type: currentDraft.media.mediaType,
        duration_seconds: currentDraft.media.durationSeconds,
        caption: currentDraft.caption,
      });
      if (data.is_demo)
        setLocalPreviews((previous) => ({
          ...previous,
          [currentDraft.media.id]: currentDraft.media.uri,
        }));
      setDraft(null);
      setCaption("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save this memory.",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateCaption = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await act("update_beacon_memory", { id, caption: editCaption.trim() });
      setEditId(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update this memory.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteMemory = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const removedMemory = data.beacon_memories.find((item) => item.id === id);
      await act("delete_beacon_memory", {
        id,
        activity_id: activity.id,
        object_path: removedMemory?.object_path,
      });
      setLocalPreviews((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setUrls((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      if (removedMemory && !data.is_demo) {
        try {
          await removeBeaconMedia(removedMemory.object_path);
          setCleanupPath(null);
        } catch {
          setCleanupPath(removedMemory.object_path);
          setError("Memory removed. Media cleanup is pending; retry below.");
        }
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not delete this memory.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>Beacon Memories</Text>
      <Txt muted>
        Photos and short videos connected to this Beacon, up to{" "}
        {MAX_BEACON_MEMORIES}.
      </Txt>
      <Txt muted>
        Videos may retain location metadata. Check before sharing with this
        Beacon.
      </Txt>
      {!memories.length && (
        <Txt muted>No memories yet. Add a photo or short video.</Txt>
      )}
      {memories.map((memory) => {
        const url = localPreviews[memory.id] ?? urls[memory.id];
        const editable = canManageMemory(data, memory, userId!);
        const editing = editId === memory.id;
        return (
          <View key={memory.id} style={[styles.card, { gap: 8, padding: 12 }]}>
            {memory.media_type === "image" && url ? (
              <Image
                accessibilityLabel="Beacon memory photo"
                source={{ uri: url }}
                resizeMode="cover"
                style={{ width: "100%", height: 220, borderRadius: 14 }}
              />
            ) : memory.media_type === "video" && url ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play Beacon memory video"
                onPress={() => {
                  void (async () => {
                    try {
                      const latest = memory.object_path.startsWith("demo://")
                        ? url
                        : await signedBeaconMediaUrl(memory.object_path);
                      if (latest) await Linking.openURL(latest);
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : "Could not open this video.",
                      );
                    }
                  })();
                }}
                style={[styles.row, { minHeight: 54 }]}
              >
                <Play color={colors.green} size={20} />
                <Text style={styles.label}>
                  Play video · {memory.duration_seconds}s
                </Text>
              </Pressable>
            ) : (
              <Txt muted>
                {data.is_demo
                  ? "Demo media preview is available only during this session."
                  : "This media preview is unavailable."}
              </Txt>
            )}
            {editing ? (
              <View style={{ gap: 8 }}>
                <Field
                  label="Edit caption"
                  value={editCaption}
                  onChangeText={setEditCaption}
                  maxLength={MAX_MEMORY_CAPTION_LENGTH}
                  multiline
                />
                <View style={[styles.row, { gap: 8 }]}>
                  <Button
                    compact
                    title="Save caption"
                    disabled={busy}
                    onPress={() => void updateCaption(memory.id)}
                  />
                  <Button
                    compact
                    secondary
                    title="Cancel"
                    onPress={() => setEditId(null)}
                  />
                </View>
              </View>
            ) : (
              !!memory.caption && (
                <Text style={styles.body}>{memory.caption}</Text>
              )
            )}
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Txt muted>
                {new Date(memory.created_at).toLocaleDateString()}
              </Txt>
              {editable && !editing && (
                <View style={[styles.row, { gap: 4 }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit Beacon memory caption"
                    onPress={() => {
                      setEditCaption(memory.caption);
                      setEditId(memory.id);
                    }}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Pencil size={18} color={colors.green} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete Beacon memory"
                    disabled={busy}
                    onPress={() => void deleteMemory(memory.id)}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash size={18} color={colors.red} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        );
      })}
      <Field
        label="Caption (optional)"
        value={caption}
        onChangeText={setCaption}
        maxLength={MAX_MEMORY_CAPTION_LENGTH}
        multiline
        editable={canWrite && !draft}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {cleanupPath && (
        <Button
          title="Retry media cleanup"
          secondary
          disabled={busy}
          onPress={() => {
            setBusy(true);
            void removeBeaconMedia(cleanupPath)
              .then(() => {
                setCleanupPath(null);
                setError("");
              })
              .catch((failure) =>
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Media cleanup is still pending.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      )}
      <Button
        title={
          busy
            ? "Adding memory…"
            : draft
              ? "Retry saving memory"
              : "Add photo or video"
        }
        disabled={
          busy ||
          !canWrite ||
          (!draft && memories.length >= MAX_BEACON_MEMORIES)
        }
        secondary
        onPress={() => void saveMemory()}
      />
    </View>
  );
}
