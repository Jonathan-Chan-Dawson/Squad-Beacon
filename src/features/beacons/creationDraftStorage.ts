import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import {
  parseCreationSnapshot,
  splitCreationStorageText,
  type CreationSnapshot,
} from "./draftSnapshot";

const queues = new Map<string, Promise<unknown>>();
const prefix = (viewer: string) =>
  `beacon.creation.${Array.from(viewer)
    .map((c) => c.codePointAt(0)!.toString(16))
    .join("-")}`;
const read = (key: string) =>
  Platform.OS === "web"
    ? Promise.resolve(
        typeof localStorage === "undefined" ? null : localStorage.getItem(key),
      )
    : SecureStore.getItemAsync(key);
const write = (key: string, value: string) =>
  Platform.OS === "web"
    ? Promise.resolve().then(() => {
        if (typeof localStorage === "undefined")
          throw new Error("Draft storage is unavailable.");
        localStorage.setItem(key, value);
      })
    : SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
const remove = (key: string) =>
  Platform.OS === "web"
    ? Promise.resolve().then(() => localStorage.removeItem(key))
    : SecureStore.deleteItemAsync(key);
type Manifest = {
  token: string;
  generation: string;
  chunks: number;
  title: string;
  updatedAt: number;
};
type IndexPointer = { generation: string; chunks: number };
async function readIndex(viewer: string) {
  const key = `${prefix(viewer)}.index`;
  const raw = await read(key);
  if (!raw || raw.startsWith("[")) return raw;
  const pointer = JSON.parse(raw) as IndexPointer;
  if (
    !/^[\w-]+$/.test(pointer.generation) ||
    !Number.isInteger(pointer.chunks) ||
    pointer.chunks < 1 ||
    pointer.chunks > 700
  )
    throw new Error("Saved draft index could not be verified.");
  let result = "";
  for (let i = 0; i < pointer.chunks; i++) {
    const part = await read(`${key}.${pointer.generation}.${i}`);
    if (part === null) throw new Error("Saved draft index is incomplete.");
    result += part;
  }
  return result;
}
async function writeIndex(viewer: string, rows: Manifest[]) {
  const key = `${prefix(viewer)}.index`,
    raw = JSON.stringify(rows);
  const prior = await read(key);
  const generation = randomUUID(),
    parts = splitCreationStorageText(raw),
    chunks = parts.length;
  for (let i = 0; i < chunks; i++)
    await write(`${key}.${generation}.${i}`, parts[i]);
  await write(key, JSON.stringify({ generation, chunks }));
  if (prior && !prior.startsWith("[")) {
    const old = JSON.parse(prior) as IndexPointer;
    for (let i = 0; i < old.chunks; i++)
      await remove(`${key}.${old.generation}.${i}`).catch(() => {});
  }
}
async function index(viewer: string): Promise<Manifest[]> {
  const raw = await readIndex(viewer);
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  if (
    !Array.isArray(rows) ||
    rows.length > 100 ||
    rows.some(
      (row) =>
        !row ||
        typeof row.token !== "string" ||
        !/^creation:[\w-]+$/.test(row.token) ||
        typeof row.generation !== "string" ||
        !/^[\w-]+$/.test(row.generation) ||
        !Number.isInteger(row.chunks) ||
        row.chunks < 1 ||
        row.chunks > 700 ||
        typeof row.title !== "string" ||
        !Number.isFinite(row.updatedAt),
    )
  )
    throw new Error("Saved draft index could not be read.");
  return rows;
}
function serialized<T>(viewer: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(viewer) ?? Promise.resolve())
    .catch(() => {})
    .then(task);
  queues.set(viewer, next);
  return next;
}
export async function listSavedCreationDrafts(viewer: string) {
  await queues.get(viewer)?.catch(() => {});
  const rows = (await index(viewer)).sort((a, b) => b.updatedAt - a.updatedAt);
  // Verify the offered continuation without erasing corrupt or pending recovery data.
  if (rows[0]) await readCreationSnapshot(viewer, rows[0].token);
  return rows;
}
export function writeCreationSnapshot(snapshot: CreationSnapshot) {
  const raw = JSON.stringify(snapshot);
  parseCreationSnapshot(raw, snapshot.viewer);
  return serialized(snapshot.viewer, async () => {
    const rows = await index(snapshot.viewer);
    if (rows.length >= 100 && !rows.some((row) => row.token === snapshot.token))
      throw new Error(
        "Draft storage is full. Continue an existing draft before saving another.",
      );
    const generation = randomUUID();
    const parts = splitCreationStorageText(raw),
      chunks = parts.length;
    const base = `${prefix(snapshot.viewer)}.${generation}`;
    for (let i = 0; i < chunks; i++) await write(`${base}.${i}`, parts[i]);
    const previous = rows.find((row) => row.token === snapshot.token);
    const updated = [
      {
        token: snapshot.token,
        generation,
        chunks,
        title: Array.from(String(snapshot.fields.title || "Untitled Beacon"))
          .slice(0, 120)
          .join(""),
        updatedAt: snapshot.updatedAt,
      },
      ...rows.filter((row) => row.token !== snapshot.token),
    ];
    await writeIndex(snapshot.viewer, updated);
    if (previous)
      for (let i = 0; i < previous.chunks; i++)
        await remove(
          `${prefix(snapshot.viewer)}.${previous.generation}.${i}`,
        ).catch(() => {});
  });
}
export async function readCreationSnapshot(viewer: string, token: string) {
  const row = (await index(viewer)).find((item) => item.token === token);
  if (!row) throw new Error("This draft is no longer available.");
  let raw = "";
  for (let i = 0; i < row.chunks; i++) {
    const chunk = await read(`${prefix(viewer)}.${row.generation}.${i}`);
    if (chunk == null)
      throw new Error("This draft could not be fully restored.");
    raw += chunk;
  }
  const snapshot = parseCreationSnapshot(raw, viewer);
  if (snapshot.token !== token)
    throw new Error("This draft could not be verified.");
  return snapshot;
}
export function deleteCreationSnapshot(viewer: string, token: string) {
  return serialized(viewer, async () => {
    const rows = await index(viewer),
      previous = rows.find((row) => row.token === token);
    await writeIndex(
      viewer,
      rows.filter((row) => row.token !== token),
    );
    if (previous)
      for (let i = 0; i < previous.chunks; i++)
        await remove(`${prefix(viewer)}.${previous.generation}.${i}`).catch(
          () => {},
        );
  });
}
