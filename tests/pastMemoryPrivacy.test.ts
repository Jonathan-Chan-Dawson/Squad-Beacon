import assert from "node:assert/strict";
import test from "node:test";
import { emptyData, type Activity, type Profile } from "../src/shared/types";
import { selectPastMemoryPhotos } from "../src/features/beacons/pastMemoryPrivacy";
const activity: Activity = { id: "beacon", owner_id: "host", title: "Practice", category: "Fitness", mode: "squad", starts_at: "2026-10-01T15:00:00Z", ends_at: "2026-10-01T16:00:00Z", timezone: "UTC", approval_required: false, status: "completed", goal_id: null, habit_id: null, plan_id: null, plan_step_index: null, audience: "friends", audience_id: null, enable_experiences: false, viewer_can_access: true };
const profile = (id: string): Profile => ({ id, name: id, username: id, bio: "", interests: [], identity_tags: [], aspiration_goals: [], onboarding_survey_status: "completed", featured_activity_id: null, hide_featured: false, timezone: "UTC", quiet_start: 22, quiet_end: 8, profile_visibility: "public", viewer_can_view_full_profile: true });
function fixture() {
  const data = emptyData(); data.viewer_id = "viewer"; data.activities.push(activity); data.profiles.push(profile("viewer"), profile("host"), profile("author"));
  data.rsvps.push({ activity_id: "beacon", user_id: "viewer", status: "going", approved: true });
  data.beacon_memories.push({ id: "photo", activity_id: "beacon", author_id: "author", object_path: "beacon/author/photo.jpg", media_type: "image", duration_seconds: null, caption: "A good day", created_at: "2026-10-01T16:00:00Z", updated_at: "2026-10-01T16:00:00Z" });
  return data;
}
test("Past can show a readable photo when Experiences is paused", () => {
  assert.deepEqual(selectPastMemoryPhotos(fixture(), [activity], "viewer"), [{ activityId: "beacon", path: "beacon/author/photo.jpg" }]);
});
test("Historical photos require current viewer, attendee access and readable author", () => {
  const data = fixture(); data.viewer_id = "other";
  assert.deepEqual(selectPastMemoryPhotos(data, [activity], "viewer"), []);
  data.viewer_id = "viewer"; data.rsvps = [];
  assert.deepEqual(selectPastMemoryPhotos(data, [activity], "viewer"), []);
  data.rsvps.push({ activity_id: "beacon", user_id: "viewer", status: "going", approved: true });
  data.blocks.push({ blocker_id: "author", blocked_id: "viewer" });
  assert.deepEqual(selectPastMemoryPhotos(data, [activity], "viewer"), []);
});
test("Past never signs fabricated demo URLs or video paths as photo thumbnails", () => {
  const data = fixture(); data.beacon_memories[0].object_path = "demo://photo";
  assert.deepEqual(selectPastMemoryPhotos(data, [activity], "viewer"), []);
  data.beacon_memories[0].object_path = "beacon/author/video.mp4"; data.beacon_memories[0].media_type = "video";
  assert.deepEqual(selectPastMemoryPhotos(data, [activity], "viewer"), []);
});
