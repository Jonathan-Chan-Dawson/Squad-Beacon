import test from "node:test";
import assert from "node:assert/strict";
import type { BeaconCommunityAssociation } from "../src/features/discovery/beaconCommunities";
import {
  browseEntryReason,
  filterPublicSummariesForBrowse,
  mergeBrowseEntries,
  rankBrowseEntries,
  rankPublicBeaconSummaries,
} from "../src/features/discovery/domain";
import type { PublicBeaconSummary } from "../src/features/discovery/types";
import type { Activity } from "../src/shared/types";
import { makeDemo, DEMO_ID } from "../src/shared/demo";

const now = Date.parse("2026-10-21T18:00:00Z");
const at = (minutes: number) => new Date(now + minutes * 60000).toISOString();

function publicSummary(
  id: string,
  start: number,
  end: number,
  overrides: Partial<PublicBeaconSummary> = {},
): PublicBeaconSummary {
  return {
    activity_id: id,
    title: `Gathering ${id}`,
    category: "Social",
    interest_tags: [],
    starts_at: at(start),
    ends_at: at(end),
    area_label: "Chicago",
    coarse_lat: 41.9,
    coarse_lng: -87.6,
    requires_approval: false,
    capacity_limit: null,
    capacity_policy: "soft",
    accepted_seat_count: 2,
    closed: false,
    ...overrides,
  };
}

function community(
  activityId: string,
  entityId: string,
): BeaconCommunityAssociation {
  return {
    activity_id: activityId,
    relationship: "associated",
    priority: 0,
    summary: {
      entity_type: "squad",
      entity_id: entityId,
      name: `Community ${entityId}`,
      description: "",
      discoverability: "public",
      join_mode: "open",
      member_count: 1,
      child_count: 0,
      membership_status: "active",
      action: "joined",
      parent_type: null,
      parent_id: null,
      parent_name: null,
    },
  };
}

test("Browse merges public summaries without replacing a readable Activity", () => {
  const activity = { id: "same", title: "Readable version" } as Activity;
  const entries = mergeBrowseEntries(
    [activity, { ...activity, title: "Duplicate readable version" }],
    [
      publicSummary("same", 30, 90),
      publicSummary("public-only", 45, 90),
      publicSummary("public-only", 60, 120, { title: "Duplicate public" }),
    ],
  );
  assert.deepEqual(
    entries.map((entry) =>
      entry.kind === "activity"
        ? [entry.kind, entry.activity.title]
        : [entry.kind, entry.summary.activity_id],
    ),
    [
      ["activity", "Readable version"],
      ["public", "public-only"],
    ],
  );
});

test("public Browse filters honor period, selected categories, query, and coarse map area", () => {
  const options = {
    period: "Active" as const,
    query: "coffee",
    categories: ["Social"],
    filters: {
      audience: "Everyone" as const,
      category: "All categories" as const,
      time: "Now" as const,
      planId: null,
    },
    area: {
      kind: "viewport" as const,
      label: "Chicago",
      coordinate: { latitude: 41.9, longitude: -87.6 },
      zoom: 12,
      bounds: { north: 42, south: 41.8, east: -87.4, west: -87.8 },
    },
    now,
  };
  const summaries = [
    publicSummary("match", -10, 30, { title: "Coffee walk" }),
    publicSummary("going", -10, 30, {
      title: "Coffee going",
      closed: true,
      viewer_response: "going",
    }),
    publicSummary("upcoming", 20, 60, { title: "Coffee later" }),
    publicSummary("elsewhere", -10, 30, {
      title: "Coffee outside area",
      coarse_lat: 40,
      coarse_lng: -87.6,
    }),
    publicSummary("unknown-format", -10, 30, {
      title: "Coffee location unknown",
      coarse_lat: null,
      coarse_lng: null,
    }),
    publicSummary("other-query", -10, 30, { title: "Library hour" }),
  ];
  const rows = filterPublicSummariesForBrowse(summaries, options);
  assert.deepEqual(
    rows.map((row) => row.activity_id),
    ["match", "going", "unknown-format"],
  );
  assert.deepEqual(
    filterPublicSummariesForBrowse(summaries, {
      ...options,
      filters: { ...options.filters, format: "Physical" },
    }).map((row) => row.activity_id),
    ["match", "going"],
  );
  assert.deepEqual(
    filterPublicSummariesForBrowse(summaries, {
      ...options,
      filters: { ...options.filters, format: "Virtual" },
    }),
    [],
  );
});

test("public ranking keeps viewer responses, live and near-start rows ahead, then diversifies communities", () => {
  const rows = [
    publicSummary("community-a1", -20, 20),
    publicSummary("community-a2", -10, 30),
    publicSummary("community-b", -5, 25, { category: "Study" }),
    publicSummary("soon", 30, 90),
    publicSummary("interest-match", 90, 150, { interest_tags: ["coffee"] }),
    publicSummary("going", 120, 180, { viewer_response: "going" }),
  ];
  const associations = [
    community("community-a1", "a"),
    community("community-a2", "a"),
    community("community-b", "b"),
  ];
  assert.deepEqual(
    rankPublicBeaconSummaries(rows, ["coffee"], null, now, associations).map(
      (row) => row.activity_id,
    ),
    [
      "going",
      "community-a1",
      "community-b",
      "community-a2",
      "soon",
      "interest-match",
    ],
  );
});

test("Browse prefers a different primary community before a different category for the same host", () => {
  const data = makeDemo();
  const ownerId = data.profiles.find((profile) => profile.id !== DEMO_ID)!.id;
  const base = data.activities[0];
  const activity = (id: string, category: Activity["category"]): Activity => ({
    ...base,
    id,
    owner_id: ownerId,
    title: id,
    category,
    mode: "open",
    audience: "public",
    audience_id: null,
    status: "scheduled",
    starts_at: at(90),
    ends_at: at(150),
    approval_required: false,
  });
  const rows = [
    activity("a1", "Social"),
    activity("a2", "Study"),
    activity("b", "Creative"),
  ];
  data.rsvps = [];
  const entries = mergeBrowseEntries(rows, []);
  assert.deepEqual(
    rankBrowseEntries(
      entries,
      data,
      DEMO_ID,
      now,
      [],
      [community("a1", "a"), community("a2", "a"), community("b", "b")],
    ).map((entry) =>
      entry.kind === "activity" ? entry.activity.id : "public",
    ),
    ["a1", "b", "a2"],
  );
});

test("discovery reasons use one supported, viewer-safe signal and omit unknown capacity", () => {
  const data = makeDemo();
  data.viewer_id = DEMO_ID;
  const owner = data.profiles.find((profile) => profile.id !== DEMO_ID)!;
  owner.profile_visibility = "friends";
  data.friendships = [
    {
      id: "friendship",
      sender_id: DEMO_ID,
      recipient_id: owner.id,
      status: "accepted",
    },
  ];
  data.blocks = data.blocks.filter(
    (row) =>
      !(
        (row.blocker_id === DEMO_ID && row.blocked_id === owner.id) ||
        (row.blocker_id === owner.id && row.blocked_id === DEMO_ID)
      ),
  );
  const activity: Activity = {
    ...data.activities[0],
    id: "friend-hosted",
    owner_id: owner.id,
    audience: "friends",
    audience_id: null,
    mode: "squad",
    status: "scheduled",
    starts_at: at(90),
    ends_at: at(180),
    capacity_limit: null,
  };
  data.activities = [activity];
  assert.equal(
    browseEntryReason({ kind: "activity", activity }, data, DEMO_ID, now),
    "Friend hosting",
  );
  owner.profile_visibility = "custom";
  data.profile_visibility_grants = data.profile_visibility_grants.filter(
    (grant) => grant.owner_id !== owner.id,
  );
  data.profiles.find((profile) => profile.id === DEMO_ID)!.interests = [];
  assert.equal(
    browseEntryReason({ kind: "activity", activity }, data, DEMO_ID, now),
    "",
  );
  owner.profile_visibility = "friends";

  const publicEntry = {
    kind: "public" as const,
    summary: publicSummary("interest", 90, 180, {
      interest_tags: ["coffee"],
    }),
  };
  data.profiles.find((profile) => profile.id === DEMO_ID)!.interests = [
    "coffee",
  ];
  assert.equal(
    browseEntryReason(publicEntry, data, DEMO_ID, now),
    "Matches your interest",
  );
  assert.equal(
    browseEntryReason(
      {
        kind: "public",
        summary: publicSummary("unknown-capacity", 90, 180),
      },
      data,
      DEMO_ID,
      now,
    ),
    "",
  );
  assert.equal(
    browseEntryReason(
      {
        kind: "public",
        summary: publicSummary("known-capacity", 90, 180, {
          capacity_limit: 8,
          accepted_seat_count: 7,
        }),
      },
      data,
      DEMO_ID,
      now,
    ),
    "Spots available",
  );
  assert.equal(
    browseEntryReason(
      {
        kind: "public",
        summary: publicSummary("closed-capacity", 90, 180, {
          capacity_limit: 8,
          accepted_seat_count: 7,
          closed: true,
        }),
      },
      data,
      DEMO_ID,
      now,
    ),
    "",
  );
  assert.equal(
    browseEntryReason(
      {
        kind: "public",
        summary: publicSummary("expired-capacity", -90, -1, {
          capacity_limit: 8,
          accepted_seat_count: 7,
        }),
      },
      data,
      DEMO_ID,
      now,
    ),
    "",
  );
  const soonEntry = {
    kind: "public" as const,
    summary: publicSummary("soon", 30, 90, {
      interest_tags: ["coffee"],
      capacity_limit: 8,
      accepted_seat_count: 7,
    }),
  };
  assert.equal(
    browseEntryReason(soonEntry, data, DEMO_ID, now, [community("soon", "a")]),
    "Starts soon",
  );
  const associated = community("interest", "study-club");
  associated.summary.membership_status = "requested";
  assert.equal(
    browseEntryReason(publicEntry, data, DEMO_ID, now, [associated]),
    "Matches your interest",
  );
  associated.summary.membership_status = "active";
  assert.equal(
    browseEntryReason(publicEntry, data, DEMO_ID, now, [associated]),
    "From your Squad",
  );
  data.profiles.find((profile) => profile.id === DEMO_ID)!.interests = [];
  assert.equal(
    browseEntryReason(publicEntry, data, DEMO_ID, now, [
      {
        ...associated,
        summary: { ...associated.summary, membership_status: "requested" },
      },
    ]),
    "",
  );
});
