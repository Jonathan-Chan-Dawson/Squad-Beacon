import test from "node:test";
import assert from "node:assert/strict";
import {
  canReadBeaconMeetingDetails,
  matchesBeaconFilters,
} from "../src/features/maps/filtering";
import { emptyData, type Activity, type Data } from "../src/shared/types";
import type { ExplorationFilters } from "../src/shared/exploration";

const now = Date.parse("2026-10-04T15:00:00.000Z");

function beacon(id: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    owner_id: "viewer",
    title: id,
    description: "",
    category: "Social",
    mode: "squad",
    starts_at: "2026-10-04T16:00:00.000Z",
    ends_at: "2026-10-04T18:00:00.000Z",
    timezone: "UTC",
    approval_required: false,
    status: "scheduled",
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    audience: "private",
    audience_id: null,
    ...overrides,
  };
}

function baseData(): Data {
  const data = emptyData();
  data.is_demo = true;
  data.viewer_id = "viewer";
  return data;
}

const allFilters: ExplorationFilters = {
  audience: "Everyone",
  category: "All categories",
  time: "All",
  planId: null,
  when: "Any",
  join: "Any",
  format: "Any",
};

function matches(
  data: Data,
  activity: Activity,
  patch: Partial<ExplorationFilters> = {},
) {
  return matchesBeaconFilters(
    data,
    activity,
    "viewer",
    { ...allFilters, ...patch },
    now,
  );
}

test("map filters fail closed for mismatched viewer snapshots and inaccessible private Beacon rows", () => {
  const data = baseData();
  const privateBeacon = beacon("private", { owner_id: "someone-else" });
  data.activities.push(privateBeacon);
  data.places.push({
    activity_id: privateBeacon.id,
    label: "Private house",
    latitude: 41.8,
    longitude: -87.6,
    online_url: null,
  });
  assert.equal(matches(data, privateBeacon), false);
  assert.equal(
    canReadBeaconMeetingDetails(data, privateBeacon, "viewer"),
    false,
  );

  const owned = beacon("owned");
  data.activities.push(owned);
  data.viewer_id = "stale-viewer";
  assert.equal(matches(data, owned), false);
  assert.equal(canReadBeaconMeetingDetails(data, owned, "viewer"), false);
});

test("pending invite can read the Beacon title but not raw meeting-place details or place-query matches", () => {
  const data = baseData();
  const invite = beacon("invite", {
    owner_id: "host",
    audience: "friends",
    audience_id: null,
    mode: "invite",
    approval_required: true,
  });
  data.friendships.push({
    id: "friend",
    sender_id: "viewer",
    recipient_id: "host",
    status: "accepted",
  });
  data.beacon_invitation_grants.push({
    activity_id: invite.id,
    user_id: "viewer",
    invited_by: "host",
    created_at: new Date(now).toISOString(),
  });
  data.activities.push(invite);
  data.places.push({
    activity_id: invite.id,
    label: "Hidden room 42",
    latitude: 41.8,
    longitude: -87.6,
    online_url: null,
  });
  assert.equal(matches(data, invite), true);
  assert.equal(canReadBeaconMeetingDetails(data, invite, "viewer"), false);
  assert.equal(
    matchesBeaconFilters(data, invite, "viewer", allFilters, now, {
      query: "Hidden room 42",
    }),
    false,
  );
  data.rsvps.push({
    activity_id: invite.id,
    user_id: "viewer",
    status: "going",
    approved: true,
  });
  assert.equal(canReadBeaconMeetingDetails(data, invite, "viewer"), true);
});

test("public readable non-approval Beacons keep place search and physical filters", () => {
  const data = baseData();
  const cafe = beacon("cafe", { owner_id: "host", audience: "friends" });
  data.friendships.push({
    id: "friend",
    sender_id: "viewer",
    recipient_id: "host",
    status: "accepted",
  });
  data.activities.push(cafe);
  data.places.push({
    activity_id: cafe.id,
    label: "Public cafe",
    latitude: 41.8,
    longitude: -87.6,
    online_url: null,
  });
  assert.equal(canReadBeaconMeetingDetails(data, cafe, "viewer"), true);
  assert.equal(
    matchesBeaconFilters(
      data,
      cafe,
      "viewer",
      { ...allFilters, format: "Physical" },
      now,
    ),
    true,
  );
  assert.equal(
    matchesBeaconFilters(data, cafe, "viewer", allFilters, now, {
      query: "Public cafe",
    }),
    true,
  );
});

test("date filters use local overlap and the nearest current or coming weekend only", () => {
  const data = baseData();
  const todayOngoing = beacon("today-ongoing", {
    starts_at: "2026-10-03T22:00:00.000Z",
    ends_at: "2026-10-04T18:00:00.000Z",
  });
  const multiDayTonight = beacon("multi-night", {
    starts_at: "2026-10-03T22:00:00.000Z",
    ends_at: "2026-10-05T02:00:00.000Z",
  });
  const endedBeforeEvening = beacon("last-night", {
    starts_at: "2026-10-03T22:00:00.000Z",
    ends_at: "2026-10-04T04:00:00.000Z",
  });
  const tomorrowMorning = beacon("tomorrow-morning", {
    starts_at: "2026-10-05T10:00:00.000Z",
    ends_at: "2026-10-05T11:00:00.000Z",
  });
  const endsAtMidnight = beacon("ends-at-midnight", {
    starts_at: "2026-10-03T20:00:00.000Z",
    ends_at: "2026-10-04T00:00:00.000Z",
  });
  const endsAtEvening = beacon("ends-at-evening", {
    starts_at: "2026-10-04T10:00:00.000Z",
    ends_at: "2026-10-04T17:00:00.000Z",
  });
  const currentWeekend = beacon("current-weekend", {
    starts_at: "2026-10-02T17:00:00.000Z",
    ends_at: "2026-10-03T18:00:00.000Z",
  });
  const nextWeekend = beacon("next-weekend", {
    starts_at: "2026-10-09T17:00:00.000Z",
    ends_at: "2026-10-10T18:00:00.000Z",
  });
  data.activities.push(
    todayOngoing,
    multiDayTonight,
    endedBeforeEvening,
    tomorrowMorning,
    endsAtMidnight,
    endsAtEvening,
    currentWeekend,
    nextWeekend,
  );
  assert.equal(matches(data, todayOngoing, { when: "Today" }), true);
  assert.equal(matches(data, multiDayTonight, { when: "Tonight" }), true);
  assert.equal(matches(data, endedBeforeEvening, { when: "Tonight" }), false);
  assert.equal(matches(data, endsAtEvening, { when: "Tonight" }), false);
  assert.equal(matches(data, endsAtMidnight, { when: "Today" }), false);
  assert.equal(matches(data, tomorrowMorning, { when: "Tonight" }), false);
  assert.equal(matches(data, tomorrowMorning, { when: "Tomorrow" }), true);
  assert.equal(matches(data, currentWeekend, { when: "Weekend" }), true);
  assert.equal(matches(data, nextWeekend, { when: "Weekend" }), false);
  const justAfterEveningStarts = beacon("evening-minute", {
    ends_at: "2026-10-04T17:01:00.000Z",
  });
  data.activities.push(justAfterEveningStarts);
  assert.equal(
    matches(data, justAfterEveningStarts, { when: "Tonight" }),
    true,
  );
});

test("join filters exclude solo, closed, and ineligible invite-only Beacons", () => {
  const data = baseData();
  const solo = beacon("solo", { mode: "solo", target_count: 3 });
  const closed = beacon("closed", {
    manual_closed: true,
    capacity_policy: "strict",
    capacity_limit: 5,
  });
  const invite = beacon("invite", {
    owner_id: "host",
    mode: "invite",
    audience: "friends",
    approval_required: true,
  });
  data.activities.push(solo, closed, invite);
  data.friendships.push({
    id: "friend",
    sender_id: "viewer",
    recipient_id: "host",
    status: "accepted",
  });
  assert.equal(matches(data, solo, { join: "Open" }), false);
  assert.equal(matches(data, solo, { join: "Needs People" }), false);
  assert.equal(matches(data, closed, { join: "Spots Available" }), false);
  assert.equal(matches(data, invite, { join: "Request Approval" }), false);
  data.beacon_invitation_grants.push({
    activity_id: invite.id,
    user_id: "viewer",
    invited_by: "host",
    created_at: new Date(now).toISOString(),
  });
  assert.equal(matches(data, invite, { join: "Request Approval" }), true);
});
