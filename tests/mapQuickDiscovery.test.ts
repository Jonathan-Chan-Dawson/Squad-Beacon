import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import type { Activity, Category } from "../src/shared/types";
import type {
  ExplorationFilters,
  MapViewport,
} from "../src/shared/exploration";
import {
  clearQuickDiscoveryFilters,
  normalizeExplorationFilters,
  resetDiscoveryFilters,
  selectedBeaconCategories,
} from "../src/shared/explorationFilters";
import {
  matchesBeaconFilters,
  explorationFilterCount,
} from "../src/features/maps/filtering";
import {
  prepareDiscoveryFriends,
  discoveryFriendScopeLabel,
  matchesDiscoveryFriends,
} from "../src/features/maps/discoveryFriends";
import { publicMapBeacons } from "../src/features/maps/publicMapDiscovery";
import {
  SurpriseCycle,
  surpriseCandidates,
  type SurpriseCandidate,
} from "../src/features/maps/surpriseDiscovery";
import { deriveMapPointPriorities } from "../src/features/maps/relevance";
import type { PublicBeaconSummary } from "../src/features/discovery/types";

const now = Date.parse("2026-11-03T18:00:00Z");
const viewport: MapViewport = {
  center: { latitude: 41.88, longitude: -87.64 },
  zoom: 13,
  bounds: { north: 41.9, south: 41.86, west: -87.67, east: -87.61 },
};

function fixture() {
  const data = makeDemo();
  const viewer = data.profiles.find((p) => p.id === DEMO_ID)!;
  const friend = data.profiles.find((p) => p.id !== DEMO_ID)!;
  data.friendships = [
    {
      ...data.friendships[0],
      sender_id: DEMO_ID,
      recipient_id: friend.id,
      status: "accepted",
    },
  ];
  data.blocks = [];
  data.activity_exclusions = [];
  data.rsvps = [];
  data.lists = [
    {
      ...data.lists[0],
      id: "circle",
      name: "My real circle",
      owner_id: DEMO_ID,
    },
  ];
  data.list_members = [{ list_id: "circle", user_id: friend.id }];
  viewer.interests = ["Study"];
  const base: Activity = {
    ...data.activities.find((a) => a.mode !== "solo")!,
    id: "base",
    owner_id: DEMO_ID,
    title: "Study together",
    description: "",
    category: "Study",
    mode: "squad",
    audience: "friends",
    audience_id: null,
    status: "scheduled",
    approval_required: false,
    manual_closed: false,
    capacity_policy: "soft",
    capacity_limit: null,
    starts_at: new Date(now - 60_000).toISOString(),
    ends_at: new Date(now + 3600_000).toISOString(),
    plan_id: null,
    plan_step: undefined,
    plan_started_at: undefined,
  };
  const activities = [
    { ...base, id: "hosted", owner_id: friend.id },
    { ...base, id: "attended" },
    { ...base, id: "unrelated", category: "Gaming" as Category },
    {
      ...base,
      id: "future",
      owner_id: friend.id,
      starts_at: new Date(now + 60_000).toISOString(),
    },
  ];
  data.activities = activities;
  data.rsvps = [
    {
      activity_id: "attended",
      user_id: friend.id,
      status: "going",
      approved: true,
    } as (typeof data.rsvps)[number],
  ];
  data.places = activities.map((a) => ({
    ...data.places[0],
    activity_id: a.id,
    latitude: 41.88,
    longitude: -87.64,
    online_url: null,
    label: "Authorized place",
  }));
  return { data, friend, activities };
}

function ids(filters: ExplorationFilters) {
  const { data } = fixture();
  const friends = prepareDiscoveryFriends(data, DEMO_ID, filters.friendScope);
  return data.activities
    .filter((a) =>
      matchesBeaconFilters(data, a, DEMO_ID, filters, now, { friends }),
    )
    .map((a) => a.id);
}

test("canonical categories distinguish absent legacy input from an explicitly cleared array", () => {
  const legacy = {
    ...resetDiscoveryFilters(),
    categories: undefined,
    category: "Study" as const,
    time: "Now" as const,
  };
  const normalized = normalizeExplorationFilters(legacy);
  assert.deepEqual(normalized.categories, ["Study"]);
  assert.equal(normalized.category, "All categories");
  assert.equal(normalized.happeningNow, true);
  assert.equal(normalized.time, "All");
  assert.deepEqual(selectedBeaconCategories({ ...legacy, categories: [] }), []);
  assert.deepEqual(normalizeExplorationFilters(normalized), normalized);
});

test("All clears only social/category restrictions while Reset restores discovery defaults", () => {
  const selected = {
    ...resetDiscoveryFilters(),
    friendScope: "custom:circle" as const,
    categories: ["Study" as Category],
    happeningNow: true,
    time: "Upcoming" as const,
    when: "Tomorrow" as const,
    audience: "group",
    join: "Open" as const,
    planId: "plan",
    personalizedRanking: false,
  };
  const all = clearQuickDiscoveryFilters(selected);
  assert.equal(all.friendScope, null);
  assert.deepEqual(all.categories, []);
  for (const key of [
    "happeningNow",
    "time",
    "when",
    "audience",
    "join",
    "planId",
    "personalizedRanking",
  ] as const)
    assert.equal(all[key], selected[key]);
  const reset = resetDiscoveryFilters();
  assert.equal(reset.happeningNow, false);
  assert.equal(reset.friendScope, null);
  assert.equal(reset.personalizedRanking, undefined);
  assert.equal(explorationFilterCount(reset), 0);
});

for (const [name, filters, expected] of [
  [
    "Friends + Now",
    { friendScope: "friends", happeningNow: true },
    ["hosted", "attended"],
  ],
  [
    "Friends + Study",
    { friendScope: "friends", categories: ["Study"] },
    ["hosted", "attended", "future"],
  ],
  [
    "Interests + Now",
    { categories: ["Study"], happeningNow: true },
    ["hosted", "attended"],
  ],
  [
    "Private List + Interest",
    { friendScope: "custom:circle", categories: ["Study"] },
    ["hosted", "attended", "future"],
  ],
  [
    "OR categories",
    { categories: ["Study", "Gaming"], happeningNow: true },
    ["hosted", "attended", "unrelated"],
  ],
  ["incompatible Upcoming + Now", { time: "Upcoming", happeningNow: true }, []],
  ["incompatible date + Now", { when: "Tomorrow", happeningNow: true }, []],
] as const)
  test(`${name} uses independent intersections`, () => {
    assert.deepEqual(
      ids({ ...resetDiscoveryFilters(), ...filters } as ExplorationFilters),
      expected,
    );
  });

test("private-list people are not interpreted as a Beacon audience; missing lists fail closed", () => {
  const { data, activities } = fixture();
  assert.equal(activities[0].audience_id, null);
  const list = prepareDiscoveryFriends(data, DEMO_ID, "custom:circle");
  assert.equal(matchesDiscoveryFriends(activities[0], list), true);
  assert.equal(matchesDiscoveryFriends(activities[1], list), true);
  assert.equal(
    discoveryFriendScopeLabel(data, DEMO_ID, "custom:circle"),
    "My real circle",
  );
  data.lists = [];
  assert.equal(
    prepareDiscoveryFriends(data, DEMO_ID, "custom:circle").people.size,
    0,
  );
  assert.equal(
    discoveryFriendScopeLabel(data, DEMO_ID, "custom:circle"),
    "Private List unavailable",
  );
});

test("Starred, pending participation, blocks and viewer changes do not broaden Friends matches", () => {
  const { data, friend, activities } = fixture();
  data.favorites = [];
  assert.equal(
    prepareDiscoveryFriends(data, DEMO_ID, "favorites").people.size,
    0,
  );
  data.favorites.push({
    owner_id: DEMO_ID,
    kind: "friend",
    target_id: friend.id,
  } as (typeof data.favorites)[number]);
  assert.equal(
    matchesDiscoveryFriends(
      activities[1],
      prepareDiscoveryFriends(data, DEMO_ID, "favorites"),
    ),
    true,
  );
  data.rsvps[0].status = "requested";
  data.rsvps[0].approved = false;
  assert.equal(
    matchesDiscoveryFriends(
      activities[1],
      prepareDiscoveryFriends(data, DEMO_ID, "favorites"),
    ),
    false,
  );
  data.blocks.push({
    blocker_id: DEMO_ID,
    blocked_id: friend.id,
  } as (typeof data.blocks)[number]);
  assert.equal(
    prepareDiscoveryFriends(data, DEMO_ID, "friends").people.size,
    0,
  );
  assert.equal(
    prepareDiscoveryFriends(data, "another", "custom:circle").people.size,
    0,
  );
});

test("hidden profiles cannot establish an attendance match in an authorized hosted snapshot", () => {
  const { data, friend, activities } = fixture();
  data.is_demo = false;
  for (const activity of activities) activity.viewer_can_access = true;
  friend.viewer_can_view_full_profile = false;
  assert.equal(
    matchesDiscoveryFriends(
      activities[1],
      prepareDiscoveryFriends(data, DEMO_ID, "friends"),
    ),
    false,
  );
  friend.viewer_can_view_full_profile = true;
  assert.equal(
    matchesDiscoveryFriends(
      activities[1],
      prepareDiscoveryFriends(data, DEMO_ID, "friends"),
    ),
    true,
  );
});

test("Now excludes unstarted Plan children, cancelled and completed Beacons", () => {
  const { data, activities } = fixture();
  const filters = { ...resetDiscoveryFilters(), happeningNow: true };
  const child = activities[0];
  child.plan_id = "plan";
  child.plan_step = { start_mode: "manual" } as Activity["plan_step"];
  child.plan_started_at = null;
  assert.equal(matchesBeaconFilters(data, child, DEMO_ID, filters, now), false);
  child.plan_started_at = child.starts_at;
  assert.equal(matchesBeaconFilters(data, child, DEMO_ID, filters, now), true);
  child.status = "completed";
  assert.equal(matchesBeaconFilters(data, child, DEMO_ID, filters, now), false);
  child.status = "cancelled";
  assert.equal(matchesBeaconFilters(data, child, DEMO_ID, filters, now), false);
});

function summary(id = "public-only"): PublicBeaconSummary {
  return {
    activity_id: id,
    title: "Public Study",
    category: "Study",
    interest_tags: ["Study"],
    starts_at: new Date(now - 1000).toISOString(),
    ends_at: new Date(now + 3600_000).toISOString(),
    area_label: "Approximate area",
    coarse_lat: 41.885,
    coarse_lng: -87.635,
    requires_approval: false,
    capacity_policy: "soft",
    capacity_limit: null,
    accepted_seat_count: 1,
    closed: false,
  };
}

test("public summaries cannot invent live state or friends; authorized counterparts confirm them", () => {
  const { data } = fixture(),
    row = summary("hosted"),
    defaults = resetDiscoveryFilters();
  const publicRows = (f: ExplorationFilters, known = false) =>
    publicMapBeacons(
      [row],
      f,
      [],
      [],
      false,
      viewport,
      now,
      known ? { data, viewerId: DEMO_ID, now } : undefined,
    );
  assert.equal(publicRows(defaults).length, 1);
  assert.equal(publicRows({ ...defaults, happeningNow: true }).length, 0);
  assert.equal(publicRows({ ...defaults, friendScope: "friends" }).length, 0);
  assert.equal(
    publicRows(
      { ...defaults, happeningNow: true, friendScope: "friends" },
      true,
    ).length,
    1,
  );
  data.activities[0].plan_id = "waiting";
  data.activities[0].plan_step = {} as Activity["plan_step"];
  data.activities[0].plan_started_at = null;
  assert.equal(publicRows({ ...defaults, happeningNow: true }, true).length, 0);
});

test("For Me changes matching affinity without changing eligible results", () => {
  const { data, activities } = fixture();
  const enabled = deriveMapPointPriorities(
    data,
    DEMO_ID,
    activities.map((a) => a.id),
    [],
    now,
    true,
  );
  const disabled = deriveMapPointPriorities(
    data,
    DEMO_ID,
    activities.map((a) => a.id),
    [],
    now,
    false,
  );
  assert.deepEqual(Object.keys(enabled), Object.keys(disabled));
  assert.equal(
    enabled["beacon:hosted"].affinity,
    disabled["beacon:hosted"].affinity! + 1,
  );
  data.profiles.find((p) => p.id === DEMO_ID)!.interests = [];
  const missing = deriveMapPointPriorities(
    data,
    DEMO_ID,
    ["hosted"],
    [],
    now,
    true,
  );
  assert.equal(
    missing["beacon:hosted"].affinity,
    disabled["beacon:hosted"].affinity,
  );
});

test("Surprise candidates recheck filters, clock, authorization and usable exact locations", () => {
  const { data, activities, friend } = fixture();
  const filters = {
    ...resetDiscoveryFilters(),
    happeningNow: true,
    categories: ["Study" as Category],
    friendScope: "friends" as const,
  };
  const build = () =>
    surpriseCandidates(data, DEMO_ID, activities, [], filters, viewport, now);
  assert.deepEqual(
    build().map((c) => c.id),
    ["attended", "hosted"],
  );
  assert.ok(
    build().find((c) => c.id === "hosted")!.weight >
      build().find((c) => c.id === "attended")!.weight,
  );
  data.places.find((p) => p.activity_id === "hosted")!.longitude = NaN;
  assert.deepEqual(
    build().map((c) => c.id),
    ["attended"],
  );
  activities[1].ends_at = new Date(now).toISOString();
  assert.equal(build().length, 0);
  data.blocks.push({
    blocker_id: DEMO_ID,
    blocked_id: friend.id,
  } as (typeof data.blocks)[number]);
  assert.equal(build().length, 0);
  assert.equal(
    surpriseCandidates(data, "another", activities, [], filters, viewport, now)
      .length,
    0,
  );
});

test("public Surprise coordinates stay coarse even when a different exact place is present", () => {
  const { data } = fixture(),
    row = summary("hosted");
  const candidates = surpriseCandidates(
    data,
    DEMO_ID,
    [],
    [row],
    resetDiscoveryFilters(),
    viewport,
    now,
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "public");
  assert.equal(candidates[0].zoom, 13);
  assert.deepEqual(candidates[0].coordinate, {
    latitude: row.coarse_lat,
    longitude: row.coarse_lng,
  });
  assert.equal(
    surpriseCandidates(
      data,
      DEMO_ID,
      [],
      [summary()],
      { ...resetDiscoveryFilters(), happeningNow: true },
      viewport,
      now,
    ).length,
    0,
  );
  const outside = { ...row, coarse_lat: 0, coarse_lng: 0 };
  assert.equal(
    surpriseCandidates(
      data,
      DEMO_ID,
      [],
      [outside],
      resetDiscoveryFilters(),
      viewport,
      now,
    ).length,
    0,
  );
});

const choices: SurpriseCandidate[] = ["a", "b", "c"].map((id) => ({
  id,
  kind: "activity",
  coordinate: viewport.center,
  zoom: 15,
  weight: id === "a" ? 6 : 1,
}));
test("Surprise cycles exhaust candidates before repeating, and avoid a boundary repeat", () => {
  const cycle = new SurpriseCycle();
  const first = choices.map(
    () => cycle.pick("viewer/filters/starting-area", choices, () => 0.99)!.id,
  );
  assert.equal(new Set(first).size, 3);
  assert.notEqual(
    cycle.pick("viewer/filters/starting-area", choices, () => 0.99)!.id,
    first[2],
  );
  assert.equal(cycle.pick("new-filter-context", choices, () => 0)!.id, "a");
  assert.equal(
    cycle.pick("no-results", [], () => 0),
    null,
  );
});

test("weighted selection is deterministic under injected randomness and stable refreshes retain seen IDs", () => {
  const cycle = new SurpriseCycle();
  assert.equal(cycle.pick("same", choices, () => 0.5)!.id, "a");
  assert.notEqual(
    cycle.pick(
      "same",
      choices.map((c) => ({ ...c })),
      () => 0.5,
    )!.id,
    "a",
  );
  const narrowed = [choices[2]];
  assert.equal(cycle.pick("same", narrowed, () => 0.5)!.id, "c");
  cycle.reset();
  assert.equal(cycle.pick("same", choices, () => 0)!.id, "a");
});

test("Surprise revalidates deletion, permissions and coordinate changes against the frozen starting bounds", () => {
  const { data, activities } = fixture();
  const filters = resetDiscoveryFilters();
  const build = () =>
    surpriseCandidates(data, DEMO_ID, activities, [], filters, viewport, now);
  const initial = build();
  assert.equal(initial.length, 4);
  data.activities = data.activities.filter((a) => a.id !== "hosted");
  assert.ok(!build().some((c) => c.id === "hosted"));
  data.places.find((p) => p.activity_id === "attended")!.latitude = 42;
  assert.ok(!build().some((c) => c.id === "attended"));
  data.activity_exclusions.push({
    activity_id: "future",
    user_id: DEMO_ID,
  } as (typeof data.activity_exclusions)[number]);
  assert.deepEqual(
    build().map((c) => c.id),
    ["unrelated"],
  );
  data.activities.find((a) => a.id === "unrelated")!.status = "cancelled";
  assert.equal(build().length, 0);
});
