import assert from "node:assert/strict";
import test from "node:test";
import { makeDemo, demoAction, DEMO_ID } from "../src/shared/demo";
import { emptyData, normalizeData, type Profile } from "../src/shared/types";
import {
  selectListPeople,
  privateListName,
} from "../src/features/people/privateLists";
import {
  selectHubConversations,
  selectStartChatFriends,
  filterHubConversations,
} from "../src/features/people/hubState";
import {
  afterReadMarker,
  messagesAreGrouped,
} from "../src/features/messages/readMarkers";
import { beaconLinkId } from "../src/features/messages/beaconLinks";

test("unread boundaries preserve microseconds and equivalent timezone offsets", () => {
  const marker = {
    last_read_at: "2026-10-14T10:00:00.123456+00:00",
    last_read_message_id: "b",
  };
  assert.equal(
    afterReadMarker(
      { id: "a", created_at: "2026-10-14T10:00:00.123457Z" },
      marker,
    ),
    true,
  );
  assert.equal(
    afterReadMarker(
      { id: "z", created_at: "2026-10-14T10:00:00.123455Z" },
      marker,
    ),
    false,
  );
  assert.equal(
    afterReadMarker(
      { id: "b", created_at: "2026-10-14T05:00:00.123456-05:00" },
      marker,
    ),
    false,
  );
});

test("lists derive eligible friends and favorites, isolate owners, and follow live changes", () => {
  const data = makeDemo();
  const friend = [...selectListPeople(data, DEMO_ID)][0];
  assert.ok(friend);
  data.lists.push(
    { id: "test-list", owner_id: DEMO_ID, name: "Study" },
    { id: "foreign", owner_id: friend, name: "Secret" },
  );
  data.list_members.push(
    { list_id: "test-list", user_id: friend },
    { list_id: "test-list", user_id: "stranger" },
    { list_id: "foreign", user_id: friend },
  );
  data.favorites.push({ owner_id: DEMO_ID, kind: "friend", target_id: friend });
  assert.deepEqual(
    [...selectListPeople(data, DEMO_ID, "custom:test-list")],
    [friend],
  );
  assert.equal(selectListPeople(data, DEMO_ID, "favorites").has(friend), true);
  assert.equal(selectListPeople(data, DEMO_ID, "custom:foreign").size, 0);
  data.blocks.push({ blocker_id: friend, blocked_id: DEMO_ID });
  assert.equal(selectListPeople(data, DEMO_ID, "custom:test-list").size, 0);
  assert.equal(selectListPeople(data, DEMO_ID, "favorites").has(friend), false);
  assert.equal(selectListPeople(data, "wrong").size, 0);
});

test("demo list edits match secure ownership, validation, deletion and audience protection", () => {
  let data = makeDemo();
  const peer = [...selectListPeople(data, DEMO_ID)][0];
  data = demoAction(data, "create_list", { name: "  New List  " });
  const list = data.lists.find((row) => row.name === "New List")!;
  assert.ok(list);
  assert.throws(
    () => demoAction(data, "create_list", { name: "New List" }),
    /already/,
  );
  assert.throws(() => privateListName(" "), /1–50/);
  assert.throws(() => privateListName("x".repeat(51)), /1–50/);
  assert.throws(
    () => demoAction(data, "rename_list", { id: "missing", name: "Bad" }),
    /own/,
  );
  assert.throws(
    () =>
      demoAction(data, "list_member", {
        id: list.id,
        user_id: "stranger",
        add: true,
      }),
    /accepted friend/,
  );
  data = demoAction(data, "list_member", {
    id: list.id,
    user_id: peer,
    add: true,
  });
  data = demoAction(data, "rename_list", { id: list.id, name: "Renamed" });
  data.profile_visibility_grants.push({
    owner_id: DEMO_ID,
    kind: "list",
    target_id: list.id,
  });
  assert.throws(
    () => demoAction(data, "delete_list", { id: list.id }),
    /still used/,
  );
  data.profile_visibility_grants = data.profile_visibility_grants.filter(
    (row) => row.target_id !== list.id,
  );
  data = demoAction(data, "delete_list", { id: list.id });
  assert.equal(
    data.lists.some((row) => row.id === list.id),
    false,
  );
  assert.equal(
    data.list_members.some((row) => row.list_id === list.id),
    false,
  );
});

test("read boundaries handle timestamp ties and never regress in demo", () => {
  let data = makeDemo();
  const peer = [...selectListPeople(data, DEMO_ID)][0];
  const created = "2026-10-14T10:00:00.000Z";
  data.messages.push(
    ...["a", "b"].map((id) => ({
      id,
      author_id: peer,
      recipient_id: DEMO_ID,
      activity_id: null,
      body: id,
      created_at: created,
    })),
  );
  data = demoAction(data, "mark_dm_chat_read", {
    peer_id: peer,
    message_id: "b",
  });
  data = demoAction(data, "mark_dm_chat_read", {
    peer_id: peer,
    message_id: "a",
  });
  assert.equal(
    data.dm_message_reads.find((row) => row.peer_id === peer)
      ?.last_read_message_id,
    "b",
  );
  assert.equal(
    afterReadMarker({ id: "c", created_at: created }, data.dm_message_reads[0]),
    true,
  );
  assert.equal(
    afterReadMarker({ id: "a", created_at: created }, data.dm_message_reads[0]),
    false,
  );
  assert.throws(
    () =>
      demoAction(data, "mark_dm_chat_read", {
        peer_id: peer,
        message_id: "missing",
      }),
    /conversation/,
  );
  assert.deepEqual(
    normalizeData({ dm_message_reads: undefined }).dm_message_reads,
    [],
  );
});

test("hundreds of conversations remain reachable and private profile metadata stays hidden", () => {
  const data = emptyData();
  data.viewer_id = "viewer";
  const profile = (id: string): Profile => ({
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
    profile_visibility: "public",
    viewer_can_view_full_profile: true,
  });
  for (let i = 0; i < 350; i++) {
    const peer = `friend-${i}`;
    data.profiles.push(profile(peer));
    data.friendships.push({
      id: peer,
      sender_id: "viewer",
      recipient_id: peer,
      status: "accepted",
    });
    data.messages.push({
      id: peer,
      author_id: peer,
      recipient_id: "viewer",
      activity_id: null,
      body: "Hello",
      created_at: new Date(Date.UTC(2026, 9, 14, 0, i)).toISOString(),
    });
  }
  const rows = selectHubConversations(data, "viewer");
  assert.equal(rows.length, 350);
  assert.equal(rows[0].id, "friend-349");
  assert.equal(
    filterHubConversations(rows, "Friends", "friend-0")[0].id,
    "friend-0",
  );
  assert.equal(selectStartChatFriends(data, "viewer", "", rows).length, 0);
  data.messages = [];
  data.profiles[0].viewer_can_view_full_profile = false;
  const hidden = selectStartChatFriends(data, "viewer", "").find(
    (row) => row.id === "friend-0",
  );
  assert.equal(hidden?.name, "Friend");
  assert.equal(hidden?.profile, undefined);
  assert.equal(selectStartChatFriends(data, "viewer", "friend-0").length, 0);
});

test("group runs break by author, date and five-minute gap; only app Beacon links preview", () => {
  const first = { authorId: "a", createdAt: "2026-10-14T10:00:00Z" };
  assert.equal(
    messagesAreGrouped(first, { ...first, createdAt: "2026-10-14T10:05:00Z" }),
    true,
  );
  assert.equal(
    messagesAreGrouped(first, { ...first, createdAt: "2026-10-14T10:05:01Z" }),
    false,
  );
  assert.equal(messagesAreGrouped(first, { ...first, authorId: "b" }), false);
  assert.equal(messagesAreGrouped(undefined, first), false);
  assert.equal(
    beaconLinkId("Meet here squadbeacon://activity/test-id"),
    "test-id",
  );
  assert.equal(
    beaconLinkId("https://evil.example/activity/secret", "https://app.example"),
    undefined,
  );
  assert.equal(
    beaconLinkId("https://app.example/activity/real", "https://app.example"),
    "real",
  );
});
