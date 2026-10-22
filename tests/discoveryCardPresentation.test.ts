import test from "node:test";
import assert from "node:assert/strict";
import {
  discoveryCardMetadata,
  discoveryContextLabel,
  shouldUseAdaptiveDiscoveryShell,
} from "../src/features/discovery/discoveryCardPresentation";

test("the compact shell stays opt-in so existing Home Explore cards keep their presentation", () => {
  assert.equal(shouldUseAdaptiveDiscoveryShell("discovery"), false);
  assert.equal(shouldUseAdaptiveDiscoveryShell("home", true), false);
  assert.equal(shouldUseAdaptiveDiscoveryShell("discovery", true), true);
});

test("discovery metadata prioritizes accepted count and strict spots remaining", () => {
  assert.equal(
    discoveryCardMetadata({
      goingCount: 8,
      capacity: { limit: 10, strict: true, full: false },
    }),
    "8 going · 2 spots left",
  );
  assert.equal(
    discoveryCardMetadata({
      goingCount: 9,
      capacity: { limit: 10, strict: true },
    }),
    "9 going · 1 spot left",
  );
  assert.equal(
    discoveryCardMetadata({
      goingCount: 12,
      capacity: { limit: 10, strict: true },
    }),
    "12 going · Full",
  );
});

test("soft capacity stays informational when the suggested size is reached or exceeded", () => {
  assert.equal(
    discoveryCardMetadata({
      goingCount: 14,
      capacity: { limit: 12, strict: false, full: true },
    }),
    "14 going · Suggested 12",
  );
});

test("metadata clamps invalid counts and omits unusable capacity values", () => {
  assert.equal(
    discoveryCardMetadata({
      goingCount: Number.NaN,
      capacity: { limit: 0.5, strict: true, full: true },
      friendsGoing: -3,
    }),
    "0 going",
  );
  assert.equal(
    discoveryCardMetadata({ goingCount: 2, friendsGoing: 1 }),
    "2 going · 1 friend",
  );
});

test("context suppression requires matching visible timing, strict capacity, or community evidence", () => {
  assert.equal(
    discoveryContextLabel("Starts soon", { timingLabel: "Today at 5 PM" }),
    null,
  );
  assert.equal(discoveryContextLabel("Starts soon"), "Starts soon");
  assert.equal(
    discoveryContextLabel("Spots available", {
      strictCapacityLabel: "2 spots left",
    }),
    null,
  );
  assert.equal(discoveryContextLabel("Spots available"), "Spots available");
  assert.equal(
    discoveryContextLabel("From your Squad", { communityLabel: "Beacons" }),
    null,
  );
  assert.equal(
    discoveryContextLabel("From your Organization"),
    "From your Organization",
  );
  assert.equal(
    discoveryContextLabel("Matches your interest", {
      timingLabel: "Today at 5 PM",
      strictCapacityLabel: "2 spots left",
      communityLabel: "Beacons",
    }),
    "Matches your interest",
  );
});

test("friend-host context stays when the visible social metadata is about attendees", () => {
  assert.equal(
    discoveryContextLabel("Friend hosting", {
      friendsLabel: "2 friends attending",
    }),
    "Friend hosting",
  );
  assert.equal(
    discoveryContextLabel("2 friends attending", {
      friendsLabel: "2 friends attending",
    }),
    null,
  );
});
