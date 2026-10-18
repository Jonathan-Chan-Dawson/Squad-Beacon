import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import {
  personalHubPreview,
  confirmedHubActivities,
} from "../src/features/beacons/hubSelectors";
import { discoveryActivities } from "../src/features/beacons/discoverySelectors";
import type { Activity } from "../src/shared/types";
const now = Date.parse("2026-10-17T16:00:00Z");
const iso = (offset: number) => new Date(now + offset * 60000).toISOString();
function fixture() {
  const data = makeDemo();
  const base: Activity = {
    ...data.activities[0],
    owner_id: DEMO_ID,
    mode: "open",
    audience: "friends",
    audience_id: null,
    status: "scheduled",
    plan_id: null,
    plan_step: false,
    starts_at: iso(60),
    ends_at: iso(120),
    category: "Social",
  };
  data.activities = [];
  data.places = [];
  data.rsvps = [];
  return { data, base };
}
test("personal preview keeps one current and one next commitment, excluding expired and unstarted plans", () => {
  const { data, base } = fixture();
  data.activities = [
    { ...base, id: "next", starts_at: iso(30) },
    { ...base, id: "later", starts_at: iso(60) },
    { ...base, id: "current", starts_at: iso(-15) },
    { ...base, id: "also-live", starts_at: iso(-5) },
    { ...base, id: "expired", starts_at: iso(-120), ends_at: iso(0) },
    {
      ...base,
      id: "waiting",
      plan_id: "plan",
      plan_step: true,
      plan_started_at: null,
    },
  ];
  assert.deepEqual(
    personalHubPreview(confirmedHubActivities(data, DEMO_ID), now).map(
      (row) => row.id,
    ),
    ["current", "next"],
  );
  assert.deepEqual(
    personalHubPreview(
      data.activities.filter((row) => Date.parse(row.starts_at) > now),
      now,
    ).map((row) => row.id),
    ["next", "later"],
  );
});
test("discovery searches the full 500-Beacon dataset, respects categories, excludes solo notes and wrong viewers", () => {
  const { data, base } = fixture();
  data.activities = Array.from({ length: 500 }, (_, index) => ({
    ...base,
    id: `beacon-${index}`,
    title: `Gathering ${index}`,
    category: index % 2 ? "Study" : "Social",
  }));
  data.activities.push({
    ...base,
    id: "note",
    mode: "solo",
    title: "Gathering 499",
  });
  const filters = {
    audience: "Everyone",
    category: "All categories",
    time: "All",
    planId: null,
    categories: ["Study"],
  } as const;
  const selected = { ...filters, categories: [...filters.categories] };
  assert.deepEqual(
    discoveryActivities(
      data,
      DEMO_ID,
      now,
      "Upcoming",
      "Gathering 499",
      selected,
      null,
    ).map((row) => row.id),
    ["beacon-499"],
  );
  assert.equal(
    discoveryActivities(data, DEMO_ID, now, "Upcoming", "", selected, null)
      .length,
    250,
  );
  assert.deepEqual(
    discoveryActivities(
      data,
      "another-account",
      now,
      "Upcoming",
      "",
      selected,
      null,
    ),
    [],
  );
});
test("discovery does not search hidden meeting locations or return revoked activities", () => {
  const { data, base } = fixture();
  const host = data.profiles.find((row) => row.id !== DEMO_ID)!;
  data.activities = [
    {
      ...base,
      id: "private",
      owner_id: host.id,
      audience: "private",
      title: "Hidden",
    },
  ];
  data.places = [
    {
      activity_id: "private",
      label: "Secret destination",
      latitude: 47,
      longitude: -122,
      online_url: null,
    },
  ];
  const filters = {
    audience: "Everyone",
    category: "All categories",
    time: "All",
    planId: null,
  } as const;
  assert.deepEqual(
    discoveryActivities(
      data,
      DEMO_ID,
      now,
      "Upcoming",
      "Secret",
      filters,
      null,
    ),
    [],
  );
  assert.deepEqual(
    discoveryActivities(
      data,
      DEMO_ID,
      now,
      "Upcoming",
      "Hidden",
      filters,
      null,
    ),
    [],
  );
});

test("explicit time filters stay consistent between homepage and full discovery", () => {
  const { data, base } = fixture();
  data.activities = [{ ...base, id: "live", starts_at: iso(-10) }, { ...base, id: "next" }];
  const filters = { audience: "Everyone", category: "All categories", time: "Now", planId: null } as const;
  assert.deepEqual(discoveryActivities(data, DEMO_ID, now, "Upcoming", "", filters, null), []);
  assert.deepEqual(discoveryActivities(data, DEMO_ID, now, "Active", "", filters, null).map((row) => row.id), ["live"]);
  assert.deepEqual(discoveryActivities(data, DEMO_ID, now, "Active", "", { ...filters, time: "Upcoming" }, null), []);
});
