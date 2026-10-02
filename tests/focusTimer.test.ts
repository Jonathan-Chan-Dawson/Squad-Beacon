import test from "node:test";
import assert from "node:assert/strict";
import {
  createFocusTimer,
  focusSecondsRemaining,
  pauseFocusTimer,
  resetFocusTimer,
  startFocusTimer,
  tickFocusTimer,
} from "@/src/features/beacons/focusTimer";

test("focus timer uses an absolute deadline across background time", () => {
  const started = startFocusTimer(createFocusTimer(), 1_000_000);
  assert.equal(started.deadline, 2_500_000);
  assert.equal(focusSecondsRemaining(started, 1_030_000), 1470);
  assert.equal(focusSecondsRemaining(started, 1_150_000), 1350);
  const completed = tickFocusTimer(started, 2_500_000);
  assert.equal(completed.phase, "complete");
  assert.equal(completed.remainingSeconds, 0);
  assert.equal(completed.deadline, null);
});

test("pause and resume preserve remaining time without counting the pause", () => {
  const started = startFocusTimer(createFocusTimer(), 10_000),
    paused = pauseFocusTimer(started, 133_400);
  assert.equal(paused.phase, "paused");
  assert.equal(paused.remainingSeconds, 1377);
  assert.equal(paused.deadline, null);
  const resumed = startFocusTimer(paused, 500_000);
  assert.equal(resumed.deadline, 1_877_000);
  assert.equal(focusSecondsRemaining(resumed, 510_000), 1367);
});

test("remaining time clamps at zero and duration, and reset restores the preset", () => {
  const timer = createFocusTimer(90),
    running = startFocusTimer(timer, 5_000);
  assert.equal(focusSecondsRemaining(running, 99_000), 0);
  assert.equal(focusSecondsRemaining(running, -500_000), 90);
  const finished = tickFocusTimer(running, 95_000);
  assert.equal(finished.phase, "complete");
  const reset = resetFocusTimer(finished);
  assert.equal(reset.phase, "idle");
  assert.equal(reset.remainingSeconds, 90);
  assert.equal(reset.deadline, null);
  assert.equal(createFocusTimer(0).phase, "complete");
});
