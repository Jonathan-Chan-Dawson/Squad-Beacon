import test from "node:test";
import assert from "node:assert/strict";
import {
  friendsBrowseState,
  initializeFriendsScope,
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
    scope: "custom:close-friends",
  });
  rememberFriendsScrollOffset(viewer, 540);
  assert.deepEqual(friendsBrowseState(viewer), {
    query: "Amara",
    filter: "Available",
    scope: "custom:close-friends",
  });
  assert.equal(friendsScrollOffset(viewer), 540);
  assert.deepEqual(planningSelection(viewer), ["one", "two"]);
  updateFriendsBrowseState(viewer, { query: "Jordan" });
  assert.equal(friendsScrollOffset(viewer), 0);
  assert.equal(friendsBrowseState(viewer).filter, "Available");
  assert.equal(friendsBrowseState(viewer).scope, "custom:close-friends");
});

test("browsing and restoration cannot leak across accounts or change signed-out state", () => {
  updateFriendsBrowseState("one-account", {
    query: "private search",
    scope: "custom:private-list",
  });
  rememberFriendsScrollOffset("one-account", 1000);
  assert.deepEqual(friendsBrowseState("another-account"), {
    query: "",
    filter: "All",
    scope: "friends",
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

test("scope defaults initialize once, after loading, without overriding explicit choices", () => {
  initializeFriendsScope("default-favorites", true, []);
  assert.equal(friendsBrowseState("default-favorites").scope, "friends");
  initializeFriendsScope("default-favorites", false, []);
  assert.equal(friendsBrowseState("default-favorites").scope, "friends");
  initializeFriendsScope("default-all", false, []);
  assert.equal(friendsBrowseState("default-all").scope, "friends");
  updateFriendsBrowseState("chosen-during-load", { scope: "friends" });
  initializeFriendsScope("chosen-during-load", true, []);
  assert.equal(friendsBrowseState("chosen-during-load").scope, "friends");
  updateFriendsBrowseState("empty-favorites", { scope: "favorites" });
  initializeFriendsScope("empty-favorites", false, []);
  assert.equal(friendsBrowseState("empty-favorites").scope, "favorites");
});

test("scope changes preserve directory filters and crew; only deleted owned lists fall back", () => {
  const viewer = "scope-lifecycle";
  setPlanningSelection(viewer, ["one", "revoked"]);
  updateFriendsBrowseState(viewer, {
    scope: "custom:empty",
    query: "a",
    filter: "Available",
  });
  initializeFriendsScope(viewer, true, ["empty"]);
  assert.equal(friendsBrowseState(viewer).scope, "custom:empty");
  initializeFriendsScope(viewer, true, []);
  assert.deepEqual(friendsBrowseState(viewer), {
    scope: "friends",
    query: "a",
    filter: "Available",
  });
  assert.deepEqual(planningSelection(viewer), ["one", "revoked"]);
  initializeFriendsScope(null, true, []);
  assert.equal(friendsBrowseState(null).scope, "friends");
});
