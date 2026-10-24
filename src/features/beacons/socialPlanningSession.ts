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
// Editors get isolated account-scoped sessions; explicit saves persist snapshots separately.
let creationVersion = 0;
const creationDrafts = new Map<
  string,
  {
    viewer: string;
    fields: Map<string, unknown>;
    context?: Record<string, string>;
  }
>();
let creationAccount: string | null | undefined;
let creationEpoch = 0;
/** Account transitions invalidate any in-flight picker result, including switching back. */
export function setCreationDraftAccount(viewer: string | null) {
  if (creationAccount === viewer) return;
  creationAccount = viewer;
  creationEpoch += 1;
  creationDrafts.clear();
  sessions.forEach((value) => value.fields.delete("locationReturn"));
}
export function startCreationDraft(viewer: string | null) {
  if (!viewer) return undefined;
  setCreationDraftAccount(viewer);
  const token = `creation:${Date.now()}-${++creationVersion}-${Math.random().toString(36).slice(2)}`;
  creationDrafts.set(token, { viewer, fields: new Map() });
  return token;
}
function draftFields(viewer: string | null, token?: string) {
  if (!viewer || !token) return undefined;
  if (token.startsWith("creation:")) {
    const draft = creationDrafts.get(token);
    return draft?.viewer === viewer ? draft.fields : undefined;
  }
  return token === String(session(viewer).version)
    ? session(viewer).fields
    : undefined;
}
export type PickedCreationLocation = {
  label: string;
  latitude: number;
  longitude: number;
};
export function beginCreationLocationPick(
  viewer: string | null,
  token: string | undefined,
  params: Record<string, string>,
) {
  const fields = draftFields(viewer, token);
  if (!fields) return false;
  fields.set("locationReturn", params);
  return true;
}
export function finishCreationLocationPick(
  viewer: string | null,
  token?: string,
  location?: PickedCreationLocation,
) {
  const fields = draftFields(viewer, token);
  const params = fields?.get("locationReturn") as
    Record<string, string> | undefined;
  if (!fields || !params) return undefined;
  if (
    location &&
    (!Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      Math.abs(location.latitude) > 90 ||
      Math.abs(location.longitude) > 180)
  )
    return undefined;
  if (location) {
    fields.set("label", location.label.trim() || "Pinned location");
    fields.set("pin", {
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }
  fields.delete("locationReturn");
  return location
    ? { ...params, locationResult: String(++creationVersion) }
    : params;
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
  const fields = draftFields(viewer, token);
  if (!fields) return create();
  if (!fields.has(field)) fields.set(field, create());
  return fields.get(field) as T;
}
export function hasPlanningDraftField(
  viewer: string | null,
  token: string | undefined,
  field: string,
) {
  return draftFields(viewer, token)?.has(field) ?? false;
}
export function usePlanningInvitees(
  viewer: string | null,
  token: string | undefined,
  initial: string[],
): [string[], Dispatch<SetStateAction<string[]>>] {
  const [selected, update] = usePlanningSelection(viewer);
  const [local, setLocal] = usePlanningDraftState(
    viewer,
    token?.startsWith("creation:") ? token : undefined,
    "inviteeIds",
    initial,
  );
  const ids = token && !token.startsWith("creation:") ? selected : local;
  return [
    ids,
    (next) => {
      const result = typeof next === "function" ? next(ids) : next;
      if (token && !token.startsWith("creation:")) update(result);
      else setLocal(result);
    },
  ];
}
export function completePlanningDraft(viewer: string | null, token?: string) {
  if (token?.startsWith("creation:")) {
    if (draftFields(viewer, token)) {
      creationDrafts.delete(token);
      if (viewer)
        void import("./creationDraftStorage")
          .then((storage) => storage.deleteCreationSnapshot(viewer, token))
          .catch(() => {});
    }
    return;
  }
  if (!viewer || !token || token !== String(session(viewer).version)) return;
  const value = session(viewer);
  value.ids = [];
  value.fields.clear();
  value.version += 1;
  notify();
}

export async function saveCreationDraft(
  viewer: string | null,
  token: string | undefined,
  context?: Record<string, string>,
) {
  const fields = draftFields(viewer, token);
  const epoch = creationEpoch;
  if (!viewer || !token || !fields)
    throw new Error(
      "This draft is no longer active. Return to the account that started it.",
    );
  const draft = creationDrafts.get(token);
  if (draft && context) draft.context = context;
  const { writeCreationSnapshot } = await import("./creationDraftStorage");
  if (creationEpoch !== epoch || draftFields(viewer, token) !== fields)
    throw new Error("This draft changed accounts before saving.");
  await writeCreationSnapshot({
    version: 1,
    viewer,
    token: token.startsWith("creation:") ? token : `creation:planning-${token}`,
    updatedAt: Date.now(),
    context: context ?? draft?.context ?? {},
    fields: Object.fromEntries(fields),
  });
  if (creationAccount !== viewer || creationEpoch !== epoch)
    throw new Error(
      "Your account changed while saving. Return to the original account.",
    );
}

export async function restoreCreationDraft(viewer: string, token: string) {
  setCreationDraftAccount(viewer);
  const epoch = creationEpoch;
  const { readCreationSnapshot } = await import("./creationDraftStorage");
  const snapshot = await readCreationSnapshot(viewer, token);
  if (creationAccount !== viewer || creationEpoch !== epoch)
    throw new Error("Your account changed while restoring this draft.");
  creationDrafts.set(token, {
    viewer,
    fields: new Map(Object.entries(snapshot.fields)),
    context: snapshot.context,
  });
  return snapshot.context;
}

export function setCreationDraftField(
  viewer: string | null,
  token: string | undefined,
  field: string,
  value: unknown,
) {
  const fields = draftFields(viewer, token);
  if (!fields) throw new Error("This draft is no longer active.");
  fields.set(field, value);
}

/** Live account-scoped fields; explicit checkpoints serialize them for restart recovery. */
export function usePlanningDraftState<T>(
  viewer: string | null,
  token: string | undefined,
  field: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const active = !!draftFields(viewer, token);
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
        draftFields(viewer, token)?.set(field, result);
        return result;
      });
    },
    [field, token, viewer],
  );
  return [value, set];
}
