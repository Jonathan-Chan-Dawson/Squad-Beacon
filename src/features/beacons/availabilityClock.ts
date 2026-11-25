import { useCallback, useSyncExternalStore } from "react";
import { AppState } from "react-native";

const subscribers = new Map<() => void, number>();
let now = Date.now();
let timer: ReturnType<typeof setTimeout> | undefined;
let appState: ReturnType<typeof AppState.addEventListener> | undefined;

function schedule() {
  clearTimeout(timer);
  if (subscribers.size === 0 || AppState.currentState === "background") return;
  const current = Date.now();
  let next = current + 60000;
  for (const expiry of subscribers.values()) {
    if (expiry > current) next = Math.min(next, expiry);
    else if (expiry > now) next = current;
  }
  timer = setTimeout(tick, next - current);
}

function tick() {
  now = Date.now();
  for (const callback of subscribers.keys()) callback();
  schedule();
}

function subscribe(callback: () => void, expiry: number) {
  if (!subscribers.size) {
    now = Date.now();
    appState = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
      else schedule();
    });
    if (typeof window !== "undefined") window.addEventListener("online", tick);
  }
  subscribers.set(callback, expiry);
  schedule();
  return () => {
    subscribers.delete(callback);
    if (!subscribers.size) {
      appState?.remove();
      appState = undefined;
      if (typeof window !== "undefined")
        window.removeEventListener("online", tick);
    }
    schedule();
  };
}

const getNow = () => now;

const disabledNow = () => 0;
const unsubscribeNothing = () => {};

export function useAvailabilityNow(expiry = Infinity, enabled = true) {
  const listen = useCallback(
    (callback: () => void) =>
      enabled ? subscribe(callback, expiry) : unsubscribeNothing,
    [expiry, enabled],
  );
  return useSyncExternalStore(
    listen,
    enabled ? getNow : disabledNow,
    enabled ? getNow : disabledNow,
  );
}
