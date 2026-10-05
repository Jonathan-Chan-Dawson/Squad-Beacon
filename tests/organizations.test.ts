import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_ID, demoAction, makeDemo } from "../src/shared/demo";
import type { Organization, OrganizationMember } from "../src/features/organizations/types";
import {
  activeOrganizationRole,
  canChangeOrganizationMemberRole,
  canInviteOrganizationRole,
  canLeaveOrganization,
  canManageOrganization,
  canManageOrganizationMember,
  canManageOrganizationSquads,
  groupChatScopeId,
  organizationActiveMemberCount,
  organizationSizeLabel,
} from "../src/features/organizations/domain";

const organization: Organization = {
  id: "org-1",
  owner_id: "owner",
  name: "Trail Crew",
  description: "A collection of local squads.",
  created_at: "2026-09-01T00:00:00Z",
};

const members: OrganizationMember[] = [
  { organization_id: "org-1", user_id: "coowner", role: "coowner", status: "active", invited_by: "owner", created_at: "2026-09-02T00:00:00Z" },
  { organization_id: "org-1", user_id: "admin", role: "admin", status: "active", invited_by: "owner", created_at: "2026-09-03T00:00:00Z" },
  { organization_id: "org-1", user_id: "elder", role: "elder", status: "active", invited_by: "admin", created_at: "2026-09-04T00:00:00Z" },
  { organization_id: "org-1", user_id: "member", role: "member", status: "active", invited_by: "elder", created_at: "2026-09-05T00:00:00Z" },
  { organization_id: "org-1", user_id: "pending", role: "member", status: "invited", invited_by: "admin", created_at: "2026-09-06T00:00:00Z" },
];

test("organization role hierarchy keeps owner immutable and pending members inactive", () => {
  assert.equal(activeOrganizationRole(organization, members, "owner"), "owner");
  assert.equal(activeOrganizationRole(organization, members, "admin"), "admin");
  assert.equal(activeOrganizationRole(organization, members, "pending"), null);
  assert.equal(canManageOrganization(organization, members, "admin"), true);
  assert.equal(canManageOrganization(organization, members, "elder"), false);
  assert.equal(canManageOrganizationSquads(organization, members, "elder"), true);
  assert.equal(canManageOrganizationSquads(organization, members, "member"), false);
  assert.equal(canInviteOrganizationRole(organization, members, "admin", "elder"), true);
  assert.equal(canInviteOrganizationRole(organization, members, "admin", "admin"), false);
  assert.equal(canInviteOrganizationRole(organization, members, "pending", "member"), false);
  assert.equal(canManageOrganizationMember(organization, members, "admin", "member"), true);
  assert.equal(canManageOrganizationMember(organization, members, "admin", "elder"), true);
  assert.equal(canManageOrganizationMember(organization, members, "elder", "admin"), false);
  assert.equal(canManageOrganizationMember(organization, members, "admin", "owner"), false);
  assert.equal(canChangeOrganizationMemberRole(organization, members, "admin", "member", "elder"), true);
  assert.equal(canChangeOrganizationMemberRole(organization, members, "admin", "member", "admin"), false);
  assert.equal(canChangeOrganizationMemberRole(organization, members, "admin", "coowner", "member"), false);
  assert.equal(canChangeOrganizationMemberRole(organization, members, "owner", "coowner", "admin"), true);
  assert.equal(canChangeOrganizationMemberRole(organization, members, "admin", "owner", "member"), false);
  assert.equal(canLeaveOrganization(organization, members, "member"), true);
  assert.equal(canLeaveOrganization(organization, members, "pending"), false);
  assert.equal(canLeaveOrganization(organization, members, "owner"), false);
});

test("organization counts and group-chat scope IDs remain explicit and deterministic", () => {
  assert.equal(organizationActiveMemberCount("org-1", "owner", members), 5);
  assert.equal(organizationSizeLabel(99), "Very Small");
  assert.equal(organizationSizeLabel(100), "Small");
  assert.equal(organizationSizeLabel(1_000), "Large");
  assert.equal(organizationSizeLabel(10_000), "Very Large");
  assert.equal(organizationSizeLabel(100_000), "Mega");
  assert.equal(groupChatScopeId({ scope: "organization", organization_id: "org-1", squad_id: "squad-1" }), "org-1");
  assert.equal(groupChatScopeId({ scope: "squad", organization_id: "org-1", squad_id: "squad-1" }), "squad-1");
  assert.equal(groupChatScopeId({ scope: "organization" }), null);
});

test("demo organizations include real collection/chat/audience examples and working member flows", () => {
  const data = makeDemo();
  const organization = data.organizations[0];
  assert.ok(organization);
  assert.equal(
    data.organization_members.some(
      (member) => member.organization_id === organization.id && member.user_id === DEMO_ID && member.status === "active",
    ),
    true,
  );
  assert.equal(data.organization_squads.filter((link) => link.organization_id === organization.id).length, 2);
  assert.ok(data.group_messages.some((message) => message.scope === "organization" && message.organization_id === organization.id));
  assert.ok(data.group_messages.some((message) => message.scope === "squad"));
  assert.ok(data.activities.some((activity) => activity.audience === "organization" && activity.audience_id === organization.id));

  const sent = demoAction(data, "send_group_message", {
    scope: "organization", organization_id: organization.id, body: "Demo chat works.",
  });
  assert.equal(sent.group_messages.length, data.group_messages.length + 1);
  assert.equal(sent.group_messages.at(-1)?.author_id, DEMO_ID);
  const marked = demoAction(sent, "mark_group_chat_read", {
    scope: "organization", organization_id: organization.id,
  });
  assert.ok(marked.group_message_reads.some((row) => row.user_id === DEMO_ID && row.organization_id === organization.id));

  const candidate = data.profiles.find((profile) =>
    profile.id !== DEMO_ID &&
    profile.id !== organization.owner_id &&
    !data.organization_members.some((member) => member.organization_id === organization.id && member.user_id === profile.id) &&
    !data.blocks.some((block) =>
      (block.blocker_id === DEMO_ID && block.blocked_id === profile.id) ||
      (block.blocker_id === profile.id && block.blocked_id === DEMO_ID),
    ) &&
    !data.blocks.some((block) =>
      (block.blocker_id === organization.owner_id && block.blocked_id === profile.id) ||
      (block.blocker_id === profile.id && block.blocked_id === organization.owner_id),
    ),
  );
  assert.ok(candidate);
  const invited = demoAction(data, "invite_organization_member", {
    organization_id: organization.id, user_id: candidate.id, role: "member",
  });
  assert.equal(invited.organization_members.find((member) => member.user_id === candidate.id)?.status, "invited");

  const privateProfile = demoAction(data, "save_profile_privacy", {
    profile_visibility: "custom", person_ids: [], squad_ids: [], list_ids: [], organization_ids: [organization.id],
  });
  assert.ok(privateProfile.profile_visibility_grants.some((grant) => grant.owner_id === DEMO_ID && grant.kind === "organization" && grant.target_id === organization.id));
  assert.throws(() => demoAction(data, "save_profile_privacy", {
    profile_visibility: "custom", person_ids: [], squad_ids: [], list_ids: [], organization_ids: [organization.id, organization.id],
  }), /each audience member once/i);
  assert.throws(() => demoAction(data, "invite_organization_member", {
    organization_id: organization.id, user_id: organization.owner_id, role: "member",
  }), /cannot invite/i);
});
