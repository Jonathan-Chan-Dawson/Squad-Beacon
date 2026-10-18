import test from "node:test";
import assert from "node:assert/strict";
import { emptyData, type Activity, type Profile } from "../src/shared/types";
import {
  parseProfileContentPage,
  selectProfileBeacon,
  selectProfileContent,
} from "../src/features/profile/profileContent";

const now = Date.parse("2026-10-18T15:00:00Z");
function fixture() {
  const data = emptyData();
  data.is_demo = true;
  data.viewer_id = "viewer";
  const person = (id: string): Profile => ({
    id,
    name: id,
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
  });
  data.profiles = [person("viewer"), person("friend"), person("other")];
  data.friendships = [
    {
      id: "friendship",
      sender_id: "viewer",
      recipient_id: "friend",
      status: "accepted",
    },
  ];
  function activity(
    id: string,
    owner = "friend",
    status: Activity["status"] = "completed",
    offset = -7200000,
  ) {
    const row: Activity = {
      id,
      owner_id: owner,
      title: id,
      category: "Study",
      mode: "squad",
      starts_at: new Date(now + offset).toISOString(),
      ends_at: new Date(now + offset + 3600000).toISOString(),
      timezone: "UTC",
      approval_required: false,
      status,
      goal_id: null,
      habit_id: null,
      plan_id: null,
      plan_step_index: null,
      aspiration_ids: [],
      audience: "friends",
      audience_id: null,
      enable_experiences: true,
    };
    data.activities.push(row);
    return row;
  }
  const memory = (
    id: string,
    activityId: string,
    author = "friend",
    type: "image" | "video" = "image",
  ) =>
    data.beacon_memories.push({
      id,
      activity_id: activityId,
      author_id: author,
      object_path: `${activityId}/${author}/${id}.jpg`,
      media_type: type,
      duration_seconds: type === "video" ? 10 : null,
      caption: "",
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
  return { data, activity, memory };
}
test("albums group only readable contributions; participation without uploads stays in history", () => {
  const { data, activity, memory } = fixture();
  activity("album");
  activity("no-uploads");
  activity("viewer-host", "viewer");
  data.rsvps.push(
    {
      activity_id: "album",
      user_id: "viewer",
      status: "going",
      approved: true,
    },
    {
      activity_id: "viewer-host",
      user_id: "friend",
      status: "going",
      approved: true,
    },
  );
  memory("a", "album");
  memory("b", "album");
  memory("v", "album", "friend", "video");
  memory("mine", "album", "viewer");
  const albums = selectProfileContent(
    data,
    "viewer",
    { personId: "friend", filter: "albums" },
    now,
  );
  assert.equal(albums.rows.length, 1);
  assert.equal(albums.rows[0].photoCount, 2);
  assert.equal(albums.rows[0].videoCount, 1);
  assert.equal(albums.rows[0].coverPath, "album/friend/b.jpg");
  data.activities.find((a) => a.id === "album")!.enable_experiences = false;
  assert.equal(
    selectProfileContent(
      data,
      "viewer",
      { personId: "friend", filter: "albums" },
      now,
    ).rows.length,
    0,
    "paused Experiences follows private storage policy",
  );
  data.activities.find((a) => a.id === "album")!.enable_experiences = true;
  assert.equal(
    selectProfileContent(
      data,
      "viewer",
      { personId: "friend", filter: "past" },
      now,
    ).rows.length,
    3,
  );
  data.rsvps = data.rsvps.filter((r) => r.activity_id !== "album");
  assert.equal(
    selectProfileContent(
      data,
      "viewer",
      { personId: "friend", filter: "albums" },
      now,
    ).rows.length,
    0,
  );
});
test("featured activity respects hidden, expiry, solo status, explicit feature and current before future", () => {
  const { data, activity } = fixture();
  const profile = data.profiles[1];
  const future = activity("future", "friend", "scheduled", 7200000);
  const current = activity("current", "friend", "scheduled", -1000);
  const solo = activity("status", "friend", "scheduled", -1000);
  solo.mode = "solo";
  assert.equal(
    selectProfileBeacon(data, profile, "viewer", now)?.id,
    current.id,
  );
  profile.featured_activity_id = future.id;
  assert.equal(
    selectProfileBeacon(data, profile, "viewer", now)?.id,
    future.id,
  );
  profile.hide_featured = true;
  assert.equal(selectProfileBeacon(data, profile, "viewer", now), undefined);
  assert.equal(
    selectProfileBeacon(
      data,
      { ...profile, hide_featured: false },
      "viewer",
      now,
    ),
    undefined,
    "stale profile arguments cannot bypass current choices",
  );
  profile.hide_featured = false;
  profile.viewer_profile_feature_hidden = true;
  assert.equal(selectProfileBeacon(data, profile, "viewer", now), undefined);
  profile.viewer_profile_feature_hidden = false;
  profile.featured_activity_id = null;
  current.ends_at = new Date(now - 1).toISOString();
  assert.equal(
    selectProfileBeacon(data, profile, "viewer", now)?.id,
    future.id,
  );
});
test("stable pagination includes joined but excludes tentative, blocked and mismatched snapshots", () => {
  const { data, activity } = fixture();
  for (const id of ["a", "b", "c", "d"]) activity(id);
  activity("joined", "viewer");
  activity("maybe", "viewer");
  data.rsvps.push(
    {
      activity_id: "joined",
      user_id: "friend",
      status: "going",
      approved: true,
    },
    {
      activity_id: "maybe",
      user_id: "friend",
      status: "interested",
      approved: true,
    },
  );
  const page = selectProfileContent(
    data,
    "viewer",
    { personId: "friend", pageSize: 2 },
    now,
  );
  const next = selectProfileContent(
    data,
    "viewer",
    { personId: "friend", pageSize: 20, cursor: page.nextCursor },
    now,
  );
  assert.equal(page.beaconCount, 5);
  assert.equal(new Set([...page.rows, ...next.rows].map((r) => r.id)).size, 5);
  data.blocks.push({ blocker_id: "friend", blocked_id: "viewer" });
  assert.equal(
    selectProfileContent(data, "viewer", { personId: "friend" }, now).rows
      .length,
    0,
  );
  data.blocks = [];
  data.viewer_id = "other";
  assert.equal(
    selectProfileContent(data, "viewer", { personId: "friend" }, now).rows
      .length,
    0,
  );
});
test("RPC parser rejects malformed rows and negative counts", () => {
  const { data, activity } = fixture();
  activity("one");
  const page = selectProfileContent(
    data,
    "viewer",
    { personId: "friend" },
    now,
  );
  assert.deepEqual(parseProfileContentPage(page), page);
  assert.throws(() => parseProfileContentPage({ ...page, beaconCount: -1 }));
  assert.throws(() =>
    parseProfileContentPage({
      ...page,
      rows: [{ ...page.rows[0], photoCount: -2 }],
    }),
  );
});
