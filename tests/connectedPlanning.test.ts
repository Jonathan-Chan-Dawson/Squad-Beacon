import { canReadPlanningThread } from "../src/features/planning/domain";
import { planLocalDateTimeToISO } from "../src/features/plans/domain";
import test from "node:test";
import assert from "node:assert/strict";
import {
  availabilitySummary,
  interestTarget,
  suggestedSlots,
  backupAvailableAt,
  validateSlots,
  wallTimeToInstant,
  instantToWallField,
} from "../src/features/planning/connected";
import { emptyData } from "../src/shared/types";
import type {
  PlanningThread,
  PlanningSlot,
} from "../src/features/planning/types";

const base = Date.parse("2030-01-01T12:00:00Z");
const thread: PlanningThread = {
  id: "t",
  owner_id: "owner",
  coowner_ids: [],
  kind: "time",
  title: "Walk",
  body: "",
  audience: "friends",
  audience_id: null,
  deadline_at: new Date(base + 3600000).toISOString(),
  status: "open",
  payload: null,
  winner_proposal_id: null,
  replaced_from_proposal_id: null,
  materialized_activity_id: null,
  created_at: "",
  resolved_at: null,
};
const slots: PlanningSlot[] = ["a", "b", "c"].map((id, i) => ({
  id,
  thread_id: "t",
  starts_at: new Date(base + (i + 2) * 86400000).toISOString(),
  ends_at: new Date(base + (i + 2) * 86400000 + 3600000).toISOString(),
  timezone: "America/Chicago",
  retired_at: null,
}));
test("scheduling validates slots and rejects equivalent instants and invalid deadlines", () => {
  validateSlots(slots, thread.deadline_at, base);
  assert.throws(
    () =>
      validateSlots(
        [slots[0], { ...slots[0], id: "b" }],
        thread.deadline_at,
        base,
      ),
    /distinct/i,
  );
  assert.throws(
    () => validateSlots(slots, slots[0].starts_at, base),
    /follow the deadline/i,
  );
  assert.throws(
    () =>
      validateSlots(
        [{ ...slots[0], ends_at: slots[0].starts_at }, slots[1]],
        thread.deadline_at,
        base,
      ),
    /last/i,
  );
});
test("availability keeps missing answers distinct and recommendations preserve ties and positive support", () => {
  const data = emptyData();
  data.viewer_id = "owner";
  data.planning_threads = [thread];
  data.planning_slots = slots;
  assert.deepEqual(
    availabilitySummary(data, thread, "owner", base).recommended,
    [],
  );
  data.planning_availability = [
    {
      thread_id: "t",
      user_id: "owner",
      slots_revision: 1,
      answers: { a: "yes", b: "yes" },
      none_work: false,
      updated_at: "",
    },
  ];
  const summary = availabilitySummary(data, thread, "owner", base);
  assert.deepEqual(summary.recommended, ["a", "b"]);
  assert.equal(summary.slots[2].no, 0);
});
test("wall-clock conversion rejects spring gaps and uses documented later fall occurrence", () => {
  assert.throws(
    () => planLocalDateTimeToISO("2030-03-10", "02:30", "America/Chicago"),
    /does not exist/i,
  );
  const repeated = wallTimeToInstant(
    new Date(2030, 10, 3, 1, 30).toISOString(),
    "America/Chicago",
  );
  assert.equal(repeated, "2030-11-03T07:30:00.000Z");
  assert.equal(
    wallTimeToInstant(
      instantToWallField(repeated, "America/Chicago"),
      "America/Chicago",
    ),
    repeated,
  );
});
test("backup grace follows 25 percent with a 24-hour cap and short-notice review buffer", () => {
  const d = new Date(base).toISOString();
  const at = (hours: number) =>
    backupAvailableAt(d, new Date(base + hours * 3600000).toISOString()) - base;
  assert.equal(at(4), 3600000);
  assert.equal(at(24), 6 * 3600000);
  assert.equal(at(48), 12 * 3600000);
  assert.equal(at(96), 24 * 3600000);
  assert.equal(at(0.25), 0);
});

test("interest targets stay optional and require bounded whole people", () => {
  assert.equal(interestTarget(""), null);
  assert.equal(interestTarget("4"), 4);
  for (const invalid of ["1", "101", "2.5", "four"])
    assert.throws(() => interestTarget(invalid), /2 to 100/);
});

test("suggested times use practical evenings in the intended zone and retain a valid duration", () => {
  let id = 0;
  const suggestions = suggestedSlots(base, () => `s${id++}`, {
    timezone: "America/Chicago",
    starts_at: "2030-01-01T10:00:00Z",
    ends_at: "2030-01-01T11:30:00Z",
  });
  assert.equal(suggestions.length, 3);
  assert.equal(suggestions[0].starts_at, "2030-01-04T00:00:00.000Z");
  assert.equal(
    Date.parse(suggestions[0].ends_at) - Date.parse(suggestions[0].starts_at),
    90 * 60000,
  );
});

test("server participant access fills hidden relationship rows without granting viewer access", () => {
  const data = emptyData();
  data.viewer_id = "viewer";
  assert.equal(canReadPlanningThread(data, thread, "participant"), false);
  data.planning_member_access = [
    { thread_id: thread.id, user_id: "participant" },
  ];
  assert.equal(canReadPlanningThread(data, thread, "participant"), true);
  assert.equal(canReadPlanningThread(data, thread, "viewer"), false);
});
