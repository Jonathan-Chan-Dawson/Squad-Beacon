import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID, demoAction } from "../src/shared/demo";
import {
  nextRecurrenceDate,
  recurrencePreview,
} from "../src/features/plans/recurrence";
import {
  planEditorFromData,
  type PlanEditorDraft,
} from "../src/features/plans/planEditorModel";

const rule = {
  anchor_date: "2027-01-31",
  frequency: "monthly" as const,
  interval_count: 1,
  interval_weeks: 1,
  month_day: 31,
  weekdays: [7],
  ends_on: null,
};
test("monthly repeats retain their original day across shorter months and leap years", () => {
  assert.deepEqual(recurrencePreview(rule, "2027-01-30", 4), [
    "2027-01-31",
    "2027-02-28",
    "2027-03-31",
    "2027-04-30",
  ]);
  assert.equal(
    nextRecurrenceDate({ ...rule, anchor_date: "2028-01-31" }, "2028-01-31"),
    "2028-02-29",
  );
  assert.deepEqual(
    recurrencePreview({ ...rule, interval_count: 2 }, "2027-01-30", 3),
    ["2027-01-31", "2027-03-31", "2027-05-31"],
  );
  assert.equal(
    nextRecurrenceDate({ ...rule, ends_on: "2027-02-27" }, "2027-01-31"),
    null,
  );
});
test("daily and weekly intervals use local dates across DST and validate inputs", () => {
  assert.deepEqual(
    recurrencePreview(
      {
        ...rule,
        frequency: "daily",
        anchor_date: "2027-03-13",
        interval_count: 2,
      },
      "2027-03-12",
      3,
    ),
    ["2027-03-13", "2027-03-15", "2027-03-17"],
  );
  assert.deepEqual(
    recurrencePreview(
      {
        ...rule,
        frequency: "weekly",
        anchor_date: "2027-03-01",
        weekdays: [1, 5],
        interval_count: 2,
      },
      "2027-02-28",
      4,
    ),
    ["2027-03-01", "2027-03-05", "2027-03-15", "2027-03-19"],
  );
  assert.throws(
    () => nextRecurrenceDate({ ...rule, interval_count: 0 }, "2027-01-01"),
    /Check/,
  );
});
test("saving a Plan draft publishes nothing; selected scheduling publishes only selected new Beacons", () => {
  let data = makeDemo();
  const before = data.activities.length,
    notices = data.notices.length;
  const starts = new Date(Date.now() + 3600000 * 12).toISOString(),
    ends = new Date(Date.now() + 3600000 * 13).toISOString();
  const beacon = {
    title: "Unpublished",
    description: "Private draft",
    category: "Social",
    mode: "squad",
    audience: "private",
    audience_id: null,
    starts_at: starts,
    ends_at: ends,
    timezone: "UTC",
    approval_required: false,
    target_count: null,
    label: "",
    online_url: null,
    latitude: null,
    longitude: null,
    aspiration_ids: [],
  };
  const draft: PlanEditorDraft = {
    version: 1,
    token: "draft",
    revision: 0,
    title: "A small adventure",
    description: "",
    timezone: "UTC",
    start_date: "",
    squad_id: null,
    removed_stop_ids: [],
    stops: [
      {
        id: crypto.randomUUID(),
        kind: "idea",
        title: "Maybe a cafe",
        details: "",
      },
      {
        id: crypto.randomUUID(),
        kind: "beacon",
        title: beacon.title,
        details: "",
        beacon,
        include: true,
      },
      {
        id: crypto.randomUUID(),
        kind: "beacon",
        title: "Later",
        details: "",
        beacon: { ...beacon, title: "Later" },
        include: false,
      },
    ],
  };
  data = demoAction(
    data,
    "save_plan_editor",
    draft as unknown as Record<string, unknown>,
  );
  const p = data.plans.find((p) => p.title === draft.title)!;
  assert.equal(data.activities.length, before);
  assert.equal(data.notices.length, notices);
  assert.equal(data.plan_beacon_drafts?.length, 2);
  const saved = planEditorFromData(data, p, DEMO_ID, "draft");
  data = demoAction(
    data,
    "schedule_plan_editor",
    saved as unknown as Record<string, unknown>,
  );
  assert.equal(data.activities.length, before + 1);
  assert.equal(data.plan_beacon_drafts?.length, 1);
  assert.equal(data.activities.at(-1)?.title, "Unpublished");
  assert.throws(
    () =>
      demoAction(
        data,
        "save_plan_editor",
        saved as unknown as Record<string, unknown>,
      ),
    /changed/,
  );
});
