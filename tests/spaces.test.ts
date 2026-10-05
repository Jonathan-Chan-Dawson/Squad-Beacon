import test from "node:test";
import assert from "node:assert/strict";
import {
  canInviteSpaceMember,
  canManageSpace,
  canManageSpaceMember,
  canReadSpace,
  visibleSpaceSquads,
} from "@/src/features/spaces/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import type { Space, SpaceMember } from "@/src/features/spaces/types";
import { DEMO_ID, demoAction, makeDemo } from "@/src/shared/demo";
import { emptyData } from "@/src/shared/types";

const space: Space = {
  id: "space-1",
  owner_id: "owner",
  name: "Independent Space",
  description: "A membership hub.",
  created_at: "2026-10-01T00:00:00Z",
};
const members: SpaceMember[] = [
  {
    space_id: space.id,
    user_id: "owner",
    role: "owner",
    status: "active",
    invited_by: null,
    created_at: space.created_at,
  },
  {
    space_id: space.id,
    user_id: "admin",
    role: "admin",
    status: "active",
    invited_by: "owner",
    created_at: space.created_at,
  },
  {
    space_id: space.id,
    user_id: "member",
    role: "member",
    status: "active",
    invited_by: "owner",
    created_at: space.created_at,
  },
  {
    space_id: space.id,
    user_id: "invitee",
    role: "member",
    status: "invited",
    invited_by: "admin",
    created_at: space.created_at,
  },
];

function snapshot(viewerId: string) {
  const data = emptyData();
  data.viewer_id = viewerId;
  data.spaces = [space];
  data.space_members = structuredClone(members);
  data.profiles = ["owner", "admin", "member", "invitee", "friend"].map(
    (id) => ({
      id,
      username: id,
      name: id,
      bio: "",
      interests: [],
      identity_tags: [],
      aspiration_goals: [],
      onboarding_survey_status: "skipped",
      featured_activity_id: null,
      hide_featured: false,
      timezone: "UTC",
      quiet_start: 0,
      quiet_end: 0,
    }),
  );
  data.friendships = [
    { id: "friendship", sender_id: "admin", recipient_id: "friend", status: "accepted" },
  ];
  data.squads = [
    { id: "squad-1", owner_id: "squad-owner", name: "Private Squad", description: "" },
  ];
  data.squad_members = [
    { squad_id: "squad-1", user_id: "owner", role: "owner" },
    { squad_id: "squad-1", user_id: "squad-owner", role: "owner" },
  ];
  data.space_squads = [
    { space_id: space.id, squad_id: "squad-1", added_by: "owner", created_at: space.created_at },
  ];
  return data;
}

test("Space access is active-member scoped and pending invites expose only basics", () => {
  const ownerData = snapshot("owner");
  assert.equal(canReadSpace(ownerData, space.id, "owner"), true);
  assert.equal(canManageSpace(ownerData, space.id, "owner"), true);

  const adminData = snapshot("admin");
  assert.equal(canManageSpace(adminData, space.id, "admin"), true);
  assert.equal(canManageSpaceMember(adminData, space.id, "admin", "member"), true);
  assert.equal(canManageSpaceMember(adminData, space.id, "admin", "owner"), false);

  const inviteeData = snapshot("invitee");
  assert.equal(canReadSpace(inviteeData, space.id, "invitee"), true);
  assert.equal(canManageSpace(inviteeData, space.id, "invitee"), false);
  assert.deepEqual(visibleSpaceSquads(inviteeData, space.id, "invitee"), []);
});

test("Space links do not expose private Squad metadata or survive membership/block loss", () => {
  const spaceOnly = snapshot("member");
  assert.equal(canReadSpace(spaceOnly, space.id, "member"), true);
  assert.deepEqual(visibleSpaceSquads(spaceOnly, space.id, "member"), []);

  const squadOwnerView = snapshot("owner");
  assert.deepEqual(visibleSpaceSquads(squadOwnerView, space.id, "owner").map((row) => row.id), ["squad-1"]);
  squadOwnerView.blocks.push({ blocker_id: "owner", blocked_id: "squad-owner" });
  assert.equal(canReadSpace(squadOwnerView, space.id, "owner"), true);
  assert.deepEqual(visibleSpaceSquads(squadOwnerView, space.id, "owner"), []);

  const revoked = snapshot("member");
  revoked.space_members = revoked.space_members.filter(
    (row) => row.user_id !== "member",
  );
  assert.equal(canReadSpace(revoked, space.id, "member"), false);
  assert.deepEqual(visibleSpaceSquads(revoked, space.id, "member"), []);

  revoked.blocks.push({ blocker_id: "owner", blocked_id: "admin" });
  revoked.viewer_id = "admin";
  assert.equal(canReadSpace(revoked, space.id, "admin"), false);
});

test("Space invitations require an accepted, unblocked friend and a higher role", () => {
  assert.equal(canInviteSpaceMember(snapshot("admin"), space.id, "admin", "friend"), true);
  assert.equal(canInviteSpaceMember(snapshot("member"), space.id, "member", "friend"), false);
  assert.equal(canInviteSpaceMember(snapshot("admin"), space.id, "admin", "friend", "admin"), false);
  const blocked = snapshot("admin");
  blocked.blocks.push({ blocker_id: "friend", blocked_id: "admin" });
  assert.equal(canInviteSpaceMember(blocked, space.id, "admin", "friend"), false);
  const ownerBlocked = snapshot("admin");
  ownerBlocked.blocks.push({ blocker_id: "owner", blocked_id: "friend" });
  assert.equal(canInviteSpaceMember(ownerBlocked, space.id, "admin", "friend"), false);
});

test("demo has an independent owner-led Space and create flow installs the owner row", () => {
  const data = makeDemo();
  const demoSpace = data.spaces.find((row) => row.id === "space-neighborhood-studio");
  assert.ok(demoSpace);
  assert.equal(demoSpace.owner_id, DEMO_ID);
  assert.equal(
    data.space_members.some(
      (row) => row.space_id === demoSpace.id && row.user_id === DEMO_ID && row.role === "owner" && row.status === "active",
    ),
    true,
  );
  assert.deepEqual(data.space_squads.filter((row) => row.space_id === demoSpace.id).map((row) => row.squad_id), ["boxing"]);
  assert.equal(data.organizations.some((row) => row.id === demoSpace.id), false);
  assert.deepEqual(visibleSpaceSquads(data, demoSpace.id, DEMO_ID).map((row) => row.id), ["boxing"]);

  const created = demoAction(data, "create_space", { name: "My Space", description: "Just mine" });
  const newSpace = created.spaces.find((row) => !data.spaces.some((old) => old.id === row.id));
  assert.ok(newSpace);
  assert.equal(
    created.space_members.some(
      (row) => row.space_id === newSpace.id && row.user_id === DEMO_ID && row.role === "owner" && row.status === "active",
    ),
    true,
  );
});

test("shared Space membership follows public profile privacy and owner blocks in Demo", () => {
  const data = makeDemo();
  const demoSpace = data.spaces[0];
  const profile = (id: string, visibility: "public" | "friends") => ({
    ...data.profiles[0],
    id,
    username: id,
    name: id,
    profile_visibility: visibility,
  });
  data.profiles.push(profile("space-public-peer", "public"));
  data.space_members.push({
    space_id: demoSpace.id,
    user_id: "space-public-peer",
    role: "member",
    status: "active",
    invited_by: DEMO_ID,
    created_at: demoSpace.created_at,
  });
  assert.equal(
    data.friendships.some(
      (friendship) =>
        friendship.sender_id === "space-public-peer" ||
        friendship.recipient_id === "space-public-peer",
    ),
    false,
  );
  assert.equal(canViewProfile(data, "space-public-peer", DEMO_ID), true,
    "shared active Space membership gives a public nonfriend profile context");

  data.profiles.push(profile("space-friends-peer", "friends"));
  data.space_members.push({
    space_id: demoSpace.id,
    user_id: "space-friends-peer",
    role: "member",
    status: "active",
    invited_by: DEMO_ID,
    created_at: demoSpace.created_at,
  });
  assert.equal(canViewProfile(data, "space-friends-peer", DEMO_ID), false,
    "Space membership does not override friends-only privacy");
  data.friendships.push({
    id: "space-friendship",
    sender_id: DEMO_ID,
    recipient_id: "space-friends-peer",
    status: "accepted",
  });
  assert.equal(canViewProfile(data, "space-friends-peer", DEMO_ID), true,
    "the normal friend rule still permits the friends-only profile");

  data.spaces.push({ ...demoSpace, id: "space-blocked-owner", owner_id: "blocked-owner" });
  data.space_members.push(
    {
      space_id: "space-blocked-owner",
      user_id: "blocked-owner",
      role: "owner",
      status: "active",
      invited_by: null,
      created_at: demoSpace.created_at,
    },
    {
      space_id: "space-blocked-owner",
      user_id: "blocked-viewer",
      role: "member",
      status: "active",
      invited_by: "blocked-owner",
      created_at: demoSpace.created_at,
    },
    {
      space_id: "space-blocked-owner",
      user_id: "blocked-target",
      role: "member",
      status: "active",
      invited_by: "blocked-owner",
      created_at: demoSpace.created_at,
    },
  );
  data.profiles.push(
    profile("blocked-viewer", "public"),
    profile("blocked-target", "public"),
  );
  data.blocks.push({ blocker_id: "blocked-owner", blocked_id: "blocked-viewer" });
  data.viewer_id = "blocked-viewer";
  assert.equal(canViewProfile(data, "blocked-target", "blocked-viewer"), false,
    "a block with the Space owner disables Space profile context for both members");
});
