import assert from "node:assert/strict";
import test from "node:test";
import { emptyData, type Activity, type Profile } from "../src/shared/types";
import {
  ACTIVITY_HISTORY_DEFAULT_PAGE_SIZE,
  ACTIVITY_HISTORY_MAX_PAGE_SIZE,
  normalizeActivityHistoryQuery,
  parseActivityHistoryPage,
  searchActivityHistoryInData,
} from "../src/features/beacons/activityHistory";

const viewer = "viewer";
const host = "host";
const profile = (id: string, profile_visibility: Profile["profile_visibility"] = "public"): Profile => ({
  id,
  name: id === host ? "Hidden Host Label" : id,
  username: id,
  bio: "",
  interests: [],
  identity_tags: [],
  aspiration_goals: [],
  onboarding_survey_status: "completed",
  featured_activity_id: null,
  hide_featured: false,
  timezone: "UTC",
  quiet_start: 22,
  quiet_end: 8,
  profile_visibility,
});
function activity(id: string, values: Partial<Activity> = {}): Activity {
  return {
    id,
    owner_id: host,
    title: `Beacon ${id}`,
    description: "A searchable meeting label",
    category: "Study",
    mode: "squad",
    starts_at: "2026-10-01T10:00:00.000Z",
    ends_at: "2026-10-01T11:00:00.000Z",
    timezone: "UTC",
    approval_required: false,
    status: "completed",
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    audience: "friends",
    audience_id: null,
    ...values,
  };
}
function demo() {
  const data = emptyData();
  data.is_demo = true;
  data.viewer_id = viewer;
  data.profiles.push(profile(viewer), profile(host, "custom"));
  return data;
}

test("demo history includes hosted shared Beacons and approved Going non-solo history only", () => {
  const data = demo();
  data.activities.push(
    activity("hosted", { owner_id: viewer, mode: "squad", status: "completed" }),
    activity("solo", { owner_id: viewer, mode: "solo", status: "completed" }),
    activity("going", { status: "cancelled" }),
    activity("pending", { status: "completed" }),
    activity("unapproved-going", { status: "completed", mode: "invite", approval_required: true }),
    activity("invited", { status: "completed", mode: "invite", approval_required: true }),
    activity("private", { status: "completed" }),
    activity("unstarted-plan", { owner_id: viewer, status: "scheduled", plan_id: "plan", plan_step: { start_mode: "manual" }, plan_started_at: null, ends_at: "2026-10-01T11:00:00Z" }),
    activity("legacy-plan-child", { owner_id: viewer, status: "scheduled", plan_id: "old-plan", plan_step: null, plan_started_at: null, ends_at: "2026-10-01T11:00:00Z" }),
    activity("elapsed", { owner_id: viewer, status: "scheduled", ends_at: "2026-10-01T11:00:00Z" }),
  );
  data.rsvps.push(
    { activity_id: "going", user_id: viewer, status: "going", approved: true },
    { activity_id: "pending", user_id: viewer, status: "requested", approved: false },
    { activity_id: "unapproved-going", user_id: viewer, status: "going", approved: false },
    { activity_id: "invited", user_id: viewer, status: "invited", approved: true },
    { activity_id: "private", user_id: viewer, status: "going", approved: true },
  );
  data.activity_exclusions.push({ activity_id: "private", user_id: viewer });

  const page = searchActivityHistoryInData(data, viewer, { pageSize: 20 }, Date.parse("2026-10-02T00:00:00Z"));
  assert.deepEqual(page.rows.map((row) => row.id).sort(), ["elapsed", "going", "hosted", "legacy-plan-child"]);
  assert.equal(page.rows.find((row) => row.id === "elapsed")?.historyLabel, "ended");
  assert.equal(page.rows.find((row) => row.id === "going")?.historyLabel, "cancelled");
  assert.equal(page.rows.find((row) => row.id === "hosted")?.viewerRole, "host");
  assert.equal(page.rows.find((row) => row.id === "going")?.viewerRole, "attendee");
  assert.equal(searchActivityHistoryInData(data, "someone-else").rows.length, 0);
});

test("history search uses only visible activity labels and visible host names", () => {
  const data = demo();
  data.activities.push(activity("searchable", { title: "Quiet rehearsal" }));
  data.rsvps.push({ activity_id: "searchable", user_id: viewer, status: "going", approved: true });
  data.beacon_notes.push({
    id: "private-note",
    activity_id: "searchable",
    author_id: host,
    section_heading: "Private",
    visibility: "private",
    body: "secret-content",
    revision: 1,
    created_at: "2026-10-01T11:00:00Z",
    updated_at: "2026-10-01T11:00:00Z",
  });

  assert.equal(searchActivityHistoryInData(data, viewer, { query: "rehearsal" }).rows.length, 1);
  assert.equal(searchActivityHistoryInData(data, viewer, { query: "hidden host label" }).rows.length, 0);
  assert.equal(searchActivityHistoryInData(data, viewer, { query: "secret-content" }).rows.length, 0);
  assert.equal(searchActivityHistoryInData(data, viewer, { query: "meeting label" }).rows.length, 1);
});

test("history keyset pagination is stable for equal timestamps and applies page bounds", () => {
  const data = demo();
  for (let index = 0; index < ACTIVITY_HISTORY_MAX_PAGE_SIZE + 2; index++)
    data.activities.push(activity(`history-${String(index).padStart(2, "0")}`, { owner_id: viewer }));
  const first = searchActivityHistoryInData(data, viewer, {});
  assert.equal(first.rows.length, ACTIVITY_HISTORY_DEFAULT_PAGE_SIZE);
  assert.equal(first.hasMore, true);
  assert.ok(first.nextCursor);
  const second = searchActivityHistoryInData(data, viewer, { cursor: first.nextCursor, pageSize: 20 });
  assert.equal(second.rows.length, ACTIVITY_HISTORY_MAX_PAGE_SIZE - ACTIVITY_HISTORY_DEFAULT_PAGE_SIZE + 2);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.rows, ...second.rows].map((row) => row.id)).size, 22);
  assert.equal(normalizeActivityHistoryQuery({ pageSize: 200 }).pageSize, ACTIVITY_HISTORY_MAX_PAGE_SIZE);
});

test("history RPC parser maps a valid page and rejects malformed page envelopes", () => {
  const page = parseActivityHistoryPage({
    rows: [{
      id: "activity",
      owner_id: host,
      title: "History",
      category: "Study",
      mode: "squad",
      status: "scheduled",
      history_label: "ended",
      starts_at: "2026-10-01T10:00:00Z",
      ends_at: "2026-10-01T11:00:00Z",
      timezone: "UTC",
      owner_name: null,
      viewer_role: "attendee",
      viewer_rsvp_status: "going",
    }],
    has_more: false,
    next_cursor: null,
  });
  assert.equal(page.rows[0].historyLabel, "ended");
  assert.equal(page.rows[0].viewerRsvpStatus, "going");
  assert.throws(() => parseActivityHistoryPage(null), /invalid page/i);
  assert.throws(() => parseActivityHistoryPage({ rows: [], has_more: false, next_cursor: "x".repeat(181) }), /invalid cursor/i);
});
