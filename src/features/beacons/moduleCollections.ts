import { canUseBeaconModules, canAddBeaconNote, canReadBeaconActivity, canReadBeaconModuleEntry, canReadBeaconNote, canEditBeaconChecklist } from "@/src/features/beacons/beaconModules";
import {
  canManageBeacon,
  canWriteBeaconModule,
  isBeaconModuleEnabled,
  isApprovedGoing,
} from "@/src/features/beacons/permissions";
import type { Data, Payload } from "@/src/shared/types";

type NewId = () => string;

const textValue = (value: unknown) => typeof value === "string" ? value.trim() : "";
function error(message: string): never {
  throw new Error(message);
}

/** Demo mirror of 002's private notes, checklist sections, saved Lists, and folders. */
export function applyDemoModuleCollectionAction(
  data: Data,
  action: string,
  payload: Payload,
  userId: string,
  newId: NewId,
): boolean {
  const activityId = String(payload.activity_id ?? ""),
    id = String(payload.id ?? ""),
    activity = data.activities.find((item) => item.id === activityId),
    now = () => new Date().toISOString();
  const canWriteNote = (sourceId: string | null) => {
    if (!sourceId) return true;
    const source = data.activities.find((item) => item.id === sourceId);
    return !!source && canWriteBeaconModule(data, source, userId, "journal") && canAddBeaconNote(data, source, userId);
  };
  const validNoteText = (body: string, heading: string) => {
    if (!body || body.length > 1000) error("Write a note of 1 to 1000 characters.");
    if (heading.length > 100) error("Keep the Journal heading under 100 characters.");
  };
  const itemVisible = (item: Data["beacon_checklist_items"][number]) => {
    const source = data.activities.find((entry) => entry.id === item.activity_id);
    return !!source && canReadBeaconModuleEntry(data, source, item.author_id, userId);
  };

  if (action === "save_beacon") {
    const targetId = activityId || id,
      saved = payload.saved === true;
    if (typeof payload.saved !== "boolean" || !targetId) error("Choose a Beacon to save.");
    if (saved && (!activity || !canReadBeaconActivityForDemo(data, activity, userId))) error("Beacon unavailable.");
    data.beacon_favorites = data.beacon_favorites.filter((item) => !(item.owner_id === userId && item.activity_id === targetId));
    if (saved) data.beacon_favorites.push({ owner_id: userId, activity_id: targetId, created_at: now() });
    return true;
  }

  if (action === "set_checklist_edit_policy") {
    const target = data.activities.find((item) => item.id === activityId || item.id === id),
      policy = payload.policy;
    if (!target || target.status !== "scheduled" || !canManageBeacon(data, target, userId)) error("Only a current Beacon manager can change checklist permissions.");
    if (policy !== "participants" && policy !== "managers") error("Choose who can edit this checklist.");
    target.checklist_edit_policy = policy;
    return true;
  }

  if (action === "create_journal_entry" || action === "add_beacon_note" || action === "save_beacon_note") {
    const sourceId = action === "create_journal_entry" ? null : (activityId || null),
      source = sourceId ? data.activities.find((item) => item.id === sourceId) : undefined,
      body = textValue(payload.body),
      heading = textValue(payload.section_heading),
      visibility = (payload.visibility ?? "private") as "private" | "shared",
      noteId = id || newId();
    if ((sourceId && (!source || !canWriteNote(sourceId))) || (visibility !== "private" && visibility !== "shared"))
      error("Join this Beacon before writing its Journal entry.");
    if (sourceId && source?.status === "cancelled") error("Cancelled Beacon history is read-only.");
    if (!sourceId && visibility !== "private") error("Standalone Journal entries stay private.");
    validNoteText(body, heading);
    const current = data.beacon_notes.find((note) => note.id === noteId);
    if (current) {
      if (current.author_id !== userId || current.activity_id !== sourceId) error("This Journal entry is unavailable.");
      const expected = Number(payload.expected_revision);
      if (current.body === body && current.section_heading === heading && current.visibility === visibility) return true;
      if (!Number.isInteger(expected) || expected < 0) error("Refresh the note before editing it.");
      if (current.revision !== expected) error("This note changed. Your draft is still here; refresh before saving.");
      current.body = body;
      current.section_heading = heading;
      current.visibility = visibility;
      current.revision += 1;
      current.updated_at = now();
      return true;
    }
    if (action === "save_beacon_note" && payload.expected_revision != null) error("This Journal entry is unavailable.");
    if (sourceId && data.beacon_notes.filter((note) => note.activity_id === sourceId).length >= 50) error("This Beacon already has 50 Journal entries.");
    data.beacon_notes.push({
      id: noteId,
      activity_id: sourceId,
      author_id: userId,
      body,
      section_heading: heading,
      visibility,
      revision: 0,
      created_at: now(),
      updated_at: now(),
    });
    return true;
  }

  if (action === "edit_beacon_note" || action === "set_beacon_note_visibility") {
    const note = data.beacon_notes.find((entry) => entry.id === id);
    if (!note || note.author_id !== userId) error("Only your own note can be changed.");
    if (note.activity_id && !canWriteNote(note.activity_id)) error("This Beacon Journal is paused or unavailable.");
    if (action === "set_beacon_note_visibility") {
      const visibility = payload.visibility;
      if (visibility !== "private" && visibility !== "shared") error("Choose private or shared.");
      if (!note.activity_id && visibility !== "private") error("Standalone Journal entries stay private.");
      const expected = Number(payload.expected_revision);
      if (note.revision === expected + 1 && note.visibility === visibility) return true;
      if (!Number.isInteger(expected) || expected < 0 || note.revision !== expected) error("This note changed. Refresh before changing its sharing setting.");
      note.visibility = visibility;
      note.revision += 1;
      note.updated_at = now();
      return true;
    }
    const body = textValue(payload.body),
      heading = payload.section_heading == null ? note.section_heading : textValue(payload.section_heading),
      visibility = (payload.visibility ?? note.visibility) as "private" | "shared",
      expected = Number(payload.expected_revision);
    validNoteText(body, heading);
    if (visibility !== "private" && visibility !== "shared") error("Choose a valid sharing setting.");
    if (!note.activity_id && visibility !== "private") error("Standalone Journal entries stay private.");
    if (note.body === body && note.section_heading === heading && note.visibility === visibility && note.revision === expected + 1) return true;
    if (!Number.isInteger(expected) || expected < 0 || note.revision !== expected) error("This note changed. Your draft is still here; refresh before saving.");
    note.body = body;
    note.section_heading = heading;
    note.visibility = visibility;
    note.revision += 1;
    note.updated_at = now();
    return true;
  }

  if (action === "delete_beacon_note") {
    const note = data.beacon_notes.find((entry) => entry.id === id);
    if (!note) error("Note unavailable.");
    if (note.author_id !== userId) {
      const source = data.activities.find((entry) => entry.id === note.activity_id);
      if (note.visibility !== "shared" || source?.owner_id !== userId || data.blocks.some((block) => block.blocked_id === note.author_id && block.blocker_id === userId || block.blocker_id === note.author_id && block.blocked_id === userId))
        error("Only the note author or Beacon host can delete a shared note.");
    } else if (note.activity_id && !canWriteNote(note.activity_id)) {
      error("This Beacon Journal is read-only or unavailable.");
    }
    data.beacon_notes = data.beacon_notes.filter((entry) => entry.id !== note.id);
    data.library_resource_folders = data.library_resource_folders.filter((entry) => !(entry.kind === "journal" && entry.resource_id === note.id));
    return true;
  }

  if (action === "ensure_saved_checklist_copy") {
    if (!activity || !canUseBeaconModules(data, activity, userId) || !isBeaconModuleEnabled(activity, "checklist")) error("This Beacon checklist is unavailable.");
    const existing = data.library_saved_checklists.find((list) => list.owner_id === userId && list.source_activity_id === activity.id);
    if (existing) return true;
    const sections = data.beacon_checklist_sections.filter((item) => item.activity_id === activity.id).map((item) => ({ id: item.id, title: item.title, position: item.position }));
    const items = data.beacon_checklist_items.filter((item) => item.activity_id === activity.id && itemVisible(item)).map((item) => ({ id: item.id, text: item.text, completed: item.completed, section_id: item.section_id, assignee_id: item.assignee_id }));
    data.library_saved_checklists.push({ id: newId(), owner_id: userId, source_activity_id: activity.id, title: activity.title.slice(0, 120), sections, items, revision: 0, created_at: now(), updated_at: now() });
    return true;
  }

  if (action === "save_library_checklist") {
    const listId = id || newId(),
      title = textValue(payload.title),
      sections = Array.isArray(payload.sections) ? payload.sections as Data["library_saved_checklists"][number]["sections"] : [],
      items = Array.isArray(payload.items) ? payload.items as Data["library_saved_checklists"][number]["items"] : [],
      existing = data.library_saved_checklists.find((list) => list.id === listId);
    if (!title || title.length > 120 || sections.length > 30 || items.length > 50) error("Checklists need a title, up to 30 sections, and 50 items.");
    if (new Set(sections.map((item) => item.id)).size !== sections.length || sections.some((item) => !item.id || !item.title.trim() || item.title.length > 80 || !Number.isInteger(item.position) || item.position < 0 || item.position > 29)) error("Choose valid, uniquely identified checklist sections.");
    if (new Set(items.map((item) => item.id)).size !== items.length || items.some((item) => !item.id || !item.text.trim() || item.text.length > 160 || (item.section_id != null && !sections.some((section) => section.id === item.section_id)))) error("Choose valid checklist items and section assignments.");
    if (existing) {
      if (existing.owner_id !== userId) error("This saved List is unavailable.");
      const expected = Number(payload.expected_revision);
      if (JSON.stringify([existing.title, existing.sections, existing.items]) === JSON.stringify([title, sections, items]) && existing.revision === expected + 1) return true;
      if (!Number.isInteger(expected) || expected < 0 || existing.revision !== expected) error("This List changed elsewhere. Refresh before saving.");
      existing.title = title;
      existing.sections = structuredClone(sections);
      existing.items = structuredClone(items);
      existing.revision += 1;
      existing.updated_at = now();
    } else {
      if (payload.expected_revision != null) error("This saved List is unavailable.");
      data.library_saved_checklists.push({ id: listId, owner_id: userId, source_activity_id: null, title, sections: structuredClone(sections), items: structuredClone(items), revision: 0, created_at: now(), updated_at: now() });
    }
    return true;
  }

  if (action === "delete_saved_checklist") {
    const list = data.library_saved_checklists.find((item) => item.id === id && item.owner_id === userId);
    if (!list) error("Saved List unavailable.");
    data.library_saved_checklists = data.library_saved_checklists.filter((item) => item.id !== list.id);
    data.library_resource_folders = data.library_resource_folders.filter((item) => !(item.kind === "checklist" && item.resource_id === list.id));
    return true;
  }

  if (action === "apply_saved_checklist_to_beacon") {
    const target = data.activities.find((item) => item.id === activityId),
      listId = String(payload.saved_checklist_id ?? ""),
      list = data.library_saved_checklists.find((item) => item.id === listId && item.owner_id === userId);
    if (!target || !list || target.owner_id !== userId || target.status !== "scheduled") error("Only a host can reuse their own List on a scheduled Beacon.");
    if (data.beacon_checklist_items.some((item) => item.activity_id === target.id) || data.beacon_checklist_sections.some((item) => item.activity_id === target.id)) error("This Beacon already has a checklist. Clear it before applying a saved List.");
    const sectionsById = new Map<string, string>();
    target.enable_checklist = true;
    for (const section of list.sections) {
      const copiedId = newId();
      sectionsById.set(section.id, copiedId);
      data.beacon_checklist_sections.push({ id: copiedId, activity_id: target.id, title: section.title, position: section.position, created_at: now() });
    }
    for (const item of list.items) {
      const assigned = item.assignee_id && isApprovedGoing(target, data.rsvps.find((row) => row.activity_id === target.id && row.user_id === item.assignee_id)) ? item.assignee_id : null;
      data.beacon_checklist_items.push({ id: newId(), activity_id: target.id, author_id: userId, text: item.text, completed: false, section_id: item.section_id ? sectionsById.get(item.section_id) ?? null : null, assignee_id: assigned, created_at: now(), updated_at: now() });
    }
    return true;
  }

  if (action === "add_checklist_section" || action === "edit_checklist_section" || action === "delete_checklist_section") {
    const section = action === "add_checklist_section" ? undefined : data.beacon_checklist_sections.find((entry) => entry.id === id),
      target = section ? data.activities.find((entry) => entry.id === section.activity_id) : activity;
    if (!target || (section && section.activity_id !== target.id) || !canWriteBeaconModule(data, target, userId, "checklist") || !canEditBeaconChecklist(data, target, userId)) error("You cannot edit this checklist.");
    if (action !== "add_checklist_section" && !section) error("This checklist section is unavailable.");
    if (action === "add_checklist_section") {
      const title = textValue(payload.title), sectionId = id || newId(), list = data.beacon_checklist_sections.filter((entry) => entry.activity_id === target.id);
      if (!title || title.length > 80) error("Section titles must be 1 to 80 characters.");
      const duplicate = data.beacon_checklist_sections.find((entry) => entry.id === sectionId);
      if (duplicate) { if (duplicate.activity_id === target.id && duplicate.title === title) return true; error("This section ID is already in use."); }
      if (list.length >= 30) error("A checklist can have up to 30 sections.");
      data.beacon_checklist_sections.push({ id: sectionId, activity_id: target.id, title, position: list.length, created_at: now() });
    } else if (action === "edit_checklist_section") {
      if (!section) throw new Error("This checklist section is unavailable.");
      const title = payload.title == null ? section.title : textValue(payload.title);
      if (!title || title.length > 80) error("Section titles must be 1 to 80 characters.");
      section.title = title;
    } else {
      if (!section) throw new Error("This checklist section is unavailable.");
      data.beacon_checklist_items = data.beacon_checklist_items.map((item) => item.section_id === section.id ? { ...item, section_id: null, updated_at: now() } : item);
      data.beacon_checklist_sections = data.beacon_checklist_sections.filter((item) => item.id !== section.id);
      data.beacon_checklist_sections.filter((item) => item.activity_id === target.id).sort((a, b) => a.position - b.position).forEach((item, index) => { item.position = index; });
    }
    return true;
  }

  if (["add_checklist_item", "toggle_checklist_item", "edit_checklist_item", "delete_checklist_item"].includes(action)) {
    const item = action === "add_checklist_item" ? undefined : data.beacon_checklist_items.find((entry) => entry.id === id),
      target = item ? data.activities.find((entry) => entry.id === item.activity_id) : activity;
    if (!target || (item && !itemVisible(item)) || !canWriteBeaconModule(data, target, userId, "checklist") || !canEditBeaconChecklist(data, target, userId)) error("This checklist is unavailable or cannot be changed.");
    if (action !== "add_checklist_item" && !item) error("This checklist item is unavailable.");
    if (action === "delete_checklist_item") {
      if (!item) throw new Error("This checklist item is unavailable.");
      data.beacon_checklist_items = data.beacon_checklist_items.filter((entry) => entry.id !== item.id);
      return true;
    }
    if (action === "toggle_checklist_item") {
      if (!item) throw new Error("This checklist item is unavailable.");
      if (typeof payload.completed !== "boolean") error("Choose whether this checklist item is complete.");
      item.completed = payload.completed;
      item.updated_at = now();
      return true;
    }
    const text = textValue(payload.text ?? item?.text),
      sectionId = payload.section_id === undefined ? item?.section_id ?? null : payload.section_id == null || payload.section_id === "" ? null : String(payload.section_id),
      assigneeId = payload.assignee_id === undefined ? item?.assignee_id ?? null : payload.assignee_id == null || payload.assignee_id === "" ? null : String(payload.assignee_id);
    if (!text || text.length > 160) error("Checklist items must be 1 to 160 characters.");
    if (sectionId && !data.beacon_checklist_sections.some((entry) => entry.id === sectionId && entry.activity_id === target.id)) error("Choose a section from this checklist.");
    if (assigneeId && assigneeId !== target.owner_id) {
      const assignee = data.rsvps.find((rsvp) => rsvp.activity_id === target.id && rsvp.user_id === assigneeId);
      if (!isApprovedGoing(target, assignee) || !canReadBeaconActivityForDemo(data, target, assigneeId)) error("Assign items to an accepted Beacon participant.");
    }
    if (item) {
      item.text = text; item.section_id = sectionId; item.assignee_id = assigneeId; item.updated_at = now();
    } else {
      const itemId = id || newId(), duplicate = data.beacon_checklist_items.find((entry) => entry.id === itemId);
      if (duplicate) {
        if (duplicate.activity_id === target.id && duplicate.author_id === userId && duplicate.text === text && duplicate.section_id === sectionId && duplicate.assignee_id === assigneeId) return true;
        error("This item ID is already in use.");
      }
      if (data.beacon_checklist_items.filter((entry) => entry.activity_id === target.id).length >= 50) error("This Beacon already has 50 checklist items.");
      data.beacon_checklist_items.push({ id: itemId, activity_id: target.id, author_id: userId, text, completed: false, section_id: sectionId, assignee_id: assigneeId, created_at: now(), updated_at: now() });
    }
    return true;
  }

  if (action === "move_library_resource") {
    const kind = payload.kind,
      resourceId = String(payload.resource_id ?? ""),
      folderId = payload.folder_id == null ? null : String(payload.folder_id);
    if (kind !== "journal" && kind !== "checklist") error("Choose a private Library resource.");
    if (kind === "journal") {
      const note = data.beacon_notes.find((entry) => entry.id === resourceId && entry.author_id === userId);
      if (!note || !canReadBeaconNote(data, note, userId)) error("This Journal entry is unavailable.");
    } else if (!data.library_saved_checklists.some((entry) => entry.id === resourceId && entry.owner_id === userId)) error("This saved List is unavailable.");
    const folder = folderId ? data.library_folders.find((entry) => entry.id === folderId && entry.owner_id === userId && entry.kind === kind) : undefined;
    if (folderId && !folder) error("Choose one of your folders in this Library.");
    data.library_resource_folders = data.library_resource_folders.filter((entry) => !(entry.owner_id === userId && entry.kind === kind && entry.resource_id === resourceId));
    if (folderId) data.library_resource_folders.push({ owner_id: userId, kind, resource_id: resourceId, folder_id: folderId, updated_at: now() });
    return true;
  }

  if (action === "create_library_folder" || action === "rename_library_folder") {
    const kind = payload.kind,
      name = textValue(payload.name),
      parentId = payload.parent_id == null ? null : String(payload.parent_id),
      editing = action === "rename_library_folder",
      folder = editing ? data.library_folders.find((entry) => entry.id === id && entry.owner_id === userId && entry.kind === kind) : undefined;
    if (kind !== "journal" && kind !== "checklist") error("Choose Journals or Checklists for this folder.");
    if (editing && !folder) error("That private folder is unavailable.");
    if (!name || name.length > 40) error("Folder names must be 1 to 40 characters.");
    if (parentId && !data.library_folders.some((entry) => entry.id === parentId && entry.owner_id === userId && entry.kind === kind)) error("Choose a parent folder in this private library.");
    if (data.library_folders.some((entry) => entry.owner_id === userId && entry.kind === kind && entry.id !== folder?.id && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) error("You already have a folder with that name.");
    if (!editing) {
      const requestedId = id || null,
        existing = requestedId ? data.library_folders.find((entry) => entry.id === requestedId) : undefined;
      if (existing) {
        if (existing.owner_id === userId && existing.kind === kind && existing.name === name && existing.parent_id === parentId) return true;
        error("This folder ID is already in use.");
      }
      const sameName = data.library_folders.find((entry) => entry.owner_id === userId && entry.kind === kind && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      if (sameName) {
        if (!requestedId) return true;
        error("You already have a folder with that name.");
      }
      if (data.library_folders.filter((entry) => entry.owner_id === userId && entry.kind === kind).length >= 30) error("You can create up to 30 folders in each library.");
      const createdAt = now();
      data.library_folders.push({ id: requestedId ?? newId(), owner_id: userId, kind, name, parent_id: parentId, created_at: createdAt, updated_at: createdAt });
      return true;
    }
    if (!folder) throw new Error("That private folder is unavailable.");
    if (payload.parent_id !== undefined) {
      let cursor = parentId, depth = 1;
      while (cursor) {
        if (cursor === folder.id) error("Folders cannot contain themselves.");
        const parent = data.library_folders.find((entry) => entry.id === cursor && entry.owner_id === userId && entry.kind === kind);
        if (!parent) throw new Error("Choose a parent folder in this private library.");
        cursor = parent.parent_id;
        depth += 1;
        if (depth > 5) error("Folders can nest only five levels deep.");
      }
      folder.parent_id = parentId;
    }
    folder.name = name;
    folder.updated_at = now();
    return true;
  }

  if (action === "delete_library_folder") {
    const folder = data.library_folders.find((entry) => entry.id === id && entry.owner_id === userId);
    if (!folder) error("That private folder is unavailable.");
    data.library_folders = data.library_folders.filter((entry) => entry.id !== id);
    data.library_folders.forEach((entry) => { if (entry.parent_id === id) entry.parent_id = null; });
    data.library_folder_items = data.library_folder_items.filter((entry) => entry.folder_id !== id);
    data.library_resource_folders = data.library_resource_folders.filter((entry) => entry.folder_id !== id);
    return true;
  }

  if (action === "move_library_item") {
    const kind = payload.kind,
      targetId = String(payload.activity_id ?? ""),
      target = data.activities.find((entry) => entry.id === targetId),
      folderId = payload.folder_id == null ? null : String(payload.folder_id);
    if (!target || (kind !== "journal" && kind !== "checklist") || !canUseBeaconModules(data, target, userId)) error("This shared Beacon library is unavailable.");
    const folder = folderId ? data.library_folders.find((entry) => entry.id === folderId && entry.owner_id === userId && entry.kind === kind) : undefined;
    if (folderId && !folder) error("Choose one of your folders in this Library.");
    data.library_folder_items = data.library_folder_items.filter((entry) => !(entry.owner_id === userId && entry.kind === kind && entry.activity_id === targetId));
    if (folderId) data.library_folder_items.push({ owner_id: userId, kind, activity_id: targetId, folder_id: folderId, updated_at: now() });
    return true;
  }

  return false;
}

function canReadBeaconActivityForDemo(data: Data, activity: Data["activities"][number], userId: string) {
  return canReadBeaconActivity(data, activity, userId);
}
