import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, demoAction } from "../src/shared/demo";
import {
  makeScenario,
  scenarios,
  scenarioTime,
} from "../src/features/onboarding/scenarios";
import {
  contentState,
  homePresentation,
  firstSuccessCandidate,
} from "../src/features/onboarding/presentation";
import { getCopy } from "../src/features/onboarding/copy";
import {
  listenOnboardingSuccess,
  reportOnboardingSuccess,
  parseProgress,
  type OnboardingKey,
} from "../src/features/onboarding/progress";
import { demoPublicBeacons } from "../src/features/discovery/publicDirectory";

test("empty is not new: reliable first-entry evidence and loaded progress are required", () => {
  const { data } = makeScenario("fresh");
  const present = (
    keys: OnboardingKey[],
    status: "ready" | "loading" | "error" = "ready",
    firstSession = false,
  ) =>
    homePresentation(
      data,
      DEMO_ID,
      scenarioTime,
      new Set(keys),
      status,
      false,
      null,
      firstSession,
    ).kind;
  assert.equal(present([]), "compact");
  assert.equal(present(["entry.eligible.v1"], "loading"), "compact");
  assert.equal(present(["entry.eligible.v1"], "error"), "compact");
  assert.equal(present(["entry.eligible.v1"]), "compact");
  assert.equal(present(["entry.eligible.v1"], "ready", true), "welcome");
  assert.equal(
    present(["entry.eligible.v1", "welcome.seen.v1"], "ready", true),
    "welcome",
  );
  assert.equal(present(["entry.eligible.v1", "welcome.seen.v1"]), "compact");
  assert.equal(
    present(["entry.eligible.v1", "welcome.dismissed.v1"]),
    "compact",
  );
  assert.equal(
    homePresentation(
      data,
      "another-account",
      scenarioTime,
      new Set(["entry.eligible.v1"]),
      "ready",
      false,
      null,
    ).kind,
    "unavailable",
  );
});
test("content precedence distinguishes failure, loading, access, filters and emptiness", () => {
  assert.equal(
    contentState({ error: "failure", loading: true, count: 0 }),
    "error",
  );
  assert.equal(
    contentState({ available: false, loading: true, count: 4 }),
    "unavailable",
  );
  assert.equal(contentState({ loading: true, count: 0 }), "loading");
  assert.equal(contentState({ filtered: true, count: 0 }), "filtered");
  assert.equal(contentState({ count: 0 }), "empty");
  assert.equal(contentState({ filtered: true, count: 1 }), "populated");
});
test("all ten scenarios have valid profiles and no orphaned fixture relationships", () => {
  assert.equal(Object.keys(scenarios).length, 10);
  for (const name of Object.keys(scenarios) as (keyof typeof scenarios)[]) {
    const { data } = makeScenario(name);
    assert.equal(data.viewer_id, DEMO_ID);
    assert.equal(data.is_demo, true);
    assert.notEqual(
      data.profiles.find((p) => p.id === DEMO_ID)?.onboarding_survey_status,
      "pending",
    );
    for (const f of data.friendships) {
      assert.ok(
        data.profiles.some((p) => p.id === f.sender_id),
        `${name}: sender`,
      );
      assert.ok(
        data.profiles.some((p) => p.id === f.recipient_id),
        `${name}: recipient`,
      );
    }
    for (const m of data.squad_members)
      assert.ok(data.squads.some((s) => s.id === m.squad_id));
    for (const r of data.rsvps)
      assert.ok(data.activities.some((a) => a.id === r.activity_id));
    for (const p of data.planning_proposals)
      assert.ok(data.planning_threads.some((t) => t.id === p.thread_id));
  }
});
test("pending requests remain prominent; friends and populated accounts suppress introduction", () => {
  for (const name of [
    "friends",
    "responses",
    "invitation",
    "populated",
  ] as const) {
    const { data } = makeScenario(name);
    const home = homePresentation(
      data,
      DEMO_ID,
      Date.now(),
      new Set(["entry.eligible.v1"]),
      "ready",
      false,
      null,
    );
    assert.notEqual(home.kind, "welcome");
    if (name === "invitation" || name === "responses")
      assert.ok(home.pending > 0, name);
  }
});
test("public discovery is authorized projection without fabricated connections", () => {
  const { data } = makeScenario("discovery");
  assert.equal(data.friendships.length, 0);
  const rows = demoPublicBeacons(data, DEMO_ID, "", scenarioTime);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].activity_id, "lab-public");
  assert.equal("description" in rows[0], false);
});
test("copy is deterministic, editable by tone, and optional", () => {
  assert.deepEqual(
    getCopy("empty.upcoming", "playful", "viewer"),
    getCopy("empty.upcoming", "playful", "viewer"),
  );
  assert.equal(
    getCopy("empty.upcoming", "bro", "viewer", false).quip,
    undefined,
  );
  assert.equal(getCopy("state.error", "bro").quip, undefined);
  assert.equal(
    getCopy("empty.upcoming", "bro").title,
    getCopy("empty.upcoming", "friendly").title,
  );
});
test("first-success candidates require confirmed action transitions and matching viewers", () => {
  const before = makeScenario("invitation").data;
  const after = demoAction(before, "accept_friend", { id: "lab-invitation" });
  assert.equal(
    firstSuccessCandidate(before, after, DEMO_ID, "accept_friend"),
    "success.firstConnection.v1",
  );
  assert.equal(
    firstSuccessCandidate(after, after, DEMO_ID, "accept_friend"),
    null,
  );
  assert.equal(
    firstSuccessCandidate(before, after, "different-viewer", "accept_friend"),
    null,
  );
  assert.equal(firstSuccessCandidate(before, after, DEMO_ID, "refresh"), null);
});

test("first Beacon and completion require a new confirmed Beacon, excluding status and Activity Notes", () => {
  const before = makeScenario("fresh").data;
  const publicFixture = makeScenario("discovery").data.activities[0];
  const after = structuredClone(before);
  after.activities.push({ ...publicFixture, owner_id: DEMO_ID });
  assert.equal(
    firstSuccessCandidate(before, after, DEMO_ID, "create_activity"),
    "success.firstBeacon.v1",
  );
  assert.equal(
    firstSuccessCandidate(after, after, DEMO_ID, "create_activity"),
    null,
  );
  const completed = structuredClone(after);
  completed.activities[0].status = "completed";
  assert.equal(
    firstSuccessCandidate(after, completed, DEMO_ID, "activity_status"),
    "success.firstCompletion.v1",
  );
  assert.equal(
    firstSuccessCandidate(completed, completed, DEMO_ID, "activity_status"),
    null,
  );
  after.activities[0].mode = "solo";
  after.activities[0].solo_purpose = "status_note";
  assert.equal(
    firstSuccessCandidate(before, after, DEMO_ID, "create_activity"),
    null,
  );
});
test("progress parsing is bounded and action listeners detach safely", () => {
  assert.deepEqual(
    [...parseProgress([{ key: "tip.ping.v1" }, { key: "unknown" }])],
    ["tip.ping.v1"],
  );
  assert.throws(() => parseProgress(null));
  let calls = 0;
  const stop = listenOnboardingSuccess(() => calls++);
  const event = {
    viewer: DEMO_ID,
    epoch: 1,
    key: "success.firstBeacon.v1" as const,
  };
  reportOnboardingSuccess(event);
  stop();
  reportOnboardingSuccess(event);
  assert.equal(calls, 1);
});
