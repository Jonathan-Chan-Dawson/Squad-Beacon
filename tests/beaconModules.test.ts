import test from "node:test";
import assert from "node:assert/strict";
import {
  canAddBeaconNote,
  canDeleteBeaconModuleEntry,
  canEditBeaconChecklist,
  canReadBeaconActivity,
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

test("organization Beacon visibility requires both active memberships and ignores stale RSVP grants", () => {
  const data = emptyData();
  data.organizations.push({
    id: "org-1", owner_id: "org-owner", name: "Trail Crew", description: "", created_at: "2026-09-01T00:00:00Z",
  });
  data.organization_members.push(
    { organization_id: "org-1", user_id: "host", role: "admin", status: "active", invited_by: "org-owner", created_at: "2026-09-02T00:00:00Z" },
    { organization_id: "org-1", user_id: "guest", role: "member", status: "active", invited_by: "host", created_at: "2026-09-03T00:00:00Z" },
    { organization_id: "org-1", user_id: "pending", role: "member", status: "invited", invited_by: "host", created_at: "2026-09-04T00:00:00Z" },
  );
  const orgActivity: Activity = { ...activity, audience: "organization", audience_id: "org-1" };
  assert.equal(canReadBeaconActivity(data, orgActivity, "guest"), true);
  assert.equal(canReadBeaconActivity(data, orgActivity, "org-owner"), true);
  assert.equal(canReadBeaconActivity(data, orgActivity, "pending"), false);
  assert.equal(canReadBeaconActivity(data, orgActivity, "outsider"), false);

  data.rsvps.push({ activity_id: orgActivity.id, user_id: "guest", status: "going", approved: true });
  data.organization_members = data.organization_members.filter((member) => member.user_id !== "guest");
  assert.equal(canReadBeaconActivity(data, orgActivity, "guest"), false,
    "an approved RSVP cannot preserve organization Beacon access after leaving");
  data.organization_members.push({
    organization_id: "org-1", user_id: "guest", role: "member", status: "active", invited_by: "host", created_at: "2026-09-03T00:00:00Z",
  });
  data.organization_bans.push({
    organization_id: "org-1", user_id: "guest", banned_by: "host", reason: "", former_role: "member", created_at: "2026-09-05T00:00:00Z",
  });
  assert.equal(canReadBeaconActivity(data, orgActivity, "guest"), false,
    "an active-looking stale membership row does not override an organization ban");
  data.organization_bans = [];
  data.blocks.push({ blocker_id: "guest", blocked_id: "org-owner" });
  assert.equal(canReadBeaconActivity(data, orgActivity, "guest"), false,
    "blocking the organization owner denies organization audience access");
  data.blocks = [];
  data.organization_members = data.organization_members.filter((member) => member.user_id !== "host");
  assert.equal(canReadBeaconActivity(data, orgActivity, "guest"), false,
    "the Beacon author must remain an active member of the organization too");
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
    /Beacon Journal is read-only or unavailable/,
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
    note = paused.beacon_notes.find(
      (item) => item.activity_id === hosted.id && item.author_id === DEMO_ID,
    );
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
    /checklist is unavailable or cannot be changed/,
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
    /Beacon Journal is paused or unavailable/,
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
