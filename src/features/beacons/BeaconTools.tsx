import React, { useEffect, useRef, useState } from "react";
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
  canReadBeaconNote,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import {
  canManageBeacon,
  isApprovedGoing,
  isBeaconModuleEnabled,
} from "@/src/features/beacons/permissions";
import {
  createFocusTimer,
  pauseFocusTimer,
  startFocusTimer,
  tickFocusTimer,
} from "@/src/features/beacons/focusTimer";
import { canViewProfile } from "@/src/features/profile/privacy";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Chips, Field, Sheet, Txt, useTheme } from "@/src/shared/ui";
import type { Activity, BeaconChecklistItem, BeaconChecklistSection, Payload } from "@/src/shared/types";

type ToolSection = "checklist" | "journal" | "focus";
type TimerMode = "Standard" | "Pomodoro";
type PomodoroPhase = "Focus" | "Break";

function formatTime(seconds: number) {
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" +
    String(seconds % 60).padStart(2, "0");
}

export function BeaconTools({ activity }: { activity: Activity }) {
  const { colors, styles } = useTheme();
  const { data, userId, act, refresh } = useBeacon();
  const checklistEnabled = isBeaconModuleEnabled(activity, "checklist");
  const journalEnabled = isBeaconModuleEnabled(activity, "journal");
  const focusEnabled = isBeaconModuleEnabled(activity, "focus");
  const enabledSections: ToolSection[] = [];
  if (checklistEnabled) enabledSections.push("checklist");
  if (journalEnabled) enabledSections.push("journal");
  if (focusEnabled) enabledSections.push("focus");
  const [activeSection, setActiveSection] = useState<ToolSection | null>(
    enabledSections[0] ?? null,
  );
  const displayedSection = enabledSections.includes(activeSection as ToolSection)
    ? activeSection
    : enabledSections[0] ?? null;

  const [checklistText, setChecklistText] = useState("");
  const [checklistDraftId, setChecklistDraftId] = useState(() => Crypto.randomUUID());
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [sectionText, setSectionText] = useState("");
  const [sectionDraftId, setSectionDraftId] = useState(() => Crypto.randomUUID());
  const [sectionBusy, setSectionBusy] = useState(false);
  const [newItemSectionId, setNewItemSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<BeaconChecklistItem | null>(null);
  const [itemText, setItemText] = useState("");
  const [itemSectionId, setItemSectionId] = useState<string | null>(null);
  const [itemAssigneeId, setItemAssigneeId] = useState<string | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<BeaconChecklistSection | null>(null);
  const [sectionEditTitle, setSectionEditTitle] = useState("");
  const [sectionEditBusy, setSectionEditBusy] = useState(false);

  const [noteBody, setNoteBody] = useState<string | null>(null);
  const [noteHeading, setNoteHeading] = useState<string | null>(null);
  const [noteVisibility, setNoteVisibility] = useState<"private" | "shared" | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  const [timerMode, setTimerMode] = useState<TimerMode>("Pomodoro");
  const [standardMinutes, setStandardMinutes] = useState("25");
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>("Focus");
  const [timer, setTimer] = useState(() => createFocusTimer());
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const ensuredCopyActivity = useRef<string | null>(null);

  const allowed = !!userId && canUseBeaconModules(data, activity, userId);
  const checklistEditable =
    checklistEnabled &&
    !!userId &&
    canEditBeaconChecklist(data, activity, userId);
  const notesWritable =
    journalEnabled && !!userId && canAddBeaconNote(data, activity, userId);
  const canManage = !!userId && canManageBeacon(data, activity, userId);
  const sections = allowed
    ? data.beacon_checklist_sections
        .filter((section) => section.activity_id === activity.id)
        .sort((left, right) => left.position - right.position)
    : [];
  const checklist = allowed
    ? data.beacon_checklist_items
        .filter(
          (item) =>
            item.activity_id === activity.id &&
            canReadBeaconModuleEntry(data, activity, item.author_id, userId!),
        )
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
    : [];
  const notes = allowed
    ? data.beacon_notes
        .filter(
          (note) =>
            note.activity_id === activity.id &&
            canReadBeaconNote(data, note, userId!),
        )
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
    : [];
  const ownNote = notes.find((note) => note.author_id === userId);
  const approvedIds = [
    ...new Set([
      activity.owner_id,
      ...data.rsvps
        .filter(
          (rsvp) =>
            rsvp.activity_id === activity.id &&
            isApprovedGoing(activity, rsvp),
        )
        .map((rsvp) => rsvp.user_id),
    ]),
  ];
  const assignees = approvedIds.map((id) => {
    const profile = data.profiles.find((item) => item.id === id);
    const visible =
      !!profile &&
      !!userId &&
      (id === userId || canViewProfile(data, profile, userId));
    return {
      id,
      label: id === userId ? "You" : visible ? profile?.name ?? "Participant" : "Participant",
    };
  });
  const completedCount = checklist.filter((item) => item.completed).length;
  const remaining = timer.remainingSeconds;
  const timerActionTitle =
    timer.phase === "running"
      ? "Pause timer"
      : timer.phase === "paused"
        ? "Resume timer"
        : timer.phase === "complete"
          ? "Timer complete"
          : "Start timer";
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

  useEffect(() => {
    if (
      !allowed ||
      !checklistEnabled ||
      !userId ||
      ensuredCopyActivity.current === activity.id
    )
      return;
    ensuredCopyActivity.current = activity.id;
    void act("ensure_saved_checklist_copy", { activity_id: activity.id })
      .catch(() => undefined);
  }, [act, activity.id, allowed, checklistEnabled, userId]);

  const run = async (action: string, payload: Payload) => {
    setBusy(true);
    setInlineError("");
    try {
      await act(action, payload);
    } catch (failure) {
      setInlineError(
        failure instanceof Error ? failure.message : "Could not save that change.",
      );
    } finally {
      setBusy(false);
    }
  };
  const noteAuthorName = (authorId: string) => {
    if (authorId === userId) return "You";
    const profile = data.profiles.find((item) => item.id === authorId);
    return profile && userId && canViewProfile(data, profile, userId)
      ? profile.name
      : "Beacon participant";
  };
  const canEditItem = (item: BeaconChecklistItem) =>
    checklistEditable &&
    (activity.checklist_edit_policy !== "managers" ||
      canManage ||
      item.author_id === userId);
  const deleteItem = (authorId: string) =>
    !!userId &&
    canDeleteBeaconModuleEntry(data, activity, authorId, userId);
  const openEditItem = (item: BeaconChecklistItem) => {
    setEditingItem(item);
    setItemText(item.text);
    setItemSectionId(item.section_id);
    setItemAssigneeId(item.assignee_id);
    setInlineError("");
  };
  const saveItemEdit = async () => {
    if (!editingItem || !itemText.trim()) {
      setInlineError("Write a checklist item first.");
      return;
    }
    setItemSaving(true);
    setInlineError("");
    try {
      await act("edit_checklist_item", {
        id: editingItem.id,
        text: itemText.trim(),
        section_id: itemSectionId,
        assignee_id: itemAssigneeId,
      });
      setEditingItem(null);
    } catch (failure) {
      setInlineError(failure instanceof Error ? failure.message : "Could not edit that item.");
    } finally {
      setItemSaving(false);
    }
  };
  const saveNote = async () => {
    const body = (noteBody ?? ownNote?.body ?? "").trim();
    const heading = (noteHeading ?? ownNote?.section_heading ?? "").trim();
    if (!body || body.length > 1000) {
      setNoteError("Write a Beacon Note of 1 to 1000 characters.");
      return;
    }
    if (!notesWritable || !userId) {
      setNoteError("You need current access to save a Beacon Note.");
      return;
    }
    setNoteSaving(true);
    setNoteError("");
    try {
      await act("save_beacon_note", {
        activity_id: activity.id,
        id: ownNote?.id,
        section_heading: heading,
        body,
        visibility: noteVisibility ?? ownNote?.visibility ?? "private",
        expected_revision: ownNote?.revision,
      });
      setNoteBody(null);
      setNoteHeading(null);
      setNoteVisibility(null);
    } catch (failure) {
      setNoteError(failure instanceof Error ? failure.message : "Could not save your Beacon Note.");
      await refresh().catch(() => undefined);
    } finally {
      setNoteSaving(false);
    }
  };
  const changeNoteVisibility = async (value: "private" | "shared") => {
    setNoteVisibility(value);
    if (!ownNote || ownNote.visibility === value || !userId) return;
    setNoteSaving(true);
    setNoteError("");
    try {
      await act("set_beacon_note_visibility", {
        id: ownNote.id,
        visibility: value,
        expected_revision: ownNote.revision,
      });
    } catch (failure) {
      setNoteError(failure instanceof Error ? failure.message : "Could not change Beacon Note visibility.");
      setNoteVisibility(ownNote.visibility);
      await refresh().catch(() => undefined);
    } finally {
      setNoteSaving(false);
    }
  };
  const resetTimer = () => {
    setPomodoroPhase("Focus");
    const duration = timerMode === "Pomodoro"
      ? 25 * 60
      : Math.max(1, Math.min(1440, Number(standardMinutes) || 25)) * 60;
    setTimer(createFocusTimer(duration));
  };
  const switchTimerMode = (mode: TimerMode) => {
    setTimerMode(mode);
    setPomodoroPhase("Focus");
    const duration = mode === "Pomodoro"
      ? 25 * 60
      : Math.max(1, Math.min(1440, Number(standardMinutes) || 25)) * 60;
    setTimer(createFocusTimer(duration));
  };
  const startNextPomodoroPhase = () => {
    const nextPhase: PomodoroPhase = pomodoroPhase === "Focus" ? "Break" : "Focus";
    const nextTimer = createFocusTimer((nextPhase === "Break" ? 5 : 25) * 60);
    setPomodoroPhase(nextPhase);
    setTimer(startFocusTimer(nextTimer, Date.now()));
  };

  return (
    <View style={{ gap: 10 }}>
      {allowed && checklistEnabled ? (
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={(displayedSection === "checklist" ? "Collapse" : "Expand") + " checklist"}
            accessibilityState={{ expanded: displayedSection === "checklist" }}
            onPress={() =>
              setActiveSection((current) =>
                current === "checklist" ? null : "checklist",
              )
            }
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
            {displayedSection === "checklist" ? (
              <ChevronUp size={20} color={colors.muted} />
            ) : (
              <ChevronDown size={20} color={colors.muted} />
            )}
          </Pressable>
          {displayedSection === "checklist" ? (
            <View style={{ gap: 9 }}>
              {canManage && activity.status === "scheduled" ? (
                <View style={{ gap: 5 }}>
                  <Text style={styles.label}>Who can edit checklist items?</Text>
                  <Chips
                    accessibilityPrefix="Checklist editors"
                    options={["Participants", "Managers"]}
                    value={activity.checklist_edit_policy === "managers" ? "Managers" : "Participants"}
                    onChange={(choice) =>
                      void run("set_checklist_edit_policy", {
                        activity_id: activity.id,
                        policy: choice === "Managers" ? "managers" : "participants",
                      })
                    }
                  />
                </View>
              ) : null}
              {sections.map((section) => {
                const items = checklist.filter(
                  (item) => item.section_id === section.id,
                );
                return (
                  <View key={section.id} style={{ gap: 5 }}>
                    <View style={[styles.row, { minHeight: 44 }]}>
                      <Text style={[styles.label, { flex: 1 }]}>{section.title}</Text>
                      {checklistEditable ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={"Edit section " + section.title}
                          onPress={() => {
                            setEditingSection(section);
                            setSectionEditTitle(section.title);
                          }}
                          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                        >
                          <Pencil size={17} color={colors.green} />
                        </Pressable>
                      ) : null}
                      {checklistEditable ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={"Delete section " + section.title}
                          onPress={() => void run("delete_checklist_section", { id: section.id })}
                          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                        >
                          <Trash size={17} color={colors.muted} />
                        </Pressable>
                      ) : null}
                    </View>
                    {items.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        activity={activity}
                        allowed={allowed}
                        editable={canEditItem(item)}
                        deletable={deleteItem(item.author_id)}
                        assignedName={
                          assignees.find((assignee) => assignee.id === item.assignee_id)?.label
                        }
                        authorName={noteAuthorName(item.author_id)}
                        busy={busy}
                        onToggle={() =>
                          void run("toggle_checklist_item", {
                            id: item.id,
                            completed: !item.completed,
                          })
                        }
                        onEdit={() => openEditItem(item)}
                        onDelete={() => void run("delete_checklist_item", { id: item.id })}
                      />
                    ))}
                  </View>
                );
              })}
              {(() => {
                const items = checklist.filter((item) => !item.section_id);
                if (!items.length && sections.length) return null;
                return (
                  <View style={{ gap: 5 }}>
                    {sections.length ? <Text style={styles.label}>Unsectioned</Text> : null}
                    {items.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        activity={activity}
                        allowed={allowed}
                        editable={canEditItem(item)}
                        deletable={deleteItem(item.author_id)}
                        assignedName={
                          assignees.find((assignee) => assignee.id === item.assignee_id)?.label
                        }
                        authorName={noteAuthorName(item.author_id)}
                        busy={busy}
                        onToggle={() =>
                          void run("toggle_checklist_item", {
                            id: item.id,
                            completed: !item.completed,
                          })
                        }
                        onEdit={() => openEditItem(item)}
                        onDelete={() => void run("delete_checklist_item", { id: item.id })}
                      />
                    ))}
                  </View>
                );
              })()}
              {!checklist.length ? <Txt muted>No checklist items yet.</Txt> : null}
              {checklistEditable && checklist.length < 50 ? (
                <>
                  {sections.length > 0 ? (
                    <Chips
                      accessibilityPrefix="Add item to section"
                      options={["Unsectioned", ...sections.map((section) => section.title)]}
                      value={
                        sections.find((section) => section.id === newItemSectionId)?.title ??
                        "Unsectioned"
                      }
                      onChange={(selection) =>
                        setNewItemSectionId(
                          sections.find((section) => section.title === selection)?.id ?? null,
                        )
                      }
                    />
                  ) : null}
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
                          section_id: newItemSectionId,
                        });
                        setChecklistText("");
                        setChecklistDraftId(Crypto.randomUUID());
                      } finally {
                        setChecklistSaving(false);
                      }
                    }}
                  />
                </>
              ) : null}
              {checklistEditable && sections.length < 20 ? (
                <View style={[styles.card, { padding: 11, gap: 7 }]}>
                  <Field
                    label="New checklist section"
                    value={sectionText}
                    onChangeText={(value) => {
                      setSectionText(value);
                      setSectionDraftId(Crypto.randomUUID());
                    }}
                    maxLength={80}
                  />
                  <Button
                    title="Add section"
                    secondary
                    disabled={sectionBusy || !sectionText.trim()}
                    onPress={async () => {
                      const title = sectionText.trim();
                      if (!title) return;
                      setSectionBusy(true);
                      try {
                        await act("add_checklist_section", {
                          activity_id: activity.id,
                          title,
                          id: sectionDraftId,
                        });
                        setSectionText("");
                        setSectionDraftId(Crypto.randomUUID());
                      } catch (failure) {
                        setInlineError(failure instanceof Error ? failure.message : "Could not add that section.");
                      } finally {
                        setSectionBusy(false);
                      }
                    }}
                  />
                </View>
              ) : null}
              {activity.status !== "scheduled" ? (
                <Txt muted>The checklist is read-only after this Beacon.</Txt>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {allowed && journalEnabled ? (
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={(displayedSection === "journal" ? "Collapse" : "Expand") + " Beacon Note"}
            accessibilityState={{ expanded: displayedSection === "journal" }}
            onPress={() =>
              setActiveSection((current) =>
                current === "journal" ? null : "journal",
              )
            }
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <StickyNote size={20} color={colors.green} />
            <Text style={[styles.h2, { flex: 1 }]}>Beacon Note</Text>
            <Text style={styles.muted}>{notes.length}/50</Text>
            {displayedSection === "journal" ? (
              <ChevronUp size={20} color={colors.muted} />
            ) : (
              <ChevronDown size={20} color={colors.muted} />
            )}
          </Pressable>
          {displayedSection === "journal" ? (
            <View style={{ gap: 9 }}>
              <Txt muted>
                Your note starts private. Share it with this Beacon only when you choose.
              </Txt>
              {notes.filter((note) => note.author_id !== userId || note.id !== ownNote?.id).map((note) => {
                const heading = note.section_heading?.trim();
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
                    <Text style={styles.muted}>
                      {noteAuthorName(note.author_id)} · {note.visibility === "private" ? "Private" : "Shared"} ·{" "}
                      {new Date(note.created_at).toLocaleDateString()}
                    </Text>
                    {heading ? <Text style={styles.label}>{heading}</Text> : null}
                    <Text style={styles.body}>{note.body}</Text>
                    {deleteNoteAllowed(note, userId, data, activity) ? (
                      <Button
                        compact
                        secondary
                        title="Delete Beacon Note"
                        onPress={() => void run("delete_beacon_note", { id: note.id })}
                      />
                    ) : null}
                  </View>
                );
              })}
              {ownNote || noteBody != null ? (
                <>
                  <Field
                    label="Note heading (optional)"
                    value={noteHeading ?? ownNote?.section_heading ?? ""}
                    onChangeText={setNoteHeading}
                    maxLength={80}
                  />
                  <Field
                    label="Your Beacon Note"
                    value={noteBody ?? ownNote?.body ?? ""}
                    onChangeText={setNoteBody}
                    placeholder="A detail you want to remember"
                    maxLength={1000}
                    multiline
                    editable={!noteSaving && notesWritable}
                  />
                  <Chips
                    accessibilityPrefix="Beacon Note visibility"
                    options={["Private", "Share with Beacon"]}
                    value={
                      (noteVisibility ?? ownNote?.visibility ?? "private") === "shared"
                        ? "Share with Beacon"
                        : "Private"
                    }
                    onChange={(choice) =>
                      void changeNoteVisibility(
                        choice === "Share with Beacon" ? "shared" : "private",
                      )
                    }
                  />
                  {ownNote && notesWritable ? (
                    <Action
                      title="Save Beacon Note"
                      secondary
                      disabled={noteSaving || !(noteBody ?? ownNote.body).trim()}
                      run={saveNote}
                    />
                  ) : null}
                </>
              ) : notesWritable && notes.length < 50 ? (
                <>
                  <Field
                    label="Note heading (optional)"
                    value={noteHeading ?? ""}
                    onChangeText={setNoteHeading}
                    maxLength={80}
                  />
                  <Field
                    label="Your Beacon Note"
                    value={noteBody ?? ""}
                    onChangeText={setNoteBody}
                    placeholder="A detail you want to remember"
                    maxLength={1000}
                    multiline
                  />
                  <Chips
                    accessibilityPrefix="Beacon Note visibility"
                    options={["Private", "Share with Beacon"]}
                    value={(noteVisibility ?? "private") === "shared" ? "Share with Beacon" : "Private"}
                    onChange={(choice) =>
                      setNoteVisibility(
                        choice === "Share with Beacon" ? "shared" : "private",
                      )
                    }
                  />
                  <Action
                    title="Save Beacon Note"
                    secondary
                    disabled={noteSaving || !(noteBody ?? "").trim()}
                    run={saveNote}
                  />
                </>
              ) : (
                <Txt muted>No Beacon Notes yet.</Txt>
              )}
              {noteError ? (
                <Text accessibilityRole="alert" style={styles.error}>{noteError}</Text>
              ) : null}
              {activity.status === "cancelled" ? (
                <Txt muted>Cancelled Beacon Notes are read-only.</Txt>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {focusEnabled ? (
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={(displayedSection === "focus" ? "Collapse" : "Expand") + " timer"}
            accessibilityState={{ expanded: displayedSection === "focus" }}
            onPress={() =>
              setActiveSection((current) =>
                current === "focus" ? null : "focus",
              )
            }
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Timer size={20} color={colors.green} />
            <Text style={[styles.h2, { flex: 1 }]}>Timer</Text>
            {displayedSection === "focus" ? (
              <ChevronUp size={20} color={colors.muted} />
            ) : (
              <ChevronDown size={20} color={colors.muted} />
            )}
          </Pressable>
          {displayedSection === "focus" ? (
            <View style={{ gap: 10, alignItems: "flex-start" }}>
              <Chips
                accessibilityPrefix="Timer mode"
                options={["Standard", "Pomodoro"]}
                value={timerMode}
                onChange={switchTimerMode}
              />
              {timerMode === "Standard" ? (
                <Field
                  label="Timer minutes"
                  value={standardMinutes}
                  onChangeText={(value) => setStandardMinutes(value.replace(/[^0-9]/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              ) : null}
              <Text
                accessibilityLabel={formatTime(remaining) + " remaining"}
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
                {timerMode === "Pomodoro"
                  ? "25-minute focus, then an optional 5-minute break."
                  : "Choose a duration for this local timer."}{" "}
                On this device only.
              </Txt>
              {timer.phase === "complete" ? (
                <Txt>
                  {timerMode === "Pomodoro"
                    ? pomodoroPhase === "Focus"
                      ? "Focus session complete."
                      : "Break complete."
                    : "Timer complete."}
                </Txt>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                        : "Start"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reset timer"
                  onPress={resetTimer}
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
                {timer.phase === "complete" && timerMode === "Pomodoro" ? (
                  <Button
                    secondary
                    title={pomodoroPhase === "Focus" ? "Start 5-minute break" : "Start next focus"}
                    onPress={startNextPomodoroPhase}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {!allowed && (checklistEnabled || journalEnabled) ? (
        <View style={styles.card}>
          <Txt muted>Join this Beacon to use its shared Checklist and Beacon Note.</Txt>
        </View>
      ) : null}
      {inlineError ? (
        <Text accessibilityRole="alert" style={styles.error}>{inlineError}</Text>
      ) : null}

      <Sheet
        title="Edit checklist item"
        visible={!!editingItem}
        onClose={() => setEditingItem(null)}
      >
        <Field
          label="Checklist item"
          value={itemText}
          onChangeText={setItemText}
          maxLength={160}
        />
        {sections.length ? (
          <Chips
            accessibilityPrefix="Move to section"
            options={["Unsectioned", ...sections.map((section) => section.title)]}
            value={
              sections.find((section) => section.id === itemSectionId)?.title ??
              "Unsectioned"
            }
            onChange={(selection) =>
              setItemSectionId(
                sections.find((section) => section.title === selection)?.id ?? null,
              )
            }
          />
        ) : null}
        <Txt muted>Assign to an approved participant</Txt>
        <Chips
          accessibilityPrefix="Assignee"
          options={["Unassigned", ...assignees.map((assignee) => assignee.label)]}
          value={
            assignees.find((assignee) => assignee.id === itemAssigneeId)?.label ??
            "Unassigned"
          }
          onChange={(selection) =>
            setItemAssigneeId(
              assignees.find((assignee) => assignee.label === selection)?.id ?? null,
            )
          }
        />
        <Button
          title="Save checklist item"
          disabled={itemSaving || !itemText.trim()}
          onPress={() => void saveItemEdit()}
        />
      </Sheet>
      <Sheet
        title="Edit checklist section"
        visible={!!editingSection}
        onClose={() => setEditingSection(null)}
      >
        <Field
          label="Section name"
          value={sectionEditTitle}
          onChangeText={setSectionEditTitle}
          maxLength={80}
        />
        <Button
          title="Save section"
          disabled={sectionEditBusy || !sectionEditTitle.trim()}
          onPress={async () => {
            if (!editingSection || !sectionEditTitle.trim()) return;
            setSectionEditBusy(true);
            try {
              await act("edit_checklist_section", {
                id: editingSection.id,
                title: sectionEditTitle.trim(),
              });
              setEditingSection(null);
            } catch (failure) {
              setInlineError(failure instanceof Error ? failure.message : "Could not edit that section.");
            } finally {
              setSectionEditBusy(false);
            }
          }}
        />
      </Sheet>
      <Txt muted>
        Shared tool access follows the Beacon’s current access and block settings.
      </Txt>
    </View>
  );
}

function ChecklistItemRow({
  item,
  activity,
  allowed,
  editable,
  deletable,
  assignedName,
  authorName,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: BeaconChecklistItem;
  activity: Activity;
  allowed: boolean;
  editable: boolean;
  deletable: boolean;
  assignedName?: string;
  authorName: string;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors, styles } = useTheme();
  return (
    <View
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      }}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={(item.completed ? "Uncheck " : "Check ") + item.text}
        accessibilityState={{
          checked: item.completed,
          disabled: !allowed || activity.status !== "scheduled" || busy,
        }}
        disabled={!allowed || activity.status !== "scheduled" || busy}
        onPress={onToggle}
        style={({ pressed }) => ({
          minHeight: 44,
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {item.completed ? (
          <Check size={19} color={colors.green} />
        ) : (
          <Circle size={19} color={colors.muted} />
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
          <Text style={styles.muted}>
            {assignedName ? "For " + assignedName + " · " : ""}
            {authorName}
          </Text>
        </View>
      </Pressable>
      {editable && activity.status === "scheduled" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Edit checklist item " + item.text}
          disabled={busy}
          onPress={onEdit}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Pencil size={17} color={colors.green} />
        </Pressable>
      ) : null}
      {deletable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Delete checklist item " + item.text}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onDelete}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Trash size={17} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function deleteNoteAllowed(
  note: { author_id: string; activity_id: string | null; visibility: "private" | "shared" },
  userId: string | null,
  data: ReturnType<typeof useBeacon>["data"],
  activity: Activity,
) {
  return !!(
    userId &&
    note.activity_id === activity.id &&
    canDeleteBeaconModuleEntry(data, activity, note.author_id, userId)
  );
}
