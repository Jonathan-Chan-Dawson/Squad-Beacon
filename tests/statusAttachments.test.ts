import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { eligibleStatusAttachments, resolveStatusAttachment, statusNoteText, visibleStatusAttachment } from "../src/features/beacons/statusAttachments";
import { quickStatusDraft } from "../src/features/beacons/quickStatus";
import { beaconParticipation } from "../src/features/beacons/participation";
import { canUseBeaconModules } from "../src/features/beacons/beaconModules";

test("only owned or cohosted live content can be featured; privacy and lifecycle are independent", () => {
  const data = makeDemo(); const now = Date.now();
  const beacon = { ...data.activities[0], id: "owned-feature", owner_id: DEMO_ID, mode: "invite" as const, audience: "private" as const, audience_id: null, status: "scheduled" as const, starts_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + 3600000).toISOString() };
  data.activities.push(beacon);
  const attachment = { type: "beacon" as const, id: beacon.id };
  assert.ok(eligibleStatusAttachments(data, DEMO_ID, now).some(row => row.id === beacon.id));
  const status = { ...beacon, id: "status", mode: "solo" as const, status_attachment: attachment, status_presentation: "text_activity" as const };
  data.activities.push(status);
  assert.equal(visibleStatusAttachment(data, status, DEMO_ID, now)?.id, beacon.id);
  assert.equal(visibleStatusAttachment(data, { ...status, status_note_hidden: true }, DEMO_ID, now), null);
  assert.equal(visibleStatusAttachment(data, { ...status, status_sharing: false }, DEMO_ID, now), null);
  assert.equal(statusNoteText({ ...status, status_presentation: "activity_only", title: "retained secret" }), "");
  assert.equal(visibleStatusAttachment(data, { ...status, status_presentation: "text_only" }, DEMO_ID, now), null);
  beacon.status = "cancelled" as typeof beacon.status;
  assert.equal(resolveStatusAttachment(data, attachment, DEMO_ID, now), null);
  assert.equal(eligibleStatusAttachments(data, DEMO_ID, now).some(row => row.id === beacon.id), false);
  data.viewer_id = "someone-else";
  assert.equal(resolveStatusAttachment(data, attachment, DEMO_ID, now), null);
});

test("quick current availability preserves attachment configuration without altering scheduled records", () => {
  const data = makeDemo(); const now = Date.now();
  const source = { ...data.activities[0], status_attachment: { type: "draw" as const, id: "draw" }, status_presentation: "activity_only" as const, status_note_hidden: true, status_sharing: false };
  const future = { ...source, id: "future", title: "Tomorrow", starts_at: new Date(now + 86400000).toISOString() };
  const before = structuredClone(future);
  const draft = quickStatusDraft(source, "friends", null, 60, now);
  assert.deepEqual(draft.attachment, source.status_attachment);
  assert.equal(draft.presentation, "activity_only"); assert.equal(draft.noteHidden, true); assert.equal(draft.sharing, false);
  assert.deepEqual(future, before);
});

test("Draws remain viewable awaiting resolution; closed Pings and Votes do not", () => {
  const data = makeDemo(); const now = Date.now();
  const base = data.planning_threads[0];
  assert.ok(base);
  for (const kind of ["ping", "vote", "draw"] as const) {
    const thread = { ...base, id: `feature-${kind}`, owner_id: DEMO_ID, kind, status: "open" as const, deadline_at: new Date(now - 1000).toISOString() };
    data.planning_threads.push(thread);
    assert.equal(!!resolveStatusAttachment(data, { type: kind, id: thread.id }, DEMO_ID, now), kind === "draw");
  }
});

test("hosted preview authorization permits RSVP without granting participant tools", () => {
  const data = makeDemo(); const now = Date.now(); data.is_demo = false;
  const source = { ...data.activities[0], id: "readable-not-participating", owner_id: "maya", mode: "squad" as const, status: "scheduled" as const, starts_at: new Date(now).toISOString(), ends_at: new Date(now + 3600000).toISOString(), viewer_can_read: true, viewer_can_access: false, approval_required: false, manual_closed: false, capacity_limit: null, accepted_seat_count: 1 };
  data.activities.push(source);
  assert.ok(resolveStatusAttachment(data, { type: "beacon", id: source.id }, DEMO_ID, now));
  assert.ok(beaconParticipation(data, DEMO_ID, source.id, now)?.allowed.includes("join"));
  assert.equal(canUseBeaconModules(data, source, DEMO_ID), false);
  source.viewer_can_read = false;
  assert.equal(resolveStatusAttachment(data, { type: "beacon", id: source.id }, DEMO_ID, now), null);
  assert.equal(beaconParticipation(data, DEMO_ID, source.id, now), null);
});
