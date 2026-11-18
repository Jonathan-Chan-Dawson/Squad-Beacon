import test from "node:test";
import assert from "node:assert/strict";
import {
  clearEntryIntent,
  consumeEntryIntent,
  rememberEntryIntent,
  setEntryIntentStorage,
} from "../src/features/auth/entryIntent";
import { demoAction, makeDemo, DEMO_ID } from "../src/shared/demo";
import { accountReadiness } from "../src/shared/accountReadiness";
import { homePresentation } from "../src/features/onboarding/presentation";
import { emptyData } from "../src/shared/types";

test("demo remains a ready signed-in account without a real session", () => {
  const data = makeDemo();
  assert.equal(
    accountReadiness({
      data,
      userId: DEMO_ID,
      demo: true,
      session: null,
      loading: false,
      error: null,
    }).state,
    "ready",
  );
});

test("signed-out Beacons use the existing compact home state", () => {
  assert.equal(
    homePresentation(
      emptyData(),
      null,
      Date.now(),
      new Set(),
      "loading",
      false,
      null,
    ).kind,
    "compact",
  );
});

test("public Beacon continuation survives reload but expires, clears and never stores tokens", () => {
  let saved = "";
  setEntryIntentStorage({
    read: () => saved,
    write: (value) => {
      saved = value;
    },
  });
  const path = "/discover/11111111-1111-4111-8111-111111111111";
  rememberEntryIntent(path, { token: "should-not-persist" });
  assert.equal(saved.includes("should-not-persist"), false);
  assert.equal(JSON.parse(saved).destination, path);
  consumeEntryIntent(); // Consume memory, then simulate a fresh email-callback load.
  saved = JSON.stringify({ destination: path, expires: Date.now() + 60000 });
  assert.equal(consumeEntryIntent(), path);
  assert.equal(consumeEntryIntent(), "/");
  for (const destination of [
    "https://evil.invalid",
    "//evil.invalid",
    "/profile",
    path + "?token=secret",
  ]) {
    saved = JSON.stringify({ destination, expires: Date.now() + 60000 });
    assert.equal(consumeEntryIntent(), "/");
  }
  saved = JSON.stringify({ destination: path, expires: Date.now() - 1 });
  assert.equal(consumeEntryIntent(), "/");
  rememberEntryIntent(path, {});
  clearEntryIntent();
  assert.equal(consumeEntryIntent(), "/");
  setEntryIntentStorage(undefined);
});

test("demo host visibility is explicit and disappears with public publishing", () => {
  let data = makeDemo();
  const activity = data.activities.find(
    (row) =>
      row.owner_id === DEMO_ID &&
      row.mode === "squad" &&
      row.audience !== "organization" &&
      Date.parse(row.ends_at) > Date.now(),
  )!;
  assert.ok(activity);
  data = demoAction(data, "publish_beacon_discovery", {
    activity_id: activity.id,
    area_label: "Chicago",
  });
  assert.notEqual(
    data.public_beacons.find((row) => row.activity_id === activity.id)
      ?.guest_visible,
    true,
  );
  data = demoAction(data, "set_beacon_guest_visibility", {
    activity_id: activity.id,
    enabled: true,
  });
  assert.equal(
    data.public_beacons.find((row) => row.activity_id === activity.id)
      ?.guest_visible,
    true,
  );
  data = demoAction(data, "unpublish_beacon_discovery", {
    activity_id: activity.id,
  });
  assert.throws(
    () =>
      demoAction(data, "set_beacon_guest_visibility", {
        activity_id: activity.id,
        enabled: true,
      }),
    /Publish/,
  );
});
