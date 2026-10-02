import test from "node:test";
import assert from "node:assert/strict";
import {
  canAddBeaconNote,
  canDeleteBeaconModuleEntry,
  canEditBeaconChecklist,
  canReadBeaconModuleEntry,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { demoAction, DEMO_ID, makeDemo } from "@/src/shared/demo";
import { emptyData, type Activity } from "@/src/shared/types";

const activity: Activity = {
  id: "beacon",
  owner_id: "host",
  title: "Shared walk",
  category: "Social",
  mode: "squad",
  starts_at: "2026-10-01T15:00:00.000Z",
  ends_at: "2026-10-01T16:00:00.000Z",
  timezone: "America/Chicago",
  approval_required: false,
  status: "scheduled",
  goal_id: null,
  habit_id: null,
  plan_id: null,
  plan_step_index: null,
  aspiration_ids: [],
  audience: "friends",
  audience_id: null,
};

test("beacon modules require host or approved going status, and honor blocks", () => {
  const data = emptyData();
  assert.equal(canUseBeaconModules(data, activity, "host"), true);
  data.rsvps.push({
    activity_id: activity.id,
    user_id: "guest",
    status: "interested",
    approved: true,
  });
  assert.equal(canUseBeaconModules(data, activity, "guest"), false);
  data.rsvps[0].status = "requested";
  assert.equal(canUseBeaconModules(data, activity, "guest"), false);
  data.rsvps[0].status = "invited";
  assert.equal(canUseBeaconModules(data, activity, "guest"), false);
  data.rsvps[0].status = "going";
  assert.equal(canUseBeaconModules(data, activity, "guest"), true);
  data.blocks.push({ blocker_id: "guest", blocked_id: "host" });
  assert.equal(canUseBeaconModules(data, activity, "guest"), false);
});

test("approval-gated and invite beacons require an approved Going RSVP", () => {
  const data = emptyData(), gated = { ...activity, approval_required: true };
  data.rsvps.push({
    activity_id: activity.id,
    user_id: "guest",
    status: "going",
    approved: false,
  });
  assert.equal(canUseBeaconModules(data, gated, "guest"), false);
  data.rsvps[0].approved = true;
  assert.equal(canUseBeaconModules(data, gated, "guest"), true);
  assert.equal(canUseBeaconModules(data, { ...activity, mode: "invite" }, "guest"), true);
  data.rsvps[0].approved = false;
  assert.equal(canUseBeaconModules(data, { ...activity, mode: "invite" }, "guest"), false);
});

test("checklist and note permissions follow beacon lifecycle", () => {
  const data = emptyData();
  data.rsvps.push({
    activity_id: activity.id,
    user_id: "guest",
    status: "going",
    approved: true,
  });
  assert.equal(canEditBeaconChecklist(data, activity, "guest"), true);
  assert.equal(canAddBeaconNote(data, { ...activity, status: "completed" }, "guest"), true);
  assert.equal(canEditBeaconChecklist(data, { ...activity, status: "completed" }, "guest"), false);
  assert.equal(canUseBeaconModules(data, { ...activity, status: "cancelled" }, "guest"), true);
  assert.equal(canAddBeaconNote(data, { ...activity, status: "cancelled" }, "guest"), false);
  assert.equal(canDeleteBeaconModuleEntry(data, activity, "guest", "guest"), true);
  assert.equal(canDeleteBeaconModuleEntry(data, activity, "other", "guest"), false);
  assert.equal(canDeleteBeaconModuleEntry(data, activity, "other", "host"), true);
  assert.equal(canReadBeaconModuleEntry(data, activity, "other", "guest"), true);
  data.blocks.push({ blocker_id: "guest", blocked_id: "other" });
  assert.equal(canReadBeaconModuleEntry(data, activity, "other", "guest"), false);
  assert.equal(canDeleteBeaconModuleEntry(data, { ...activity, status: "cancelled" }, "guest", "guest"), false);
});

test("demo module actions preserve completed retries and freeze cancelled notes", () => {
  const data = makeDemo(), hosted = {
    ...activity,
    id: "demo-module",
    owner_id: DEMO_ID,
    status: "scheduled" as const,
  };
  data.activities.push(hosted);
  const first = demoAction(data, "add_checklist_item", {
    activity_id: hosted.id,
    id: "demo-item",
    text: "Pack water",
  });
  const completed = demoAction(first, "toggle_checklist_item", {
    id: "demo-item",
    completed: true,
  });
  const retried = demoAction(completed, "add_checklist_item", {
    activity_id: hosted.id,
    id: "demo-item",
    text: "Pack water",
  });
  assert.equal(
    retried.beacon_checklist_items.filter(
      (item) => item.activity_id === hosted.id,
    ).length,
    1,
  );
  assert.equal(
    retried.beacon_checklist_items.find((item) => item.id === "demo-item")
      ?.completed,
    true,
  );
  const withNote = demoAction(retried, "add_beacon_note", {
    activity_id: hosted.id,
    id: "demo-note",
    body: "A short memory.",
  });
  const cancelled = structuredClone(withNote);
  const hostedIndex = cancelled.activities.findIndex(
    (entry) => entry.id === hosted.id,
  );
  cancelled.activities[hostedIndex] = { ...hosted, status: "cancelled" };
  assert.throws(
    () => demoAction(cancelled, "delete_beacon_note", { id: "demo-note" }),
    /unavailable or cannot be deleted/,
  );
});

test("demo pauses writes without deleting authorized module history", () => {
  const seeded = makeDemo(),
    hosted = seeded.activities.find((entry) => entry.id === "demo-tools");
  assert.ok(hosted);
  const data = demoAction(seeded, "add_beacon_note", {
    activity_id: hosted.id,
    id: "demo-owner-note",
    body: "A note from the host.",
  });
  const paused = structuredClone(data),
    checklist = paused.beacon_checklist_items.find(
      (item) => item.activity_id === hosted.id,
    ),
    note = paused.beacon_notes.find((item) => item.activity_id === hosted.id);
  assert.ok(checklist);
  assert.ok(note);
  const activityIndex = paused.activities.findIndex(
    (entry) => entry.id === hosted.id,
  );
  paused.activities[activityIndex] = {
    ...hosted,
    enable_chat: false,
    enable_checklist: false,
    enable_journal: false,
  };
  assert.throws(
    () => demoAction(paused, "send_message", {
      activity_id: hosted.id,
      body: "This should stay paused.",
    }),
    /Chat is paused/,
  );
  assert.throws(
    () => demoAction(paused, "add_checklist_item", {
      activity_id: hosted.id,
      text: "A new task",
    }),
    /Join this beacon before using its tools/,
  );
  assert.throws(
    () => demoAction(paused, "toggle_checklist_item", {
      id: checklist.id,
      completed: true,
    }),
    /unavailable/,
  );
  assert.throws(
    () => demoAction(paused, "edit_beacon_note", {
      id: note.id,
      body: "Editing while paused is disabled.",
      expected_revision: note.revision,
    }),
    /journal is paused/,
  );
  assert.equal(paused.beacon_checklist_items.some((item) => item.id === checklist.id), true);
  assert.equal(paused.beacon_notes.some((item) => item.id === note.id), true);
});

test("demo neighborhood opens shared tools on its sample beacon", () => {
  const data = makeDemo(),
    beacon = data.activities.find((item) => item.id === "demo-tools");
  assert.ok(beacon);
  assert.equal(canUseBeaconModules(data, beacon, DEMO_ID), true);
  assert.equal(
    data.beacon_checklist_items.filter((item) => item.activity_id === beacon.id)
      .length,
    2,
  );
  assert.equal(
    data.beacon_notes.filter((item) => item.activity_id === beacon.id).length,
    1,
  );
});
