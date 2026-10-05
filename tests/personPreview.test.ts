import test from "node:test";
import assert from "node:assert/strict";
import {
  canViewBeaconMeetingDetails,
  selectFreshVisiblePersonLocation,
  selectPersonPreview,
} from "../src/features/people/previews/personPreview";
import {
  emptyData,
  type Activity,
  type Data,
  type ID,
  type Profile,
} from "../src/shared/types";

const now = Date.parse("2026-10-04T15:00:00.000Z");

function profile(
  id: ID,
  visibility: Profile["profile_visibility"] = "friends",
): Profile {
  return {
    id,
    username: id,
    name: id === "jordan" ? "Jordan Ellis" : id,
    bio: "A little private bio",
    interests: ["walking"],
    identity_tags: [],
    aspiration_goals: [],
    onboarding_survey_status: "completed",
    featured_activity_id: null,
    hide_featured: false,
    timezone: "UTC",
    quiet_start: 22,
    quiet_end: 8,
    profile_visibility: visibility,
  };
}

function baseData(): Data {
  const data = emptyData();
  data.is_demo = true;
  data.viewer_id = "viewer";
  data.profiles.push(profile("viewer"), profile("jordan"));
  data.friendships.push({
    id: "friendship",
    sender_id: "viewer",
    recipient_id: "jordan",
    status: "accepted",
  });
  return data;
}

function beacon(
  id: string,
  ownerId: string,
  overrides: Partial<Activity> = {},
): Activity {
  return {
    id,
    owner_id: ownerId,
    title: "A few rounds. Good company.",
    description: "Meet near the garden gate.",
    category: "Social",
    mode: "squad",
    starts_at: new Date(now - 15 * 60_000).toISOString(),
    ends_at: new Date(now + 45 * 60_000).toISOString(),
    timezone: "UTC",
    approval_required: false,
    status: "scheduled",
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    audience: "friends",
    audience_id: null,
    ...overrides,
  };
}

function location(overrides: Partial<Data["locations"][number]> = {}) {
  return {
    id: "location-jordan",
    owner_id: "jordan",
    latitude: 41.8819,
    longitude: -87.6278,
    updated_at: new Date(now - 60_000).toISOString(),
    expires_at: new Date(now + 10 * 60_000).toISOString(),
    ...overrides,
  };
}

test("Person preview resolves an accepted friend's current identity, explicit status, Beacon, and fresh map location", () => {
  const data = baseData();
  data.activities.push(
    beacon("jordan-live-status", "jordan", {
      mode: "solo",
      available: true,
      ends_at: new Date(now + 20 * 60_000).toISOString(),
    }),
  );
  data.locations.push(location());

  const selected = selectPersonPreview(data, "jordan", "viewer", now);
  assert.equal(selected.canMessage, true);
  assert.equal(selected.canViewFullProfile, true);
  assert.equal(selected.profile?.name, "Jordan Ellis");
  assert.equal(selected.availability, "ending-soon");
  assert.equal(selected.beacon?.id, "jordan-live-status");
  assert.equal(selected.canViewMap, true);
});

test("blocks and mismatched snapshots fail closed for identity, Beacon, map, and shared contexts", () => {
  const data = baseData();
  data.activities.push(beacon("friend-beacon", "jordan"));
  data.locations.push(location());
  data.blocks.push({ blocker_id: "jordan", blocked_id: "viewer" });

  const blocked = selectPersonPreview(data, "jordan", "viewer", now);
  assert.equal(blocked.canMessage, false);
  assert.equal(blocked.canViewFullProfile, false);
  assert.equal(blocked.profile, undefined);
  assert.equal(blocked.beacon, undefined);
  assert.equal(blocked.canViewMap, false);
  assert.deepEqual(blocked.sharedContexts, []);

  data.blocks = [];
  data.viewer_id = "someone-else";
  const stale = selectPersonPreview(data, "jordan", "viewer", now);
  assert.equal(stale.canMessage, false);
  assert.equal(stale.profile, undefined);
  assert.equal(stale.beacon, undefined);
  assert.equal(stale.canViewMap, false);
});

test("View Map requires fresh, finite, geographically valid shared coordinates", () => {
  const data = baseData();
  const valid = location();
  data.locations.push(valid);
  assert.equal(
    !!selectFreshVisiblePersonLocation(data, "jordan", "viewer", now),
    true,
  );

  for (const invalid of [
    { latitude: null, longitude: -87.6 },
    { latitude: 91, longitude: -87.6 },
    { latitude: 41.8, longitude: Number.NaN },
    {
      latitude: 41.8,
      longitude: -87.6,
      updated_at: new Date(now - 6 * 60_000).toISOString(),
    },
    {
      latitude: 41.8,
      longitude: -87.6,
      expires_at: new Date(now - 1).toISOString(),
    },
  ]) {
    data.locations = [location(invalid)];
    const selected = selectPersonPreview(data, "jordan", "viewer", now);
    assert.equal(selected.canViewMap, false);
    assert.equal(
      selectFreshVisiblePersonLocation(data, "jordan", "viewer", now),
      undefined,
    );
  }
});

test("invited or pending Beacon viewers do not get meeting details until approved Going", () => {
  const data = baseData();
  const invited = beacon("host-invite", "host", {
    audience: "private",
    audience_id: null,
    mode: "invite",
    approval_required: true,
  });
  data.activities.push(invited);
  data.profiles.push(profile("host"));
  data.beacon_invitation_grants.push(
    {
      activity_id: invited.id,
      user_id: "jordan",
      invited_by: "host",
      created_at: new Date(now - 10_000).toISOString(),
    },
    {
      activity_id: invited.id,
      user_id: "viewer",
      invited_by: "host",
      created_at: new Date(now - 10_000).toISOString(),
    },
  );
  data.places.push({
    activity_id: invited.id,
    label: "Private garden entrance",
    latitude: 41.88,
    longitude: -87.62,
    online_url: null,
  });
  data.rsvps.push({
    activity_id: invited.id,
    user_id: "jordan",
    status: "requested",
    approved: false,
  });

  assert.equal(canViewBeaconMeetingDetails(data, invited.id, "viewer"), false);
  assert.equal(
    selectPersonPreview(data, "jordan", "viewer", now).beacon,
    undefined,
  );

  data.rsvps[0] = { ...data.rsvps[0]!, status: "going", approved: true };
  const selected = selectPersonPreview(data, "jordan", "viewer", now);
  assert.equal(selected.beacon?.id, invited.id);
  assert.equal(canViewBeaconMeetingDetails(data, invited.id, "viewer"), false);
  data.rsvps.push({
    activity_id: invited.id,
    user_id: "viewer",
    status: "going",
    approved: true,
  });
  assert.equal(canViewBeaconMeetingDetails(data, invited.id, "viewer"), true);

  data.rsvps[1] = { ...data.rsvps[1]!, status: "requested", approved: false };
  assert.equal(canViewBeaconMeetingDetails(data, invited.id, "viewer"), false);
});

test("inaccessible Beacon and unapproved attendance never become a Person preview Beacon", () => {
  const data = baseData();
  const hidden = beacon("hidden-host-beacon", "host", {
    audience: "private",
    audience_id: null,
    mode: "invite",
    approval_required: true,
  });
  data.profiles.push(profile("host"));
  data.activities.push(hidden);
  data.places.push({
    activity_id: hidden.id,
    label: "Do not expose this place",
    latitude: 41.88,
    longitude: -87.62,
    online_url: null,
  });
  data.rsvps.push({
    activity_id: hidden.id,
    user_id: "jordan",
    status: "going",
    approved: false,
  });

  const selected = selectPersonPreview(data, "jordan", "viewer", now);
  assert.equal(selected.beacon, undefined);
  assert.equal(canViewBeaconMeetingDetails(data, hidden.id, "viewer"), false);
});

test("ordinary readable open Beacons expose meeting details before an RSVP", () => {
  const data = baseData();
  const openBeacon = beacon("open-beacon", "jordan");
  data.activities.push(openBeacon);
  data.places.push({
    activity_id: openBeacon.id,
    label: "Public cafe",
    latitude: 41.88,
    longitude: -87.62,
    online_url: null,
  });
  assert.equal(
    canViewBeaconMeetingDetails(data, openBeacon.id, "viewer"),
    true,
  );
  data.viewer_id = "someone-else";
  assert.equal(
    canViewBeaconMeetingDetails(data, openBeacon.id, "viewer"),
    false,
  );
});

test("a current approved-participant Beacon outranks a future Beacon hosted by the profile owner", () => {
  const data = baseData();
  data.profiles.push(profile("host"));
  const currentWithFriend = beacon("host-current", "host", {
    starts_at: new Date(now - 15 * 60_000).toISOString(),
    ends_at: new Date(now + 45 * 60_000).toISOString(),
  });
  const jordanFuture = beacon("jordan-future", "jordan", {
    starts_at: new Date(now + 60 * 60_000).toISOString(),
    ends_at: new Date(now + 2 * 60 * 60_000).toISOString(),
  });
  data.activities.push(currentWithFriend, jordanFuture);
  data.rsvps.push(
    {
      activity_id: currentWithFriend.id,
      user_id: "jordan",
      status: "going",
      approved: true,
    },
    {
      activity_id: currentWithFriend.id,
      user_id: "viewer",
      status: "going",
      approved: true,
    },
  );

  assert.equal(
    selectPersonPreview(data, "jordan", "viewer", now).beacon?.id,
    currentWithFriend.id,
  );
});

test("shared Squad context respects the owner-block gate for both members", () => {
  const data = baseData();
  data.profiles.push(profile("squad-owner"));
  data.squads.push({
    id: "shared-squad",
    owner_id: "squad-owner",
    name: "Book club",
    description: "",
  });
  data.squad_members.push(
    { squad_id: "shared-squad", user_id: "viewer", role: "member" },
    { squad_id: "shared-squad", user_id: "jordan", role: "member" },
  );
  assert.equal(
    selectPersonPreview(data, "jordan", "viewer", now).sharedContexts.some(
      (context) => context.id === "shared-squad",
    ),
    true,
  );

  data.blocks.push({ blocker_id: "squad-owner", blocked_id: "viewer" });
  assert.equal(
    selectPersonPreview(data, "jordan", "viewer", now).sharedContexts.some(
      (context) => context.id === "shared-squad",
    ),
    false,
  );
  data.blocks = [{ blocker_id: "squad-owner", blocked_id: "jordan" }];
  assert.equal(
    selectPersonPreview(data, "jordan", "viewer", now).sharedContexts.some(
      (context) => context.id === "shared-squad",
    ),
    false,
  );
});

test("a readable public profile remains previewable after friendship ends without message or Star rights", () => {
  const data = baseData();
  data.is_demo = false;
  data.profiles[data.profiles.findIndex((row) => row.id === "jordan")] = {
    ...profile("jordan", "public"),
    viewer_can_view_full_profile: true,
  };
  data.friendships = [];
  data.favorites.push({ owner_id: "viewer", kind: "friend", target_id: "jordan" });

  const selected = selectPersonPreview(data, "jordan", "viewer", now);
  assert.equal(selected.canMessage, false);
  assert.equal(selected.canViewFullProfile, true);
  assert.equal(selected.profile?.name, "Jordan Ellis");
  assert.equal(selected.starred, false);
});
