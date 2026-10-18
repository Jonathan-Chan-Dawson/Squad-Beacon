import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoAction, DEMO_ID } from "../src/shared/demo";
import { normalizeData } from "../src/shared/types";
import {
  beaconParticipation,
  participationPayload,
} from "../src/features/beacons/participation";
import { canUseBeaconModules } from "../src/features/beacons/beaconModules";
import { cardSocialPreview } from "../src/features/beacons/cardSocialPreview";
import { beaconEngagement } from "../src/features/beacons/beaconEngagement";

function fixture(invited = false) {
  const data = makeDemo();
  const base = data.activities[0];
  data.activities = [
    {
      ...base,
      id: "smart",
      owner_id: "jordan",
      mode: "squad",
      status: "scheduled",
      audience: "friends",
      audience_id: null,
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      ends_at: new Date(Date.now() + 7200000).toISOString(),
      plan_id: null,
      approval_required: false,
      capacity_limit: null,
      capacity_policy: "soft",
      accepted_seat_count: undefined,
      manual_closed: false,
    },
  ];
  data.rsvps = [];
  data.beacon_invitation_grants = [];
  data.beacon_roles = [];
  data.beacon_attendance = [];
  data.beacon_checklist_items = [];
  if (invited) {
    data.rsvps.push({
      activity_id: "smart",
      user_id: DEMO_ID,
      status: "invited",
      approved: true,
    });
    data.beacon_invitation_grants.push({
      activity_id: "smart",
      user_id: DEMO_ID,
      invited_by: "jordan",
      created_at: "",
    });
  }
  return data;
}
test("discovery, tentative response, and withdrawal never fabricate an invitation", () => {
  let data = fixture();
  assert.equal(beaconParticipation(data, DEMO_ID, "smart")!.primary, "Join");
  data = demoAction(data, "rsvp", participationPayload("smart", "maybe"));
  const tentative = beaconParticipation(data, DEMO_ID, "smart")!;
  assert.equal(tentative.primary, "Maybe ✓");
  assert.ok(tentative.allowed.includes("remove_maybe"));
  assert.ok(!tentative.allowed.includes("decline"));
  assert.equal(tentative.capacity.count, 1);
  assert.equal(data.beacon_invitation_grants.length, 0);
  data = demoAction(
    data,
    "rsvp",
    participationPayload("smart", "remove_maybe"),
  );
  data = demoAction(data, "rsvp", participationPayload("smart", "join"));
  assert.equal(beaconParticipation(data, DEMO_ID, "smart")!.primary, "Going ✓");
  assert.equal(data.beacon_attendance.length, 0);
  data = demoAction(data, "rsvp", participationPayload("smart", "leave"));
  assert.equal(data.rsvps.length, 0);
  assert.equal(beaconParticipation(data, DEMO_ID, "smart")!.primary, "Join");
});
test("invitation decline remains resolved and editable without participation access", () => {
  let data = fixture(true);
  assert.equal(
    beaconParticipation(data, DEMO_ID, "smart")!.invitationPair,
    true,
  );
  data = demoAction(data, "rsvp", participationPayload("smart", "decline"));
  assert.equal(data.rsvps[0].status, "declined");
  assert.equal(
    beaconParticipation(data, DEMO_ID, "smart")!.primary,
    "Can’t Go ✓",
  );
  assert.equal(canUseBeaconModules(data, data.activities[0], DEMO_ID), false);
  data = demoAction(data, "rsvp", { id: "smart", status: "withdraw" });
  assert.equal(data.rsvps[0].status, "declined");
  data = demoAction(data, "rsvp", participationPayload("smart", "join"));
  data = demoAction(data, "rsvp", participationPayload("smart", "leave"));
  assert.equal(data.rsvps[0].status, "declined");
  assert.equal(data.beacon_invitation_grants.length, 1);
});
test("confirmation reasons distinguish harmless changes from consequential departures", () => {
  let data = fixture();
  data = demoAction(data, "rsvp", participationPayload("smart", "join"));
  assert.deepEqual(beaconParticipation(data, DEMO_ID, "smart")!.reasons, []);
  data.activities[0].capacity_limit = 8;
  data.activities[0].capacity_policy = "strict";
  data.beacon_roles.push({
    activity_id: "smart",
    user_id: DEMO_ID,
    role: "admin",
    assigned_by: "jordan",
    created_at: "",
  });
  assert.equal(beaconParticipation(data, DEMO_ID, "smart")!.reasons.length, 2);
  data.activities[0].manual_closed = true;
  assert.equal(beaconParticipation(data, DEMO_ID, "smart")!.primary, "Going ✓");
  assert.ok(
    beaconParticipation(data, DEMO_ID, "smart")!.allowed.includes("leave"),
  );
  data.activities[0].status = "completed";
  assert.deepEqual(beaconParticipation(data, DEMO_ID, "smart")!.allowed, []);
});
test("normalization merges resolved rows, gates capability and fails closed on unknown statuses", () => {
  let data = fixture(true);
  data = normalizeData({
    ...data,
    resolved_beacon_responses: [{ ...data.rsvps[0], status: "declined" }],
  });
  assert.equal(data.rsvps.length, 1);
  assert.equal(data.rsvps[0].status, "declined");
  data = normalizeData({
    ...data,
    rsvps: [
      { ...data.rsvps[0], status: "future-status" as never, approved: true },
    ],
  });
  assert.equal(data.rsvps[0].status, "unknown");
  assert.equal(data.rsvps[0].approved, false);
  assert.deepEqual(beaconParticipation(data, DEMO_ID, "smart")!.allowed, []);
  assert.equal(beaconParticipation(data, "other-account", "smart"), null);
  data = fixture(true);
  data.is_demo = false;
  data.activities[0].viewer_can_access = true;
  data.capabilities = undefined;
  assert.equal(
    beaconParticipation(data, DEMO_ID, "smart")!.invitationPair,
    false,
  );
});
test("approval requests and capacity remain independent of arrival and declined identities", () => {
  let data = fixture();
  data.activities[0].approval_required = true;
  assert.equal(
    beaconParticipation(data, DEMO_ID, "smart")!.primary,
    "Request to Join",
  );
  data = demoAction(data, "rsvp", participationPayload("smart", "join"));
  assert.equal(data.rsvps[0].status, "requested");
  assert.equal(beaconParticipation(data, DEMO_ID, "smart")!.capacity.count, 1);
  assert.equal(data.beacon_attendance.length, 0);
  data = demoAction(
    data,
    "rsvp",
    participationPayload("smart", "cancel_request"),
  );
  assert.equal(data.rsvps.length, 0);
  data.rsvps.push({
    activity_id: "smart",
    user_id: "casey",
    status: "declined",
    approved: true,
  });
  assert.ok(
    !cardSocialPreview(data, DEMO_ID, "smart")!.friendAvatars.some(
      (person) => person.id === "casey",
    ),
  );
});
test("reactions aggregate actual independently authorized emoji rows", () => {
  let data = fixture();
  data = demoAction(data, "rsvp", participationPayload("smart", "join"));
  data.reactions = [
    { activity_id: "smart", user_id: DEMO_ID, emoji: "🦊" },
    { activity_id: "smart", user_id: DEMO_ID, emoji: "🦊" },
  ];
  assert.equal(beaconEngagement(data, DEMO_ID, "smart")!.reactionCount, 1);
  assert.deepEqual(beaconEngagement(data, DEMO_ID, "smart")!.reactionGroups, [
    { emoji: "🦊", count: 1 },
  ]);
});
