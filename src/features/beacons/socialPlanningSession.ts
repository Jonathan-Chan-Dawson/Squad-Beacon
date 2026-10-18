import {
  useCallback,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";

type Session = { ids: string[]; version: number; fields: Map<string, unknown> };
const sessions = new Map<string, Session>();
const listeners = new Set<() => void>();
const empty: string[] = [];
function session(viewer: string) {
  let value = sessions.get(viewer);
  if (!value) {
    value = { ids: [], version: 1, fields: new Map() };
    sessions.set(viewer, value);
  }
  return value;
}
function notify() {
  listeners.forEach((listener) => listener());
}
export function planningSelection(viewer: string | null) {
  return viewer ? session(viewer).ids : empty;
}
export function setPlanningSelection(viewer: string | null, ids: string[]) {
  if (!viewer) return;
  session(viewer).ids = [...new Set(ids)];
  notify();
}
export function usePlanningSelection(
  viewer: string | null,
): [string[], (ids: string[]) => void] {
  const ids = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => planningSelection(viewer),
    () => empty,
  );
  return [ids, (next) => setPlanningSelection(viewer, next)];
}
export function startPlanningDraft(viewer: string | null) {
  if (!viewer) throw new Error("Sign in before making a plan.");
  return String(session(viewer).version);
}
export function planningDraftObject<T>(
  viewer: string | null,
  token: string | undefined,
  field: string,
  create: () => T,
): T {
  if (!viewer || token !== String(session(viewer).version)) return create();
  const fields = session(viewer).fields;
  if (!fields.has(field)) fields.set(field, create());
  return fields.get(field) as T;
}
export function hasPlanningDraftField(
  viewer: string | null,
  token: string | undefined,
  field: string,
) {
  return (
    !!viewer &&
    token === String(session(viewer).version) &&
    session(viewer).fields.has(field)
  );
}
export function usePlanningInvitees(
  viewer: string | null,
  token: string | undefined,
  initial: string[],
): [string[], Dispatch<SetStateAction<string[]>>] {
  const [selected, update] = usePlanningSelection(viewer);
  const [local, setLocal] = useState(initial);
  const ids = token ? selected : local;
  return [
    ids,
    (next) => {
      const result = typeof next === "function" ? next(ids) : next;
      if (token) update(result);
      else setLocal(result);
    },
  ];
}
export function completePlanningDraft(viewer: string | null, token?: string) {
  if (!viewer || !token || token !== String(session(viewer).version)) return;
  const value = session(viewer);
  value.ids = [];
  value.fields.clear();
  value.version += 1;
  notify();
}

/** In-memory only, account-scoped draft fields; no cross-account or stale completed draft restoration. */
export function usePlanningDraftState<T>(
  viewer: string | null,
  token: string | undefined,
  field: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const active = !!viewer && token === String(session(viewer).version);
  const [value, setValue] = useState<T>(() => {
    const resolve = () =>
      typeof initial === "function" ? (initial as () => T)() : initial;
    return active
      ? planningDraftObject(viewer, token, field, resolve)
      : resolve();
  });
  const set: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setValue((previous) => {
        const result =
          typeof next === "function"
            ? (next as (value: T) => T)(previous)
            : next;
        if (viewer && token === String(session(viewer).version))
          session(viewer).fields.set(field, result);
        return result;
      });
    },
    [field, token, viewer],
  );
  return [value, set];
}
