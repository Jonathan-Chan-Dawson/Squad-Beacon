import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import type { Activity, Payload } from "../src/shared/types";
import { clearOwnStatuses, liveOwnedStatuses, saveOwnStatus, statusCreatePayload, statusEndAt } from "../src/features/beacons/components/feed/statusActions";
import { visibleSoloActivity } from "../src/features/maps/soloActivity";
import { selectPersonPreview } from "../src/features/people/previews/personPreview";

const now = Date.parse("2026-10-13T16:00:00Z");
function fixture() {
  const data = makeDemo();
  const source: Activity = { ...data.activities[0], id: "current", owner_id: DEMO_ID, mode: "solo", status: "scheduled", available: true,
    title: "Studying French", description: "Practicing with my book", category: "Study", timezone: "America/Chicago",
    starts_at: "2026-10-13T15:30:00Z", ends_at: "2026-10-13T17:00:00Z", audience: "list", audience_id: "my-list", enable_reactions: false };
  data.activities = [{ ...source, id: "older", starts_at: "2026-10-13T15:00:00Z" }, source];
  return { data, source };
}

test("shared status and map selectors agree on newest live record, reject expired and wrong viewer", () => {
  const { data, source } = fixture();
  data.activities.push({ ...source, id: "expired", starts_at: "2026-10-13T15:59:00Z", ends_at: "2026-10-13T16:00:00Z" });
  assert.equal(liveOwnedStatuses(data, DEMO_ID, now)[0]?.id, "current");
  assert.equal(visibleSoloActivity(data, DEMO_ID, DEMO_ID, now)?.id, "current");
  assert.deepEqual(liveOwnedStatuses(data, "another-viewer", now), []);
  assert.equal(visibleSoloActivity(data, DEMO_ID, "another-viewer", now), undefined);
});

test("availability replacement preserves note, category, audience, expiry and disabled reactions", async () => {
  const { data, source } = fixture();
  const calls: { action: string; payload?: Payload }[] = [];
  const result = await saveOwnStatus(data, DEMO_ID, { title: source.title, available: false, endsAt: source.ends_at }, async (action, payload) => {
    calls.push({ action, payload }); return { id: "replacement", event: "save_status_note", cleared_count: 2 };
  }, now);
  const payload = calls[0].payload!;
  assert.equal(calls[0].action, "save_status_note");
  assert.equal(payload.title, source.title);
  assert.equal(payload.description, source.description);
  assert.equal(payload.category, source.category);
  assert.equal(payload.audience, source.audience);
  assert.equal(payload.audience_id, source.audience_id);
  assert.equal(payload.ends_at, source.ends_at);
  assert.equal(payload.enable_reactions, false);
  assert.equal(payload.latitude, null);
  assert.equal(calls.length, 1);
  assert.equal(payload.source_id, "current");
  assert.equal(result.savedId, "replacement");
  assert.equal(result.message, "");
  assert.equal(source.status, "scheduled", "service never mutates local history");
});

test("atomic saves expose failures without attempting separate cleanup", async () => {
  const { data, source } = fixture();
  const calls: string[] = [];
  await assert.rejects(() => saveOwnStatus(data, DEMO_ID, { title: "My new note", available: true, endsAt: source.ends_at }, async (action) => {
    calls.push(action); throw new Error("Network unavailable.");
  }, now), /Network unavailable/);
  assert.deepEqual(calls, ["save_status_note"]);
  assert.ok(data.activities.every((item) => item.status === "scheduled"));
});
test("clear uses one server-scoped action and preserves failures for retry", async () => {
  const { data } = fixture();
  const calls: string[] = [];
  await assert.rejects(() => clearOwnStatuses(data, DEMO_ID, async (action) => {
    calls.push(action); throw new Error("Try later.");
  }, now), /Try later/);
  assert.deepEqual(calls, ["clear_status_notes"]);
  await assert.rejects(() => clearOwnStatuses(data, "wrong-viewer", async () => { assert.fail("No action allowed"); }, now), /Refresh your profile/);
});

test("existing expiry survives note edits, new status defaults remain friends and one hour", () => {
  const expiry = "2026-10-13T16:37:00Z";
  assert.equal(statusEndAt("custom", "60", expiry, now), expiry);
  assert.equal(Date.parse(statusEndAt("hour", "5", null, now)) - now, 60 * 60_000);
  assert.equal(Date.parse(statusEndAt("custom", "60", null, now)) - now, 60 * 60_000);
  assert.throws(() => statusEndAt("custom", "4", null, now), /5 to 1440/);
  assert.throws(() => statusEndAt("custom", "60", "bad", now), /future/);
  assert.throws(() => statusEndAt("custom", "60", new Date(now).toISOString(), now), /future/);
  const payload = statusCreatePayload({ title: "Free to hang", available: true, endsAt: statusEndAt("custom", "60", null, now) }, undefined, undefined, now);
  assert.equal(payload.audience, "friends");
  assert.equal(payload.audience_id, null);
});

test("person availability follows the newest visible status when an earlier cleanup failed", () => {
  const { data, source } = fixture();
  data.activities = [
    { ...source, id: "old", owner_id: "jordan", audience: "friends", audience_id: null, starts_at: "2026-10-13T15:00:00Z" },
    { ...source, id: "new", owner_id: "jordan", audience: "friends", audience_id: null, available: false },
  ];
  assert.equal(selectPersonPreview(data, "jordan", DEMO_ID, now).availability, "unavailable");
});

test("dedicated status actions reject an unacknowledged legacy response", async () => {
  const { data, source } = fixture();
  await assert.rejects(() => saveOwnStatus(data, DEMO_ID, { title: source.title, available: true, endsAt: source.ends_at }, async () => ({}), now), /verified/);
  await assert.rejects(() => clearOwnStatuses(data, DEMO_ID, async () => ({}), now), /verified/);
});
