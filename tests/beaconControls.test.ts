import test from "node:test";
import assert from "node:assert/strict";
import {
  beaconCapacity,
  beaconRoleFor,
  canAdmitBeaconParticipants,
  canAssignBeaconRole,
  canManageBeacon,
  canManageBeaconSettings,
  canRemoveBeaconParticipant,
  canSetArrivalState,
  canWriteBeaconModule,
} from "../src/features/beacons/permissions";
import {
  beaconSettingsDraftKey,
  canSetStrictCapacity,
  validateBeaconControlValues,
  validateMusicUrl,
} from "../src/features/beacons/controls";
import { canUseBeaconModules } from "../src/features/beacons/beaconModules";
import { emptyData, type Activity } from "@/src/shared/types";
import { demoAction, makeDemo } from "@/src/shared/demo";

const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: "beacon",
  owner_id: "host",
  title: "Crew walk",
  category: "Social",
  mode: "squad",
  starts_at: "2026-10-01T12:00:00.000Z",
  ends_at: "2026-10-01T14:00:00.000Z",
  timezone: "UTC",
  approval_required: false,
  status: "scheduled",
  goal_id: null,
  habit_id: null,
  plan_id: null,
  plan_step_index: null,
  aspiration_ids: [],
  audience: "friends",
  audience_id: null,
  ...overrides,
});

test("capacity counts host plus distinct accepted Going, never requests or interest", () => {
  const data = emptyData(),
    beacon = activity({ capacity_limit: 2, capacity_policy: "strict" });
  data.activities.push(beacon);
  data.rsvps.push(
    { activity_id: beacon.id, user_id: "going", status: "going", approved: false },
    { activity_id: beacon.id, user_id: "pending", status: "requested", approved: false },
    { activity_id: beacon.id, user_id: "interested", status: "interested", approved: false },
  );
  assert.deepEqual(beaconCapacity(data, beacon), {
    count: 2,
    limit: 2,
    remaining: 0,
    strict: true,
    full: true,
    closed: true,
    manuallyClosed: false,
  });
  assert.equal(canSetStrictCapacity(data, beacon, 2, "strict"), true);
  assert.equal(canSetStrictCapacity(data, beacon, 1, "strict"), false);
  assert.equal(canSetStrictCapacity(data, beacon, 1, "soft"), true);
});

test("role powers stay dormant until approved Going and respect role hierarchy", () => {
  const data = emptyData(), beacon = activity({ approval_required: true });
  data.activities.push(beacon);
  data.rsvps.push(
    { activity_id: beacon.id, user_id: "co", status: "going", approved: true },
    { activity_id: beacon.id, user_id: "admin", status: "going", approved: true },
    { activity_id: beacon.id, user_id: "member", status: "going", approved: true },
    { activity_id: beacon.id, user_id: "pending", status: "requested", approved: false },
  );
  data.beacon_roles.push(
    { activity_id: beacon.id, user_id: "co", role: "coowner", assigned_by: "host", created_at: "" },
    { activity_id: beacon.id, user_id: "admin", role: "admin", assigned_by: "co", created_at: "" },
  );
  assert.equal(canManageBeaconSettings(data, beacon, "co"), true);
  assert.equal(canManageBeaconSettings(data, beacon, "admin"), false);
  assert.equal(canAdmitBeaconParticipants(data, beacon, "admin"), true);
  assert.equal(canAssignBeaconRole(data, beacon, "co", "member", "admin"), true);
  assert.equal(canAssignBeaconRole(data, beacon, "co", "member", "coowner"), false);
  assert.equal(canAssignBeaconRole(data, beacon, "host", "pending", "admin"), false);
  assert.equal(canRemoveBeaconParticipant(data, beacon, "admin", "member"), true);
  assert.equal(canRemoveBeaconParticipant(data, beacon, "admin", "co"), false);
  assert.equal(canRemoveBeaconParticipant(data, beacon, "co", "admin"), true);
  assert.equal(canManageBeacon(data, beacon, "admin"), true);

  data.rsvps = data.rsvps.filter((rsvp) => rsvp.user_id !== "co");
  assert.equal(beaconRoleFor(data, beacon, "co"), "none");
  assert.equal(canManageBeaconSettings(data, beacon, "co"), false);
});

test("turning a tool off pauses writes without hiding authorized history", () => {
  const data = emptyData(),
    beacon = activity({ enable_chat: false, enable_checklist: false });
  data.activities.push(beacon);
  data.rsvps.push({ activity_id: beacon.id, user_id: "member", status: "going", approved: false });
  data.friendships.push({
    id: "host-member",
    sender_id: "host",
    recipient_id: "member",
    status: "accepted",
  });
  assert.equal(canWriteBeaconModule(data, beacon, "member", "chat"), false);
  assert.equal(canWriteBeaconModule(data, beacon, "member", "checklist"), false);
  assert.equal(canWriteBeaconModule(data, beacon, "member", "journal"), true);
});

test("manual arrival is self-only, never opens pending access, and Present is time-bounded", () => {
  const data = emptyData(), beacon = activity();
  data.activities.push(beacon);
  data.rsvps.push(
    { activity_id: beacon.id, user_id: "going", status: "going", approved: false },
    { activity_id: beacon.id, user_id: "pending", status: "requested", approved: false },
  );
  data.friendships.push({
    id: "host-going",
    sender_id: "host",
    recipient_id: "going",
    status: "accepted",
  });
  const beforeStart = Date.parse(beacon.starts_at) - 1000,
    active = Date.parse(beacon.starts_at) + 1000;
  assert.equal(canSetArrivalState(data, beacon, "going", "going", "arriving", beforeStart), true);
  assert.equal(canSetArrivalState(data, beacon, "going", "going", "present", beforeStart), false);
  assert.equal(canSetArrivalState(data, beacon, "going", "going", "present", active), true);
  assert.equal(canSetArrivalState(data, beacon, "pending", "pending", "arriving", beforeStart), false);
  assert.equal(canSetArrivalState(data, beacon, "going", "host", "present", active), false);
  assert.equal(canSetArrivalState(data, beacon, "going", "going", "arriving", active), true);
  assert.equal(canSetArrivalState(data, beacon, "host", "host", "present", active), true);
  assert.equal(canSetArrivalState(data, activity({ status: "cancelled" }), "host", "host", "none", active), false);
});

test("server-projected current access overrides stale list audience membership", () => {
  const data = emptyData(),
    beacon = activity({
      audience: "list",
      audience_id: "host-list",
      viewer_can_access: false,
    });
  data.viewer_id = "member";
  data.activities.push(beacon);
  data.rsvps.push({
    activity_id: beacon.id,
    user_id: "member",
    status: "going",
    approved: true,
  });
  assert.equal(canUseBeaconModules(data, beacon, "member"), false);
  beacon.viewer_can_access = true;
  data.activities[0] = beacon;
  assert.equal(canUseBeaconModules(data, beacon, "member"), true);
  data.activities = [];
  assert.equal(canUseBeaconModules(data, beacon, "member"), false);
  data.activities.push(beacon);
  data.viewer_id = "previous-viewer";
  assert.equal(canUseBeaconModules(data, beacon, "member"), false);
});

test("control validation restricts capacity, decorations, and music hosts", () => {
  const base = {
    capacity_limit: null,
    capacity_policy: "soft",
    manual_closed: false,
    enable_chat: true,
    enable_checklist: true,
    enable_journal: true,
    enable_experiences: true,
    enable_focus: true,
    enable_reactions: true,
    music_url: "https://open.spotify.com/playlist/abc",
    decoration_emoji: "🌿",
    decoration_accent: "ocean",
  } as const;
  assert.equal(validateBeaconControlValues({ ...base }).music_url, base.music_url);
  assert.throws(() => validateMusicUrl("https://youtube.com.evil.example/"));
  assert.throws(() => validateMusicUrl("http://open.spotify.com/"));
  assert.throws(() => validateMusicUrl("https://open.spotify.com.evil.example/"));
  assert.throws(() =>
    validateBeaconControlValues({ ...base, capacity_limit: 1 }),
  );
  assert.throws(() =>
    validateBeaconControlValues({ ...base, decoration_emoji: "🚫" }),
  );
});

test("settings drafts remount when the detail route changes even for matching controls", () => {
  const left = activity({ id: "left", capacity_limit: 8, enable_chat: false }),
    right = activity({ id: "right", capacity_limit: 8, enable_chat: false });
  assert.notEqual(beaconSettingsDraftKey(left), beaconSettingsDraftKey(right));
  assert.equal(beaconSettingsDraftKey(left), beaconSettingsDraftKey({ ...left }));
});

test("demo host settings enforce seat limits and pause modules without dropping history", () => {
  const data = makeDemo(),
    beacon = data.activities.find((item) => item.id === "demo-tools");
  assert.ok(beacon);
  data.rsvps.push({
    activity_id: beacon.id,
    user_id: "sam",
    status: "going",
    approved: true,
  });
  const strict = demoAction(data, "set_beacon_controls", {
    id: beacon.id,
    capacity_limit: 3,
    capacity_policy: "strict",
    enable_checklist: false,
  });
  assert.equal(strict.activities.find((item) => item.id === beacon.id)?.capacity_policy, "strict");
  assert.equal(strict.activities.find((item) => item.id === beacon.id)?.enable_checklist, false);
  assert.throws(
    () => demoAction(strict, "set_beacon_controls", {
      id: beacon.id,
      capacity_limit: 2,
      capacity_policy: "strict",
    }),
    /cannot be lowered below current accepted Going count/,
  );
  assert.equal(
    strict.beacon_checklist_items.some((item) => item.activity_id === beacon.id),
    true,
  );
});

test("demo attendance is self-only, time-bounded, and read-only after completion", () => {
  const data = makeDemo(),
    beacon = data.activities.find((item) => item.id === "demo-tools");
  assert.ok(beacon);
  const index = data.activities.findIndex((item) => item.id === beacon.id),
    now = Date.now();
  data.activities[index] = {
    ...beacon,
    starts_at: new Date(now - 60_000).toISOString(),
    ends_at: new Date(now + 60_000).toISOString(),
  };
  const present = demoAction(data, "set_beacon_attendance", {
    id: beacon.id,
    state: "present",
  });
  assert.equal(present.beacon_attendance.find((item) => item.activity_id === beacon.id)?.state, "present");
  assert.throws(
    () => demoAction(present, "set_beacon_attendance", {
      id: beacon.id,
      user_id: "jordan",
      state: "arriving",
    }),
    /eligible attendee/,
  );
  const completed = demoAction(present, "activity_status", {
    id: beacon.id,
    status: "completed",
  });
  assert.doesNotThrow(() => demoAction(completed, "set_beacon_attendance", {
    id: beacon.id,
    state: "present",
  }));
  assert.throws(
    () => demoAction(completed, "set_beacon_attendance", {
      id: beacon.id,
      state: "none",
    }),
    /eligible attendee/,
  );
});
