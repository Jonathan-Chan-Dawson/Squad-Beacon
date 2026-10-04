import test from "node:test";
import assert from "node:assert/strict";
import {
  canJoinTeam,
  canManageMemory,
  canReadMemory,
  type BeaconMemory,
} from "../src/features/beacons/models";
import { emptyData, type Activity, type Profile } from "../src/shared/types";

const activity: Activity = {
  id: "beacon",
  owner_id: "host",
  title: "Practice",
  category: "Fitness",
  mode: "squad",
  starts_at: "2026-10-01T15:00:00.000Z",
  ends_at: "2026-10-01T16:00:00.000Z",
  timezone: "America/Chicago",
  approval_required: false,
  status: "scheduled",
  goal_id: null,
  habit_id: null,
  plan_id: null,
  plan_step_index: null,
  aspiration_ids: [],
  audience: "friends",
  audience_id: null,
  enable_scoreboard: true,
  scoreboard_max_team_size: 2,
  viewer_can_access: true,
};

function profile(
  id: string,
  visibility: Profile["profile_visibility"] = "public",
): Profile {
  return {
    id,
    username: id,
    name: id,
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
    profile_visibility: visibility,
  };
}

function memberData() {
  const data = emptyData();
  data.is_demo = true;
  data.viewer_id = "guest";
  data.activities.push(activity);
  data.rsvps.push({
    activity_id: activity.id,
    user_id: "guest",
    status: "going",
    approved: true,
  });
  data.beacon_teams.push({
    id: "team",
    activity_id: activity.id,
    name: "Blue",
    score: 0,
    created_at: "2026-10-01T12:00:00.000Z",
    member_count: 1,
  });
  return data;
}

test("safe occupancy count prevents overbooking without exposing hidden identities", () => {
  const data = memberData();
  data.is_demo = false;
  data.beacon_team_members.push({
    team_id: "team",
    user_id: "private-member",
    joined_at: "2026-10-01T12:05:00.000Z",
  });
  data.blocks.push({ blocker_id: "guest", blocked_id: "private-member" });
  // RLS may hide the member row, but the server-projected count is viewer-safe.
  data.beacon_team_members = [];
  data.beacon_teams[0].member_count = 2;
  assert.equal(canJoinTeam(data, activity, "team", "guest", 2), false);
});

test("capacity-limited live snapshot fails closed without projected occupancy", () => {
  const data = memberData();
  data.is_demo = false;
  data.beacon_teams[0].member_count = undefined;
  assert.equal(canJoinTeam(data, activity, "team", "guest", 2), false);
});

test("demo capacity ignores stale withdrawn or owner-blocked memberships", () => {
  const data = memberData();
  data.beacon_teams[0].member_count = undefined;
  data.beacon_team_members.push({
    team_id: "team",
    user_id: "former-guest",
    joined_at: "2026-10-01T12:05:00.000Z",
  });
  data.rsvps.push({
    activity_id: activity.id,
    user_id: "former-guest",
    status: "out",
    approved: true,
  });
  assert.equal(canJoinTeam(data, activity, "team", "guest", 2), true);
});

test("private author profile hides Beacon Memory metadata from an otherwise authorized attendee", () => {
  const data = memberData();
  data.profiles = [
    profile("host"),
    profile("guest"),
    profile("private-author", "friends"),
  ];
  data.viewer_id = "guest";
  data.rsvps.push({
    activity_id: activity.id,
    user_id: "private-author",
    status: "going",
    approved: true,
  });
  const memory: BeaconMemory = {
    id: "memory",
    activity_id: activity.id,
    author_id: "private-author",
    object_path: "demo://beacon/private-author/memory",
    media_type: "image",
    duration_seconds: null,
    caption: "private note",
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
  };
  data.beacon_memories.push(memory);
  assert.equal(
    canReadMemory(
      data,
      { ...activity, enable_experiences: true },
      memory,
      "guest",
    ),
    false,
  );
});

test("withdrawn creator cannot edit/delete Beacon Memory metadata", () => {
  const data = memberData();
  data.viewer_id = "guest";
  data.profiles = [profile("host"), profile("guest")];
  data.beacon_memories.push({
    id: "memory",
    activity_id: activity.id,
    author_id: "guest",
    object_path: "demo://beacon/guest/memory",
    media_type: "image",
    duration_seconds: null,
    caption: "caption",
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
  });
  data.rsvps[0].status = "out";
  assert.equal(canManageMemory(data, data.beacon_memories[0], "guest"), false);
});
