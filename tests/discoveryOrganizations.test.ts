import test from "node:test";
import assert from "node:assert/strict";
import type { Organization, OrganizationMember } from "@/src/features/organizations/types";
import {
  canChangeOrganizationMemberRole,
  canInviteOrganizationRole,
  canLeaveOrganization,
  canManageOrganization,
  canManageOrganizationMember,
} from "@/src/features/organizations/domain";
import {
  filterPublicBeaconSummaries,
  rankPublicBeaconSummaries,
  validatePublicDiscoveryOptIn,
} from "@/src/features/discovery/domain";
import type { PublicBeaconSummary } from "@/src/features/discovery/types";

const organization: Organization = {
  id: "org-1",
  owner_id: "owner",
  name: "Trail Crew",
  description: "A small group",
  created_at: "2026-09-01T00:00:00Z",
};
const members: OrganizationMember[] = [
  {
    organization_id: "org-1",
    user_id: "admin",
    role: "admin",
    status: "active",
    invited_by: "owner",
    created_at: "2026-09-02T00:00:00Z",
  },
  {
    organization_id: "org-1",
    user_id: "member",
    role: "member",
    status: "active",
    invited_by: "owner",
    created_at: "2026-09-03T00:00:00Z",
  },
  {
    organization_id: "org-1",
    user_id: "pending",
    role: "member",
    status: "invited",
    invited_by: "admin",
    created_at: "2026-09-04T00:00:00Z",
  },
];

const publicCard = (
  activity_id: string,
  start: string,
  extra: Partial<PublicBeaconSummary> = {},
): PublicBeaconSummary => ({
  activity_id,
  title: "Birdwatching",
  category: "Other",
  interest_tags: ["birds", "nature"],
  starts_at: start,
  ends_at: new Date(Date.parse(start) + 60 * 60 * 1000).toISOString(),
  area_label: "North Park",
  coarse_lat: 41.88,
  coarse_lng: -87.63,
  requires_approval: false,
  capacity_limit: null,
  capacity_policy: "soft",
  accepted_seat_count: 1,
  closed: false,
  ...extra,
});

test("public opt-in requires a confirmed area and paired valid coarse coordinates", () => {
  assert.throws(
    () => validatePublicDiscoveryOptIn({ activity_id: "a", area_label: " " }),
    /coarse area label/,
  );
  assert.throws(
    () =>
      validatePublicDiscoveryOptIn({
        activity_id: "a",
        area_label: "North Park",
        coarse_lat: 41.88,
      }),
    /both coarse map coordinates/,
  );
  assert.throws(
    () =>
      validatePublicDiscoveryOptIn({
        activity_id: "a",
        area_label: "North Park",
        coarse_lat: 91,
        coarse_lng: -87,
      }),
    /valid coarse map coordinates/,
  );
  assert.doesNotThrow(() =>
    validatePublicDiscoveryOptIn({
      activity_id: "a",
      area_label: "North Park",
      coarse_lat: 41.88,
      coarse_lng: -87.63,
    }),
  );
});

test("discovery only searches sanitized future/open summaries and ranks opted-in affinities", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const nature = publicCard("a", "2026-10-02T12:00:00Z");
  const nearbyMatch = publicCard("b", "2026-10-03T12:00:00Z", {
    interest_tags: ["hiking"],
  });
  const closed = publicCard("c", "2026-10-02T12:00:00Z", { closed: true });
  const ended = publicCard("d", "2026-09-30T12:00:00Z");
  assert.deepEqual(
    filterPublicBeaconSummaries(
      [nature, nearbyMatch, closed, ended],
      { query: "north", category: "All", interest: "bird", area: "park" },
      now,
    ).map((row) => row.activity_id),
    ["a"],
  );
  assert.deepEqual(
    rankPublicBeaconSummaries([nature, nearbyMatch], ["hiking"], null, now).map(
      (row) => row.activity_id,
    ),
    ["b", "a"],
  );
  assert.deepEqual(Object.keys(nature).sort(), [
    "accepted_seat_count",
    "activity_id",
    "area_label",
    "capacity_limit",
    "capacity_policy",
    "category",
    "closed",
    "coarse_lat",
    "coarse_lng",
    "ends_at",
    "interest_tags",
    "requires_approval",
    "starts_at",
    "title",
  ]);
});

test("organization role affordances keep owner authority immutable and active-only", () => {
  assert.equal(canManageOrganization(organization, members, "owner"), true);
  assert.equal(canManageOrganization(organization, members, "admin"), true);
  assert.equal(canManageOrganization(organization, members, "member"), false);
  assert.equal(canManageOrganization(organization, members, "pending"), false);
  assert.equal(canInviteOrganizationRole(organization, members, "admin", "member"), true);
  assert.equal(canInviteOrganizationRole(organization, members, "admin", "admin"), false);
  assert.equal(canInviteOrganizationRole(organization, members, "owner", "admin"), true);
  assert.equal(canManageOrganizationMember(organization, members, "admin", "member"), true);
  assert.equal(canManageOrganizationMember(organization, members, "admin", "owner"), false);
  assert.equal(canChangeOrganizationMemberRole(organization, members, "admin", "member"), false);
  assert.equal(canChangeOrganizationMemberRole(organization, members, "owner", "admin"), true);
  assert.equal(canLeaveOrganization(organization, members, "owner"), false);
  assert.equal(canLeaveOrganization(organization, members, "member"), true);
});
