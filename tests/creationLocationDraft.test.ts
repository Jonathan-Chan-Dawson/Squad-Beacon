import test from "node:test";
import assert from "node:assert/strict";
import {
  beginCreationLocationPick,
  completePlanningDraft,
  finishCreationLocationPick,
  planningDraftObject,
  setCreationDraftAccount,
  startCreationDraft,
  startPlanningDraft,
} from "../src/features/beacons/socialPlanningSession";

const read = <T>(viewer: string, token: string, field: string) =>
  planningDraftObject<T | undefined>(viewer, token, field, () => undefined);
test("confirm changes only location and repeated picks rehydrate the same full draft", () => {
  const viewer = "picker-owner",
    token = startCreationDraft(viewer)!;
  const title = planningDraftObject(viewer, token, "title", () => "Dinner");
  const settings = planningDraftObject(viewer, token, "controls", () => ({
    audience: "private",
    enable_chat: false,
    starts: "2026-11-01T12:00:00Z",
  }));
  const invitees = planningDraftObject(viewer, token, "inviteeIds", () => [
    "friend",
  ]);
  assert.ok(
    beginCreationLocationPick(viewer, token, {
      planSession: token,
      kind: "beacon",
    }),
  );
  const first = finishCreationLocationPick(viewer, token, {
    latitude: 0,
    longitude: 0,
    label: "  ",
  })!;
  assert.equal(read(viewer, token, "label"), "Pinned location");
  assert.deepEqual(read(viewer, token, "pin"), { latitude: 0, longitude: 0 });
  assert.equal(read(viewer, token, "title"), title);
  assert.equal(read(viewer, token, "controls"), settings);
  assert.equal(read(viewer, token, "inviteeIds"), invitees);
  assert.ok(beginCreationLocationPick(viewer, token, first));
  const second = finishCreationLocationPick(viewer, token, {
    latitude: 41,
    longitude: -87,
    label: "Park",
  })!;
  assert.notEqual(first.locationResult, second.locationResult);
  assert.equal(second.planSession, token);
  assert.equal(read(viewer, token, "controls"), settings);
});

test("cancel preserves the prior location; invalid coordinates never update it", () => {
  const viewer = "cancel-owner",
    token = startCreationDraft(viewer)!;
  planningDraftObject(viewer, token, "label", () => "Original park");
  const pin = planningDraftObject(viewer, token, "pin", () => ({
    latitude: 41,
    longitude: -87,
  }));
  const params = { planSession: token, template: "kept" };
  beginCreationLocationPick(viewer, token, params);
  assert.equal(
    finishCreationLocationPick(viewer, token, {
      latitude: NaN,
      longitude: 12,
      label: "bad",
    }),
    undefined,
  );
  assert.equal(
    finishCreationLocationPick(viewer, token, {
      latitude: 91,
      longitude: 12,
      label: "bad",
    }),
    undefined,
  );
  assert.deepEqual(finishCreationLocationPick(viewer, token), params);
  assert.equal(read(viewer, token, "pin"), pin);
  assert.equal(read(viewer, token, "label"), "Original park");
  assert.equal(finishCreationLocationPick(viewer, token), undefined);
});

test("account changes and completed drafts reject pending results, including returning to the old account", () => {
  const viewer = "old-owner",
    token = startCreationDraft(viewer)!;
  beginCreationLocationPick(viewer, token, { planSession: token });
  assert.equal(finishCreationLocationPick("other", token), undefined);
  setCreationDraftAccount("other");
  setCreationDraftAccount(viewer);
  assert.equal(finishCreationLocationPick(viewer, token), undefined);
  const current = startCreationDraft(viewer)!;
  beginCreationLocationPick(viewer, current, { planSession: current });
  completePlanningDraft(viewer, current);
  assert.equal(finishCreationLocationPick(viewer, current), undefined);
});

test("planning drafts retain their existing fields and reject results after completion", () => {
  const viewer = "plan-owner",
    token = startPlanningDraft(viewer);
  const details = planningDraftObject(viewer, token, "details", () => ({
    target: 5,
    duration: 60,
  }));
  beginCreationLocationPick(viewer, token, { planSession: token });
  assert.ok(
    finishCreationLocationPick(viewer, token, {
      latitude: 1,
      longitude: 2,
      label: "Park",
    }),
  );
  assert.equal(read(viewer, token, "details"), details);
  beginCreationLocationPick(viewer, token, { planSession: token });
  completePlanningDraft(viewer, token);
  assert.equal(finishCreationLocationPick(viewer, token), undefined);
});
