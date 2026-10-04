import test from "node:test";
import assert from "node:assert/strict";
import {
  canReadBeaconNote,
} from "@/src/features/beacons/beaconModules";
import { demoAction, DEMO_ID, makeDemo } from "@/src/shared/demo";

test("Beacon Journal defaults private; shared entries require current authorized viewer", () => {
  const initial = makeDemo(),
    activity = initial.activities.find((item) => item.id === "demo-tools");
  assert.ok(activity);
  const privateData = demoAction(initial, "add_beacon_note", {
    activity_id: activity.id,
    id: "demo-private-journal-entry",
    body: "Personal memory.",
  });
  const privateNote = privateData.beacon_notes.find(
    (item) => item.id === "demo-private-journal-entry",
  );
  assert.ok(privateNote);
  assert.equal(privateNote.visibility, "private");
  assert.equal(canReadBeaconNote(privateData, privateNote, DEMO_ID), true);

  const sharedData = demoAction(privateData, "add_beacon_note", {
    activity_id: activity.id,
    id: "demo-shared-journal-entry",
    body: "Crew memory.",
    visibility: "shared",
  });
  const sharedNote = sharedData.beacon_notes.find(
    (item) => item.id === "demo-shared-journal-entry",
  );
  assert.ok(sharedNote);
  assert.equal(canReadBeaconNote(sharedData, sharedNote, DEMO_ID), true);

  const previousViewer = structuredClone(sharedData);
  previousViewer.viewer_id = "another-account";
  assert.equal(
    canReadBeaconNote(previousViewer, privateNote, DEMO_ID),
    false,
    "cached entries fail closed after the active viewer changes",
  );
});

test("automatic checklist copies never overwrite an edited personal List", () => {
  const initial = makeDemo(),
    activity = initial.activities.find((item) => item.id === "demo-tools");
  assert.ok(activity);
  const copied = demoAction(initial, "ensure_saved_checklist_copy", {
    activity_id: activity.id,
  });
  const saved = copied.library_saved_checklists.find(
    (item) => item.source_activity_id === activity.id,
  );
  assert.ok(saved);
  assert.equal(saved.owner_id, DEMO_ID);

  const edited = demoAction(copied, "save_library_checklist", {
    id: saved.id,
    title: "My packing list",
    sections: saved.sections,
    items: saved.items,
    expected_revision: saved.revision,
  });
  const retried = demoAction(edited, "ensure_saved_checklist_copy", {
    activity_id: activity.id,
  });
  const preserved = retried.library_saved_checklists.find(
    (item) => item.id === saved.id,
  );
  assert.equal(preserved?.title, "My packing list");
  assert.equal(preserved?.revision, saved.revision + 1);
  assert.equal(
    retried.library_saved_checklists.filter(
      (item) => item.source_activity_id === activity.id,
    ).length,
    1,
  );
});

test("private Library folders nest by kind, and moving an entry does not duplicate it", () => {
  const initial = makeDemo();
  const withNote = demoAction(initial, "create_journal_entry", {
    id: "demo-standalone-entry",
    body: "A personal note, not shared with the Beacon.",
  });
  const rootFolder = demoAction(withNote, "create_library_folder", {
    id: "demo-folder-root",
    kind: "journal",
    name: "Trips",
  });
  const childFolder = demoAction(rootFolder, "create_library_folder", {
    id: "demo-folder-child",
    kind: "journal",
    name: "Weekend",
    parent_id: "demo-folder-root",
  });
  assert.equal(
    childFolder.library_folders.find((item) => item.id === "demo-folder-child")
      ?.parent_id,
    "demo-folder-root",
  );
  assert.throws(
    () => demoAction(childFolder, "rename_library_folder", {
      id: "demo-folder-root",
      kind: "journal",
      name: "Trips",
      parent_id: "demo-folder-child",
    }),
    /contain themselves/,
  );
  const moved = demoAction(childFolder, "move_library_resource", {
    kind: "journal",
    resource_id: "demo-standalone-entry",
    folder_id: "demo-folder-child",
  });
  assert.equal(
    moved.library_resource_folders.filter(
      (entry) => entry.resource_id === "demo-standalone-entry",
    ).length,
    1,
  );
  assert.throws(
    () => demoAction(moved, "move_library_resource", {
      kind: "checklist",
      resource_id: "demo-standalone-entry",
      folder_id: "demo-folder-child",
    }),
    /unavailable|Choose one of your folders/,
  );
});
