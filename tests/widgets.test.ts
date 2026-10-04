import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveWidgetPayload,
  WIDGET_FRESHNESS_MS,
  widgetTimelineDates,
} from "@/src/features/widgets/derive";
import { defaultWidgetPreferences } from "@/src/features/widgets/types";
import { emptyData } from "@/src/shared/types";
import { isWidgetAdviceEligible } from "@/src/features/widgets/adviceEligibility";

const now = new Date("2026-09-30T16:00:00.000Z");
function fixture() {
  const data = emptyData();
  data.viewer_id = "me";
  data.is_demo = true;
  data.profiles = [
    {
      id: "me",
      name: "Me",
      username: "me",
      bio: "",
      interests: [],
      featured_activity_id: null,
      hide_featured: false,
      timezone: "UTC",
      quiet_start: 0,
      quiet_end: 0,
    },
    {
      id: "friend",
      name: "Ari",
      username: "ari",
      bio: "",
      interests: [],
      featured_activity_id: null,
      hide_featured: false,
      timezone: "UTC",
      quiet_start: 0,
      quiet_end: 0,
    },
    {
      id: "stranger",
      name: "Sam",
      username: "sam",
      bio: "",
      interests: [],
      featured_activity_id: null,
      hide_featured: false,
      timezone: "UTC",
      quiet_start: 0,
      quiet_end: 0,
    },
  ];
  data.friendships = [
    {
      id: "friendship",
      sender_id: "me",
      recipient_id: "friend",
      status: "accepted",
    },
    {
      id: "pending",
      sender_id: "me",
      recipient_id: "stranger",
      status: "pending",
    },
  ];
  data.squads = [
    { id: "squad", owner_id: "me", name: "Book Club", description: "" },
  ];
  data.squad_members = [
    { squad_id: "squad", user_id: "me", role: "owner" },
    { squad_id: "squad", user_id: "friend", role: "member" },
    { squad_id: "squad", user_id: "stranger", role: "member" },
  ];
  data.lists = [{ id: "list", owner_id: "me", name: "Close circle" }];
  data.list_members = [
    { list_id: "list", user_id: "friend" },
    { list_id: "list", user_id: "stranger" },
  ];
  data.activities = [
    {
      id: "live",
      owner_id: "friend",
      title: "Coffee",
      category: "Social",
      mode: "solo",
      starts_at: "2026-09-30T15:30:00.000Z",
      ends_at: "2026-09-30T17:00:00.000Z",
      timezone: "UTC",
      approval_required: false,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      audience: "friends",
      audience_id: null,
      available: true,
    },
    {
      id: "private",
      owner_id: "friend",
      title: "Private plan",
      category: "Other",
      mode: "solo",
      starts_at: "2026-09-30T15:00:00.000Z",
      ends_at: "2026-09-30T18:00:00.000Z",
      timezone: "UTC",
      approval_required: false,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      audience: "private",
      audience_id: null,
      available: true,
    },
    {
      id: "next",
      owner_id: "me",
      title: "Studio night",
      category: "Creative",
      mode: "squad",
      starts_at: "2026-09-30T18:00:00.000Z",
      ends_at: "2026-09-30T20:00:00.000Z",
      timezone: "UTC",
      approval_required: false,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      audience: "private",
      audience_id: null,
    },
    {
      id: "squad-live",
      owner_id: "friend",
      title: "Book club meetup",
      category: "Creative",
      mode: "squad",
      starts_at: "2026-09-30T15:45:00.000Z",
      ends_at: "2026-09-30T17:30:00.000Z",
      timezone: "UTC",
      approval_required: false,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      audience: "squad",
      audience_id: "squad",
    },
    {
      id: "soon",
      owner_id: "friend",
      title: "Soon",
      category: "Social",
      mode: "squad",
      starts_at: "2026-09-30T16:10:00.000Z",
      ends_at: "2026-09-30T16:30:00.000Z",
      timezone: "UTC",
      approval_required: false,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      audience: "friends",
      audience_id: null,
    },
  ];
  data.places = [
    {
      activity_id: "squad-live",
      label: "12 Secret Street",
      latitude: 44.9,
      longitude: -93.2,
      online_url: null,
    },
  ];
  data.locations = [
    {
      id: "location",
      owner_id: "friend",
      latitude: 44.91,
      longitude: -93.21,
      updated_at: now.toISOString(),
      expires_at: "2026-09-30T16:15:00.000Z",
    },
  ];
  return data;
}

test("widget circles contain only accepted friends and honor friend/squad/list selection", () => {
  const data = fixture();
  const preferences = defaultWidgetPreferences();
  preferences.privacy = "full";
  preferences.enabled = true;
  preferences.circles = {
    circle1: { kind: "friend", id: "friend" },
    circle2: { kind: "squad", id: "squad" },
    circle3: { kind: "list", id: "list" },
  };
  const payload = deriveWidgetPayload(data, "me", preferences, now);
  assert.equal(payload.allFriends.totalCount, 1);
  assert.equal(payload.circles.circle1.friends[0]?.name, "Ari");
  assert.equal(payload.circles.circle2.totalCount, 1);
  assert.equal(payload.circles.circle3.totalCount, 1);
  assert.equal(payload.allFriends.friends[0]?.status, "Free now");
  assert.equal(payload.allFriends.friends[0]?.detail, "Coffee");
});

test("discreet display masks friend names and beacon titles, and payload omits coordinates", () => {
  const preferences = defaultWidgetPreferences();
  preferences.privacy = "discreet";
  const payload = deriveWidgetPayload(fixture(), "me", preferences, now);
  assert.equal(payload.allFriends.friends[0]?.name, "Friend 1");
  assert.notEqual(payload.allFriends.friends[0]?.detail, "Coffee");
  assert.equal(JSON.stringify(payload).includes("latitude"), false);
  assert.equal(JSON.stringify(payload).includes("44.9"), false);
  assert.equal(JSON.stringify(payload).includes("12 Secret Street"), false);
  assert.equal(payload.circleBeacons.circle2.beacons[0]?.title, "Beacon 1");
  assert.equal(JSON.stringify(payload).includes("Book club meetup"), false);
  assert.equal(JSON.stringify(payload).includes("Private plan"), false);
});

test("widget preferences are off and discreet until the user opts in", () => {
  const preferences = defaultWidgetPreferences();
  assert.equal(preferences.enabled, false);
  assert.equal(preferences.privacy, "discreet");
});

test("widget advice is eligible only for a ready, opted-out iOS account with friends or a squad", () => {
  const eligible = {
    isIOS: true,
    isExpoGo: false,
    hasRealAccount: true,
    dataLoaded: true,
    dataErrorFree: true,
    preferencesReady: true,
    preferencesErrorFree: true,
    widgetsEnabled: false,
    hasFriendsOrSquad: true,
  };
  assert.equal(isWidgetAdviceEligible(eligible), true);
  assert.equal(isWidgetAdviceEligible({ ...eligible, isExpoGo: true }), false);
  assert.equal(
    isWidgetAdviceEligible({ ...eligible, widgetsEnabled: true }),
    false,
  );
  assert.equal(
    isWidgetAdviceEligible({ ...eligible, hasRealAccount: false }),
    false,
  );
  assert.equal(
    isWidgetAdviceEligible({ ...eligible, hasFriendsOrSquad: false }),
    false,
  );
  assert.equal(
    isWidgetAdviceEligible({ ...eligible, dataLoaded: false }),
    false,
  );
  assert.equal(
    isWidgetAdviceEligible({ ...eligible, preferencesErrorFree: false }),
    false,
  );
});

test("deleted circles and circles the viewer no longer owns or belongs to resolve empty", () => {
  const data = fixture();
  data.squad_members = data.squad_members.filter(
    (member) => !(member.squad_id === "squad" && member.user_id === "me"),
  );
  data.lists[0]!.owner_id = "someone-else";
  const preferences = defaultWidgetPreferences();
  preferences.circles = {
    circle1: { kind: "squad", id: "squad" },
    circle2: { kind: "list", id: "list" },
    circle3: { kind: "friend", id: "stranger" },
  };
  const payload = deriveWidgetPayload(data, "me", preferences, now);
  assert.equal(payload.circles.circle1.totalCount, 0);
  assert.equal(payload.circleBeacons.circle1.beacons.length, 0);
  assert.equal(payload.circles.circle2.totalCount, 0);
  assert.equal(payload.circleBeacons.circle2.beacons.length, 0);
  assert.equal(payload.circles.circle3.totalCount, 0);
});

test("widget payload becomes empty and stale after its 15-minute freshness window", () => {
  const preferences = defaultWidgetPreferences();
  preferences.privacy = "full";
  const fetchedAt = now;
  const expiredAt = new Date(+now + WIDGET_FRESHNESS_MS);
  const payload = deriveWidgetPayload(
    fixture(),
    "me",
    preferences,
    expiredAt,
    fetchedAt,
  );
  assert.equal(payload.stale, true);
  assert.equal(payload.allFriends.totalCount, 0);
  assert.equal(payload.circleBeacons.circle1.beacons.length, 0);
  assert.equal(payload.nextBeacon, null);
  assert.equal(JSON.stringify(payload).includes("Ari"), false);
  assert.equal(JSON.stringify(payload).includes("Studio night"), false);
});

test("next beacon can include the viewer's private plan while friend status never exposes a private plan", () => {
  const preferences = defaultWidgetPreferences();
  preferences.privacy = "full";
  const payload = deriveWidgetPayload(fixture(), "me", preferences, now);
  assert.equal(payload.nextBeacon?.title, "Studio night");
  assert.equal(payload.allFriends.friends[0]?.detail, "Coffee");
});

test("friend widgets omit status and beacon titles when profile privacy denies access", () => {
  const data = fixture();
  data.profiles.find((item) => item.id === "friend")!.profile_visibility =
    "custom";
  const preferences = defaultWidgetPreferences();
  preferences.privacy = "full";
  preferences.circles.circle1 = { kind: "friend", id: "friend" };

  const payload = deriveWidgetPayload(data, "me", preferences, now);

  assert.equal(payload.allFriends.totalCount, 0);
  assert.equal(payload.circles.circle1.totalCount, 0);
  assert.equal(payload.circleBeacons.circle1.beacons.length, 0);
  assert.equal(payload.nextBeacon?.title, "Studio night");
});

test("friend widgets honor profile blocks even when an activity row is otherwise audience-visible", () => {
  const data = fixture();
  data.blocks = [{ blocker_id: "me", blocked_id: "friend" }];
  const preferences = defaultWidgetPreferences();
  preferences.privacy = "full";
  preferences.circles.circle1 = { kind: "friend", id: "friend" };

  // The widget's activity audience check still allows the accepted-friend
  // beacon row; profile privacy is a separate gate and must suppress it.
  assert.equal(data.activities.some((item) => item.id === "live"), true);
  const payload = deriveWidgetPayload(data, "me", preferences, now);

  assert.equal(payload.allFriends.totalCount, 0);
  assert.equal(payload.circles.circle1.totalCount, 0);
  assert.equal(payload.circleBeacons.circle1.beacons.length, 0);
  assert.equal(payload.nextBeacon?.title, "Studio night");
});

test("widget payload and timeline fail closed when the snapshot belongs to another viewer", () => {
  const data = fixture();
  data.viewer_id = "other-account";
  const preferences = defaultWidgetPreferences();
  preferences.privacy = "full";

  const payload = deriveWidgetPayload(data, "me", preferences, now);

  assert.equal(payload.stale, true);
  assert.equal(payload.allFriends.totalCount, 0);
  assert.equal(payload.circles.circle1.totalCount, 0);
  assert.equal(payload.circleBeacons.circle1.beacons.length, 0);
  assert.equal(payload.nextBeacon, null);
  assert.deepEqual(
    widgetTimelineDates(data, "me", now).map(Number),
    [+now, +now + WIDGET_FRESHNESS_MS],
  );
});

test("widget timeline has authorized status boundaries within the freshness window", () => {
  const dates = widgetTimelineDates(fixture(), "me", now).map((date) =>
    date.toISOString(),
  );
  assert.deepEqual(dates, [
    now.toISOString(),
    "2026-09-30T16:10:00.000Z",
    new Date(+now + WIDGET_FRESHNESS_MS).toISOString(),
  ]);
});
