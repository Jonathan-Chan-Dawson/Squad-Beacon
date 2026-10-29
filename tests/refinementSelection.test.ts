import test from "node:test";
import assert from "node:assert/strict";
import { filteredFriendSelection } from "@/src/features/people/socialSelection";

test("bulk selection includes the entire filtered result beyond the rendered first page", () => {
  const people = Array.from({ length: 45 }, (_, i) => `person-${i}`);
  const result = filteredFriendSelection(["outside-filter"], people, 50);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.ids, ["outside-filter", ...people]);
});

test("bulk selection refuses an over-limit union without silently truncating", () => {
  const people = Array.from({ length: 50 }, (_, i) => `person-${i}`);
  const result = filteredFriendSelection(["outside-filter"], people, 50);
  assert.equal(result.allowed, false);
  assert.equal(result.ids.length, 51);
  assert.equal(filteredFriendSelection([people[0]], people, 50).allowed, true);
  assert.deepEqual(filteredFriendSelection(["a", "a"], ["a", "b"], 50).ids, [
    "a",
    "b",
  ]);
});
