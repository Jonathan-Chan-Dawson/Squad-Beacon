import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, demoAction, makeDemo } from "../src/shared/demo";
import {
  currentActivity,
  ownActivityNote,
  upNext,
} from "../src/features/beacons/livingActivity";
import { liveOwnedStatuses } from "../src/features/beacons/components/feed/statusActions";
import { normalizeData } from "../src/shared/types";
import {
  publishPlanningSession,
  type PlanningCreationSession,
} from "../src/features/planning/creationSession";

const payload = () => ({
  title: "Shooting hoops",
  description: "Practicing",
  category: "Fitness",
  audience: "friends",
  audience_id: null,
  timezone: "UTC",
  ends_at: new Date(Date.now() + 3600000).toISOString(),
  label: "Campus Courts",
});
test("ordinary Status save/clear, independent availability, and note editing preserve the other purpose", () => {
  let data = makeDemo();
  data = demoAction(data, "save_activity_note", payload());
  const note = ownActivityNote(data, DEMO_ID, Date.now())!;
  data = demoAction(data, "save_status_note", {
    title: "Personal message",
    available: true,
  });
  assert.equal(
    data.places.find((p) => p.activity_id === note.id)?.label,
    "Campus Courts",
  );
  assert.ok(ownActivityNote(data, DEMO_ID, Date.now()));
  assert.notEqual(liveOwnedStatuses(data, DEMO_ID, Date.now())[0]?.id, note.id);
  data = demoAction(data, "update_presence", { availability: null });
  assert.equal(
    data.activities.find((a) => a.id === note.id)?.title,
    "Shooting hoops",
  );
  assert.ok(
    data.activities.some(
      (a) => a.title === "Personal message" && a.status === "scheduled",
    ),
  );
  data = demoAction(data, "save_activity_note", {
    ...payload(),
    id: note.id,
    title: "Practicing free throws",
  });
  assert.equal(ownActivityNote(data, DEMO_ID, Date.now())?.id, note.id);
  assert.throws(
    () => demoAction(data, "save_activity_note", payload()),
    /Edit or end/,
  );
  data = demoAction(data, "clear_status_notes", {});
  assert.equal(ownActivityNote(data, DEMO_ID, Date.now())?.id, note.id);
});
test("live sharing supersedes once; disabling it cannot resurrect the old note", () => {
  let data = demoAction(makeDemo(), "save_activity_note", payload());
  const note = ownActivityNote(data, DEMO_ID, Date.now())!;
  const live = {
    ...data.activities[0],
    id: "own-live",
    owner_id: DEMO_ID,
    mode: "squad" as const,
    status: "scheduled" as const,
    audience: "friends" as const,
    starts_at: new Date(Date.now() - 1000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    plan_id: null,
    plan_step: null,
  };
  data.activities.push(live);
  // Hosting alone does not constitute permission to broadcast attendance.
  assert.equal(
    currentActivity(data, DEMO_ID, DEMO_ID, Date.now())?.type,
    "activity_note",
  );
  data = demoAction(data, "update_presence", {
    show_current_beacon: true,
    current_beacon_id: live.id,
  });
  assert.equal(
    currentActivity(data, DEMO_ID, DEMO_ID, Date.now())?.activity.id,
    live.id,
  );
  assert.equal(
    data.activities.find((a) => a.id === note.id)?.status,
    "completed",
  );
  data = demoAction(data, "update_presence", { show_current_beacon: false });
  assert.equal(currentActivity(data, DEMO_ID, DEMO_ID, Date.now()), null);
});
test("hosted projections never fall back to a readable note behind an inaccessible owner selection", () => {
  let data = normalizeData(makeDemo());
  data = demoAction(data, "save_activity_note", payload());
  data.is_demo = false;
  data.capabilities = { living_activity: true };
  data.presence = [
    {
      owner_id: DEMO_ID,
      sharing: true,
      availability: null,
      current_activity: null,
    },
  ];
  assert.equal(currentActivity(data, DEMO_ID, DEMO_ID, Date.now()), null);
  data.presence[0].current_activity = { type: "beacon", id: "inaccessible" };
  assert.equal(currentActivity(data, DEMO_ID, DEMO_ID, Date.now()), null);
  assert.equal(
    currentActivity(data, DEMO_ID, "different-account", Date.now()),
    null,
  );
});
test("Up Next is owner-only and a Featured duplicate does not cause a substitute", () => {
  let data = makeDemo();
  const now = Date.now();
  const upcoming = {
    ...data.activities[0],
    id: "next-own",
    owner_id: DEMO_ID,
    mode: "squad" as const,
    status: "scheduled" as const,
    audience: "friends" as const,
    starts_at: new Date(now + 600000).toISOString(),
    ends_at: new Date(now + 3600000).toISOString(),
    plan_id: null,
    plan_step: null,
  };
  data.activities = [upcoming];
  data.planning_threads = [];
  assert.equal(upNext(data, DEMO_ID, now)?.id, upcoming.id);
  data = demoAction(data, "save_status_note", {
    title: "",
    status_attachment: { type: "beacon", id: upcoming.id },
    status_presentation: "activity_only",
  });
  assert.equal(upNext(data, DEMO_ID, Date.now()), null);
  assert.equal(upNext(data, "another-person", Date.now()), null);
});
test("Council retries retain the decision and completed options after a partial failure", async () => {
  const session: PlanningCreationSession = {};
  const calls: string[] = [];
  let fail = true;
  let counter = 0;
  const act = async (action: string, value: Record<string, unknown>) => {
    calls.push(
      action +
        ":" +
        String((value.payload as Record<string, unknown>)?.title ?? ""),
    );
    if (action === "create_planning_thread") return { id: "decision" };
    if ((value.payload as Record<string, unknown>).title === "Second" && fail) {
      fail = false;
      throw new Error("Interrupted");
    }
    return { id: "proposal-" + ++counter };
  };
  const options = [{ title: "First" }, { title: "Second" }] as any;
  await assert.rejects(
    publishPlanningSession(session, { title: "Council" }, options, act, () =>
      String(++counter),
    ),
    /Interrupted/,
  );
  const id = await publishPlanningSession(
    session,
    { title: "Changed after failure" },
    [],
    act,
    () => String(++counter),
  );
  assert.equal(id, "decision");
  assert.equal(
    calls.filter((c) => c.startsWith("create_planning_thread")).length,
    1,
  );
  assert.equal(
    calls.filter((c) => c === "add_council_proposal:First").length,
    1,
  );
  assert.equal(
    calls.filter((c) => c === "add_council_proposal:Second").length,
    2,
  );
  assert.equal(session.attempt?.payload.title, "Council");
});
