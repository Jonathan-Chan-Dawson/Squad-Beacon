import test from "node:test";
import assert from "node:assert/strict";
import { PulseQueryController } from "@/src/features/pulse/queryController";
import { PulseDemoStore } from "@/src/features/pulse/demoStore";
import {
  PulseClientSession,
  findPulseClientSession,
  retainPulseClientSession,
} from "@/src/features/pulse/clientSession";
import type { PulseSummary } from "@/src/features/pulse/types";
const bounds = { north: 42, south: 41, east: -87, west: -88 };
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
const summary = (key: string): PulseSummary => ({
  placeKey: key,
  lat: 41.8,
  lng: -87.6,
  category: "cafe",
  crowd: 2,
  conditions: [],
  recentCount: 1,
  confirmCount: 0,
  updatedAt: 1,
  freshness: 1,
  importance: 1,
});
test("off means zero calls; settled bounds are debounced and cached for sixty seconds", async () => {
  let calls = 0,
    now = 1000;
  const controller = new PulseQueryController(
    async () => {
      calls++;
      return [summary("latest")];
    },
    () => now,
    5,
  );
  try {
    controller.setView(false, bounds, 15);
    await settle();
    assert.equal(calls, 0);
    controller.setView(true, bounds, 15);
    controller.setView(true, bounds, 15);
    await settle();
    assert.equal(calls, 1);
    controller.setView(true, bounds, 16);
    await settle();
    assert.equal(calls, 1);
    now += 60000;
    controller.setView(true, bounds, 16);
    await settle();
    assert.equal(calls, 2);
    controller.setView(false, bounds, 16);
    controller.refresh();
    await settle();
    assert.equal(calls, 2);
    assert.equal(controller.getSnapshot().summaries.length, 0);
  } finally {
    controller.dispose();
  }
});
test("a late response from cancelled bounds cannot replace newer or off snapshots", async () => {
  const pending: {
    signal: AbortSignal;
    resolve: (rows: PulseSummary[]) => void;
  }[] = [];
  const controller = new PulseQueryController(
    async (_bounds, _zoom, signal) =>
      new Promise((resolve) => pending.push({ signal, resolve })),
    Date.now,
    5,
  );
  try {
    controller.setView(true, bounds, 15);
    await settle();
    controller.setView(true, { ...bounds, east: -86 }, 15);
    await settle();
    assert.equal(pending[0].signal.aborted, true);
    pending[1].resolve([summary("new")]);
    await settle();
    pending[0].resolve([summary("old")]);
    await settle();
    assert.equal(controller.getSnapshot().summaries[0].placeKey, "new");
    controller.setView(true, { ...bounds, east: -85 }, 15);
    await settle();
    controller.setView(false, bounds, 15);
    pending[2].resolve([summary("hidden")]);
    await settle();
    assert.deepEqual(controller.getSnapshot().summaries, []);
  } finally {
    controller.dispose();
  }
});
test("demo batch rate limits roll from submission times and confirmation cooldown is place scoped", () => {
  const now = 1800000000000,
    store = new PulseDemoStore(now);
  const draft = {
    place: {
      placeKey: "own-cafe",
      name: "Cafe",
      lat: 41.8,
      lng: -87.6,
      category: "cafe" as const,
    },
    answers: { crowd: 2, wait: 1 },
  };
  for (let i = 0; i < 6; i++) store.post(draft, now + i);
  assert.throws(() => store.post(draft, now + 6), /rate/);
  store.post(draft, now + 3600000);
  store.confirm("own-cafe", now + 3600000);
  assert.throws(() => store.confirm("own-cafe", now + 3600001), /cooldown/);
  store.confirm("own-cafe", now + 4200000);
});

test("same viewer epoch retains local answers across remounts; new epoch/viewer replaces the only cache", () => {
  const session = new PulseClientSession("demo:you:1", true, 1800000000000);
  session.answers.set("cafe", { crowd: 2 });
  retainPulseClientSession(session);
  assert.equal(findPulseClientSession("demo:you:1"), session);
  assert.deepEqual(findPulseClientSession("demo:you:1")?.answers.get("cafe"), {
    crowd: 2,
  });
  assert.equal(findPulseClientSession("demo:you:2"), null);
  const reset = new PulseClientSession("demo:you:2", true, 1800000060000);
  retainPulseClientSession(reset);
  assert.equal(findPulseClientSession("demo:you:1"), null);
  assert.equal(findPulseClientSession("demo:you:2")?.answers.size, 0);
  const other = new PulseClientSession("live:other:3", false, 1800000060000);
  retainPulseClientSession(other);
  assert.equal(findPulseClientSession("demo:you:2"), null);
});
