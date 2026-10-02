export type FocusTimerPhase = "idle" | "running" | "paused" | "complete";

export interface FocusTimerState {
  durationSeconds: number;
  remainingSeconds: number;
  phase: FocusTimerPhase;
  deadline: number | null;
}

export const DEFAULT_FOCUS_SECONDS = 25 * 60;

function clampSeconds(value: number, maximum: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.ceil(value)));
}

export function createFocusTimer(
  durationSeconds = DEFAULT_FOCUS_SECONDS,
): FocusTimerState {
  const duration = clampSeconds(durationSeconds, 24 * 60 * 60);
  return {
    durationSeconds: duration,
    remainingSeconds: duration,
    phase: duration === 0 ? "complete" : "idle",
    deadline: null,
  };
}

/** Read remaining time from an absolute deadline so background pauses don't drift. */
export function focusSecondsRemaining(timer: FocusTimerState, now: number) {
  if (timer.phase !== "running")
    return clampSeconds(timer.remainingSeconds, timer.durationSeconds);
  if (timer.deadline === null || !Number.isFinite(timer.deadline)) return 0;
  const currentTime = Number.isFinite(now) ? now : timer.deadline;
  return clampSeconds(
    Math.ceil((timer.deadline - currentTime) / 1000),
    timer.durationSeconds,
  );
}

export function startFocusTimer(
  timer: FocusTimerState,
  now: number,
): FocusTimerState {
  if (timer.phase === "running" || timer.phase === "complete") return timer;
  const remainingSeconds = focusSecondsRemaining(timer, now);
  if (remainingSeconds === 0)
    return { ...timer, remainingSeconds: 0, phase: "complete", deadline: null };
  const startAt = Number.isFinite(now) ? now : Date.now();
  return {
    ...timer,
    remainingSeconds,
    phase: "running",
    deadline: startAt + remainingSeconds * 1000,
  };
}

export function pauseFocusTimer(
  timer: FocusTimerState,
  now: number,
): FocusTimerState {
  if (timer.phase !== "running") return timer;
  const remainingSeconds = focusSecondsRemaining(timer, now);
  return {
    ...timer,
    remainingSeconds,
    phase: remainingSeconds === 0 ? "complete" : "paused",
    deadline: null,
  };
}

export function tickFocusTimer(
  timer: FocusTimerState,
  now: number,
): FocusTimerState {
  if (timer.phase !== "running") return timer;
  const remainingSeconds = focusSecondsRemaining(timer, now);
  return remainingSeconds === 0
    ? { ...timer, remainingSeconds: 0, phase: "complete", deadline: null }
    : { ...timer, remainingSeconds };
}

export function resetFocusTimer(timer: FocusTimerState): FocusTimerState {
  return createFocusTimer(timer.durationSeconds);
}
