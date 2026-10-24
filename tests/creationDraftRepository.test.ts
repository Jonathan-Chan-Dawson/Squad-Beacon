import test from "node:test";
import assert from "node:assert/strict";
import { createCreationDraftRepository } from "../src/features/beacons/creationDraftRepository";
import type { CreationSnapshot } from "../src/features/beacons/draftSnapshot";
function setup() {
  const values = new Map<string, string>();
  let next = 0;
  const io = {
    read: async (key: string) => values.get(key) ?? null,
    write: async (key: string, value: string) => {
      values.set(key, value);
    },
    remove: async (key: string) => {
      values.delete(key);
    },
    newId: () => `generation-${++next}`,
  };
  return { values, io, repo: createCreationDraftRepository(io) };
}
function draft(
  token = "one",
  updatedAt = 1,
  fields: Record<string, unknown> = {},
): CreationSnapshot {
  return {
    version: 1,
    viewer: "alice",
    token: `creation:${token}`,
    updatedAt,
    context: { editor: "yes", planId: "plan" },
    fields: { title: token, ...fields },
  };
}
const session = (patch: Record<string, unknown>) => ({
  createdId: null,
  viewerId: "alice",
  creationUnverified: false,
  invitedIds: [],
  pendingIds: [],
  errors: {},
  ...patch,
});
test("multiple drafts sort by update time, preserve context after restart and update the same token", async () => {
  const { repo, io } = setup();
  await Promise.all([
    repo.writeCreationSnapshot(draft("one", 1)),
    repo.writeCreationSnapshot(draft("two", 2)),
    repo.writeCreationSnapshot(draft("three", 3)),
  ]);
  await repo.writeCreationSnapshot(
    draft("one", 4, { title: "Edited", inviteeIds: ["friend"] }),
  );
  const restarted = createCreationDraftRepository(io);
  assert.deepEqual(
    (await restarted.listCreationDraftSummaries("alice")).map(
      (row) => row.token,
    ),
    ["creation:one", "creation:three", "creation:two"],
  );
  const restored = await restarted.readCreationSnapshot(
    "alice",
    "creation:one",
  );
  assert.equal(restored.fields.title, "Edited");
  assert.equal(restored.context.planId, "plan");
  assert.deepEqual(await restarted.listCreationDraftSummaries("bob"), []);
  await assert.rejects(restarted.readCreationSnapshot("bob", "creation:one"));
});
test("user removal targets one token and preserves neighboring drafts", async () => {
  const { repo } = setup();
  await repo.writeCreationSnapshot(draft());
  await repo.writeCreationSnapshot(draft("two"));
  await repo.discardCreationDraft("alice", "creation:one");
  assert.deepEqual(
    (await repo.listCreationDraftSummaries("alice")).map((row) => row.token),
    ["creation:two"],
  );
});
test("all publication and invitation recovery states prevent user deletion", async () => {
  const { repo } = setup();
  const pending = {
    action: "create_activity",
    payload: {},
    viewer: "alice",
    requestId: "11111111-1111-4111-8111-111111111111",
  };
  const states = [
    { pendingPublication: pending },
    { pendingPublication: { ...pending, result: { id: "confirmed" } } },
    { invitationSession: session({ createdId: "confirmed" }) },
    { invitationSession: session({ creationUnverified: true }) },
    { invitationSession: session({ pendingIds: ["friend"] }) },
    {
      invitationSession: session({
        atomicAttempt: {
          ...pending,
          viewerId: "alice",
          action: "create_activity_with_invitees",
        },
      }),
    },
  ];
  for (const [index, fields] of states.entries()) {
    const token = `case-${index}`;
    await repo.writeCreationSnapshot(draft(token, index, fields));
    await assert.rejects(
      repo.discardCreationDraft("alice", `creation:${token}`),
      /recovery/,
    );
  }
  assert.ok(
    (await repo.listCreationDraftSummaries("alice")).every(
      (row) => row.status === "recovery",
    ),
  );
});
test("a draft becoming pending after confirmation is protected by a fresh queued check", async () => {
  const { repo } = setup();
  await repo.writeCreationSnapshot(draft());
  const confirmedRow = (await repo.listCreationDraftSummaries("alice"))[0];
  assert.equal(confirmedRow.status, "draft");
  const pendingWrite = repo.writeCreationSnapshot(
    draft("one", 2, {
      invitationSession: session({ createdId: "created-after-confirmation" }),
    }),
  );
  const discard = repo.discardCreationDraft("alice", confirmedRow.token);
  await pendingWrite;
  await assert.rejects(discard, /recovery/);
  assert.equal(
    (await repo.listCreationDraftSummaries("alice"))[0].status,
    "recovery",
  );
});
test("one corrupt draft stays protected without hiding healthy drafts", async () => {
  const { repo, values } = setup();
  await repo.writeCreationSnapshot(draft());
  await repo.writeCreationSnapshot(draft("two", 2));
  const row = (await repo.listSavedCreationDrafts("alice"))[0];
  for (const key of values.keys())
    if (key.endsWith(`.${row.generation}.0`)) values.set(key, "corrupt");
  const rows = await repo.listCreationDraftSummaries("alice");
  assert.equal(rows[0].status, "unavailable");
  assert.equal(rows[1].status, "draft");
  const count = values.size;
  await assert.rejects(repo.discardCreationDraft("alice", row.token));
  assert.equal(values.size, count);
});
test("failed index commit retains the previously saved snapshot and queue remains usable", async () => {
  const { io } = setup();
  let fail = false;
  const repo = createCreationDraftRepository({
    ...io,
    write: async (key, value) => {
      if (fail && key.endsWith(".index")) throw new Error("disk full");
      await io.write(key, value);
    },
  });
  await repo.writeCreationSnapshot(draft());
  fail = true;
  await assert.rejects(
    repo.writeCreationSnapshot(draft("one", 2, { title: "Unsaved" })),
    /disk full/,
  );
  assert.equal(
    (await repo.readCreationSnapshot("alice", "creation:one")).fields.title,
    "one",
  );
  fail = false;
  await repo.writeCreationSnapshot(draft("one", 3, { title: "Saved" }));
  assert.equal(
    (await repo.readCreationSnapshot("alice", "creation:one")).fields.title,
    "Saved",
  );
});
test("account transitions before the delete commit leave the draft intact", async () => {
  const { io } = setup();
  let current = true,
    changeOnCommit = false;
  const repo = createCreationDraftRepository({
    ...io,
    write: async (key, value) => {
      await io.write(key, value);
      if (changeOnCommit && key.includes(".index.")) current = false;
    },
  });
  await repo.writeCreationSnapshot(draft());
  changeOnCommit = true;
  await assert.rejects(
    repo.discardCreationDraft("alice", "creation:one", () => current),
    /account changed/,
  );
  assert.equal((await repo.listCreationDraftSummaries("alice")).length, 1);
});
test("trusted successful-publication cleanup remains distinct from user removal", async () => {
  const { repo } = setup();
  await repo.writeCreationSnapshot(
    draft("one", 1, { invitationSession: session({ createdId: "confirmed" }) }),
  );
  await repo.deleteCreationSnapshot("alice", "creation:one");
  assert.deepEqual(await repo.listCreationDraftSummaries("alice"), []);
});
