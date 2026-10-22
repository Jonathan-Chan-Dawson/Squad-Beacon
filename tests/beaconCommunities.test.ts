import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo } from "../src/shared/demo";
import { demoPublicBeacons } from "../src/features/discovery/publicDirectory";
import {
  demoBeaconCommunities,
  parseBeaconCommunities,
} from "../src/features/discovery/beaconCommunities";
import {
  communityReturnSheetIndex,
  rememberCommunityReturnSheet,
} from "../src/features/maps/communityReturnState";

test("public Demo previews recognize canonical open attendance without conferring community membership", () => {
  const data = makeDemo();
  const activity = data.activities.find((row) => row.id === "neighborhood-6")!;
  activity.approval_required = false;
  data.rsvps = data.rsvps.filter((row) => row.activity_id !== activity.id || row.user_id !== data.viewer_id);
  data.rsvps.push({ activity_id: activity.id, user_id: data.viewer_id!, status: "going", approved: false });
  assert.equal(demoPublicBeacons(data, data.viewer_id!, "").find((row) => row.activity_id === activity.id)?.viewer_response, "going");
  assert.equal(data.squad_members.some((row) => row.squad_id === "weekend-hoops" && row.user_id === data.viewer_id), false);
});

test("public association projection retains only safe, requested community identities", () => {
  const data = makeDemo();
  const rows = demoBeaconCommunities(data, data.viewer_id!, ["neighborhood-6"]);
  assert.equal(rows[0]?.summary.name, "Weekend Hoops");
  assert.equal(rows[0]?.relationship, "associated");
  assert.deepEqual(parseBeaconCommunities(rows, ["neighborhood-6"]), rows);
  assert.deepEqual(parseBeaconCommunities(rows, ["other-beacon"]), []);
  assert.deepEqual(
    parseBeaconCommunities(
      [{ ...rows[0], relationship: "hosted" }],
      ["neighborhood-6"],
    ),
    [],
  );
  assert.deepEqual(
    parseBeaconCommunities([{ ...rows[0], priority: -1 }], ["neighborhood-6"]),
    [],
  );
  assert.deepEqual(
    parseBeaconCommunities(
      [{ ...rows[0], summary: { ...rows[0].summary, action: "joined" } }],
      ["neighborhood-6"],
    ),
    [],
  );
  const parsed = parseBeaconCommunities(
    [
      {
        ...rows[0],
        owner_id: "secret",
        summary: { ...rows[0].summary, roster: ["secret"] },
      },
    ],
    ["neighborhood-6"],
  );
  assert.equal("owner_id" in parsed[0], false);
  assert.equal("roster" in parsed[0].summary, false);
  assert.equal(
    parseBeaconCommunities([...rows, ...rows], ["neighborhood-6"]).length,
    rows.length,
  );
});

test("private communities and revoked host affiliations do not enrich public discovery", () => {
  const data = makeDemo();
  const viewer = data.viewer_id!;
  data.squads.find((row) => row.id === "weekend-hoops")!.discoverability =
    "private";
  assert.deepEqual(demoBeaconCommunities(data, viewer, ["neighborhood-6"]), []);
  data.squads.find((row) => row.id === "weekend-hoops")!.discoverability =
    "public";
  data.squad_members = data.squad_members.filter(
    (row) => row.squad_id !== "weekend-hoops",
  );
  assert.deepEqual(demoBeaconCommunities(data, viewer, ["neighborhood-6"]), []);
  assert.deepEqual(
    demoBeaconCommunities(data, "other-viewer", ["neighborhood-6"]),
    [],
  );
  assert.deepEqual(
    demoBeaconCommunities({ ...data, is_demo: false }, viewer, [
      "neighborhood-6",
    ]),
    [],
  );
});

test("hidden hierarchy nodes cannot bridge a public Beacon to a discoverable ancestor", () => {
  const data = makeDemo();
  const viewer = data.viewer_id!;
  const created_at = new Date().toISOString();
  data.spaces.push({
    id: "hidden-middle",
    owner_id: "neighbor-6",
    name: "Hidden",
    description: "",
    space_type: "other",
    created_at,
    discoverability: "private",
    join_mode: "invite",
    invite_policy: "admins",
  });
  data.organizations.push({
    id: "visible-ancestor",
    owner_id: "neighbor-6",
    name: "Public Ancestor",
    description: "",
    created_at,
    discoverability: "public",
    join_mode: "open",
    invite_policy: "admins",
  });
  data.space_squads.push({
    space_id: "hidden-middle",
    squad_id: "weekend-hoops",
    added_by: "neighbor-6",
    created_at,
  });
  data.organization_spaces.push({
    organization_id: "visible-ancestor",
    space_id: "hidden-middle",
    added_by: "neighbor-6",
    created_at,
  });
  const rows = demoBeaconCommunities(data, viewer, ["neighborhood-6"]);
  assert.equal(
    rows.some((row) => row.summary.entity_id === "visible-ancestor"),
    false,
  );
  data.spaces.find((row) => row.id === "hidden-middle")!.discoverability =
    "public";
  const visible = demoBeaconCommunities(data, viewer, ["neighborhood-6"]);
  assert.equal(
    visible.some((row) => row.summary.entity_id === "visible-ancestor"),
    true,
  );
  assert.equal(visible[0].summary.entity_id, "weekend-hoops");
});

test("returning from a community restores the sheet without crossing viewer boundaries", () => {
  assert.equal(communityReturnSheetIndex("first", "beacon"), 1);
  rememberCommunityReturnSheet("first", "beacon", 2);
  assert.equal(communityReturnSheetIndex("first", "beacon"), 2);
  rememberCommunityReturnSheet("first", "beacon", -1);
  assert.equal(communityReturnSheetIndex("first", "beacon"), 2);
  assert.equal(communityReturnSheetIndex("second", "beacon"), 1);
  assert.equal(communityReturnSheetIndex("first", "beacon"), 1);
  rememberCommunityReturnSheet("first", "beacon", 0);
  assert.equal(communityReturnSheetIndex(null, "beacon"), 1);
});
