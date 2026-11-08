import { useEffect, useRef, useState } from "react";
import { draftStorageIO } from "./creationDraftStorage";
import { decodeFocus, type PersistedFocus } from "./focusTimer";
import { randomUUID } from "expo-crypto";
import { splitCreationStorageText } from "./draftSnapshot";
const queues = new Map<string, Promise<void>>();
type Pointer = { generation: string; chunks: number };
function pointer(raw: string | null): Pointer | null {
  try {
    const p = JSON.parse(raw ?? "null") as Pointer;
    return p &&
      /^[\w-]+$/.test(p.generation) &&
      Number.isInteger(p.chunks) &&
      p.chunks > 0 &&
      p.chunks <= 32
      ? p
      : null;
  } catch {
    return null;
  }
}
async function readFocus(key: string) {
  await queues.get(key)?.catch(() => undefined);
  const raw = await draftStorageIO.read(key),
    p = pointer(raw);
  if (!p) return raw;
  let value = "";
  for (let i = 0; i < p.chunks; i++) {
    const part = await draftStorageIO.read(`${key}.${p.generation}.${i}`);
    if (part === null) return null;
    value += part;
  }
  return value;
}
async function writeFocus(key: string, value: string) {
  const prior = pointer(await draftStorageIO.read(key)),
    generation = randomUUID(),
    parts = splitCreationStorageText(value);
  for (let i = 0; i < parts.length; i++)
    await draftStorageIO.write(`${key}.${generation}.${i}`, parts[i]);
  await draftStorageIO.write(
    key,
    JSON.stringify({ generation, chunks: parts.length }),
  );
  if (prior)
    for (let i = 0; i < prior.chunks; i++)
      await draftStorageIO
        .remove(`${key}.${prior.generation}.${i}`)
        .catch(() => undefined);
}
export function useFocusPersistence(
  key: string,
  value: PersistedFocus,
  restore: (s: PersistedFocus) => void,
) {
  const [ready, setReady] = useState("");
  const callback = useRef(restore);
  useEffect(() => {
    callback.current = restore;
  }, [restore]);
  useEffect(() => {
    let alive = true;
    void readFocus(key)
      .then((raw) => {
        if (!alive) return;
        const stored = decodeFocus(raw);
        if (stored) callback.current(stored);
        setReady(key);
      })
      .catch(() => {
        if (alive) setReady(key);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  const encoded = JSON.stringify({
    ...value,
    timer: {
      ...value.timer,
      remainingSeconds:
        value.timer.phase === "running"
          ? value.timer.durationSeconds
          : value.timer.remainingSeconds,
    },
  });
  useEffect(() => {
    if (ready !== key) return;
    const pending = (queues.get(key) ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => writeFocus(key, encoded));
    queues.set(key, pending);
    void pending.catch(() => undefined);
  }, [key, ready, encoded]);
  return ready === key;
}
