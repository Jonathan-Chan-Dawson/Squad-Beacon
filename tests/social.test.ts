import test from "node:test";
import assert from "node:assert/strict";
import { demoAction, DEMO_ID, makeDemo } from "@/src/shared/demo";
import { parseSocialDirectoryRows } from "@/src/features/social/types";
import { searchSocialDirectoryInData } from "@/src/features/social/directory";

test("social directory parser projects only safe, internally consistent summaries", () => {
  const parsed = parseSocialDirectoryRows([{
    entity_type: "squad", entity_id: "public-squad", name: "Public Squad", description: "A safe summary.",
    discoverability: "public", join_mode: "open", member_count: 35, child_count: 0,
    membership_status: null, action: "join", parent_type: null, parent_id: null, parent_name: null,
    roster: ["private-user"], latitude: 47.6, owner_id: "private-owner", messages: ["private-chat"],
  }]);
  assert.equal(parsed.length, 1);
  assert.deepEqual(Object.keys(parsed[0]).sort(), [
    "action", "child_count", "description", "discoverability", "entity_id", "entity_type",
    "join_mode", "member_count", "membership_status", "name", "parent_id", "parent_name", "parent_type",
  ].sort());
  assert.equal(parseSocialDirectoryRows([{ ...parsed[0], member_count: -1 }]).length, 0);
  assert.equal(parseSocialDirectoryRows([{ ...parsed[0], action: "invite_required" }]).length, 0);
  assert.equal(parseSocialDirectoryRows([{ ...parsed[0], parent_type: "squad", parent_id: "nested", parent_name: "Nested" }]).length, 0);
});

test("demo Beacon association is atomic metadata and never changes audience access", () => {
  const data = makeDemo();
  const starts = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const ends = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const payload = {
    title: "Association test", category: "Social", mode: "solo", timezone: "America/Chicago",
    starts_at: starts, ends_at: ends, audience: "private", audience_id: null,
    social_entity_type: "squad", social_entity_id: "pickup-basketball",
  };
  const originalActivityCount = data.activities.length;
  const associated = demoAction(data, "create_activity", payload);
  assert.equal(associated.activities.length, originalActivityCount + 1);
  const activity = associated.activities.find((row) => !data.activities.some((old) => old.id === row.id));
  assert.equal(activity?.owner_id, DEMO_ID);
  assert.equal(activity?.audience, "private");
  const link = associated.activity_social_links.find((row) => row.activity_id === activity?.id);
  assert.deepEqual(link && { entity_type: link.entity_type, entity_id: link.entity_id, created_by: link.created_by }, {
    entity_type: "squad", entity_id: "pickup-basketball", created_by: DEMO_ID,
  });
  assert.throws(() => demoAction(data, "create_activity", {
    ...payload, social_entity_id: "open-run-club",
  }), /join the selected community/i);
  assert.equal(data.activities.length, originalActivityCount, "a failed association creates no orphan Beacon");
});

test("demo request routes, private browsing, and parent eligibility stay independent", () => {
  const data = makeDemo();
  data.squads.push({
    id: "private-directory-only", owner_id: "maya", name: "Hidden Squad", description: "No public listing.",
  });
  const browse = searchSocialDirectoryInData(data, DEMO_ID, { query: "", entityType: "all", pageSize: 50 });
  const huge = browse.find((row) => row.entity_id === "pickup-basketball");
  assert.equal(huge?.member_count, 35);
  assert.equal(data.squad_members.filter((row) => row.squad_id === "pickup-basketball").length, 35);
  assert.equal(browse.some((row) => row.entity_id === "open-run-club" && row.action === "join"), true);
  assert.equal(browse.some((row) => row.entity_id === "private-directory-only"), false);

  const gatedSquad = {
    id: "community-child", owner_id: "maya", name: "Community Child", description: "Parent-gated.",
    discoverability: "community" as const, join_mode: "open" as const, invite_policy: "admins" as const,
  };
  data.squads.push(gatedSquad);
  data.squad_members.push({ squad_id: gatedSquad.id, user_id: "maya", role: "owner" });
  data.space_squads.push({ space_id: "space-lakefront-runs", squad_id: gatedSquad.id, added_by: "maya", created_at: new Date().toISOString() });
  assert.equal(searchSocialDirectoryInData(data, DEMO_ID, { query: "", entityType: "squad" }).some((row) => row.entity_id === gatedSquad.id), false);
  assert.throws(() => demoAction(data, "join_squad", { squad_id: gatedSquad.id }), /unavailable/i);
  const parentJoined = demoAction(data, "join_space", { space_id: "space-lakefront-runs" });
  assert.equal(parentJoined.squad_members.some((row) => row.squad_id === gatedSquad.id && row.user_id === DEMO_ID), false,
    "joining an eligible parent still does not enroll the child");
  const contextual = searchSocialDirectoryInData(parentJoined, DEMO_ID, {
    query: "", entityType: "squad", parentType: "space", parentId: "space-lakefront-runs",
  });
  assert.equal(contextual.some((row) => row.entity_id === gatedSquad.id && row.action === "join"), true);
  const childJoined = demoAction(parentJoined, "join_squad", { squad_id: gatedSquad.id });
  assert.equal(childJoined.squad_members.some((row) => row.squad_id === gatedSquad.id && row.user_id === DEMO_ID), true);
});

test("demo join-request/cancel/approve/deny routes work for Squads, Spaces, and Organizations", () => {
  const initial = makeDemo();
  const userId = DEMO_ID;
  const socialOrganization = {
    id: "social-request-org", owner_id: "maya", name: "Request Organization", description: "Review test.",
    created_at: new Date().toISOString(), discoverability: "public" as const, join_mode: "request" as const, invite_policy: "admins" as const,
  };
  initial.organizations.push(socialOrganization);
  initial.spaces.find((row) => row.id === "space-park-care")!.discoverability = "public";
  initial.spaces.find((row) => row.id === "space-park-care")!.join_mode = "request";

  let data = demoAction(initial, "request_squad_join", { squad_id: "chess-table" });
  assert.equal(data.squad_join_requests.some((row) => row.squad_id === "chess-table" && row.user_id === userId), true);
  data = demoAction(data, "cancel_squad_join_request", { squad_id: "chess-table" });
  assert.equal(data.squad_join_requests.some((row) => row.squad_id === "chess-table" && row.user_id === userId), false);

  data = demoAction(data, "request_space_join", { space_id: "space-park-care" });
  assert.equal(data.space_members.some((row) => row.space_id === "space-park-care" && row.user_id === userId && row.status === "requested"), true);
  data = demoAction(data, "cancel_space_join_request", { space_id: "space-park-care" });
  assert.equal(data.space_members.some((row) => row.space_id === "space-park-care" && row.user_id === userId), false);

  data = demoAction(data, "request_organization_join", { organization_id: socialOrganization.id });
  assert.equal(data.organization_members.some((row) => row.organization_id === socialOrganization.id && row.user_id === userId && row.status === "requested"), true);
  data = demoAction(data, "cancel_organization_join_request", { organization_id: socialOrganization.id });
  assert.equal(data.organization_members.some((row) => row.organization_id === socialOrganization.id && row.user_id === userId), false);

  const targetId = "social-request-target";
  data.squad_members.push({ squad_id: "chess-table", user_id: userId, role: "admin" });
  data.squad_join_requests.push({ squad_id: "chess-table", user_id: targetId, created_at: new Date().toISOString() });
  data = demoAction(data, "approve_squad_join_request", { squad_id: "chess-table", user_id: targetId });
  assert.equal(data.squad_members.some((row) => row.squad_id === "chess-table" && row.user_id === targetId), true);
  data.squad_join_requests.push({ squad_id: "chess-table", user_id: "social-denied", created_at: new Date().toISOString() });
  data = demoAction(data, "deny_squad_join_request", { squad_id: "chess-table", user_id: "social-denied" });
  assert.equal(data.squad_join_requests.some((row) => row.squad_id === "chess-table" && row.user_id === "social-denied"), false);

  data.space_members.push({ space_id: "space-park-care", user_id: userId, role: "admin", status: "active", invited_by: "jordan", created_at: new Date().toISOString() });
  data.space_members.push({ space_id: "space-park-care", user_id: targetId, role: "member", status: "requested", invited_by: null, created_at: new Date().toISOString() });
  data = demoAction(data, "approve_space_join_request", { space_id: "space-park-care", user_id: targetId });
  assert.equal(data.space_members.some((row) => row.space_id === "space-park-care" && row.user_id === targetId && row.status === "active"), true);
  data.space_members.push({ space_id: "space-park-care", user_id: "social-denied", role: "member", status: "requested", invited_by: null, created_at: new Date().toISOString() });
  data = demoAction(data, "deny_space_join_request", { space_id: "space-park-care", user_id: "social-denied" });
  assert.equal(data.space_members.some((row) => row.space_id === "space-park-care" && row.user_id === "social-denied"), false);

  data.organization_members.push({ organization_id: socialOrganization.id, user_id: userId, role: "admin", status: "active", invited_by: "maya", created_at: new Date().toISOString() });
  data.organization_members.push({ organization_id: socialOrganization.id, user_id: targetId, role: "member", status: "requested", invited_by: null, created_at: new Date().toISOString() });
  data = demoAction(data, "approve_organization_join_request", { organization_id: socialOrganization.id, user_id: targetId });
  assert.equal(data.organization_members.some((row) => row.organization_id === socialOrganization.id && row.user_id === targetId && row.status === "active"), true);
  data.organization_members.push({ organization_id: socialOrganization.id, user_id: "social-denied", role: "member", status: "requested", invited_by: null, created_at: new Date().toISOString() });
  data = demoAction(data, "deny_organization_join_request", { organization_id: socialOrganization.id, user_id: "social-denied" });
  assert.equal(data.organization_members.some((row) => row.organization_id === socialOrganization.id && row.user_id === "social-denied"), false);
});

test("demo conversion and grouping preserve source records and never copy members implicitly", () => {
  const data = makeDemo();
  const now = new Date().toISOString();
  const sourceMemberCount = data.squad_members.filter((row) => row.squad_id === "pickup-basketball").length;
  data.group_messages.push({
    id: "social-source-message", scope: "squad", scope_id: "pickup-basketball",
    organization_id: null, squad_id: "pickup-basketball", author_id: DEMO_ID,
    body: "Source chat stays attached to the source Squad.", created_at: now,
  });
  data.plans.push({
    id: "social-source-plan", owner_id: DEMO_ID, squad_id: "pickup-basketball",
    title: "Source plan", description: "Preserve this ID.", timezone: "America/Chicago",
    start_date: "2026-10-07", status: "scheduled", created_at: now,
  });
  data.activities.push({
    ...data.activities[0], id: "social-source-activity", owner_id: DEMO_ID,
    audience: "squad", audience_id: "pickup-basketball",
  });
  assert.throws(() => demoAction(data, "organize_squad_into_space", {
    squad_id: "pickup-basketball", name: "Converted", copy_members: true,
    confirm_member_copy: false, expected_member_count: sourceMemberCount - 1,
  }), /confirm that current squad members/i);
  assert.throws(() => demoAction(data, "organize_squad_into_space", {
    squad_id: "pickup-basketball", name: "Converted", copy_members: true,
    confirm_member_copy: true, expected_member_count: sourceMemberCount,
  }), /roster changed/i);

  const converted = demoAction(data, "organize_squad_into_space", {
    squad_id: "pickup-basketball", name: "Converted", copy_members: true,
    confirm_member_copy: true, expected_member_count: sourceMemberCount - 1,
    rename_general: true,
  });
  const convertedSpace = converted.spaces.find((row) => !data.spaces.some((old) => old.id === row.id))!;
  assert.equal(convertedSpace.name, "Converted");
  assert.equal(converted.space_members.filter((row) => row.space_id === convertedSpace.id && row.user_id !== DEMO_ID).length, sourceMemberCount - 1);
  assert.equal(converted.squads.find((row) => row.id === "pickup-basketball")?.name, "General");
  assert.equal(converted.squad_members.filter((row) => row.squad_id === "pickup-basketball").length, sourceMemberCount);
  assert.equal(converted.group_messages.some((row) => row.id === "social-source-message"), true);
  assert.equal(converted.plans.some((row) => row.id === "social-source-plan" && row.squad_id === "pickup-basketball"), true);
  assert.equal(converted.activities.some((row) => row.id === "social-source-activity" && row.audience_id === "pickup-basketball"), true);

  const grouped = demoAction(data, "create_space_from_squads", {
    name: "Grouped Existing Squad", squad_ids: ["pickup-basketball"],
  });
  const groupedSpace = grouped.spaces.find((row) => !data.spaces.some((old) => old.id === row.id))!;
  assert.equal(grouped.space_squads.some((row) => row.space_id === groupedSpace.id && row.squad_id === "pickup-basketball"), true);
  assert.equal(grouped.space_members.filter((row) => row.space_id === groupedSpace.id).length, 1,
    "grouping creates only the Space owner membership and does not enroll Squad members");
});
