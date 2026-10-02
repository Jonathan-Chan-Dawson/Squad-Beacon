import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  ListChecks,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  StickyNote,
  Timer,
  Trash,
} from "lucide-react-native";
import {
  canAddBeaconNote,
  canDeleteBeaconModuleEntry,
  canEditBeaconChecklist,
  canReadBeaconModuleEntry,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
import {
  createFocusTimer,
  pauseFocusTimer,
  resetFocusTimer,
  startFocusTimer,
  tickFocusTimer,
} from "@/src/features/beacons/focusTimer";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Field, Txt, useTheme } from "@/src/shared/ui";
import type { Activity, Payload } from "@/src/shared/types";

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

export function BeaconTools({ activity }: { activity: Activity }) {
  const { colors, styles } = useTheme();
  const { data, userId, act, refresh } = useBeacon();
  const [activeSection, setActiveSection] = useState<"checklist" | "journal" | "focus" | null>("checklist");
  const [checklistText, setChecklistText] = useState("");
  const [checklistDraftId, setChecklistDraftId] = useState(() =>
    Crypto.randomUUID(),
  );
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteDraftId, setNoteDraftId] = useState(() => Crypto.randomUUID());
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEditBody, setNoteEditBody] = useState("");
  const [noteEditRevision, setNoteEditRevision] = useState<number | null>(null);
  const [noteEditConflict, setNoteEditConflict] = useState(false);
  const [noteEditSaving, setNoteEditSaving] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(createFocusTimer);

  const checklistEnabled = isBeaconModuleEnabled(activity, "checklist");
  const journalEnabled = isBeaconModuleEnabled(activity, "journal");
  const focusEnabled = isBeaconModuleEnabled(activity, "focus");

  useEffect(() => {
    if (timer.phase !== "running") return;
    const interval = setInterval(() => {
      setTimer((current) =>
        focusEnabled
          ? tickFocusTimer(current, Date.now())
          : pauseFocusTimer(current, Date.now()),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.phase, focusEnabled]);

  const allowed = !!userId && canUseBeaconModules(data, activity, userId);
  const checklistEditable =
    checklistEnabled && !!userId && canEditBeaconChecklist(data, activity, userId);
  const notesWritable =
    journalEnabled && !!userId && canAddBeaconNote(data, activity, userId);
  const checklist = allowed
    ? data.beacon_checklist_items
        .filter(
          (item) =>
            item.activity_id === activity.id &&
            canReadBeaconModuleEntry(data, activity, item.author_id, userId!),
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : [];
  const notes = allowed
    ? data.beacon_notes
        .filter(
          (note) =>
            note.activity_id === activity.id &&
            canReadBeaconModuleEntry(data, activity, note.author_id, userId!),
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : [];

  const inlineAction = async (action: string, payload: Payload) => {
    setBusy(true);
    setInlineError("");
    try {
      await act(action, payload);
    } catch (error) {
      setInlineError(
        error instanceof Error ? error.message : "Could not save that change.",
      );
    } finally {
      setBusy(false);
    }
  };
  const beginNoteEdit = (note: (typeof notes)[number]) => {
    setEditingNoteId(note.id);
    setNoteEditBody(note.body);
    setNoteEditRevision(note.revision);
    setNoteEditConflict(false);
    setInlineError("");
  };
  const saveNoteEdit = async (
    note: (typeof notes)[number],
    expectedRevision: number,
  ) => {
    const body = noteEditBody.trim();
    if (!body || body.length > 1000) {
      setInlineError("Write a journal entry of 1 to 1000 characters.");
      return;
    }
    setNoteEditSaving(true);
    setInlineError("");
    try {
      await act("edit_beacon_note", {
        id: note.id,
        body,
        expected_revision: expectedRevision,
      });
      setEditingNoteId(null);
      setNoteEditBody("");
      setNoteEditRevision(null);
      setNoteEditConflict(false);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Could not save that note.";
      setInlineError(message);
      if (message.toLowerCase().includes("changed")) setNoteEditConflict(true);
      // Refresh the shared version but keep the user's current draft and revision.
      await refresh().catch(() => undefined);
    } finally {
      setNoteEditSaving(false);
    }
  };
  const authorName = (authorId: string) => {
    if (authorId === userId) return "You";
    return (
      data.profiles.find((profile) => profile.id === authorId)?.name ??
      (authorId === activity.owner_id ? "Beacon host" : "A participant")
    );
  };
  const deleteChecklist = (authorId: string) =>
    checklistEditable &&
    !!userId &&
    canDeleteBeaconModuleEntry(data, activity, authorId, userId);
  const deleteNote = (authorId: string) =>
    journalEnabled && !!userId && canDeleteBeaconModuleEntry(data, activity, authorId, userId);
  const completedCount = checklist.filter((item) => item.completed).length;
  const remaining = timer.remainingSeconds;
  const timerActionTitle =
    timer.phase === "running"
      ? "Pause focus timer"
      : timer.phase === "paused"
        ? "Resume focus timer"
        : timer.phase === "complete"
              ? "Focus timer complete"
          : "Start focus timer";

  return (
    <View style={{ gap: 10 }}>
      {allowed ? (
        <>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${activeSection === "checklist" ? "Collapse" : "Expand"} checklist`}
              accessibilityState={{ expanded: activeSection === "checklist" }}
              onPress={() => setActiveSection((open) => open === "checklist" ? null : "checklist")}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <ListChecks size={21} color={colors.green} />
              <Text style={[styles.h2, { flex: 1 }]}>Checklist</Text>
              <Text style={styles.muted}>
                {checklist.length}/50 · {completedCount} done
              </Text>
              {activeSection === "checklist" ? (
                <ChevronUp size={20} color={colors.muted} />
              ) : (
                <ChevronDown size={20} color={colors.muted} />
              )}
            </Pressable>
            {activeSection === "checklist" && (
              <View style={{ gap: 8 }}>
                {!checklistEnabled && (
                  <Txt muted>The checklist is paused by the host. Existing items stay visible, read-only.</Txt>
                )}
                {!checklist.length && (
                  <Txt muted>No checklist items yet. Add the first one.</Txt>
                )}
                {checklist.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                    }}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${item.completed ? "Uncheck" : "Check"} ${item.text}`}
                      accessibilityState={{
                        checked: item.completed,
                        disabled: !checklistEditable || busy,
                      }}
                      disabled={!checklistEditable || busy}
                      onPress={() =>
                        void inlineAction("toggle_checklist_item", {
                          id: item.id,
                          completed: !item.completed,
                        })
                      }
                      style={({ pressed }) => ({
                        minHeight: 44,
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        opacity: pressed ? 0.75 : 1,
                      })}
                    >
                      {item.completed ? (
                        <Check size={20} color={colors.green} />
                      ) : (
                        <Circle size={20} color={colors.muted} />
                      )}
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text
                          style={[
                            styles.body,
                            item.completed && {
                              color: colors.muted,
                              textDecorationLine: "line-through",
                            },
                          ]}
                        >
                          {item.text}
                        </Text>
                        <Text style={styles.muted}>{authorName(item.author_id)}</Text>
                      </View>
                    </Pressable>
                    {deleteChecklist(item.author_id) && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete checklist item: ${item.text}`}
                        accessibilityState={{ disabled: busy }}
                        disabled={busy}
                        onPress={() =>
                          void inlineAction("delete_checklist_item", {
                            id: item.id,
                          })
                        }
                        style={({ pressed }) => ({
                          width: 44,
                          height: 44,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: pressed ? 0.65 : 1,
                        })}
                      >
                        <Trash size={18} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>
                ))}
                {checklistEditable && checklist.length < 50 && (
                  <>
                    <Field
                      label="Add a checklist item"
                      value={checklistText}
                      onChangeText={(text) => {
                        setChecklistText(text);
                        setChecklistDraftId(Crypto.randomUUID());
                      }}
                      placeholder="What should everyone remember?"
                      maxLength={160}
                      returnKeyType="done"
                      editable={!checklistSaving}
                    />
                    <Action
                      title="Add item"
                      secondary
                      disabled={!checklistText.trim() || checklistSaving}
                      run={async () => {
                        const text = checklistText.trim();
                        if (!text) throw new Error("Write a checklist item first.");
                        setChecklistSaving(true);
                        try {
                          await act("add_checklist_item", {
                            activity_id: activity.id,
                            text,
                            id: checklistDraftId,
                          });
                          setChecklistText("");
                          setChecklistDraftId(Crypto.randomUUID());
                        } finally {
                          setChecklistSaving(false);
                        }
                      }}
                    />
                  </>
                )}
                {activity.status === "completed" && (
                  <Txt muted>The checklist is read-only after the beacon.</Txt>
                )}
                {activity.status === "cancelled" && (
                  <Txt muted>Cancelled beacon tools are read-only.</Txt>
                )}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${activeSection === "journal" ? "Collapse" : "Expand"} journal`}
              accessibilityState={{ expanded: activeSection === "journal" }}
              onPress={() => setActiveSection((open) => open === "journal" ? null : "journal")}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <StickyNote size={20} color={colors.green} />
              <Text style={[styles.h2, { flex: 1 }]}>Journal</Text>
              <Text style={styles.muted}>{notes.length}/50</Text>
              {activeSection === "journal" ? (
                <ChevronUp size={20} color={colors.muted} />
              ) : (
                <ChevronDown size={20} color={colors.muted} />
              )}
            </Pressable>
            {activeSection === "journal" && (
              <View style={{ gap: 10 }}>
                <Txt muted>Shared with approved beacon participants. Keep it short and useful to the group.</Txt>
                {!journalEnabled && (
                  <Txt muted>The journal is paused by the host. Existing notes stay visible, read-only.</Txt>
                )}
                {!notes.length && (
                  <Txt muted>No notes yet. Keep a short detail to remember.</Txt>
                )}
                {notes.map((note) => {
                  const editing = editingNoteId === note.id;
                  return (
                  <View
                    key={note.id}
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                      paddingTop: 9,
                      gap: 4,
                    }}
                  >
                    <View style={styles.between}>
                      <Text style={styles.muted}>
                        {authorName(note.author_id)} · {new Date(note.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Text>
                      {note.author_id === userId && notesWritable && !editing && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Edit your journal entry"
                          accessibilityState={{ disabled: noteEditSaving || busy }}
                          disabled={noteEditSaving || busy}
                          onPress={() => beginNoteEdit(note)}
                          style={({ pressed }) => ({
                            width: 44,
                            height: 44,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.65 : 1,
                          })}
                        >
                          <Pencil size={18} color={colors.green} />
                        </Pressable>
                      )}
                      {deleteNote(note.author_id) && !editing && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Delete shared note"
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() =>
                            void inlineAction("delete_beacon_note", {
                              id: note.id,
                            })
                          }
                          style={({ pressed }) => ({
                            width: 44,
                            height: 44,
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: pressed ? 0.65 : 1,
                          })}
                        >
                          <Trash size={18} color={colors.muted} />
                        </Pressable>
                      )}
                    </View>
                    {editing ? (
                      <View style={{ gap: 8 }}>
                        <Field
                          label="Edit your journal entry"
                          value={noteEditBody}
                          onChangeText={setNoteEditBody}
                          maxLength={1000}
                          multiline
                          editable={!noteEditSaving}
                        />
                        {noteEditConflict && (
                          <View style={[styles.card, { padding: 12 }]}>
                            <Txt muted>The shared version changed. Your draft is still here.</Txt>
                            <Text style={styles.body}>{note.body}</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              <Button
                                title="Use shared version"
                                compact
                                secondary
                                onPress={() => {
                                  setNoteEditBody(note.body);
                                  setNoteEditRevision(note.revision);
                                  setNoteEditConflict(false);
                                  setInlineError("");
                                }}
                              />
                              <Button
                                title="Save my draft as latest"
                                compact
                                disabled={noteEditSaving || !notesWritable || activity.status === "cancelled"}
                                onPress={() => {
                                  setNoteEditRevision(note.revision);
                                  void saveNoteEdit(note, note.revision);
                                }}
                              />
                            </View>
                          </View>
                        )}
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Button
                            title="Save edit"
                            compact
                            disabled={noteEditSaving || !notesWritable || !noteEditBody.trim()}
                            onPress={() =>
                              void saveNoteEdit(note, noteEditRevision ?? note.revision)
                            }
                          />
                          <Button
                            title="Cancel edit"
                            compact
                            secondary
                            disabled={noteEditSaving}
                            onPress={() => {
                              setEditingNoteId(null);
                              setNoteEditConflict(false);
                              setInlineError("");
                            }}
                          />
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.body}>{note.body}</Text>
                    )}
                  </View>
                  );
                })}
                {notesWritable && notes.length < 50 && (
                  <>
                    <Field
                      label="Add a journal entry"
                      value={noteBody}
                      onChangeText={(body) => {
                        setNoteBody(body);
                        setNoteDraftId(Crypto.randomUUID());
                      }}
                      placeholder="A detail to remember about this beacon"
                      maxLength={1000}
                      multiline
                      editable={!noteSaving}
                    />
                    <Action
                      title="Add entry"
                      secondary
                      disabled={!noteBody.trim() || noteSaving}
                      run={async () => {
                        const body = noteBody.trim();
                        if (!body) throw new Error("Write a short note first.");
                        setNoteSaving(true);
                        try {
                          await act("add_beacon_note", {
                            activity_id: activity.id,
                            body,
                            id: noteDraftId,
                          });
                          setNoteBody("");
                          setNoteDraftId(Crypto.randomUUID());
                        } finally {
                          setNoteSaving(false);
                        }
                      }}
                    />
                  </>
                )}
                {activity.status === "completed" && (
                  <Txt muted>Add a note to keep a memory. Checklist changes are closed.</Txt>
                )}
                {activity.status === "cancelled" && (
                  <Txt muted>Cancelled beacon notes are read-only.</Txt>
                )}
              </View>
            )}
          </View>
          {!!inlineError && (
            <Text accessibilityRole="alert" style={styles.error}>
              {inlineError}
            </Text>
          )}
        </>
      ) : (
        <View style={styles.card}>
          <Txt muted>
            Shared checklist and notes are available to approved beacon participants.
          </Txt>
        </View>
      )}

      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${activeSection === "focus" ? "Collapse" : "Expand"} local focus timer`}
          accessibilityState={{ expanded: activeSection === "focus" }}
          onPress={() => setActiveSection((open) => open === "focus" ? null : "focus")}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Timer size={20} color={colors.green} />
          <Text style={[styles.h2, { flex: 1 }]}>Focus timer</Text>
          {activeSection === "focus" ? (
            <ChevronUp size={20} color={colors.muted} />
          ) : (
            <ChevronDown size={20} color={colors.muted} />
          )}
        </Pressable>
        {activeSection === "focus" && (
          <View style={{ gap: 10, alignItems: "flex-start" }}>
            {!focusEnabled ? (
              <Txt muted>The focus timer is paused by the host. It will stay paused until re-enabled.</Txt>
            ) : (
              <>
            <Text
              accessibilityLabel={`${formatTime(remaining)} remaining`}
              style={{
                color: colors.ink,
                fontSize: 38,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatTime(remaining)}
            </Text>
            <Txt muted>
              25-minute focus · On this device only · Resets when you leave this beacon.
            </Txt>
            {timer.phase === "complete" && <Txt>Focus complete. Nice work.</Txt>}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={timerActionTitle}
                accessibilityState={{ disabled: timer.phase === "complete" }}
                disabled={timer.phase === "complete"}
                onPress={() =>
                  setTimer((current) =>
                    current.phase === "running"
                      ? pauseFocusTimer(current, Date.now())
                      : startFocusTimer(current, Date.now()),
                  )
                }
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.green,
                  backgroundColor: colors.lime,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                {timer.phase === "running" ? (
                  <Pause size={17} color={colors.ink} />
                ) : (
                  <Play size={17} color={colors.ink} />
                )}
                <Text style={{ color: colors.ink, fontWeight: "700" }}>
                  {timer.phase === "running"
                    ? "Pause"
                    : timer.phase === "paused"
                      ? "Resume"
                      : timer.phase === "complete"
                        ? "Done"
                        : "Start"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset focus timer"
                onPress={() => setTimer((current) => resetFocusTimer(current))}
                style={({ pressed }) => ({
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.line,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <RotateCcw size={18} color={colors.green} />
              </Pressable>
            </View>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
