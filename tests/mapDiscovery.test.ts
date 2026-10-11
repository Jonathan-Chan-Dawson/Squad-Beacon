import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID, demoAction } from "../src/shared/demo";
import {
  discoverBeacons,
  beaconDiscoveryTier,
  beaconDiscoveryDistance,
  personDiscoveryReason,
  beaconPreviewWhen,
} from "../src/features/maps/discoveryRanking";
import {
  demoPublicBeacons,
  parsePublicBeaconRows,
} from "../src/features/discovery/publicDirectory";
import { publicMapBeacons } from "../src/features/maps/publicMapDiscovery";
import { showBeaconOnMap } from "../src/features/maps/mapDiscovery";
import { canReadBeaconActivity } from "../src/features/beacons/beaconModules";
import { searchSocialDirectoryInData } from "../src/features/social/directory";
import { demoWorldwidePlaces } from "../src/features/maps/placeSearch";

test("discovery prioritizes involvement and live activities, preserving closed joined Beacons", () => {
  const data = makeDemo();
  const now = Date.now();
  const activity = data.activities.find((row) => row.id === "neighborhood-6")!;
  assert.equal(beaconDiscoveryTier(data, activity, DEMO_ID, now), 2);
  data.rsvps.push({
    activity_id: activity.id,
    user_id: DEMO_ID,
    status: "invited",
    approved: false,
  });
  assert.equal(beaconDiscoveryTier(data, activity, DEMO_ID, now), 1);
  data.rsvps[data.rsvps.length - 1] = {
    activity_id: activity.id,
    user_id: DEMO_ID,
    status: "going",
    approved: true,
  };
  activity.manual_closed = true;
  assert.equal(beaconDiscoveryTier(data, activity, DEMO_ID, now), 0);
  assert.equal(showBeaconOnMap(data, activity, DEMO_ID, {}, now), true);
  assert.ok(beaconPreviewWhen(activity, now).startsWith("Now · Ends"));
});

test("one query finds activities, people interests and unjoined public communities", () => {
  const data = makeDemo();
  const beacons = discoverBeacons(data, DEMO_ID, "basketball", Date.now());
  assert.ok(beacons.some((row) => row.id === "neighborhood-6"));
  const person = data.profiles.find((row) => row.id === "neighbor-22")!;
  assert.ok(person.interests.includes("basketball"));
  assert.match(personDiscoveryReason(data, person, DEMO_ID), /Auburn Hoops/);
  const rows = searchSocialDirectoryInData(data, DEMO_ID, {
    query: "basketball",
  });
  assert.ok(
    rows.some(
      (row) => row.entity_id === "weekend-hoops" && row.action === "join",
    ),
  );
});

test("friendless discovery uses coarse public summaries and never grants a Squad membership", () => {
  let data = makeDemo();
  data.friendships = [];
  const before = demoPublicBeacons(data, DEMO_ID, "basketball");
  const card = before.find((row) => row.activity_id === "neighborhood-6")!;
  assert.ok(card);
  const activity = data.activities.find((row) => row.id === card.activity_id)!;
  assert.equal(canReadBeaconActivity(data, activity, DEMO_ID), false);
  assert.equal(
    discoverBeacons(data, DEMO_ID, "basketball", Date.now()).some(
      (row) => row.id === activity.id,
    ),
    false,
  );
  data = demoAction(data, "join_public_beacon", { activity_id: activity.id });
  assert.equal(
    canReadBeaconActivity(
      data,
      data.activities.find((row) => row.id === activity.id)!,
      DEMO_ID,
    ),
    true,
  );
  assert.equal(
    data.squad_members.some(
      (row) => row.squad_id === "weekend-hoops" && row.user_id === DEMO_ID,
    ),
    false,
  );
  assert.equal(
    demoPublicBeacons(data, DEMO_ID, "").find(
      (row) => row.activity_id === activity.id,
    )?.viewer_response,
    "going",
  );
});

test("public pins honor the existing audience, category and context filters", () => {
  const data = makeDemo();
  const rows = demoPublicBeacons(data, DEMO_ID, "");
  const filters = {
    audience: "Public",
    category: "All categories",
    time: "All",
    planId: null,
  } as const;
  assert.ok(
    publicMapBeacons(rows, filters, [], [], false, null, Date.now()).length,
  );
  assert.equal(
    publicMapBeacons(
      rows,
      { ...filters, audience: "Friends" },
      [],
      [],
      false,
      null,
      Date.now(),
    ).length,
    0,
  );
  assert.equal(
    publicMapBeacons(rows, filters, ["Study"], [], false, null, Date.now())
      .length,
    0,
  );
  assert.equal(
    publicMapBeacons(rows, filters, [], [], true, null, Date.now()).length,
    0,
  );
  assert.equal(
    publicMapBeacons(
      rows,
      filters,
      [],
      rows.map((row) => row.activity_id),
      false,
      null,
      Date.now(),
    ).length,
    0,
  );
});

test("search and public summaries fail closed after blocking, exclusion or viewer change", () => {
  const data = makeDemo();
  const activity = data.activities.find((row) => row.id === "neighborhood-6")!;
  activity.description = "hidden badminton";
  activity.approval_required = true;
  data.places.find((row) => row.activity_id === activity.id)!.label =
    "Private secret location";
  assert.equal(
    discoverBeacons(data, DEMO_ID, "secret location", Date.now()).some(
      (row) => row.id === activity.id,
    ),
    false,
  );
  assert.equal(
    beaconDiscoveryDistance(data, activity, DEMO_ID, {
      latitude: 41.88,
      longitude: -87.65,
    }),
    undefined,
  );
  data.blocks.push({ blocker_id: DEMO_ID, blocked_id: activity.owner_id });
  assert.equal(
    discoverBeacons(data, DEMO_ID, "badminton", Date.now()).some(
      (row) => row.id === activity.id,
    ),
    false,
  );
  assert.equal(
    demoPublicBeacons(data, DEMO_ID, "").some(
      (row) => row.activity_id === activity.id,
    ),
    false,
  );
  data.viewer_id = "another-viewer";
  assert.deepEqual(discoverBeacons(data, DEMO_ID, "", Date.now()), []);
  assert.deepEqual(demoPublicBeacons(data, DEMO_ID, ""), []);
});

test("public parser strips extra private fields and rejects invalid coordinates", () => {
  const row = demoPublicBeacons(makeDemo(), DEMO_ID, "")[0];
  const parsed = parsePublicBeaconRows([
    { ...row, owner_id: "secret", description: "secret", places: [] },
  ]);
  assert.equal(parsed.length, 1);
  assert.equal("owner_id" in parsed[0], false);
  assert.equal("places" in parsed[0], false);
  assert.deepEqual(parsePublicBeaconRows([{ ...row, coarse_lat: 91 }]), []);
  assert.deepEqual(parsePublicBeaconRows([{ ...row, coarse_lng: null }]), []);
  assert.deepEqual(parsePublicBeaconRows([{ ...row, ends_at: "invalid" }]), []);
  assert.equal(demoWorldwidePlaces("naperville")[0].primaryType, "locality");
});
