import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { selectCommunityInCommon } from "../src/features/social/inCommon";

test("friends here requires accepted friendship, visible profile and actual membership", () => {
  const data = makeDemo();
  const names = () =>
    selectCommunityInCommon(data, DEMO_ID, "squad", "boxing").flatMap((g) =>
      g.items.map((i) => i.id),
    );
  assert.ok(names().includes("jordan"));
  data.squad_members = data.squad_members.filter(
    (m) => m.squad_id !== "boxing" || m.user_id !== "jordan",
  );
  assert.ok(
    !names().includes("jordan"),
    "a friend outside the roster is not a member",
  );
  data.squad_members.push({
    squad_id: "boxing",
    user_id: "jordan",
    role: "member",
  });
  data.friendships = data.friendships.map((f) =>
    f.sender_id === "jordan" || f.recipient_id === "jordan"
      ? { ...f, status: "pending" }
      : f,
  );
  assert.ok(
    !names().includes("jordan"),
    "a pending friendship is not a friend",
  );
});

test("hidden and blocked profiles are omitted without leaking counts", () => {
  const data = makeDemo();
  const names = () =>
    selectCommunityInCommon(data, DEMO_ID, "squad", "boxing").flatMap((g) =>
      g.items.map((i) => i.id),
    );
  data.profiles.find((p) => p.id === "jordan")!.profile_visibility = "custom";
  data.profile_visibility_grants = data.profile_visibility_grants.filter(
    (a) => a.owner_id !== "jordan",
  );
  assert.ok(!names().includes("jordan"));
  data.profiles.find((p) => p.id === "jordan")!.profile_visibility = "friends";
  data.blocks.push({ blocker_id: "jordan", blocked_id: DEMO_ID });
  assert.ok(!names().includes("jordan"));
  data.viewer_id = "another-account";
  assert.deepEqual(
    selectCommunityInCommon(data, DEMO_ID, "squad", "boxing"),
    [],
  );
});

test("Organization overlap keeps Squad membership independent and excludes invitations", () => {
  const data = makeDemo();
  const id = "space-neighborhood-studio";
  const groups = () => selectCommunityInCommon(data, DEMO_ID, "space", id);
  assert.ok(
    groups().some(
      (g) => g.id === "friends" && g.items.some((i) => i.id === "jordan"),
    ),
  );
  data.space_squads.push({
    space_id: id,
    squad_id: "boxing",
    added_by: DEMO_ID,
    created_at: new Date().toISOString(),
  });
  assert.ok(
    groups().some(
      (g) => g.id === "squads" && g.items.some((i) => i.id === "boxing"),
    ),
  );
  data.squad_members = data.squad_members.filter(
    (m) => m.squad_id !== "boxing" || m.user_id !== DEMO_ID,
  );
  assert.ok(
    !groups().some(
      (g) => g.id === "squads" && g.items.some((i) => i.id === "boxing"),
    ),
  );
  data.space_members.find(
    (m) => m.space_id === id && m.user_id === DEMO_ID,
  )!.status = "invited";
  assert.deepEqual(groups(), []);
});

test("Network overlap requires separate active Organization membership", () => {
  const data = makeDemo();
  const network = "org-lakefront-collective",
    space = "space-neighborhood-studio";
  data.organization_spaces.push({
    organization_id: network,
    space_id: space,
    added_by: DEMO_ID,
    created_at: new Date().toISOString(),
  });
  const groups = () =>
    selectCommunityInCommon(data, DEMO_ID, "organization", network);
  assert.ok(
    groups().some(
      (g) => g.id === "organizations" && g.items.some((i) => i.id === space),
    ),
  );
  data.space_members = data.space_members.filter(
    (m) => m.space_id !== space || m.user_id !== DEMO_ID,
  );
  assert.ok(
    !groups().some(
      (g) => g.id === "organizations" && g.items.some((i) => i.id === space),
    ),
  );
  assert.deepEqual(
    selectCommunityInCommon(data, null, "organization", network),
    [],
  );
});

test("shared Beacons require hosting or approved Going; readable invitations do not imply participation", () => {
  const data = makeDemo();
  const activity = data.activities.find((a) => a.id === "demo-tools")!;
  activity.audience = "squad";
  activity.audience_id = "boxing";
  const rows = () =>
    selectCommunityInCommon(data, DEMO_ID, "squad", "boxing").find(
      (g) => g.id === "beacons",
    )?.items ?? [];
  assert.ok(rows().some((i) => i.id === activity.id));
  activity.owner_id = "jordan";
  data.rsvps = data.rsvps.filter(
    (r) => r.activity_id !== activity.id || r.user_id !== DEMO_ID,
  );
  assert.ok(!rows().some((i) => i.id === activity.id));
  data.rsvps.push({
    activity_id: activity.id,
    user_id: DEMO_ID,
    status: "going",
    approved: false,
  });
  activity.approval_required = true;
  assert.ok(!rows().some((i) => i.id === activity.id));
  data.rsvps.find(
    (r) => r.activity_id === activity.id && r.user_id === DEMO_ID,
  )!.approved = true;
  assert.ok(rows().some((i) => i.id === activity.id));
  data.activity_exclusions.push({ activity_id: activity.id, user_id: DEMO_ID });
  assert.ok(!rows().some((i) => i.id === activity.id));
});

test("large overlap remains exact, de-duplicated and empty after access is revoked", () => {
  const data = makeDemo();
  const original = selectCommunityInCommon(
    data,
    DEMO_ID,
    "squad",
    "boxing",
  ).find((g) => g.id === "friends")!.items.length;
  for (let i = 0; i < 55; i++) {
    const id = `common-friend-${i}`;
    data.profiles.push({
      ...data.profiles[0],
      id,
      name: `A long member name for readable directory rows ${i}`,
      username: `common_${i}`,
      profile_visibility: "friends",
    });
    data.friendships.push({
      sender_id: DEMO_ID,
      recipient_id: id,
      status: "accepted",
    });
    data.squad_members.push({
      squad_id: "boxing",
      user_id: id,
      role: "member",
    });
  }
  const friends = selectCommunityInCommon(
    data,
    DEMO_ID,
    "squad",
    "boxing",
  ).find((g) => g.id === "friends")!.items;
  assert.equal(friends.length, original + 55);
  assert.equal(new Set(friends.map((i) => i.id)).size, friends.length);
  data.squad_members = data.squad_members.filter(
    (m) => m.squad_id !== "boxing" || m.user_id !== DEMO_ID,
  );
  assert.deepEqual(
    selectCommunityInCommon(data, DEMO_ID, "squad", "boxing"),
    [],
  );
});
