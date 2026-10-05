import assert from "node:assert/strict";
import test from "node:test";
import {
  canOpenSquadPing,
  pendingSocialCount,
  searchablePeople,
  squadChatRowSummary,
} from "@/src/features/people/communication";
import type { PlanningThread } from "@/src/features/planning/types";
import { emptyData, type Profile } from "@/src/shared/types";

function profile(id: string, name: string, canView = true): Profile {
  return {
    id,
    username: id,
    name,
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
    profile_visibility: "public",
    viewer_can_view_full_profile: canView,
  };
}

function squadPingData() {
  const data = emptyData();
  data.viewer_id = "viewer";
  data.squads.push({
    id: "squad",
    owner_id: "host",
    name: "Boxing crew",
    description: "",
  });
  data.squad_members.push(
    { squad_id: "squad", user_id: "host", role: "owner" },
    { squad_id: "squad", user_id: "viewer", role: "member" },
  );
  const thread: PlanningThread = {
    id: "ping",
    owner_id: "host",
    coowner_ids: [],
    kind: "ping",
    title: "A quick boxing session?",
    body: "",
    audience: "squad",
    audience_id: "squad",
    deadline_at: new Date(Date.now() + 60_000).toISOString(),
    status: "open",
    payload: null,
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };
  return { data, thread };
}

test("Squad Ping card jumps require a matching snapshot and current Squad membership", () => {
  const { data, thread } = squadPingData();
  assert.equal(canOpenSquadPing(data, thread, "viewer"), true);

  data.squad_members = data.squad_members.filter(
    (member) => member.user_id !== "viewer",
  );
  assert.equal(canOpenSquadPing(data, thread, "viewer"), false);

  data.squad_members.push({ squad_id: "squad", user_id: "viewer", role: "member" });
  data.viewer_id = "other-viewer";
  assert.equal(canOpenSquadPing(data, thread, "viewer"), false);

  data.viewer_id = "viewer";
  assert.equal(
    canOpenSquadPing(data, { ...thread, audience: "friends" }, "viewer"),
    false,
  );
});

test("Squad chat rows link a newer Ping and separate its pending response from unread messages", () => {
  const { data, thread } = squadPingData();
  const now = Date.now();
  thread.created_at = new Date(now - 2_000).toISOString();
  thread.deadline_at = new Date(now + 60_000).toISOString();
  data.planning_threads.push(thread);

  const unanswered = squadChatRowSummary(
    data,
    "squad",
    "viewer",
    { body: "Older chat note", created_at: new Date(now - 3_000).toISOString() },
    "Plan something together",
    now,
  );
  assert.equal(unanswered.preview, "Ping · A quick boxing session?");
  assert.equal(unanswered.latest, thread.created_at);
  assert.equal(unanswered.pingId, thread.id);
  assert.equal(unanswered.needsResponse, true);

  data.planning_ping_responses.push({
    thread_id: thread.id,
    user_id: "viewer",
    response: "interested",
    auto_rsvp: false,
    created_at: new Date(now - 1_000).toISOString(),
    updated_at: new Date(now - 1_000).toISOString(),
  });
  const answered = squadChatRowSummary(
    data,
    "squad",
    "viewer",
    { body: "Older chat note", created_at: new Date(now - 3_000).toISOString() },
    "Plan something together",
    now,
  );
  assert.equal(
    answered.preview,
    "Ping · A quick boxing session? · You replied Interested",
  );
  assert.equal(answered.needsResponse, false);
});

test("Squad summaries ignore broadcast Friend Pings and fail closed for blocked or stale access", () => {
  const { data, thread } = squadPingData();
  const now = Date.now();
  data.planning_threads.push({
    ...thread,
    id: "friend-ping",
    audience: "friends",
    audience_id: null,
    created_at: new Date(now).toISOString(),
  });
  const friendPing = squadChatRowSummary(
    data,
    "squad",
    "viewer",
    { body: "DM preview", created_at: new Date(now - 1_000).toISOString() },
    "Plan something together",
    now,
  );
  assert.equal(friendPing.preview, "DM preview");
  assert.equal(friendPing.pingId, undefined);
  assert.equal(friendPing.needsResponse, false);

  data.blocks.push({ blocker_id: "host", blocked_id: "viewer" });
  const blocked = squadChatRowSummary(
    data,
    "squad",
    "viewer",
    undefined,
    "Plan something together",
    now,
  );
  assert.deepEqual(blocked, {
    preview: "Plan something together",
    latest: "",
    needsResponse: false,
  });

  data.blocks = [];
  data.viewer_id = "another-viewer";
  const stale = squadChatRowSummary(
    data,
    "squad",
    "viewer",
    undefined,
    "Plan something together",
    now,
  );
  assert.equal(stale.pingId, undefined);
  assert.equal(stale.needsResponse, false);
});

test("pending social count includes actionable invitations and fails closed for stale snapshots", () => {
  const data = emptyData();
  data.viewer_id = "viewer";
  data.friendships.push({
    id: "request",
    sender_id: "friend",
    recipient_id: "viewer",
    status: "pending",
  });
  data.squad_invites.push({
    id: "invite",
    squad_id: "squad",
    sender_id: "owner",
    recipient_id: "viewer",
  });
  assert.equal(pendingSocialCount(data, "viewer", Date.now()), 2);
  data.messages.push({
    id: "chat",
    author_id: "friend",
    recipient_id: "viewer",
    activity_id: null,
    body: "Hello",
    created_at: new Date().toISOString(),
  });
  assert.equal(pendingSocialCount(data, "viewer", Date.now()), 2);
  data.viewer_id = "another-viewer";
  assert.equal(pendingSocialCount(data, "viewer", Date.now()), 0);
});

test("search-only People results exclude friends, private profiles, blocks, and stale snapshots", () => {
  const data = emptyData();
  data.viewer_id = "viewer";
  data.profiles.push(
    profile("viewer", "My Name"),
    profile("friend", "Friendly Person"),
    profile("public", "Public Person"),
    profile("private", "Private Person", false),
    profile("blocked", "Blocked Person"),
  );
  data.friendships.push({
    id: "accepted",
    sender_id: "viewer",
    recipient_id: "friend",
    status: "accepted",
  });
  data.blocks.push({ blocker_id: "viewer", blocked_id: "blocked" });

  assert.deepEqual(searchablePeople(data, "viewer", "Person").map((item) => item.id), ["public"]);
  assert.deepEqual(searchablePeople(data, "viewer", "Private"), []);
  data.viewer_id = "someone-else";
  assert.deepEqual(searchablePeople(data, "viewer", "Public"), []);
});
