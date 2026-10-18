import { beaconEngagement } from "../src/features/beacons/beaconEngagement";
import test from "node:test";
import assert from "node:assert/strict";
import {
  cardSecondaryMetadata,
  compactCountdown,
  discoveryPrimaryLabel,
} from "../src/features/beacons/cardPresentation";
import { personalCollections } from "../src/features/beacons/personalCollections";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  liveOwnedStatuses,
  saveOwnStatus,
  clearOwnStatuses,
} from "../src/features/beacons/components/feed/statusActions";
import { quickStatusDraft } from "../src/features/beacons/quickStatus";
import type { Payload } from "../src/shared/types";

test("discovery labels describe joining, requesting, waiting, and opening without changing transitions", () => {
  assert.equal(
    discoveryPrimaryLabel({
      pending: false,
      opens: false,
      requiresApproval: false,
    }),
    "Join",
  );
  assert.equal(
    discoveryPrimaryLabel({
      pending: false,
      opens: false,
      requiresApproval: true,
    }),
    "Request",
  );
  assert.equal(
    discoveryPrimaryLabel({
      pending: true,
      opens: true,
      requiresApproval: true,
    }),
    "Pending",
  );
  assert.equal(
    discoveryPrimaryLabel({
      pending: false,
      opens: true,
      requiresApproval: false,
    }),
    "Open",
  );
});
test("an already approved invitation uses Join rather than requesting approval again", () => {
  assert.equal(
    discoveryPrimaryLabel({
      pending: false,
      opens: false,
      requiresApproval: true,
      approvalGranted: true,
    }),
    "Join",
  );
  assert.equal(
    discoveryPrimaryLabel({
      pending: false,
      opens: false,
      requiresApproval: true,
      approvalGranted: false,
    }),
    "Request",
  );
});
test("preview metadata omits repeated and placeholder locations, using authorized host text only", () => {
  assert.deepEqual(
    cardSecondaryMetadata(
      "Coffee together",
      { label: "  coffee  together ", kind: "physical" },
      "Amara",
    ),
    { label: "Hosted by Amara", kind: "host" },
  );
  assert.equal(
    cardSecondaryMetadata(
      "Coffee together",
      { label: "Place to be decided", kind: "physical" },
      "Beacon host",
    ),
    null,
  );
  assert.equal(cardSecondaryMetadata("Coffee", null, ""), null);
  assert.deepEqual(
    cardSecondaryMetadata(
      "Coffee",
      { label: "Lakeside", kind: "physical" },
      "You",
    ),
    { label: "Lakeside", kind: "physical" },
  );
  assert.deepEqual(cardSecondaryMetadata("Coffee", null, "You"), {
    label: "You’re hosting",
    kind: "host",
  });
  assert.equal(compactCountdown("Ends", 120), "Ends in 2h");
  assert.equal(compactCountdown("Ends", 90), "Ends in 1h 30m");
});
test("saved Beacons, favorite friends, and favorite Squads remain independent and permission filtered", () => {
  const data = makeDemo();
  const beacon = data.activities.find((row) => row.owner_id === DEMO_ID)!;
  const friend = data.profiles.find((row) => row.id === "jordan")!;
  const squad = data.squads.find((row) => row.owner_id === DEMO_ID)!;
  data.beacon_favorites = [
    {
      owner_id: DEMO_ID,
      activity_id: beacon.id,
      created_at: new Date().toISOString(),
    },
  ];
  data.favorites = [
    { owner_id: DEMO_ID, target_id: friend.id, kind: "friend" },
    { owner_id: DEMO_ID, target_id: squad.id, kind: "squad" },
  ];
  const before = personalCollections(data, DEMO_ID);
  assert.equal(before.saved.length, 1);
  assert.equal(before.friends.length, 1);
  assert.equal(before.squads.length, 1);
  data.beacon_favorites = [];
  assert.equal(personalCollections(data, DEMO_ID).friends.length, 1);
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: friend.id });
  assert.equal(personalCollections(data, DEMO_ID).friends.length, 0);
  assert.equal(personalCollections(data, DEMO_ID).squads.length, 1);
  assert.deepEqual(personalCollections(data, "another-viewer"), {
    saved: [],
    friends: [],
    squads: [],
  });
});
test("quick current availability never targets or cancels an independently scheduled status", async () => {
  const data = makeDemo();
  const now = Date.parse("2026-10-17T16:00:00Z");
  const future = {
    ...data.activities[0],
    id: "future",
    owner_id: DEMO_ID,
    mode: "solo" as const,
    status: "scheduled" as const,
    starts_at: "2026-10-18T16:00:00Z",
    ends_at: "2026-10-18T17:00:00Z",
    audience: "private" as const,
    audience_id: null,
    title: "Tomorrow’s study session",
  };
  data.activities = [future];
  const draft = quickStatusDraft(
    liveOwnedStatuses(data, DEMO_ID, now)[0],
    "friends",
    null,
    60,
    now,
  );
  const calls: { action: string; payload?: Payload }[] = [];
  await saveOwnStatus(
    data,
    DEMO_ID,
    draft,
    async (action, payload) => {
      calls.push({ action, payload });
      return { id: "live", event: "save_status_note", cleared_count: 0 };
    },
    now,
  );
  assert.deepEqual(
    calls.map((row) => row.action),
    ["save_status_note"],
  );
  assert.equal(calls[0].payload!.source_id, undefined);
  assert.equal(calls[0].payload!.starts_at, new Date(now).toISOString());
  assert.equal(calls[0].payload!.audience, "friends");
  assert.equal(data.activities[0], future);
  await clearOwnStatuses(
    data,
    DEMO_ID,
    async (action) => {
      calls.push({ action });
      return { event: "clear_status_notes", cleared_count: 1 };
    },
    now,
  );
  assert.equal(calls.at(-1)!.action, "clear_status_notes");
  assert.equal(data.activities[0], future);
});

test("card engagement exposes only enabled authorized reactions, comments and tools", () => {
  const data = makeDemo();
  const activity = {
    ...data.activities[0],
    id: "engagement",
    owner_id: DEMO_ID,
    mode: "open" as const,
    status: "scheduled" as const,
    audience: "friends" as const,
    audience_id: null,
    enable_reactions: true,
    enable_comments: true,
    enable_checklist: true,
    enable_focus: false,
    enable_music: false,
  };
  data.activities = [activity];
  data.reactions = [
    { activity_id: activity.id, user_id: DEMO_ID, emoji: "✨" },
    { activity_id: activity.id, user_id: "jordan", emoji: "🙌" },
  ];
  data.comments = [
    {
      id: "mine",
      activity_id: activity.id,
      author_id: DEMO_ID,
      body: "On my way",
      created_at: new Date().toISOString(),
    },
    {
      id: "blocked",
      activity_id: activity.id,
      author_id: "jordan",
      body: "Hidden",
      created_at: new Date().toISOString(),
    },
  ];
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "jordan" });
  const preview = beaconEngagement(data, DEMO_ID, activity.id)!;
  assert.equal(preview.reactionCount, 1);
  assert.equal(preview.commentCount, 1);
  assert.equal(preview.selectedEmoji, "✨");
  assert.ok(preview.tools.includes("checklist"));
  assert.ok(!preview.tools.includes("focus"));
  assert.equal(beaconEngagement(data, "another-viewer", activity.id), null);
  data.activities[0] = {
    ...activity,
    enable_reactions: false,
    enable_comments: false,
  };
  const disabled = beaconEngagement(data, DEMO_ID, activity.id)!;
  assert.equal(disabled.canReact, false);
  assert.equal(disabled.canReadComments, false);
});
