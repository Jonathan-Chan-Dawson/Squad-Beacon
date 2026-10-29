import test from "node:test";
import assert from "node:assert/strict";
import {
  finishCreationPublicListing,
  type CreationPublicListing,
} from "@/src/features/beacons/creationPublicListing";

test("a lost listing reply reuses the confirmed Beacon, frozen area and request identity", async () => {
  const state: CreationPublicListing = { enabled: true, area: "Chicago" };
  const calls: { payload: unknown; id: string }[] = [];
  const publish = async (payload: unknown, id: string) => {
    calls.push({ payload: structuredClone(payload), id });
    if (calls.length === 1) throw new Error("Reply lost");
  };
  const run = () =>
    finishCreationPublicListing(
      state,
      "owner",
      "confirmed-beacon",
      { latitude: 41.88123, longitude: -87.62987 },
      () => true,
      async () => {},
      publish,
      () => "11111111-1111-4111-8111-111111111111",
    );
  await assert.rejects(run, /Reply lost/);
  state.area = "Edited after failure";
  await run();
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[1].payload, {
    activity_id: "confirmed-beacon",
    area_label: "Chicago",
    coarse_lat: 41.88,
    coarse_lng: -87.63,
  });
  await run();
  assert.equal(calls.length, 2);
});

test("checkpoint failure prevents listing and account changes reject pending recovery", async () => {
  const state: CreationPublicListing = { enabled: true, area: "Chicago" };
  let calls = 0;
  await assert.rejects(
    () =>
      finishCreationPublicListing(
        state,
        "owner",
        "beacon",
        null,
        () => true,
        async () => {
          throw new Error("Disk full");
        },
        async () => {
          calls++;
        },
        () => "11111111-1111-4111-8111-111111111111",
      ),
    /Disk full/,
  );
  assert.equal(calls, 0);
  await assert.rejects(
    () =>
      finishCreationPublicListing(
        state,
        "other",
        "beacon",
        null,
        () => true,
        async () => {},
        async () => {
          calls++;
        },
        () => "new",
      ),
    /account or Beacon changed/,
  );
  assert.equal(calls, 0);
});
