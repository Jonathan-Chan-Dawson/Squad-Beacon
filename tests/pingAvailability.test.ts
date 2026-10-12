import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePingAvailability,
  relativePingAvailability,
  pingAvailabilityAllowsRsvp,
} from "../src/features/planning/availability";
import { demoAction, makeDemo, DEMO_ID } from "../src/shared/demo";

test("availability normalizes offsets and rejects ambiguous or invalid timestamps", () => {
  assert.equal(
    validatePingAvailability("2026-10-12T17:30:00-05:00", "interested"),
    "2026-10-12T22:30:00.000Z",
  );
  for (const value of ["2026-10-12T17:30:00", "infinity", "invalidZ", 123])
    assert.throws(() => validatePingAvailability(value, "interested"));
  assert.throws(() => validatePingAvailability("2026-10-12T17:30:00Z", "pass"));
  assert.equal(relativePingAvailability("now"), null);
  assert.equal(
    relativePingAvailability("hour", new Date("2026-10-12T17:30:00Z")),
    "2026-10-12T18:30:00.000Z",
  );
  assert.equal(
    pingAvailabilityAllowsRsvp("2026-10-12T18:00:00Z", "2026-10-12T17:00:00Z"),
    false,
  );
  assert.equal(
    pingAvailabilityAllowsRsvp("2026-10-12T18:00:00Z", "2026-10-12T18:00:00Z"),
    true,
  );
});

test("canonical demo replies retain preferences, support removal and clear them for Maybe", () => {
  let data = makeDemo();
  const thread_id = "demo-ping-maya";
  data = demoAction(data, "respond_planning_ping", {
    thread_id,
    response: "interested",
    auto_rsvp: true,
    available_after: "2026-10-12T17:30:00-05:00",
  });
  data = demoAction(data, "respond_planning_ping", {
    thread_id,
    response: "interested",
  });
  const response = () =>
    data.planning_ping_responses.find(
      (row) => row.thread_id === thread_id && row.user_id === DEMO_ID,
    )!;
  assert.equal(response().available_after, "2026-10-12T22:30:00.000Z");
  assert.equal(response().auto_rsvp, true);
  data = demoAction(data, "respond_planning_ping", {
    thread_id,
    response: "interested",
    available_after: null,
  });
  assert.equal(response().available_after, null);
  assert.equal(response().auto_rsvp, true);
  data = demoAction(data, "respond_planning_ping", {
    thread_id,
    response: "maybe",
  });
  assert.equal(response().available_after, null);
  assert.equal(response().auto_rsvp, false);
});
