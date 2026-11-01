import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, makeDemo } from "../src/shared/demo";
import { beaconCardShortcuts } from "../src/features/beacons/beaconCardShortcuts";

test("shortcuts require the current viewer and respect independent module and place permissions", () => {
  const data = makeDemo();
  const id = "demo-tools";
  const activity = data.activities.find((row) => row.id === id)!;
  const owner = beaconCardShortcuts(data, DEMO_ID, id)!;
  assert.equal(owner.chat, "beacon");
  assert.equal(owner.canMap, true);
  assert.equal(owner.engagement?.canReact, true);
  assert.equal(owner.engagement?.canReadComments, true);
  assert.equal(beaconCardShortcuts(data, "another-viewer", id), null);
  assert.equal(beaconCardShortcuts(data, null, id), null);
  activity.enable_chat = false;
  activity.enable_reactions = false;
  activity.enable_comments = false;
  const disabled = beaconCardShortcuts(data, DEMO_ID, id)!;
  assert.equal(disabled.chat, null);
  assert.equal(disabled.engagement?.canReact, false);
  assert.equal(disabled.engagement?.canReadComments, false);
  data.places = data.places.filter((place) => place.activity_id !== id);
  assert.equal(beaconCardShortcuts(data, DEMO_ID, id)?.canMap, false);
});

test("a readable friend's Beacon uses an explicitly authorized host message rather than Beacon chat", () => {
  const data = makeDemo();
  const activity = data.activities.find((row) => row.id === "a1")!;
  const preview = beaconCardShortcuts(data, DEMO_ID, activity.id)!;
  assert.equal(preview.chat, "host");
  assert.equal(preview.engagement, null);
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: activity.owner_id });
  const blocked = beaconCardShortcuts(data, DEMO_ID, activity.id);
  assert.ok(!blocked || blocked.chat === null);
});

import { beaconEngagement } from "../src/features/beacons/beaconEngagement";

test("Tools include Memories' separate destination and exclude disabled or unconfigured modules", () => {
  const data = makeDemo();
  const activity = data.activities.find((row) => row.id === "demo-tools")!;
  activity.enable_checklist = true;
  activity.enable_journal = true;
  activity.enable_focus = true;
  activity.enable_experiences = true;
  activity.enable_scoreboard = true;
  activity.enable_music = true;
  activity.music_url = "https://example.com/music";
  assert.equal(beaconEngagement(data, DEMO_ID, activity.id)!.tools.length, 6);
  assert.ok(
    beaconEngagement(data, DEMO_ID, activity.id)!.tools.includes("experiences"),
  );
  activity.music_url = null;
  assert.equal(beaconEngagement(data, DEMO_ID, activity.id)!.tools.length, 5);
  for (const key of [
    "enable_checklist",
    "enable_journal",
    "enable_focus",
    "enable_experiences",
    "enable_scoreboard",
  ] as const)
    activity[key] = false;
  assert.deepEqual(beaconEngagement(data, DEMO_ID, activity.id)!.tools, []);
  assert.equal(beaconEngagement(data, "other-account", activity.id), null);
});

test("reaction overflow retains every authorized type and deduplicates people", () => {
  const data = makeDemo();
  const activity = data.activities.find((row) => row.id === "demo-tools")!;
  const people = [
    DEMO_ID,
    ...data.profiles
      .filter((profile) => profile.id !== DEMO_ID)
      .slice(0, 4)
      .map((profile) => profile.id),
  ];
  data.rsvps.push(
    ...people
      .slice(1)
      .map((user_id) => ({
        activity_id: activity.id,
        user_id,
        status: "going" as const,
        approved: true,
      })),
  );
  data.reactions = people.map((user_id, index) => ({
    activity_id: activity.id,
    user_id,
    emoji: String.fromCodePoint(0x1f600 + index),
  }));
  data.reactions.push(data.reactions[0]);
  const result = beaconEngagement(data, DEMO_ID, activity.id)!;
  assert.equal(result.reactionCount, 5);
  assert.equal(result.reactionGroups.length, 3);
  assert.equal(result.allReactionGroups.length, 5);
  assert.equal(result.selectedEmoji, String.fromCodePoint(0x1f600));
});
