import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, demoAction, makeDemo } from "../src/shared/demo";
import { canViewProfile } from "../src/features/profile/privacy";
import { emptyData, type Data, type ID, type Profile } from "../src/shared/types";

test("demo unblocking removes only your block and does not grant friendship or location access", () => {
  const data = makeDemo();
  const target = data.profiles.find((person) => person.id !== DEMO_ID)!.id;
  data.blocks = [
    { blocker_id: DEMO_ID, blocked_id: target },
    { blocker_id: target, blocked_id: DEMO_ID },
  ];
  data.friendships = [];
  data.location_recipients = [];
  const result = demoAction(data, "unblock", { id: target });
  assert.deepEqual(result.blocks, [{ blocker_id: target, blocked_id: DEMO_ID }]);
  assert.deepEqual(result.friendships, []);
  assert.deepEqual(result.location_recipients, []);
  assert.equal(canViewProfile(result, target, DEMO_ID), false);
  assert.throws(() => demoAction(data, "unblock", { id: DEMO_ID }), /blocked person/i);
});

function profile(id: ID, visibility: Profile["profile_visibility"] = "public"): Profile {
  return {
    id,
    username: id,
    name: id,
    bio: "private bio",
    interests: ["music"],
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

function demoData(viewer: ID, profiles: Profile[]): Data {
  const data = emptyData();
  data.is_demo = true;
  data.viewer_id = viewer;
  data.profiles = profiles;
  return data;
}

test("public preserves the prior relationship visibility; friends excludes squad-only peers", () => {
  const data = demoData("viewer", [
    profile("viewer"),
    profile("friend", "friends"),
    profile("squad-peer", "friends"),
    profile("private-person", "friends"),
  ]);
  data.friendships.push({
    id: "friendship",
    sender_id: "viewer",
    recipient_id: "friend",
    status: "accepted",
  });
  data.squads.push({
    id: "squad",
    owner_id: "squad-peer",
    name: "Shared crew",
    description: "",
  });
  data.squad_members.push(
    { squad_id: "squad", user_id: "viewer", role: "member" },
    { squad_id: "squad", user_id: "squad-peer", role: "owner" },
  );

  assert.equal(canViewProfile(data, "friend", "viewer"), true);
  assert.equal(canViewProfile(data, "squad-peer", "viewer"), false);
  data.profiles.find((item) => item.id === "squad-peer")!.profile_visibility = "public";
  assert.equal(canViewProfile(data, "squad-peer", "viewer"), true);
  assert.equal(canViewProfile(data, "private-person", "viewer"), false);
});

test("custom profile access is OR across selected people, current squads, and owner's lists", () => {
  const data = demoData("viewer", [
    profile("viewer"),
    profile("selected-person", "custom"),
    profile("selected-squad", "custom"),
    profile("selected-list", "custom"),
    profile("other", "custom"),
  ]);
  data.profile_visibility_grants.push(
    { owner_id: "selected-person", kind: "person", target_id: "viewer" },
    { owner_id: "selected-squad", kind: "squad", target_id: "crew" },
    { owner_id: "selected-list", kind: "list", target_id: "close-friends" },
  );
  data.squads.push({ id: "crew", owner_id: "selected-squad", name: "Crew", description: "" });
  data.squad_members.push(
    { squad_id: "crew", user_id: "selected-squad", role: "owner" },
    { squad_id: "crew", user_id: "viewer", role: "member" },
  );
  data.lists.push({ id: "close-friends", owner_id: "selected-list", name: "Close friends" });
  data.list_members.push({ list_id: "close-friends", user_id: "viewer" });

  assert.equal(canViewProfile(data, "selected-person", "viewer"), true);
  assert.equal(canViewProfile(data, "selected-squad", "viewer"), true);
  assert.equal(canViewProfile(data, "selected-list", "viewer"), true);
  assert.equal(canViewProfile(data, "other", "viewer"), false);
  data.squad_members = data.squad_members.filter(
    (member) => member.user_id !== "selected-squad",
  );
  assert.equal(canViewProfile(data, "selected-squad", "viewer"), false);
});

test("blocks deny full profiles in either direction and stale or mismatched viewer data fails closed", () => {
  const data = demoData("viewer", [profile("viewer"), profile("friend")]);
  data.friendships.push({
    id: "friendship",
    sender_id: "viewer",
    recipient_id: "friend",
    status: "accepted",
  });
  assert.equal(canViewProfile(data, "friend", "viewer"), true);
  data.blocks.push({ blocker_id: "friend", blocked_id: "viewer" });
  assert.equal(canViewProfile(data, "friend", "viewer"), false);
  data.blocks = [{ blocker_id: "viewer", blocked_id: "friend" }];
  assert.equal(canViewProfile(data, "friend", "viewer"), false);
  assert.equal(canViewProfile(data, profile("removed"), "viewer"), false);
  assert.equal(canViewProfile(data, "friend", "someone-else"), false);
  data.viewer_id = null;
  assert.equal(canViewProfile(data, "friend", "viewer"), false);
});

test("public profile context respects an explicit private-beacon invitation without exposing it broadly", () => {
  const data = demoData("invitee", [profile("invitee"), profile("host")]);
  data.activities.push({
    id: "private-beacon",
    owner_id: "host",
    title: "Invite-only meetup",
    category: "Social",
    mode: "invite",
    starts_at: "2026-10-04T12:00:00.000Z",
    ends_at: "2026-10-04T13:00:00.000Z",
    timezone: "UTC",
    approval_required: true,
    status: "scheduled",
    // A stale projection must not hide a valid invitation fallback in demo.
    viewer_can_access: false,
    goal_id: null,
    habit_id: null,
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
    audience: "friends",
    audience_id: null,
  });
  data.rsvps.push({
    activity_id: "private-beacon",
    user_id: "invitee",
    status: "invited",
    approved: true,
  });
  data.beacon_invitation_grants.push({
    activity_id: "private-beacon",
    user_id: "invitee",
    invited_by: "host",
    created_at: "",
  });

  assert.equal(canViewProfile(data, "host", "invitee"), true);
  data.activity_exclusions.push({
    activity_id: "private-beacon",
    user_id: "invitee",
  });
  assert.equal(canViewProfile(data, "host", "invitee"), false);
  data.activity_exclusions = [];
  data.beacon_invitation_grants = [];
  data.rsvps = [];
  assert.equal(canViewProfile(data, "host", "invitee"), false);
});

test("signed-in snapshots trust only the server projection, not client grant arrays", () => {
  const data = demoData("viewer", [profile("viewer"), profile("friend", "custom")]);
  data.is_demo = false;
  data.profile_visibility_grants.push({
    owner_id: "friend",
    kind: "person",
    target_id: "viewer",
  });
  assert.equal(canViewProfile(data, "friend", "viewer"), false);
  data.profiles.find((item) => item.id === "friend")!.viewer_can_view_full_profile = true;
  assert.equal(canViewProfile(data, "friend", "viewer"), true);
  data.profiles.find((item) => item.id === "friend")!.viewer_can_view_full_profile = false;
  assert.equal(canViewProfile(data, "friend", "viewer"), false);
});

test("demo privacy updates mirror custom selections and always reject blocked targets", () => {
  const data = makeDemo();
  data.profiles.push(profile("custom-person"));
  const saved = demoAction(data, "save_profile_privacy", {
    profile_visibility: "custom",
    person_ids: ["custom-person"],
    squad_ids: [],
    list_ids: [],
  });
  assert.equal(
    saved.profiles.find((item) => item.id === DEMO_ID)?.profile_visibility,
    "custom",
  );
  saved.viewer_id = "custom-person";
  assert.equal(canViewProfile(saved, DEMO_ID, "custom-person"), true);
  saved.blocks.push({ blocker_id: "custom-person", blocked_id: DEMO_ID });
  assert.throws(
    () =>
      demoAction(saved, "save_profile_privacy", {
        profile_visibility: "custom",
        person_ids: ["custom-person"],
        squad_ids: [],
        list_ids: [],
      }),
    /unblocked people/,
  );
});
