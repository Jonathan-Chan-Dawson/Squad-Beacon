import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_ID, makeDemo } from "@/src/shared/demo";
import { libraryCards } from "../src/features/library/helpers";

test("library tabs show one authorized card per beacon and private filing filters", () => {
  const data = makeDemo();
  const activity = data.activities.find((item) => item.id === "demo-tools");
  assert.ok(activity);

  const initialJournals = libraryCards(data, DEMO_ID, "journal");
  const initialChecklists = libraryCards(data, DEMO_ID, "checklist");
  assert.equal(initialJournals.filter((card) => card.activity.id === activity.id).length, 1);
  assert.equal(initialJournals.find((card) => card.activity.id === activity.id)?.entryCount, 1);
  assert.equal(initialChecklists.find((card) => card.activity.id === activity.id)?.entryCount, 2);

  data.library_folders.push({
    id: "personal-journal-folder",
    owner_id: DEMO_ID,
    kind: "journal",
    name: "Walks",
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
  assert.equal(libraryCards(data, DEMO_ID, "journal", "unfiled").length, 0);
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
  assert.equal(journal.find((card) => card.activity.id === activity.id)?.entryCount, 0);
  assert.equal(checklist.find((card) => card.activity.id === activity.id)?.entryCount, 1);

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
