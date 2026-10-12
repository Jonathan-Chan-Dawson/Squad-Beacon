import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, demoAction, DEMO_ID } from "../src/shared/demo";
import { showBeaconOnMap, withinMapBeaconWindow } from "../src/features/maps/mapDiscovery";
import { discoverBeacons, beaconPreviewWhen } from "../src/features/maps/discoveryRanking";
import { friendIds, locationIsFresh } from "../src/shared/domain";
import { DEMO_PULSE_PLACES } from "../src/features/pulse/demoStore";
import { resolveMapContext } from "../src/features/maps/contextFilters";
import { selectPersonPreview } from "../src/features/people/previews/personPreview";
import { visibleSoloActivity } from "../src/features/maps/soloActivity";

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

test("demo supplies 120 varied friends with reproducible scattered locations and dense clusters", () => {
  const data = makeDemo(), now = Date.now();
  const people = data.profiles.filter(row => row.id.startsWith("map-friend-"));
  assert.equal(people.length, 120);
  assert.equal(new Set(people.map(row => row.name)).size, 120);
  assert.equal(new Set(people.map(row => row.avatar_seed)).size, 120);
  const friends = friendIds(data, DEMO_ID);
  for (const person of people) {
    assert.ok(friends.includes(person.id));
    const location = data.locations.find(row => row.owner_id === person.id)!;
    const index = Number(person.id.slice("map-friend-".length));
    assert.equal(locationIsFresh(location, new Date(now)), index % 20 < 18);
    assert.equal(data.organization_members.some(row => row.user_id === person.id && row.status === "active"), index % 5 !== 4);
  }
  assert.equal(new Set(data.locations.map(row => `${row.latitude}:${row.longitude}`)).size, data.locations.length);
  assert.ok(data.activities.some(row => row.id.startsWith("map-status-") && row.available));
  assert.ok(data.activities.some(row => row.id.startsWith("map-status-") && !row.available));
  assert.ok(!data.activities.some(row => row.id === "neighborhood-19"));
  assert.ok(DEMO_PULSE_PLACES.length >= 10);
  const locations = data.locations.filter(row => row.owner_id.startsWith("map-friend-"));
  assert.equal(locations.filter(row => locationIsFresh(row, new Date(now))).length, 108);
  assert.ok(Math.max(...locations.map(row => row.latitude!)) - Math.min(...locations.map(row => row.latitude!)) > 0.10);
  assert.ok(Math.max(...locations.map(row => row.longitude!)) - Math.min(...locations.map(row => row.longitude!)) > 0.08);
  assert.ok(locations.filter((row, i) => locations.some((other, j) => j !== i && Math.hypot(row.latitude! - other.latitude!, row.longitude! - other.longitude!) < 0.001)).length > 30);
  const repeated = makeDemo().locations.filter(row => row.owner_id.startsWith("map-friend-"));
  assert.deepEqual(locations.map(row => [row.latitude, row.longitude]), repeated.map(row => [row.latitude, row.longitude]));
});

test("friend fixtures cover every category and availability state while keeping hidden and inactive statuses private", () => {
  const data = makeDemo(), now = Date.now();
  const statuses = data.activities.filter(row => row.id.startsWith("map-status-"));
  assert.equal(new Set(statuses.map(row => row.category)).size, 6);
  assert.deepEqual(new Set(statuses.map(row => row.audience)), new Set(["friends", "squad", "organization", "private"]));
  assert.ok(statuses.some(row => !row.description));
  assert.ok(statuses.some(row => row.description && row.enable_reactions === false));
  const people = data.profiles.filter(row => row.id.startsWith("map-friend-"));
  assert.deepEqual(new Set(people.map(row => selectPersonPreview(data, row.id, DEMO_ID, now).availability)), new Set(["available", "ending-soon", "unavailable", "unknown"]));
  for (const index of [3, 4, 5, 6]) assert.equal(visibleSoloActivity(data, `map-friend-${index}`, DEMO_ID, now), undefined);
  assert.ok(visibleSoloActivity(data, "map-friend-0", DEMO_ID, now));
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

test("demo Beacon Plan resolves three ordered, visible stops and a connected Map route", () => {
  const data = makeDemo(), now = Date.now();
  const context = resolveMapContext(data, DEMO_ID, { kind: "plan", id: "map-plan-city-afternoon" });
  assert.ok(context);
  assert.equal(context.label, "Plan: Coffee, art and a lakefront walk");
  assert.deepEqual(context.points.map(point => point.activityId), ["map-plan-coffee", "map-plan-art", "map-plan-walk"]);
  assert.equal(context.paths.length, 1);
  assert.equal(context.paths[0].length, 3);
  const stops = data.activities.filter(activity => activity.plan_id === "map-plan-city-afternoon");
  assert.equal(stops.length, 3);
  for (const stop of stops) assert.equal(showBeaconOnMap(data, stop, DEMO_ID, {}, now), true);
  const extras = data.activities.filter(activity => activity.id.startsWith("map-extra-"));
  assert.equal(extras.length, 8);
  assert.equal(new Set(extras.map(activity => activity.category)).size, 6);
  for (const beacon of extras) assert.equal(showBeaconOnMap(data, beacon, DEMO_ID, {}, now), true);
  assert.ok(data.rsvps.every(row => data.profiles.some(profile => profile.id === row.user_id)));
});
