import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoAction, DEMO_ID } from "../src/shared/demo";
import { showBeaconOnMap, withinMapBeaconWindow } from "../src/features/maps/mapDiscovery";
import { discoverBeacons, beaconPreviewWhen } from "../src/features/maps/discoveryRanking";
import { friendIds, locationIsFresh } from "../src/shared/domain";
import { DEMO_PULSE_PLACES } from "../src/features/pulse/demoStore";

test("past Map Beacons remain for 24 hours, retain access checks and rank after live events", () => {
  const data = makeDemo(), now = Date.now();
  const recent = data.activities.find(row => row.id === "map-past-origami")!;
  const older = data.activities.find(row => row.id === "map-past-mural")!;
  const archived = data.activities.find(row => row.id === "map-past-archive")!;
  for (const activity of [recent, older]) assert.equal(showBeaconOnMap(data, activity, DEMO_ID, {}, now), true);
  assert.equal(showBeaconOnMap(data, archived, DEMO_ID, {}, now), false);
  const endedAt = Date.parse(recent.ends_at);
  assert.equal(withinMapBeaconWindow(recent, endedAt + 24 * 3600000 - 1), true);
  assert.equal(withinMapBeaconWindow(recent, endedAt + 24 * 3600000), false);
  assert.equal(showBeaconOnMap(data, { ...recent, status: "cancelled" }, DEMO_ID, {}, now), false);
  assert.equal(showBeaconOnMap(data, { ...recent, mode: "solo" }, DEMO_ID, {}, now), false);
  assert.equal(showBeaconOnMap(data, { ...recent, audience: "private" }, DEMO_ID, {}, now), false);
  assert.equal(showBeaconOnMap({ ...data, viewer_id: "other" }, recent, DEMO_ID, {}, now), false);
  assert.match(beaconPreviewWhen(recent, now), /^Ended 2h ago$/);
  const ranked = discoverBeacons(data, DEMO_ID, "", now);
  assert.ok(ranked.some(row => row.id === recent.id));
  assert.ok(!ranked.some(row => row.id === archived.id));
  assert.ok(ranked.findIndex(row => row.id === "map-org-dragonboat") < ranked.findIndex(row => row.id === recent.id));
});

test("demo supplies 96 located organization friends, unique avatars, varied statuses and existing Pulse examples", () => {
  const data = makeDemo(), now = Date.now();
  const people = data.profiles.filter(row => row.id.startsWith("map-friend-"));
  assert.equal(people.length, 96);
  assert.equal(new Set(people.map(row => row.name)).size, 96);
  assert.equal(new Set(people.map(row => row.avatar_seed)).size, 96);
  const friends = friendIds(data, DEMO_ID);
  for (const person of people) {
    assert.ok(friends.includes(person.id));
    const location = data.locations.find(row => row.owner_id === person.id)!;
    assert.ok(locationIsFresh(location, new Date(now)));
    assert.ok(data.organization_members.some(row => row.user_id === person.id && row.status === "active"));
  }
  assert.equal(new Set(data.locations.map(row => `${row.latitude}:${row.longitude}`)).size, data.locations.length);
  assert.ok(data.activities.some(row => row.id.startsWith("map-status-") && row.available));
  assert.ok(data.activities.some(row => row.id.startsWith("map-status-") && !row.available));
  assert.ok(!data.activities.some(row => row.id === "neighborhood-19"));
  assert.ok(DEMO_PULSE_PLACES.length >= 10);
});

test("distinct public events cover a large concert and a strict five-person meetup", () => {
  const data = makeDemo();
  const concert = data.public_beacons.find(row => row.activity_id === "map-public-concert")!;
  const meetup = data.public_beacons.find(row => row.activity_id === "map-public-photo-walk")!;
  assert.equal(concert.accepted_seat_count, 41);
  assert.equal(meetup.accepted_seat_count, 4);
  assert.equal(meetup.capacity_limit, 5);
  assert.equal(meetup.capacity_policy, "strict");
  const joined = demoAction(data, "join_public_beacon", { activity_id: meetup.activity_id });
  assert.ok(joined.rsvps.some(row => row.activity_id === meetup.activity_id && row.user_id === DEMO_ID && row.approved));
});
