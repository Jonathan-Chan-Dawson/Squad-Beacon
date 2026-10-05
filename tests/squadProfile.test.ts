import test from "node:test";
import assert from "node:assert/strict";
import {
  activeSquadDecision,
  activeSquadMembership,
  canOpenSquadProfile,
  squadActivities,
  squadCurrentAndNextActivities,
  squadPlans,
  squadSizeLabel,
  visibleSquadMembers,
  visibleSquadOrganization,
} from "../src/features/people/squadProfile";
import { visibleSquadSpace } from "../src/features/spaces/domain";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import type { PlanningThread } from "../src/features/planning/types";
import {
  selectSquadChatPings,
  visibleSquadPingResponses,
} from "../src/features/organizations/squadChat";

test("Squad size labels scale without changing membership limits", () => {
  assert.equal(squadSizeLabel(2), "Small Squad");
  assert.equal(squadSizeLabel(5), "Small Squad");
  assert.equal(squadSizeLabel(6), "Medium Squad");
  assert.equal(squadSizeLabel(15), "Medium Squad");
  assert.equal(squadSizeLabel(16), "Large Squad");
  assert.equal(squadSizeLabel(30), "Large Squad");
  assert.equal(squadSizeLabel(31), "Huge Squad");
  assert.equal(squadSizeLabel(500), "Huge Squad");
});

const thread = (overrides: Partial<PlanningThread> = {}): PlanningThread => ({
  id: "squad-ping",
  owner_id: "jordan",
  coowner_ids: [],
  kind: "ping",
  title: "Training this week?",
  body: "",
  audience: "squad",
  audience_id: "boxing",
  deadline_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: "open",
  payload: null,
  winner_proposal_id: null,
  replaced_from_proposal_id: null,
  materialized_activity_id: null,
  created_at: new Date().toISOString(),
  resolved_at: null,
  ...overrides,
});

test("Squad profile requires the current viewer and current membership", () => {
  const data = makeDemo();
  assert.equal(canOpenSquadProfile(data, "boxing", DEMO_ID), true);
  assert.equal(activeSquadMembership(data, "boxing", DEMO_ID)?.role, "owner");

  data.viewer_id = "jordan";
  assert.equal(canOpenSquadProfile(data, "boxing", DEMO_ID), false);
  data.viewer_id = DEMO_ID;
  data.squad_members = data.squad_members.filter(
    (member) => !(member.squad_id === "boxing" && member.user_id === DEMO_ID),
  );
  assert.equal(canOpenSquadProfile(data, "boxing", DEMO_ID), false);
});

test("blocked Squad owner or Organization ban removes those linked previews", () => {
  const data = makeDemo();
  assert.equal(visibleSquadOrganization(data, "boxing", DEMO_ID)?.id, "org-lakefront-collective");
  data.organization_bans.push({
    organization_id: "org-lakefront-collective",
    user_id: DEMO_ID,
    banned_by: "maya",
    reason: "",
    former_role: "elder",
    created_at: new Date().toISOString(),
  });
  assert.equal(visibleSquadOrganization(data, "boxing", DEMO_ID), undefined);

  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "maya" });
  assert.equal(canOpenSquadProfile(data, "weekend", DEMO_ID), false);
});

test("Squad Space context requires current access and independent active Space membership", () => {
  const data = makeDemo();
  assert.equal(visibleSquadSpace(data, "boxing", DEMO_ID)?.id, "space-neighborhood-studio");

  data.space_members = data.space_members.filter(
    (member) => !(member.space_id === "space-neighborhood-studio" && member.user_id === DEMO_ID),
  );
  assert.equal(visibleSquadSpace(data, "boxing", DEMO_ID), undefined);

  data.space_members.push({
    space_id: "space-neighborhood-studio",
    user_id: DEMO_ID,
    role: "owner",
    status: "active",
    invited_by: null,
    created_at: new Date().toISOString(),
  });
  data.viewer_id = "jordan";
  assert.equal(visibleSquadSpace(data, "boxing", DEMO_ID), undefined);
});

test("Squad preview shows only canonical readable squad Beacons, current and next", () => {
  const data = makeDemo();
  const now = Date.now();
  const activities = squadActivities(data, "boxing", DEMO_ID, now);
  assert.deepEqual(activities.map((activity) => activity.id), ["demo-tools", "a1"]);
  const { current, next } = squadCurrentAndNextActivities(data, "boxing", DEMO_ID, now);
  assert.equal(current?.id, "a1");
  assert.equal(next?.id, "demo-tools");

  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "jordan" });
  assert.deepEqual(
    squadActivities(data, "boxing", DEMO_ID, now).map((activity) => activity.id),
    ["demo-tools"],
  );

  data.is_demo = false;
  data.blocks = [];
  const beacon = data.activities.find((activity) => activity.id === "demo-tools")!;
  beacon.viewer_can_access = false;
  assert.equal(squadActivities(data, "boxing", DEMO_ID, now).some((item) => item.id === beacon.id), false);
});

test("Squad member identity is privacy-gated in the profile selector", () => {
  const data = makeDemo();
  const jordan = data.profiles.find((profile) => profile.id === "jordan")!;
  jordan.profile_visibility = "friends";
  data.friendships = [];
  const rows = visibleSquadMembers(data, "boxing", DEMO_ID);
  assert.equal(rows.find((row) => row.member.user_id === "jordan")?.profile, undefined);
  assert.equal(rows.find((row) => row.member.user_id === DEMO_ID)?.profile?.id, DEMO_ID);
});

test("Squad Plan selector follows readable live Plan access, not plan_members alone", () => {
  const data = makeDemo();
  const now = Date.now();
  const planId = "boxing-multi-day-plan";
  data.plans = [
    {
      id: planId,
      owner_id: "jordan",
      squad_id: "boxing",
      title: "A multi-day training plan",
      description: "",
      timezone: "America/Chicago",
      start_date: new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: "scheduled",
      created_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
    },
  ];
  data.plan_members = [{
    plan_id: planId,
    user_id: DEMO_ID,
    joined_at: new Date().toISOString(),
  }];
  const activeBeacon = data.activities.find((activity) => activity.id === "a1")!;
  activeBeacon.plan_id = planId;
  assert.equal(squadPlans(data, "boxing", DEMO_ID, now)[0]?.plan.id, planId);

  data.squad_members = data.squad_members.filter(
    (member) => !(member.squad_id === "boxing" && member.user_id === DEMO_ID),
  );
  assert.deepEqual(squadPlans(data, "boxing", DEMO_ID, now), []);
});

test("Squad preview decision is a pending scoped Ping/Vote, including owner resolution", () => {
  const data = makeDemo();
  data.planning_threads = [thread()];
  assert.equal(activeSquadDecision(data, "boxing", DEMO_ID)?.id, "squad-ping");

  data.planning_ping_responses.push({
    thread_id: "squad-ping",
    user_id: DEMO_ID,
    response: "maybe",
    auto_rsvp: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert.equal(activeSquadDecision(data, "boxing", DEMO_ID), undefined);

  const expiredOwnerPing = thread({
    id: "owner-needs-resolution",
    owner_id: DEMO_ID,
    deadline_at: new Date(Date.now() - 60_000).toISOString(),
    payload: {
      title: "Future Beacon",
      description: "",
      category: "Fitness",
      mode: "squad",
      starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      timezone: "America/Chicago",
      approval_required: false,
      audience: "squad",
      audience_id: "boxing",
      target_count: null,
      label: "",
      online_url: null,
      latitude: null,
      longitude: null,
      aspiration_ids: [],
    },
  });
  data.planning_threads = [expiredOwnerPing];
  data.planning_ping_responses = [];
  assert.equal(activeSquadDecision(data, "boxing", DEMO_ID)?.id, "owner-needs-resolution");
});

test("Squad chat shows only readable canonical Pings for the current Squad", () => {
  const data = makeDemo();
  data.planning_threads = [
    thread({ id: "boxing-ping" }),
    thread({ id: "other-squad-ping", audience_id: "weekend" }),
    thread({ id: "friend-ping", audience: "friends", audience_id: null }),
    thread({ id: "boxing-vote", kind: "vote" }),
    thread({ id: "cancelled-ping", status: "cancelled" }),
  ];
  assert.deepEqual(
    selectSquadChatPings(data, "boxing", DEMO_ID).map((item) => item.id),
    ["boxing-ping"],
  );

  data.viewer_id = "jordan";
  assert.deepEqual(selectSquadChatPings(data, "boxing", DEMO_ID), []);
  data.viewer_id = DEMO_ID;
  data.squad_members = data.squad_members.filter(
    (member) => !(member.squad_id === "boxing" && member.user_id === DEMO_ID),
  );
  assert.deepEqual(selectSquadChatPings(data, "boxing", DEMO_ID), []);
});

test("Squad chat Ping response counts exclude blocked and no-longer-member respondents", () => {
  const data = makeDemo();
  const squadPing = thread({ id: "boxing-ping" });
  data.squad_members.push({ squad_id: "boxing", user_id: "sam", role: "member" });
  data.squad_members.push({ squad_id: "boxing", user_id: "maya", role: "member" });
  data.planning_threads = [squadPing];
  data.planning_ping_responses = [
    {
      thread_id: squadPing.id,
      user_id: "sam",
      response: "interested",
      auto_rsvp: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      thread_id: squadPing.id,
      user_id: "maya",
      response: "maybe",
      auto_rsvp: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  assert.deepEqual(
    visibleSquadPingResponses(data, squadPing, DEMO_ID).map((row) => row.user_id),
    ["sam", "maya"],
  );

  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: "sam" });
  assert.deepEqual(
    visibleSquadPingResponses(data, squadPing, DEMO_ID).map((row) => row.user_id),
    ["maya"],
  );
  data.blocks = [];
  data.squad_members = data.squad_members.filter(
    (member) => !(member.squad_id === "boxing" && member.user_id === "sam"),
  );
  assert.deepEqual(
    visibleSquadPingResponses(data, squadPing, DEMO_ID),
    data.planning_ping_responses.filter((row) => row.user_id === "maya"),
  );
});
