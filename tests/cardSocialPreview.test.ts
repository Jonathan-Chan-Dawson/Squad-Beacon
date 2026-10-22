import test from "node:test";
import assert from "node:assert/strict";
import { cardSocialPreview } from "../src/features/beacons/cardSocialPreview";
import { DEMO_ID, makeDemo } from "../src/shared/demo";
import type { Data, Profile } from "../src/shared/types";

function profile(data: Data, id: string, visible = true): Profile {
  const template = data.profiles.find((person) => person.id === DEMO_ID)!;
  return {
    ...template,
    id,
    username: id,
    name: id,
    viewer_can_view_full_profile: visible,
  };
}

function fixture({ owner = DEMO_ID }: { owner?: string } = {}) {
  const data = makeDemo();
  const activity = {
    ...data.activities[0],
    id: "people-preview",
    owner_id: owner,
    mode: "squad" as const,
    audience: "friends" as const,
    approval_required: false,
    accepted_seat_count: 23,
    capacity_limit: null,
    capacity_policy: "soft" as const,
    viewer_can_access: true,
  };
  data.activities = [activity];
  data.is_demo = false;
  data.viewer_id = DEMO_ID;
  data.profiles = [profile(data, DEMO_ID, true)];
  if (owner !== DEMO_ID) data.profiles.push(profile(data, owner));
  data.rsvps = [];
  data.friendships = [];
  data.blocks = [];
  return data;
}

function addProfiles(data: Data, ids: string[], hidden: string[] = []) {
  const existing = new Set(data.profiles.map((person) => person.id));
  for (const id of ids) {
    if (!existing.has(id)) data.profiles.push(profile(data, id, !hidden.includes(id)));
  }
}

function addGoing(data: Data, ids: string[], approved = true) {
  data.rsvps.push(
    ...ids.map((user_id) => ({
      activity_id: "people-preview",
      user_id,
      status: "going" as const,
      approved,
    })),
  );
}

function addFriends(data: Data, ids: string[]) {
  data.friendships.push(
    ...ids.map((id) => ({
      id: `friend-${id}`,
      sender_id: DEMO_ID,
      recipient_id: id,
      status: "accepted" as const,
    })),
  );
}

test("read access keeps the existing friend preview but does not grant general roster faces", () => {
  const data = fixture({ owner: "host" });
  addProfiles(data, ["host", "friend", "other"]);
  addGoing(data, ["friend", "other"]);
  addFriends(data, ["friend"]);

  const preview = cardSocialPreview(data, DEMO_ID, "people-preview")!;
  assert.equal(preview.rosterAllowed, false);
  assert.deepEqual(preview.friendAvatars.map((person) => person.id), ["friend"]);
  assert.deepEqual(preview.attendeeAvatars, []);
});

test("only approved Going attendees with visible profiles enter the roster preview", () => {
  const data = fixture();
  data.activities[0].approval_required = true;
  addProfiles(
    data,
    ["friend-visible", "friend-hidden", "requested", "unapproved", "maybe", "declined"],
    ["friend-hidden"],
  );
  addFriends(data, ["friend-visible", "friend-hidden"]);
  data.rsvps = [
    { activity_id: "people-preview", user_id: "friend-visible", status: "going", approved: true },
    { activity_id: "people-preview", user_id: "friend-hidden", status: "going", approved: true },
    { activity_id: "people-preview", user_id: "requested", status: "requested", approved: false },
    { activity_id: "people-preview", user_id: "unapproved", status: "going", approved: false },
    { activity_id: "people-preview", user_id: "maybe", status: "interested", approved: true },
    { activity_id: "people-preview", user_id: "declined", status: "declined", approved: true },
  ];

  const preview = cardSocialPreview(data, DEMO_ID, "people-preview")!;
  assert.deepEqual(
    preview.attendeeAvatars.map((person) => person.id),
    ["friend-visible", DEMO_ID],
  );
  assert.deepEqual(preview.friendAvatars.map((person) => person.id), ["friend-visible"]);
});

test("attendee ordering puts visible friends first and uses IDs for stable ties", () => {
  const data = fixture({ owner: "host" });
  addProfiles(data, ["host", "viewer-friend-z", "viewer-friend-a", "other-z", "other-a"]);
  addGoing(data, [DEMO_ID, "viewer-friend-z", "viewer-friend-a", "other-z", "other-a"]);
  addFriends(data, ["viewer-friend-z", "viewer-friend-a"]);

  const preview = cardSocialPreview(data, DEMO_ID, "people-preview")!;
  assert.deepEqual(
    preview.attendeeAvatars.map((person) => person.id),
    ["viewer-friend-a", "viewer-friend-z", DEMO_ID],
  );
});

test("an authorized own-host preview shows the host with zero friends and among its three faces", () => {
  const data = fixture();
  const hostOnly = cardSocialPreview(data, DEMO_ID, "people-preview")!;
  assert.equal(hostOnly.friendCount, 0);
  assert.deepEqual(hostOnly.attendeeAvatars.map((person) => person.id), [DEMO_ID]);

  addProfiles(data, ["friend-c", "friend-a", "friend-b"]);
  addGoing(data, ["friend-c", "friend-a", "friend-b"]);
  addFriends(data, ["friend-c", "friend-a", "friend-b"]);

  const preview = cardSocialPreview(data, DEMO_ID, "people-preview")!;
  assert.deepEqual(
    preview.attendeeAvatars.map((person) => person.id),
    ["friend-a", "friend-b", DEMO_ID],
  );
  assert.equal(preview.host?.id, DEMO_ID);
});

test("viewer mismatches and denied activity projections fail closed", () => {
  const data = fixture();
  assert.equal(cardSocialPreview(data, "someone-else", "people-preview"), null);
  data.activities[0].viewer_can_access = false;
  assert.equal(cardSocialPreview(data, DEMO_ID, "people-preview"), null);
});

test("a host block removes the attendee from the roster preview", () => {
  const data = fixture({ owner: "host" });
  addProfiles(data, ["host-blocked"]);
  addGoing(data, [DEMO_ID, "host-blocked"]);
  data.blocks.push({ blocker_id: "host", blocked_id: "host-blocked" });

  const preview = cardSocialPreview(data, DEMO_ID, "people-preview")!;
  assert.equal(preview.rosterAllowed, true);
  const ids = preview.attendeeAvatars.map((person) => person.id);
  assert.ok(ids.includes("host"));
  assert.ok(!ids.includes("host-blocked"));
});

test("the canonical accepted-seat count is independent of visible attendee faces", () => {
  const data = fixture();
  data.activities[0].accepted_seat_count = 41;
  addProfiles(data, ["hidden-a", "hidden-b", "hidden-c"], ["hidden-a", "hidden-b", "hidden-c"]);
  addGoing(data, ["hidden-a", "hidden-b", "hidden-c"]);

  const preview = cardSocialPreview(data, DEMO_ID, "people-preview")!;
  assert.equal(preview.capacity.count, 41);
  assert.deepEqual(preview.attendeeAvatars.map((person) => person.id), [DEMO_ID]);
  assert.equal(preview.attendeeAvatars.length < preview.capacity.count, true);
});
