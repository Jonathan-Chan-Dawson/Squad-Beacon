import assert from "node:assert/strict";
import test from "node:test";
import { emptyData, type Profile } from "../src/shared/types";
import { filterHubConversations, selectHubConversations, selectStartChatFriends } from "../src/features/people/hubState";
import { pendingSocialCount } from "../src/features/people/communication";

const profile = (id: string): Profile => ({ id, name: id, username: id, bio: "", interests: [], identity_tags: [], aspiration_goals: [],
  onboarding_survey_status: "completed", featured_activity_id: null, hide_featured: false, timezone: "UTC", quiet_start: 22, quiet_end: 8, profile_visibility: "public", viewer_can_view_full_profile: true });
function fixture() {
  const data = emptyData(); data.viewer_id = "viewer";
  data.profiles.push(profile("viewer"), profile("friend"), profile("new-friend"), profile("host"));
  data.friendships.push({ id: "f1", sender_id: "viewer", recipient_id: "friend", status: "accepted" }, { id: "f2", sender_id: "viewer", recipient_id: "new-friend", status: "accepted" });
  data.messages.push({ id: "dm", activity_id: null, author_id: "friend", recipient_id: "viewer", body: "Coffee tomorrow?", created_at: "2026-10-08T12:00:00Z" });
  data.squads.push({ id: "crew", owner_id: "host", name: "Sketch crew", description: "Art together" });
  data.squad_members.push({ squad_id: "crew", user_id: "host", role: "owner" }, { squad_id: "crew", user_id: "viewer", role: "member" });
  data.group_messages.push({ id: "old", scope: "squad", scope_id: "crew", squad_id: "crew", organization_id: null, author_id: "host", body: "Already read", created_at: "2026-10-08T10:00:00Z" },
    { id: "new", scope: "squad", scope_id: "crew", squad_id: "crew", organization_id: null, author_id: "host", body: "Bring a pencil", created_at: "2026-10-08T13:00:00Z" });
  data.group_message_reads.push({ scope: "squad", scope_id: "crew", squad_id: "crew", organization_id: null, user_id: "viewer", last_read_at: "2026-10-08T10:00:00Z" });
  return data;
}
test("Hub uses authoritative Squad reads while DMs stay at zero unread and empty DMs stay in the tray", () => {
  const data = fixture(); const rows = selectHubConversations(data, "viewer");
  assert.equal(rows.find((row) => row.id === "crew")?.unread, 1);
  assert.equal(rows.find((row) => row.id === "friend")?.unread, 0);
  assert.equal(rows.some((row) => row.id === "new-friend"), false);
  assert.deepEqual(selectStartChatFriends(data, "viewer", "").map((row) => row.id), ["new-friend"]);
  assert.deepEqual(filterHubConversations(rows, "Unread", "").map((row) => row.id), ["crew"]);
  assert.equal(filterHubConversations(rows, "Friends", "coffee")[0]?.id, "friend");
  data.favorites.push({ owner_id: "viewer", kind: "friend", target_id: "friend" });
  assert.deepEqual(filterHubConversations(selectHubConversations(data, "viewer"), "Starred", "").map((row) => row.id), ["friend"]);
});
test("Hub rows fail closed for stale snapshots, blocked people and missing exact Squad membership", () => {
  const data = fixture();
  data.blocks.push({ blocker_id: "viewer", blocked_id: "friend" });
  data.squad_members = data.squad_members.filter((row) => row.user_id !== "viewer");
  assert.deepEqual(selectHubConversations(data, "viewer"), []);
  data.viewer_id = "another-person";
  assert.deepEqual(selectStartChatFriends(data, "viewer", ""), []);
  assert.deepEqual(selectHubConversations(data, "viewer"), []);
});
test("Hub ignores blocked Squad authors for preview and unread without changing the read cursor", () => {
  const data = fixture();
  data.group_messages.push({ id: "blocked", scope: "squad", scope_id: "crew", squad_id: "crew", organization_id: null, author_id: "blocked-author", body: "Private text", created_at: "2026-10-08T14:00:00Z" });
  data.blocks.push({ blocker_id: "blocked-author", blocked_id: "viewer" });
  const row = selectHubConversations(data, "viewer").find((item) => item.id === "crew");
  assert.equal(row?.unread, 1); assert.equal(row?.preview, "Bring a pencil");
  assert.equal(data.group_message_reads[0].last_read_at, "2026-10-08T10:00:00Z");
});
test("Response total counts each pending Space invitation once and rejects stale viewers", () => {
  const data = fixture(); data.space_members.push({ space_id: "space", user_id: "viewer", role: "member", status: "invited", invited_by: "host", created_at: "2026-10-08T14:00:00Z" });
  assert.equal(pendingSocialCount(data, "viewer"), 1);
  assert.equal(pendingSocialCount(data, "other"), 0);
});
