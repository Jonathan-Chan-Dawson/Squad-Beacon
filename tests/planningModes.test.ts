import assert from "node:assert/strict";
import test from "node:test";
import { composerSession, storeComposerSession, switchComposerKind, type ComposerDraft } from "../src/features/planning/composerSession";
import { validateSlots } from "../src/features/planning/connected";

let counter = 0;
const id = () => `mode-${++counter}`;
function seed(viewer: string, session: string) {
  const draft: ComposerDraft = {
    title: "Coffee", body: "After work", audience: "squad", audienceId: "s1",
    startsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    deadline: new Date(Date.now() + 86400000).toISOString(), minutes: "60",
    place: "Cafe", category: "Social", coordinate: { latitude: 1, longitude: 2 },
    options: [], touched: ["title"], publication: {},
  };
  storeComposerSession(viewer, session, draft);
  return draft;
}
const read = (viewer: string, session: string) => composerSession(viewer, session, () => { throw new Error("Missing draft"); });

test("mode switching seeds shared context and restores independently edited drafts", () => {
  const root = id(); seed("a", root);
  const vote = switchComposerKind("a", root, "ping", root, "vote", id);
  const draft = read("a", vote);
  assert.equal(draft.title, "Coffee");
  assert.equal(draft.audienceId, "s1");
  assert.deepEqual(draft.coordinate, { latitude: 1, longitude: 2 });
  assert.equal(draft.options.length, 2);
  draft.title = "Edited vote";
  draft.options[0].payload.title = "Board games";
  assert.equal(switchComposerKind("a", root, "vote", vote, "ping", id), root);
  assert.equal(read("a", root).title, "Coffee");
  assert.equal(switchComposerKind("a", root, "ping", root, "vote", id), vote);
  assert.equal(read("a", vote).options[0].payload.title, "Board games");
  assert.equal(read("a", vote).title, "Edited vote");
});

test("different modes do not copy options, recovery tokens or publication state", () => {
  const root = id(); const source = seed("a", root); source.recoveryToken = "private-recovery";
  const vote = switchComposerKind("a", root, "ping", root, "vote", id);
  const draw = switchComposerKind("a", root, "vote", vote, "draw", id);
  assert.notEqual(read("a", draw).options[0].id, read("a", vote).options[0].id);
  assert.equal(read("a", draw).recoveryToken, undefined);
  assert.deepEqual(read("a", draw).publication, {});
  const time = switchComposerKind("a", root, "draw", draw, "time", id, "America/Chicago");
  assert.equal(read("a", time).options.length, 0);
  assert.equal(read("a", time).timeSlots?.[0].timezone, "America/Chicago");
  validateSlots(read("a", time).timeSlots!, read("a", time).deadline);
});

test("mode maps isolate accounts and independent creation flows", () => {
  const root = id(); seed("a", root); seed("b", root).title = "Account B";
  const first = switchComposerKind("a", root, "ping", root, "vote", id);
  const second = switchComposerKind("b", root, "ping", root, "vote", id);
  assert.notEqual(first, second);
  assert.equal(read("b", second).title, "Account B");
  const other = id(); seed("a", other);
  assert.notEqual(first, switchComposerKind("a", other, "ping", other, "vote", id));
});

test("frozen publication cannot switch modes", () => {
  const root = id(); const draft = seed("a", root);
  draft.publication.attempt = {} as NonNullable<ComposerDraft["publication"]["attempt"]>;
  assert.throws(() => switchComposerKind("a", root, "ping", root, "vote", id), /verify this publication/);
});
