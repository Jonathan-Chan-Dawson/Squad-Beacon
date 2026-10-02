import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeData,
  type Activity,
  type Data,
  type PlanningThread,
  type RSVP,
} from "@/src/shared/types";

test("legacy snapshots normalize planning arrays and new thread metadata", () => {
  const legacyThread = {
    id: "thread-1",
    owner_id: "owner-1",
    kind: "vote",
    title: "Pick a time",
    body: "",
    audience: "friends",
    audience_id: null,
    deadline_at: "2026-10-02T12:00:00.000Z",
    status: "open",
    payload: null,
    winner_proposal_id: null,
    materialized_activity_id: null,
    created_at: "2026-10-01T12:00:00.000Z",
    resolved_at: null,
  } as unknown as PlanningThread;
  const legacyActivity = {
    id: "activity-1",
    owner_id: "owner-1",
    title: "Legacy beacon",
    category: "Social",
    mode: "squad",
    starts_at: "2026-10-02T12:00:00.000Z",
    ends_at: "2026-10-02T13:00:00.000Z",
    timezone: "UTC",
    approval_required: false,
    status: "scheduled",
    audience: "friends",
    audience_id: null,
  } as unknown as Activity;
  const legacyRsvp = {
    activity_id: legacyActivity.id,
    user_id: "member-1",
    status: "going",
    approved: false,
  } as unknown as RSVP;
  const normalized = normalizeData({
    planning_threads: [legacyThread],
    activities: [legacyActivity],
    rsvps: [legacyRsvp],
  } as Partial<Data>);

  assert.deepEqual(normalized.planning_ping_responses, []);
  assert.deepEqual(normalized.planning_proposals, []);
  assert.deepEqual(normalized.planning_votes, []);
  assert.deepEqual(normalized.planning_threads[0].coowner_ids, []);
  assert.equal(normalized.planning_threads[0].replaced_from_proposal_id, null);
  assert.equal(normalized.activities[0].capacity_policy, "soft");
  assert.equal(normalized.activities[0].enable_chat, true);
  assert.equal(normalized.activities[0].enable_journal, true);
  assert.deepEqual(normalized.beacon_attendance, []);
  assert.deepEqual(normalizeData(normalized), normalized);
});
