import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ID, makeDemo } from "@/src/shared/demo";
import {
  libraryCards,
  personalJournalCards,
  savedChecklistCards,
  sharedJournalHistory,
} from "../src/features/library/helpers";

test("library tabs show one authorized card per beacon and private filing filters", () => {
  const data = makeDemo();
  const activity = data.activities.find((item) => item.id === "demo-tools");
  assert.ok(activity);

  const initialJournals = libraryCards(data, DEMO_ID, "journal");
  const initialChecklists = libraryCards(data, DEMO_ID, "checklist");
  assert.equal(
    initialJournals.filter((card) => card.activity.id === activity.id).length,
    1,
  );
  assert.equal(
    initialJournals.find((card) => card.activity.id === activity.id)
      ?.entryCount,
    1,
  );
  assert.equal(
    initialChecklists.find((card) => card.activity.id === activity.id)
      ?.entryCount,
    2,
  );

  data.library_folders.push({
    id: "personal-journal-folder",
    owner_id: DEMO_ID,
    kind: "journal",
    name: "Walks",
    parent_id: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  });
  data.library_folder_items.push({
    owner_id: DEMO_ID,
    kind: "journal",
    activity_id: activity.id,
    folder_id: "personal-journal-folder",
    updated_at: "2026-10-01T00:00:00.000Z",
  });
  assert.equal(
    libraryCards(data, DEMO_ID, "journal", "personal-journal-folder").length,
    1,
  );
  assert.equal(
    libraryCards(data, DEMO_ID, "journal", "unfiled").some(
      (card) => card.activity.id === activity.id,
    ),
    false,
  );
  assert.equal(
    libraryCards(data, "maya", "journal").some(
      (card) => card.activity.id === activity.id,
    ),
    false,
  );
});

test("library card counts hide blocked authors and activity access still gates cards", () => {
  const data = makeDemo();
  const activity = data.activities.find((item) => item.id === "demo-tools");
  assert.ok(activity);
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "jordan" });

  const journal = libraryCards(data, DEMO_ID, "journal");
  const checklist = libraryCards(data, DEMO_ID, "checklist");
  assert.equal(
    journal.find((card) => card.activity.id === activity.id)?.entryCount,
    0,
  );
  assert.equal(
    checklist.find((card) => card.activity.id === activity.id)?.entryCount,
    1,
  );

  const privateActivity = {
    ...activity,
    id: "private-to-someone-else",
    owner_id: "jordan",
    mode: "solo" as const,
    audience: "private" as const,
    audience_id: null,
  };
  data.activities.push(privateActivity);
  assert.equal(
    libraryCards(data, DEMO_ID, "journal").some(
      (card) => card.activity.id === privateActivity.id,
    ),
    false,
  );
});

test("personal Journals and Lists are owner-only; shared history stays separate", () => {
  const data = makeDemo();
  const createdAt = "2026-10-01T12:00:00.000Z";
  data.beacon_notes.push({
    id: "private-journal-entry",
    activity_id: null,
    author_id: DEMO_ID,
    section_heading: "A note to myself",
    body: "Keep this private.",
    visibility: "private",
    revision: 0,
    created_at: createdAt,
    updated_at: createdAt,
  });
  data.library_saved_checklists.push({
    id: "my-list",
    owner_id: DEMO_ID,
    source_activity_id: "demo-tools",
    title: "My packing list",
    sections: [],
    items: [],
    revision: 0,
    created_at: createdAt,
    updated_at: createdAt,
  });

  assert.deepEqual(
    personalJournalCards(data, DEMO_ID).map((card) => card.note.id),
    ["private-journal-entry"],
  );
  assert.deepEqual(
    savedChecklistCards(data, DEMO_ID).map((card) => card.checklist.id),
    ["my-list"],
  );
  assert.deepEqual(
    sharedJournalHistory(data, DEMO_ID).map((card) => card.note.id),
    ["demo-note-tools"],
  );
  assert.equal(
    sharedJournalHistory(data, DEMO_ID).some(
      (card) => card.note.id === "private-journal-entry",
    ),
    false,
  );
  assert.deepEqual(personalJournalCards(data, "maya"), []);
  assert.deepEqual(savedChecklistCards(data, "maya"), []);
  assert.deepEqual(libraryCards(data, "maya", "journal"), []);
});
