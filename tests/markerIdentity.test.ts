import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "../src/shared/demo";
import { markerIdentity } from "../src/features/maps/markerIdentity";

test("marker identity fails closed across viewer snapshots", () => {
  const data = makeDemo();
  assert.equal(
    markerIdentity(data, data.activities[0], "another-viewer"),
    null,
  );
  assert.equal(markerIdentity(data, data.activities[0], null), null);
});
test("community hosting identity remains independent of the Beacon audience", () => {
  const data = makeDemo();
  const activity = data.activities.find(
    (row) => row.owner_id === DEMO_ID && row.mode !== "solo",
  )!;
  assert.ok(activity);
  activity.audience = "friends";
  data.activity_social_links = [
    {
      activity_id: activity.id,
      entity_type: "space",
      entity_id: "network",
      created_by: DEMO_ID,
      created_at: new Date().toISOString(),
    },
  ];
  assert.equal(markerIdentity(data, activity, DEMO_ID)?.label, "Network");
  data.activity_social_links[0].entity_type = "organization";
  assert.equal(markerIdentity(data, activity, DEMO_ID)?.label, "Organization");
});
