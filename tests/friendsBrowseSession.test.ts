import test from "node:test";
import assert from "node:assert/strict";
import {
  friendsBrowseState,
  friendsScrollOffset,
  rememberFriendsScrollOffset,
  updateFriendsBrowseState,
} from "../src/features/beacons/friendsBrowseSession";
import {
  planningSelection,
  setPlanningSelection,
} from "../src/features/beacons/socialPlanningSession";

test("Friends browse state and position survive navigation independently of planning selection", () => {
  const viewer = "friends-page-test";
  setPlanningSelection(viewer, ["one", "two"]);
  updateFriendsBrowseState(viewer, {
    query: "Amara",
    filter: "Available",
    listId: "close-friends",
  });
  rememberFriendsScrollOffset(viewer, 540);
  assert.deepEqual(friendsBrowseState(viewer), {
    query: "Amara",
    filter: "Available",
    listId: "close-friends",
  });
  assert.equal(friendsScrollOffset(viewer), 540);
  assert.deepEqual(planningSelection(viewer), ["one", "two"]);
  updateFriendsBrowseState(viewer, { query: "Jordan" });
  assert.equal(friendsScrollOffset(viewer), 0);
  assert.equal(friendsBrowseState(viewer).filter, "Available");
  assert.equal(friendsBrowseState(viewer).listId, "close-friends");
});

test("browsing and restoration cannot leak across accounts or change signed-out state", () => {
  updateFriendsBrowseState("one-account", {
    query: "private search",
    listId: "private-list",
  });
  rememberFriendsScrollOffset("one-account", 1000);
  assert.deepEqual(friendsBrowseState("another-account"), {
    query: "",
    filter: "All",
    listId: null,
  });
  assert.equal(friendsScrollOffset("another-account"), 0);
  updateFriendsBrowseState(null, { query: "ignored" });
  rememberFriendsScrollOffset(null, 250);
  assert.equal(friendsBrowseState(null).query, "");
  assert.equal(friendsScrollOffset(null), 0);
  rememberFriendsScrollOffset("one-account", -10);
  assert.equal(friendsScrollOffset("one-account"), 0);
  rememberFriendsScrollOffset("one-account", Number.NaN);
  assert.equal(friendsScrollOffset("one-account"), 0);
});
