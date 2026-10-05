import test from "node:test";
import assert from "node:assert/strict";
import { friendPriority } from "../src/features/people/priority";
import { matchesSearch } from "../src/shared/search";
import { DEMO_ID, demoAction, makeDemo } from "../src/shared/demo";
import { browseBeacons } from "../src/shared/browsing";
import { friendIds } from "../src/shared/domain";

test("friend priority favors togetherness, then available starred and close friends", () => {
  const base = { together: false, free: false, starred: false, close: false };
  assert.equal(friendPriority({ ...base, together: true }), 0);
  assert.equal(friendPriority({ ...base, free: true, starred: true }), 1);
  assert.equal(friendPriority({ ...base, free: true, close: true }), 2);
  assert.equal(friendPriority({ ...base, free: true }), 3);
  assert.equal(friendPriority({ ...base, starred: true }), 4);
  assert.equal(friendPriority({ ...base, close: true }), 5);
  assert.equal(friendPriority(base), 6);
});

test("shared search matches every word, accents, spacing and case", () => {
  assert.equal(matchesSearch(" cafe STUDY ", "Café", "Study crew"), true);
  assert.equal(matchesSearch("", null, undefined), true);
  assert.equal(matchesSearch("cafe running", "Café study"), false);
});

test("shared browsing distinguishes friend hosts from specific group scopes", () => {
  const data = makeDemo();
  const now = Date.now();
  const friends = friendIds(data, DEMO_ID);
  const activity = data.activities.find((row) =>
    friends.includes(row.owner_id),
  )!;
  assert.ok(activity);
  activity.title = "Café running";
  activity.audience = "squad";
  activity.audience_id = "specific-squad";
  activity.status = "scheduled";
  activity.starts_at = new Date(now - 1000).toISOString();
  activity.ends_at = new Date(now + 3600000).toISOString();
  const base = {
    period: "Active" as const,
    sort: "Soonest" as const,
    query: "running cafe",
    category: "All categories",
    joined: false,
  };
  assert.ok(
    browseBeacons(data, DEMO_ID, { ...base, audience: "Friends" }, now).some(
      (row) => row.id === activity.id,
    ),
  );
  assert.ok(
    browseBeacons(
      data,
      DEMO_ID,
      { ...base, audience: "specific-squad" },
      now,
    ).some((row) => row.id === activity.id),
  );
  assert.equal(
    browseBeacons(data, DEMO_ID, { ...base, audience: "different-squad" }, now)
      .length,
    0,
  );
});

test("Beacon search does not reveal a private host's name", () => {
  const data = makeDemo();
  const host = data.profiles.find((profile) => profile.id !== DEMO_ID)!;
  host.name = "HiddenOwnerSearchToken";
  host.profile_visibility = "custom";
  data.profile_visibility_grants = [];
  const activity = data.activities.find((row) => row.owner_id === host.id)!;
  activity.title = "Public meetup";
  activity.status = "scheduled";
  const now = Date.now();
  activity.starts_at = new Date(now - 1000).toISOString();
  activity.ends_at = new Date(now + 3600000).toISOString();
  const results = browseBeacons(
    data,
    DEMO_ID,
    {
      period: "Active",
      sort: "Soonest",
      query: host.name,
      category: "All categories",
      audience: "Everyone",
      joined: false,
    },
    now,
  );
  assert.equal(results.length, 0);
});

test("demo Routine actions update the shared snapshot without mutating the source Plan", () => {
  const original = makeDemo();
  const routine = original.plan_routines.find(
    (row) => row.owner_id === DEMO_ID,
  )!;
  assert.ok(routine);
  const paused = demoAction(original, "pause_routine", { id: routine.id });
  assert.equal(
    original.plan_routines.find((row) => row.id === routine.id)?.status,
    "active",
  );
  assert.equal(
    paused.plan_routines.find((row) => row.id === routine.id)?.status,
    "paused",
  );
  const resumed = demoAction(paused, "resume_routine", { id: routine.id });
  const run = demoAction(resumed, "run_routine_once", { id: routine.id });
  assert.equal(run.plans.length, original.plans.length + 1);
  assert.equal(
    run.activities.filter((row) => row.plan_id === routine.plan_id).length,
    3,
  );
  const generated = run.plans.find(
    (row) => !original.plans.some((source) => source.id === row.id),
  )!;
  assert.equal(
    run.activities.filter((row) => row.plan_id === generated.id).length,
    3,
  );
  assert.equal(
    run.rsvps.length,
    original.rsvps.length,
    "a routine run does not enroll anyone",
  );
});
