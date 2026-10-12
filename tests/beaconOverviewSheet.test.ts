import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  beaconActivityModules,
  beaconLinkedDecision,
  beaconSheetTabs,
  sheetTabForFeature,
} from "../src/features/maps/mapBeaconFeatures";
import { beaconChecklistLabel } from "../src/features/beacons/beaconModules";

const now = Date.parse("2026-10-11T12:00:00Z");
function beacon() {
  return {
    ...makeDemo().activities[0],
    status: "scheduled" as const,
    starts_at: new Date(now - 1000).toISOString(),
    ends_at: new Date(now + 3600000).toISOString(),
    enable_chat: true,
    enable_checklist: false,
    enable_focus: false,
    enable_journal: false,
    enable_experiences: false,
    enable_scoreboard: false,
    enable_music: false,
  };
}

test("zero modules retain built-in tabs and disabled chat stays hidden", () => {
  const a = beacon();
  assert.deepEqual(beaconSheetTabs(a), ["overview", "chat", "people"]);
  a.enable_chat = false;
  assert.deepEqual(beaconSheetTabs(a), ["overview", "people"]);
});

test("linked decisions include permitted suggestions, prefer pending work, and reject stale or private access", () => {
  const data = makeDemo();
  data.viewer_id = DEMO_ID;
  const activity = data.activities.find(
    (row) => row.id === "demo-draw-beacon",
  )!;
  const vote = data.planning_threads.find(
    (row) => row.id === "demo-vote-weekend",
  )!;
  const proposal = data.planning_proposals.find(
    (row) => row.thread_id === vote.id,
  )!;
  assert.equal(beaconLinkedDecision(data, activity.id, DEMO_ID)?.kind, "draw");
  proposal.activity_id = activity.id;
  assert.equal(beaconLinkedDecision(data, activity.id, DEMO_ID)?.id, vote.id);
  vote.audience = "private";
  vote.owner_id = "jordan";
  assert.equal(beaconLinkedDecision(data, activity.id, DEMO_ID)?.kind, "draw");
  vote.audience = "friends";
  vote.owner_id = DEMO_ID;
  proposal.author_id = "jordan";
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: proposal.author_id });
  assert.notEqual(
    beaconLinkedDecision(data, activity.id, DEMO_ID)?.id,
    vote.id,
  );
  assert.equal(beaconLinkedDecision(data, activity.id, "jordan"), undefined);
  assert.equal(beaconLinkedDecision(data, activity.id, null), undefined);
});

test("grocery naming is contextual and other checklist uses remain unchanged", () => {
  const activity = beacon();
  for (const title of ["Grocery Run", "Weekly groceries"]) {
    activity.title = title;
    assert.equal(beaconChecklistLabel(activity), "Grocery List");
  }
  activity.title = "Picnic equipment";
  assert.equal(beaconChecklistLabel(activity), "Checklist");
});

test("grocery checklist, study pair, and photo walk surface their actual modules", () => {
  const a = beacon();
  a.enable_checklist = true;
  assert.deepEqual(beaconActivityModules(a, now), ["checklist"]);
  a.enable_focus = true;
  a.category = "Study";
  assert.deepEqual(beaconActivityModules(a, now), ["focus", "checklist"]);
  a.enable_checklist = false;
  a.enable_focus = false;
  a.enable_experiences = true;
  a.category = "Creative";
  assert.deepEqual(beaconActivityModules(a, now), ["experiences"]);
});

test("sports priority changes from preparation to live game to past memories", () => {
  const a = beacon();
  a.category = "Fitness";
  a.enable_checklist = a.enable_scoreboard = a.enable_experiences = true;
  a.starts_at = new Date(now + 1000).toISOString();
  assert.equal(beaconActivityModules(a, now)[0], "checklist");
  a.starts_at = new Date(now - 1000).toISOString();
  assert.equal(beaconActivityModules(a, now)[0], "scoreboard");
  a.status = "completed" as typeof a.status;
  assert.equal(beaconActivityModules(a, now)[0], "experiences");
  a.status = "scheduled";
  a.ends_at = new Date(now - 1).toISOString();
  assert.equal(beaconActivityModules(a, now)[0], "experiences");
});

test("music without a link creates no empty tab and preview shortcuts resolve into fixed tabs", () => {
  const a = beacon();
  a.enable_music = true;
  assert.deepEqual(beaconActivityModules(a, now), []);
  a.music_url = "https://open.spotify.com/playlist/example";
  assert.deepEqual(beaconActivityModules(a, now), []);
  assert.deepEqual(beaconSheetTabs(a), ["overview", "chat", "people"]);
  assert.equal(sheetTabForFeature("music"), "overview");
  assert.equal(sheetTabForFeature("scoreboard"), "activity");
  assert.equal(sheetTabForFeature("comments"), "overview");
  assert.equal(sheetTabForFeature("chat"), "chat");
});
