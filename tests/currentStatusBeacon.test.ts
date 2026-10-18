import test from "node:test";
import assert from "node:assert/strict";
import type { Activity } from "../src/shared/types";
import { DEMO_ID, demoAction, makeDemo } from "../src/shared/demo";
import { eligibleCurrentBeacons, visibleCurrentBeacon } from "../src/features/beacons/currentStatusBeacon";
import { statusCreatePayload } from "../src/features/beacons/components/feed/statusActions";
import { quickStatusDraft } from "../src/features/beacons/quickStatus";

test("turning Current sharing off retains the private Specific selection", () => {
  const data = makeDemo(); const now = Date.now();
  const source = { ...data.activities.find(row => row.mode === "solo" && row.owner_id === DEMO_ID)!, status_show_current_beacon: true, status_current_beacon_id: "retained-ended-id" };
  const payload = statusCreatePayload({ title: "", available: false, endsAt: new Date(now + 3600000).toISOString(), showCurrentBeacon: false }, source, undefined, now);
  assert.equal(payload.status_show_current_beacon, false);
  assert.equal(payload.status_current_beacon_id, "retained-ended-id");
  data.activities = [source];
  const next = demoAction(data, "save_status_note", { source_id: source.id, title: "", status_show_current_beacon: false });
  const saved = next.activities.find(row => row.mode === "solo" && row.status === "scheduled" && row.status_show_current_beacon === false)!;
  assert.equal(saved.status_current_beacon_id, "retained-ended-id");
});

test("local blocks and exclusions suppress hosted projections before the next refresh", () => {
  const data = makeDemo(); const now = Date.now(); data.is_demo = false;
  data.capabilities = { status_current_beacon: true };
  const base = data.activities[0];
  const source = { ...base, id: "projected-live", owner_id: "maya", mode: "invite" as const, starts_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + 3600000).toISOString(), viewer_can_read: true };
  const status = { ...source, id: "shared-solo", owner_id: "jordan", mode: "solo" as const, status_current_beacon: { id: source.id, role: "going" as const } };
  data.activities = [source, status];
  assert.ok(visibleCurrentBeacon(data, status, DEMO_ID, now));
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: status.owner_id });
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now), null);
  data.blocks = [{ blocker_id: source.owner_id, blocked_id: DEMO_ID }];
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now), null);
  data.blocks = [];
  data.activity_exclusions.push({ activity_id: source.id, user_id: DEMO_ID });
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now), null);
});

function liveBeacon(base: Activity, id: string, ownerId: string, now: number, startOffset = -60_000): Activity {
  return {
    ...base,
    id,
    owner_id: ownerId,
    mode: "squad",
    status: "scheduled",
    starts_at: new Date(now + startOffset).toISOString(),
    ends_at: new Date(now + 60_000).toISOString(),
    plan_id: null,
    plan_step: null,
    plan_started_at: null,
    audience: "friends",
    audience_id: null,
  };
}

test("eligible Current Beacons are live, published and owner-authorized with stable role ranking", () => {
  const data = makeDemo();
  const now = Date.now();
  const base = data.activities[0];
  assert.ok(base);
  const olderHost = liveBeacon(base, "host-older", DEMO_ID, now, -20_000);
  const newerHostB = liveBeacon(base, "host-b", DEMO_ID, now, -5_000);
  const newerHostA = liveBeacon(base, "host-a", DEMO_ID, now, -5_000);
  const cohost = liveBeacon(base, "cohost", "maya", now, -1_000);
  const going = liveBeacon(base, "going", "jordan", now, 0);
  const pendingGoing = { ...liveBeacon(base, "pending-going", "jordan", now, 0), approval_required: true };
  const unpublishedPlan = {
    ...liveBeacon(base, "unpublished-plan", DEMO_ID, now, 0),
    plan_id: "plan-not-started",
    plan_step: { title: "Step", description: "", category: "Social", location_name: "", lat: null, lng: null, day_offset: 0, start_time: "", duration_minutes: 60 },
  } as Activity;
  const expired = { ...liveBeacon(base, "expired", DEMO_ID, now, -120_000), ends_at: new Date(now).toISOString() };
  const future = liveBeacon(base, "future", DEMO_ID, now, 1_000);
  data.activities = [olderHost, newerHostB, newerHostA, cohost, going, pendingGoing, unpublishedPlan, expired, future];
  data.beacon_roles = [{ activity_id: cohost.id, user_id: DEMO_ID, role: "coowner", assigned_by: "maya", created_at: "" }];
  data.rsvps = [
    { activity_id: cohost.id, user_id: DEMO_ID, status: "going", approved: true },
    { activity_id: going.id, user_id: DEMO_ID, status: "going", approved: true },
    { activity_id: pendingGoing.id, user_id: DEMO_ID, status: "going", approved: false },
  ];
  assert.deepEqual(eligibleCurrentBeacons(data, DEMO_ID, now).map((item) => item.id), [
    "cohost", "host-a", "host-b", "host-older", "going",
  ]);
  assert.deepEqual(eligibleCurrentBeacons(data, "maya", now), [], "the selector requires the signed-in owner's snapshot");
});

test("demo Auto resolves before viewer filtering; Specific selection and note privacy are independent", () => {
  const data = makeDemo();
  const now = Date.now();
  const base = data.activities[0];
  assert.ok(base);
  const older = liveBeacon(base, "beacon-old", DEMO_ID, now, -10_000);
  const newer = liveBeacon(base, "beacon-new", DEMO_ID, now, -1_000);
  const status: Activity = {
    ...liveBeacon(base, "living-status", DEMO_ID, now),
    mode: "solo",
    title: "",
    status_show_current_beacon: true,
    status_current_beacon_id: null,
    status_note_hidden: true,
    status_presentation: "activity_only",
  };
  data.activities = [older, newer, status];
  const automatic = visibleCurrentBeacon(data, status, DEMO_ID, now);
  assert.equal(automatic?.activity.id, newer.id);
  assert.equal(automatic?.role, "hosting");
  assert.equal(visibleCurrentBeacon(data, { ...status, status_current_beacon_id: older.id }, DEMO_ID, now)?.activity.id, older.id);
  assert.equal(visibleCurrentBeacon(data, { ...status, status_sharing: false }, DEMO_ID, now), null, "pausing Status hides the link");
  assert.equal(visibleCurrentBeacon(data, { ...status, status_show_current_beacon: false }, DEMO_ID, now), null);
});

test("going and cohosting roles are surfaced, and source permissions are rechecked", () => {
  const data = makeDemo();
  const now = Date.now();
  const base = data.activities[0];
  assert.ok(base);
  const cohost = liveBeacon(base, "cohost-source", "maya", now);
  const going = liveBeacon(base, "going-source", "jordan", now);
  const status: Activity = {
    ...liveBeacon(base, "status", DEMO_ID, now), mode: "solo", status_show_current_beacon: true,
  };
  data.activities = [cohost, going, status];
  data.beacon_roles = [{ activity_id: cohost.id, user_id: DEMO_ID, role: "coowner", assigned_by: "maya", created_at: "" }];
  data.rsvps = [
    { activity_id: cohost.id, user_id: DEMO_ID, status: "going", approved: true },
    { activity_id: going.id, user_id: DEMO_ID, status: "going", approved: true },
  ];
  assert.equal(eligibleCurrentBeacons(data, DEMO_ID, now)[0]?.id, cohost.id);
  const cohostStatus = { ...status, status_current_beacon_id: cohost.id };
  assert.equal(visibleCurrentBeacon(data, cohostStatus, DEMO_ID, now)?.role, "cohosting");
  const goingStatus = { ...status, status_current_beacon_id: going.id };
  assert.equal(visibleCurrentBeacon(data, goingStatus, DEMO_ID, now)?.role, "going");
  const admin = liveBeacon(base, "admin-source", "maya", now, -120_000);
  data.activities.push(admin);
  data.beacon_roles.push({ activity_id: admin.id, user_id: DEMO_ID, role: "admin", assigned_by: "maya", created_at: "" });
  data.rsvps.push({ activity_id: admin.id, user_id: DEMO_ID, status: "going", approved: true });
  assert.equal(visibleCurrentBeacon(data, { ...status, status_current_beacon_id: admin.id }, DEMO_ID, now)?.role, "going");
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "jordan" });
  assert.equal(visibleCurrentBeacon(data, goingStatus, DEMO_ID, now), null);
});

test("hosted snapshots require the projected source and recheck Status and source access", () => {
  const data = makeDemo();
  const now = Date.now();
  const base = data.activities[0];
  assert.ok(base);
  data.is_demo = false;
  data.capabilities = { status_current_beacon: true };
  const source = { ...liveBeacon(base, "projected-source", "maya", now), viewer_can_read: true, viewer_can_access: false };
  const status: Activity = {
    ...liveBeacon(base, "projected-status", "jordan", now),
    mode: "solo",
    viewer_can_read: true,
    status_current_beacon: { id: source.id, role: "going" },
  };
  data.activities = [source, status];
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now)?.activity.id, source.id);
  assert.equal(visibleCurrentBeacon(data, status, "another-account", now), null, "a snapshot cannot cross account boundaries");
  assert.equal(visibleCurrentBeacon(data, { ...status, status_current_beacon: null }, DEMO_ID, now), null,
    "hosted viewers never infer Auto from a partial activity list");
  data.activities[1] = { ...status, viewer_can_read: false };
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now), null);
  const inaccessibleSource = { ...source, viewer_can_read: false };
  data.activities[0] = inaccessibleSource;
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now), null);
  data.capabilities.status_current_beacon = false;
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now), null);
});

test("hosted owner views invalidate a projected cohost after local RSVP revocation", () => {
  const data = makeDemo();
  const now = Date.now();
  const base = data.activities[0];
  assert.ok(base);
  data.is_demo = false;
  data.capabilities = { status_current_beacon: true };
  const source = { ...liveBeacon(base, "owner-cohost-source", "maya", now), viewer_can_read: true, viewer_can_access: true };
  const status: Activity = {
    ...liveBeacon(base, "owner-status", DEMO_ID, now), mode: "solo", viewer_can_read: true,
    status_show_current_beacon: true, status_current_beacon_id: source.id,
    status_current_beacon: { id: source.id, role: "cohosting" },
  };
  data.activities = [source, status];
  data.beacon_roles = [{ activity_id: source.id, user_id: DEMO_ID, role: "coowner", assigned_by: "maya", created_at: "" }];
  data.rsvps = [{ activity_id: source.id, user_id: DEMO_ID, status: "going", approved: true }];
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now)?.activity.id, source.id);
  data.rsvps[0] = { ...data.rsvps[0], status: "interested" };
  assert.equal(visibleCurrentBeacon(data, status, DEMO_ID, now), null, "current local membership state overrides a stale projection");
});

test("Status payloads preserve explicit source settings and default independent scheduled notes off", () => {
  const data = makeDemo();
  const now = Date.now();
  const base = data.activities[0];
  assert.ok(base);
  const source: Activity = {
    ...liveBeacon(base, "configured-status", DEMO_ID, now),
    mode: "solo",
    status_show_current_beacon: true,
    status_current_beacon_id: "stale-source-id",
    status_sharing: false,
  };
  const endsAt = new Date(now + 60_000).toISOString();
  const renewed = statusCreatePayload({ title: "", available: false, endsAt }, source, undefined, now);
  assert.equal(renewed.status_show_current_beacon, true);
  assert.equal(renewed.status_current_beacon_id, "stale-source-id");
  assert.equal(renewed.title, "", "paused public Status does not add a placeholder title");
  assert.equal(renewed.status_note_title, "");
  const quick = quickStatusDraft(source, "friends", null, 60, now);
  assert.equal(quick.showCurrentBeacon, true);
  assert.equal(quick.currentBeaconId, "stale-source-id");
  const futureStart = new Date(now + 86_400_000).toISOString();
  const futureEnd = new Date(now + 90_000_000).toISOString();
  const quickFuture = quickStatusDraft(source, "friends", null, 60, now, futureStart, futureEnd);
  assert.equal(quickFuture.showCurrentBeacon, false);
  assert.equal(quickFuture.currentBeaconId, null);
  assert.equal(quickFuture.sourceId, undefined);
  const quickFutureEdit = quickStatusDraft({ ...source, starts_at: futureStart }, "friends", null, 60, now, futureStart, futureEnd);
  assert.equal(quickFutureEdit.showCurrentBeacon, true);
  assert.equal(quickFutureEdit.currentBeaconId, "stale-source-id");
  const scheduledFromLive = statusCreatePayload({
    title: "Tomorrow",
    available: true,
    startsAt: new Date(now + 86_400_000).toISOString(),
    endsAt: new Date(now + 90_000_000).toISOString(),
  }, { ...source, status_sharing: true }, undefined, now);
  assert.equal(scheduledFromLive.status_show_current_beacon, false);
  assert.equal(scheduledFromLive.status_current_beacon_id, null);
  assert.equal(Object.hasOwn(scheduledFromLive, "source_id"), false, "a live source does not turn a new future note into an edit");
  const scheduledSource = { ...source, starts_at: new Date(now + 86_400_000).toISOString() };
  const explicitFutureEdit = statusCreatePayload({
    title: "Updated scheduled note",
    available: true,
    startsAt: scheduledSource.starts_at,
    endsAt: new Date(now + 90_000_000).toISOString(),
  }, scheduledSource, undefined, now);
  assert.equal(explicitFutureEdit.status_show_current_beacon, true);
  assert.equal(explicitFutureEdit.status_current_beacon_id, "stale-source-id");
  assert.equal(explicitFutureEdit.source_id, scheduledSource.id);

  const independent = statusCreatePayload({
    title: "Tomorrow",
    available: true,
    startsAt: new Date(now + 86_400_000).toISOString(),
    endsAt: new Date(now + 90_000_000).toISOString(),
  }, undefined, undefined, now);
  assert.equal(independent.status_show_current_beacon, false);
  assert.equal(independent.status_current_beacon_id, null);
});

test("demo save preserves stale existing choices, rejects new invalid ones, and keeps independent schedules off", () => {
  let data = makeDemo();
  const now = Date.now();
  const base = data.activities[0];
  assert.ok(base);
  const source: Activity = {
    ...liveBeacon(base, "saved-status", DEMO_ID, now),
    mode: "solo",
    title: "Old note",
    status_show_current_beacon: true,
    status_current_beacon_id: "ended-beacon",
    status_sharing: false,
  };
  data.activities = [source];
  data = demoAction(data, "save_status_note", {
    source_id: source.id,
    title: "Renewed note",
    ends_at: new Date(now + 120_000).toISOString(),
  });
  const renewed = data.activities.find((item) => item.id === source.id);
  assert.equal(renewed?.status_show_current_beacon, true);
  assert.equal(renewed?.status_current_beacon_id, "ended-beacon");
  assert.throws(() => demoAction(data, "save_status_note", {
    source_id: source.id,
    title: "Invalid selection",
    ends_at: new Date(now + 120_000).toISOString(),
    status_show_current_beacon: true,
    status_current_beacon_id: "not-eligible",
  }), /live Beacon/);

  const beforeFutureIds = new Set(data.activities.map((item) => item.id));
  data = demoAction(data, "save_status_note", {
    title: "Tomorrow",
    starts_at: new Date(now + 86_400_000).toISOString(),
    ends_at: new Date(now + 90_000_000).toISOString(),
  });
  const independent = data.activities.find((item) => !beforeFutureIds.has(item.id));
  assert.equal(independent?.status_show_current_beacon, false);
  assert.equal(independent?.status_current_beacon_id, null);
});
