import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyData,
  type Activity,
  type BeaconDraft,
  type PlanningThread,
} from "../src/shared/types";
import { resolveMapContext } from "../src/features/maps/contextFilters";
import { readablePlanForActivity } from "../src/features/beacons/screens/discoveryPlan";
import { showBeaconOnMap } from "../src/features/maps/mapDiscovery";

const activity = (id: string, index = 0): Activity => ({
  id,
  title: id,
  description: "",
  owner_id: "viewer",
  category: "Social",
  mode: "solo",
  status: "completed",
  starts_at: "2020-01-01T10:00:00Z",
  ends_at: "2020-01-01T11:00:00Z",
  timezone: "UTC",
  audience: "private",
  audience_id: null,
  approval_required: false,
  goal_id: null,
  habit_id: null,
  plan_id: "plan",
  plan_step_index: index,
  aspiration_ids: [],
});
const draft: BeaconDraft = {
  title: "Suggestion",
  description: "",
  category: "Social",
  mode: "squad",
  starts_at: "2020-01-01T10:00:00Z",
  ends_at: "2020-01-01T11:00:00Z",
  timezone: "UTC",
  approval_required: false,
  audience: "private",
  audience_id: null,
  target_count: null,
  label: "Cafe",
  latitude: 41.88,
  longitude: -87.63,
  online_url: null,
  aspiration_ids: [],
};
function fixture() {
  const data = emptyData();
  data.is_demo = true;
  data.viewer_id = "viewer";
  data.plans.push({
    id: "plan",
    owner_id: "viewer",
    squad_id: null,
    title: "Friday Night",
    description: "",
    timezone: "UTC",
    start_date: "2020-01-01",
    status: "scheduled",
    created_at: "",
  });
  data.activities = [activity("second", 1), activity("first", 0)];
  data.places = data.activities.map((row, index) => ({
    activity_id: row.id,
    label: row.title,
    latitude: 41.88 + index * 0.01,
    longitude: -87.63,
    online_url: null,
  }));
  return data;
}
function thread(kind: PlanningThread["kind"]): PlanningThread {
  return {
    id: "thread",
    owner_id: "viewer",
    coowner_ids: [],
    title: "Dinner",
    body: "",
    kind,
    audience: "private",
    audience_id: null,
    deadline_at: "",
    status: "resolved",
    payload: draft,
    winner_proposal_id: null,
    replaced_from_proposal_id: null,
    materialized_activity_id: null,
    created_at: "",
    resolved_at: null,
  };
}
test("Plan context reveals permitted unavailable Beacons in order without altering normal discovery", () => {
  const data = fixture();
  assert.equal(showBeaconOnMap(data, data.activities[0], "viewer"), false);
  const view = resolveMapContext(data, "viewer", { kind: "plan", id: "plan" })!;
  assert.equal(view.label, "Plan: Friday Night");
  assert.deepEqual(
    view.activities.map((row) => row.id),
    ["first", "second"],
  );
  assert.deepEqual(
    view.paths[0],
    view.points.map(({ latitude, longitude }) => ({ latitude, longitude })),
  );
  assert.equal(showBeaconOnMap(data, data.activities[0], "viewer"), false);
});
test("hidden Plan steps never leak locations or connect the path across the gap", () => {
  const data = fixture();
  data.activities.push({ ...activity("hidden", 1), owner_id: "stranger" });
  data.activities[0].plan_step_index = 2;
  data.places.push({
    activity_id: "hidden",
    label: "Secret",
    latitude: 0,
    longitude: 0,
    online_url: null,
  });
  const view = resolveMapContext(data, "viewer", { kind: "plan", id: "plan" })!;
  assert.deepEqual(
    view.activities.map((row) => row.id),
    ["first", "second"],
  );
  assert.equal(view.paths.length, 0);
  assert.ok(view.points.every((point) => point.latitude !== 0));
});
test("context rechecks viewer and Plan access on every resolution", () => {
  const data = fixture();
  assert.equal(
    resolveMapContext(data, "another", { kind: "plan", id: "plan" }),
    null,
  );
  data.plans[0].owner_id = "stranger";
  assert.equal(
    resolveMapContext(data, "viewer", { kind: "plan", id: "plan" }),
    null,
  );
});

test("discovery Plan context requires the Beacon's exact linked, readable Plan", () => {
  const data = fixture();
  const beacon = data.activities[0];
  assert.equal(
    readablePlanForActivity(data, beacon, "viewer"),
    data.plans[0],
  );

  beacon.plan_id = "unrelated-plan";
  assert.equal(readablePlanForActivity(data, beacon, "viewer"), undefined);
  beacon.plan_id = data.plans[0].id;
  data.plans[0].owner_id = "stranger";
  assert.equal(readablePlanForActivity(data, beacon, "viewer"), undefined);
  data.plans[0].owner_id = "viewer";
  data.viewer_id = "another-viewer";
  assert.equal(readablePlanForActivity(data, beacon, "viewer"), undefined);
});
for (const kind of ["vote", "draw"] as const)
  test(`${kind} suggestions retain draft identity and independent Beacon privacy`, () => {
    const data = fixture();
    data.planning_threads.push(thread(kind));
    data.activities.push({ ...activity("private"), owner_id: "stranger" });
    data.planning_proposals = [
      "draft",
      "denied",
      "virtual",
      "invalid",
      "blocked",
    ].map((id) => ({
      id,
      thread_id: "thread",
      author_id: id === "blocked" ? "stranger" : "viewer",
      payload: {
        ...draft,
        online_url: id === "virtual" ? "https://example.com" : null,
        latitude: id === "invalid" ? NaN : draft.latitude,
      },
      approved: true,
      disqualified_at: null,
      created_at: "",
      activity_id: id === "denied" ? "private" : null,
    }));
    data.blocks.push({
      blocker_id: "viewer",
      blocked_id: "stranger",
      created_at: "",
    });
    const view = resolveMapContext(data, "viewer", {
      kind: "thread",
      id: "thread",
    })!;
    assert.equal(view.label, `${kind === "vote" ? "Vote" : "Draw"}: Dinner`);
    assert.deepEqual(
      view.points.map((point) => point.id),
      ["proposal:draft"],
    );
    assert.equal(view.points[0].threadId, "thread");
    assert.equal(view.activities.length, 0);
    data.planning_threads[0].owner_id = "stranger";
    assert.equal(
      resolveMapContext(data, "viewer", { kind: "thread", id: "thread" }),
      null,
    );
  });
test("Ping context shows its permitted draft or converted Beacon, never a denied conversion fallback", () => {
  const data = fixture();
  data.planning_threads.push(thread("ping"));
  const filter = { kind: "thread" as const, id: "thread" };
  assert.equal(
    resolveMapContext(data, "viewer", filter)?.points[0].id,
    "ping:thread",
  );
  data.planning_threads[0].materialized_activity_id = "second";
  assert.equal(
    resolveMapContext(data, "viewer", filter)?.points[0].activityId,
    "second",
  );
  data.activities[0].owner_id = "stranger";
  assert.deepEqual(resolveMapContext(data, "viewer", filter)?.points, []);
});

// Geometry checks cover sideways attachment and protected controls at both orientations.
import { mapCalloutLayout } from "../src/features/maps/mapCalloutLayout";
import { mapTooltip } from "../src/features/maps/tooltipConstants";
test("compact callouts stay above or below their markers and aim sideways after shifting", () => {
  const bounds = { width: 390, height: 700, top: 130, bottom: 24 };
  const above = mapCalloutLayout(
    { x: 360, y: 570 },
    bounds,
    240,
    undefined,
    16,
    mapTooltip.width,
  );
  assert.equal(above.above, true);
  assert.equal(above.attached, true);
  assert.equal(above.pointerTip + above.left, 360);
  assert.ok(above.top + 240 < 570);
  const below = mapCalloutLayout(
    { x: 110, y: 150 },
    bounds,
    240,
    undefined,
    16,
    mapTooltip.width,
  );
  assert.equal(below.above, false);
  assert.ok(below.top > 150);
  assert.ok(below.top + 240 <= 676);
});
test("callouts reserve the control rail only where they overlap it", () => {
  const bounds = {
    width: 390,
    height: 700,
    top: 130,
    bottom: 24,
    exclusionRight: 64,
    exclusionBottom: 290,
  };
  const nearControls = mapCalloutLayout(
    { x: 300, y: 150 },
    bounds,
    160,
    undefined,
    16,
    mapTooltip.width,
  );
  assert.ok(nearControls.left + nearControls.width <= 326);
  const away = mapCalloutLayout(
    { x: 200, y: 650 },
    bounds,
    160,
    undefined,
    16,
    mapTooltip.width,
  );
  assert.equal(away.width, mapTooltip.width);
});
