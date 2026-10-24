import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { selectListPeople } from "../src/features/people/privateLists";
import { filteredFriendIds } from "../src/features/people/friendGroupFilters";
import { sonarSelectionRequest } from "../src/features/profile/sonarSelection";
import { selectableSocialGroups } from "../src/features/people/socialSelection";
import { MAX_LOCATION_SHARE_MS } from "../src/features/maps/sessionHelpers";

test("favorites, private lists and selected-only always intersect current accepted friendship", () => {
  const data = makeDemo();
  const [first, second] = [...selectListPeople(data, DEMO_ID)];
  data.favorites = [
    { owner_id: DEMO_ID, kind: "friend", target_id: first },
    { owner_id: DEMO_ID, kind: "friend", target_id: "stranger" },
  ];
  data.lists.push({ id: "sonar-list", owner_id: DEMO_ID, name: "My people" });
  data.list_members.push(
    { list_id: "sonar-list", user_id: first },
    { list_id: "sonar-list", user_id: "stranger" },
  );
  assert.deepEqual(
    [...filteredFriendIds(data, DEMO_ID, { list: "favorites" })],
    [first],
  );
  assert.deepEqual(
    [...filteredFriendIds(data, DEMO_ID, { list: "custom:sonar-list" })],
    [first],
  );
  assert.deepEqual(
    [...filteredFriendIds(data, DEMO_ID, { selected: [first, "stranger"] })],
    [first],
  );
  assert.deepEqual(
    [...filteredFriendIds(data, DEMO_ID, { list: "custom:missing" })],
    [],
  );
  data.blocks.push({ blocker_id: first, blocked_id: DEMO_ID });
  assert.equal(filteredFriendIds(data, DEMO_ID).has(first), false);
  assert.equal(filteredFriendIds(data, DEMO_ID).has(second), true);
  assert.equal(filteredFriendIds(data, "different-account").size, 0);
});

test("Squad filters return people rather than groups and revoked groups have no fallback", () => {
  const data = makeDemo();
  const [first] = [...selectListPeople(data, DEMO_ID)];
  const squad = data.squads[0];
  data.squad_members = data.squad_members.filter(
    (m) => m.squad_id !== squad.id,
  );
  data.squad_members.push(
    { squad_id: squad.id, user_id: DEMO_ID, role: "owner" },
    { squad_id: squad.id, user_id: first, role: "member" },
    { squad_id: squad.id, user_id: "stranger", role: "member" },
  );
  assert.deepEqual(
    [
      ...filteredFriendIds(data, DEMO_ID, {
        group: { kind: "squad", id: squad.id },
      }),
    ],
    [first],
  );
  data.squad_members = data.squad_members.filter((m) => m.user_id !== DEMO_ID);
  assert.equal(
    filteredFriendIds(data, DEMO_ID, { group: { kind: "squad", id: squad.id } })
      .size,
    0,
  );
});

test("Organization and Network filters use active authorized members only", () => {
  const data = makeDemo();
  const accepted = selectListPeople(data, DEMO_ID);
  for (const group of selectableSocialGroups(data, DEMO_ID).filter(
    (g) => g.kind !== "squad",
  )) {
    const result = filteredFriendIds(data, DEMO_ID, { group });
    for (const id of result) {
      assert.ok(accepted.has(id));
      assert.ok(
        group.kind === "space"
          ? data.spaces.some((s) => s.id === group.id && s.owner_id === id) ||
              data.space_members.some(
                (m) =>
                  m.space_id === group.id &&
                  m.user_id === id &&
                  m.status === "active",
              )
          : data.organizations.some(
              (s) => s.id === group.id && s.owner_id === id,
            ) ||
              data.organization_members.some(
                (m) =>
                  m.organization_id === group.id &&
                  m.user_id === id &&
                  m.status === "active",
              ),
      );
    }
  }
});

test("Sonar payload contains only explicitly picked friends and preserves expiry when saving people", () => {
  const data = makeDemo();
  const now = Date.now();
  const [first] = [...selectListPeople(data, DEMO_ID)];
  data.locations = [];
  const original = structuredClone(data);
  const start = sonarSelectionRequest(
    data,
    DEMO_ID,
    [first],
    "30 minutes",
    "",
    "start",
    null,
    now,
  );
  assert.deepEqual(start, {
    recipients: [first],
    expires_at: new Date(now + 30 * 60000).toISOString(),
  });
  assert.deepEqual(
    data,
    original,
    "preparing selection never starts GPS or changes the session",
  );
  data.locations.push({
    id: "active",
    owner_id: DEMO_ID,
    expires_at: start.expires_at,
    latitude: null,
    longitude: null,
    updated_at: null,
  });
  assert.equal(
    sonarSelectionRequest(
      data,
      DEMO_ID,
      [first],
      "4 hours",
      "",
      "save",
      "active",
      now,
    ).expires_at,
    start.expires_at,
  );
  assert.equal(
    Date.parse(
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first],
        "15 minutes",
        "",
        "extend",
        "active",
        now,
      ).expires_at,
    ),
    now + 45 * 60000,
  );
  assert.equal(
    Date.parse(
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first],
        "4 hours",
        "",
        "extend",
        "active",
        now,
      ).expires_at,
    ),
    now + (4 * 60 + 30) * 60000,
  );
  data.locations[0].expires_at = new Date(
    now + MAX_LOCATION_SHARE_MS,
  ).toISOString();
  assert.equal(
    sonarSelectionRequest(
      data,
      DEMO_ID,
      [first],
      "15 minutes",
      "",
      "save",
      "active",
      now,
    ).expires_at,
    data.locations[0].expires_at,
  );
  assert.throws(
    () =>
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first],
        "15 minutes",
        "",
        "extend",
        "active",
        now,
      ),
    /limit/,
  );
});

test("revocation, expiry, account changes, duplicates and invalid activity caps require review", () => {
  const data = makeDemo();
  const now = Date.now();
  const [first] = [...selectListPeople(data, DEMO_ID)];
  data.locations = [];
  assert.throws(
    () =>
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first, "stranger"],
        "15 minutes",
        "",
        "start",
        null,
        now,
      ),
    /Review/,
  );
  assert.throws(
    () =>
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first, first],
        "15 minutes",
        "",
        "start",
        null,
        now,
      ),
    /Review/,
  );
  assert.throws(
    () =>
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first],
        "15 minutes",
        "",
        "save",
        "expired",
        now,
      ),
    /changed or ended/,
  );
  assert.throws(
    () =>
      sonarSelectionRequest(
        data,
        "other-account",
        [first],
        "15 minutes",
        "",
        "start",
        null,
        now,
      ),
    /account changed/,
  );
  assert.throws(
    () =>
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first],
        "Until activity ends",
        "missing",
        "start",
        null,
        now,
      ),
    /duration or Beacon/,
  );
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: first });
  assert.throws(
    () =>
      sonarSelectionRequest(
        data,
        DEMO_ID,
        [first],
        "15 minutes",
        "",
        "start",
        null,
        now,
      ),
    /Review/,
  );
});
