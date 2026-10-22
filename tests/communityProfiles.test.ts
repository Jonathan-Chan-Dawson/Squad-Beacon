import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "../src/shared/demo";
import {
  getCommunitySummary,
  parseCommunityProfileSummary,
  searchSocialDirectoryInData,
} from "../src/features/social/directory";
import { communityProfileMode } from "../src/features/discovery/communityPublicProfileAccess";

test("exact-ID community summaries match the safe directory projection in Demo", () => {
  const data = makeDemo();
  const viewerId = "summary-viewer";
  data.viewer_id = viewerId;
  data.squads.push({
    id: "summary-public",
    owner_id: "maya",
    name: "Public Summary",
    description: "A public community summary.",
    discoverability: "public",
    join_mode: "request",
  });

  const exact = getCommunitySummary("squad", "summary-public", data, viewerId);
  const directory = searchSocialDirectoryInData(data, viewerId, {
    query: "",
    entityType: "squad",
    pageSize: 50,
  }).find((row) => row.entity_id === "summary-public");
  assert.deepEqual(exact, directory);
  assert.deepEqual(Object.keys(exact!).sort(), [
    "action", "child_count", "description", "discoverability", "entity_id", "entity_type",
    "join_mode", "member_count", "membership_status", "name", "parent_id", "parent_name", "parent_type",
  ].sort(), "the profile resolver returns only the fixed safe directory projection");
  assert.equal(exact?.membership_status, null,
    "reading an authorized public summary does not assert community membership");
  const parsed = parseCommunityProfileSummary(exact ? [exact] : [], "squad", "summary-public");
  assert.equal(parsed?.name, "Public Summary");
  assert.deepEqual(Object.keys(parsed!).sort(), Object.keys(exact!).sort());
});

test("missing, private, banned, blocked, and stale-viewer community summaries return null", () => {
  const data = makeDemo();
  const viewerId = "summary-viewer";
  data.viewer_id = viewerId;
  data.squads.push({
    id: "summary-private",
    owner_id: "maya",
    name: "Private Summary Secret",
    description: "Must not be disclosed.",
    discoverability: "private",
    join_mode: "invite",
  });

  assert.equal(getCommunitySummary("squad", "summary-private", data, viewerId), null);
  assert.equal(getCommunitySummary("squad", "missing-summary", data, viewerId), null);
  assert.equal(getCommunitySummary("squad", "summary-private", data, "another-viewer"), null);

  data.squads.find((row) => row.id === "summary-private")!.discoverability = "public";
  data.blocks.push({ blocker_id: viewerId, blocked_id: "maya" });
  assert.equal(getCommunitySummary("squad", "summary-private", data, viewerId), null);
  data.blocks = [];
  data.squad_bans.push({
    squad_id: "summary-private",
    user_id: viewerId,
    banned_by: "maya",
    reason: "",
    former_role: "member",
    created_at: new Date().toISOString(),
  });
  assert.equal(getCommunitySummary("squad", "summary-private", data, viewerId), null);
  assert.equal(parseCommunityProfileSummary([], "squad", "summary-private"), null);
});

test("an active Squad member receives the exact summary with active status", () => {
  const data = makeDemo();
  const viewerId = "summary-viewer";
  data.viewer_id = viewerId;
  data.squads.push({
    id: "summary-member",
    owner_id: "maya",
    name: "Member Summary",
    description: "",
    discoverability: "private",
    join_mode: "invite",
  });
  data.squad_members.push({
    squad_id: "summary-member",
    user_id: viewerId,
    role: "member",
  });

  assert.equal(getCommunitySummary("squad", "summary-member", data, viewerId)?.membership_status, "active");
});

test("pending requests preserve safe identity access for private communities without granting membership", () => {
  const data = makeDemo();
  const viewerId = "summary-requester";
  const created_at = new Date().toISOString();
  data.viewer_id = viewerId;
  const entity = {
    id: "requested-private", owner_id: "maya", name: "Requested private community",
    description: "Safe identity", discoverability: "private" as const,
    join_mode: "request" as const, created_at,
  };
  data.squads.push(entity);
  data.spaces.push(entity);
  data.organizations.push(entity);
  data.squad_join_requests.push({ squad_id: entity.id, user_id: viewerId, created_at });
  data.space_members.push({ space_id: entity.id, user_id: viewerId, status: "requested", role: "member", invited_by: null, created_at });
  data.organization_members.push({ organization_id: entity.id, user_id: viewerId, status: "requested", role: "member", invited_by: null, created_at });

  for (const type of ["squad", "space", "organization"] as const) {
    const summary = getCommunitySummary(type, entity.id, data, viewerId);
    assert.equal(summary?.name, entity.name, type);
    assert.equal(summary?.membership_status, "requested", type);
    assert.equal(summary?.action, "requested", type);
  }
  data.squad_join_requests = [];
  data.space_members = data.space_members.filter((row) => row.user_id !== viewerId);
  data.organization_members = data.organization_members.filter((row) => row.user_id !== viewerId);
  for (const type of ["squad", "space", "organization"] as const)
    assert.equal(getCommunitySummary(type, entity.id, data, viewerId), null, `${type}: withdrawn requests revoke identity access`);
});

test("a permitted summary can render without a private entity row while member areas stay gated", () => {
  const summary = {
    entity_type: "space" as const,
    entity_id: "public-space",
    name: "Public Studio",
    description: "A summary available to nonmembers.",
    discoverability: "public" as const,
    join_mode: "open" as const,
    member_count: 12,
    child_count: 3,
    membership_status: null,
    action: "join" as const,
    parent_type: null,
    parent_id: null,
    parent_name: null,
  };

  assert.equal(communityProfileMode(summary, false, false), "summary",
    "safe profile fields remain available when the entity row is absent");
  assert.equal(communityProfileMode(summary, true, false), "summary",
    "a locally cached entity row never grants member areas on its own");
  assert.equal(communityProfileMode({ ...summary, membership_status: "active" }, false, false), "summary",
    "an active summary still falls back to summary-only presentation if its member record is absent");
  assert.equal(communityProfileMode({ ...summary, membership_status: "active" }, true, false), "member");
});

test("community profile mode keeps unresolved summary access separate from unavailable profiles", () => {
  assert.equal(communityProfileMode(null, true, true), "loading");
  assert.equal(communityProfileMode(null, true, false), "unavailable");
});
