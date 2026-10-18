import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  RICH_DEMO_PROFILE_IDS,
  addDemoProfileFixtures,
} from "../src/shared/demoProfileFixtures";
import { emptyData } from "../src/shared/types";
import { selectProfileContent } from "../src/features/profile/profileContent";
import { selectSharedProfileContexts } from "../src/features/people/previews/personPreview";
import {
  profileEditorDraft,
  validateProfileEditor,
} from "../src/features/profile/profileEditorDraft";

test("rich demo profiles are editable, distinct, and share meaningful interests and communities", () => {
  const data = makeDemo();
  const viewer = data.profiles.find((p) => p.id === DEMO_ID)!;
  for (const id of RICH_DEMO_PROFILE_IDS) {
    const person = data.profiles.find((p) => p.id === id)!;
    assert.ok(person.bio.length > 400 && person.bio.length <= 500);
    assert.ok(person.interests.length >= 30);
    assert.ok(person.aspiration_goals.length >= 12);
    assert.doesNotThrow(() =>
      validateProfileEditor(profileEditorDraft(person)),
    );
    assert.ok(
      person.interests.filter((i) => viewer.interests.includes(i)).length >= 12,
    );
    assert.ok(selectSharedProfileContexts(data, id, DEMO_ID).length >= 3);
  }
  assert.doesNotThrow(() => validateProfileEditor(profileEditorDraft(viewer)));
  assert.equal(
    new Set(data.profiles.map((p) => p.id)).size,
    data.profiles.length,
  );
});
test("sample memories follow the same author and participant gates and never sign fake URLs", () => {
  const data = makeDemo();
  const id = RICH_DEMO_PROFILE_IDS[0];
  const albums = selectProfileContent(data, DEMO_ID, {
    personId: id,
    filter: "albums",
    pageSize: 20,
  });
  assert.equal(albums.rows.length, 8);
  assert.ok(
    albums.rows.every((row) => row.coverPath === null && row.photoCount >= 3),
  );
  const history = selectProfileContent(data, DEMO_ID, {
    personId: id,
    filter: "past",
    pageSize: 20,
  });
  assert.ok(
    history.rows.some(
      (row) => row.title.includes("forgot to photograph") && !row.hasMemories,
    ),
  );
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: id });
  assert.equal(
    selectProfileContent(data, DEMO_ID, { personId: id, filter: "albums" }).rows
      .length,
    0,
  );
});
test("dense profile fixtures cannot populate a real or mismatched viewer snapshot", () => {
  const data = emptyData();
  const before = structuredClone(data);
  addDemoProfileFixtures(data, DEMO_ID, Date.now());
  assert.deepEqual(data, before);
});
