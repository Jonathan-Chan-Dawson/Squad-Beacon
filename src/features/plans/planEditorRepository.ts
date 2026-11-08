import type { PlanEditorDraft } from "./planEditorModel";
export function planDraftKey(viewer: string, demo: boolean, token: string) {
  return `beacon.plan-editor.v1:${demo ? "demo" : "live"}:${viewer}:${token}`;
}

export function createPlanEditorRepository(io: {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}) {
  const queues = new Map<string, Promise<unknown>>();
  const memory = new Map<string, PlanEditorDraft>();
  function cachedPlanDraft(key: string) {
    return memory.get(key);
  }
  async function readPlanDraft(key: string): Promise<PlanEditorDraft | null> {
    await queues.get(key);
    if (memory.has(key)) return structuredClone(memory.get(key)!);
    const manifest = await io.read(key);
    if (!manifest) return null;
    const { generation, count } = JSON.parse(manifest);
    if (
      typeof generation !== "string" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 150
    )
      throw new Error("This Plan draft could not be restored.");
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        io.read(`${key}:${generation}:${i}`),
      ),
    );
    if (parts.some((p) => p === null))
      throw new Error(
        "This Plan draft is incomplete. Your saved Plan is unchanged.",
      );
    const draft = JSON.parse(parts.join("")) as PlanEditorDraft;
    if (draft.version !== 1 || !Array.isArray(draft.stops))
      throw new Error("This Plan draft needs a newer app.");
    memory.set(key, draft);
    return structuredClone(draft);
  }
  function writePlanDraft(key: string, draft: PlanEditorDraft): Promise<void> {
    memory.set(key, structuredClone(draft));
    const operation = (queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const value = JSON.stringify(draft);
        if (value.length > 250000)
          throw new Error(
            "This Plan draft is too large to save on this device.",
          );
        const old = JSON.parse((await io.read(key)) ?? "null") as {
          generation: string;
          count: number;
        } | null;
        const generation = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const count = Math.max(1, Math.ceil(value.length / 1800));
        for (let i = 0; i < count; i++)
          await io.write(
            `${key}:${generation}:${i}`,
            value.slice(i * 1800, (i + 1) * 1800),
          );
        await io.write(key, JSON.stringify({ generation, count }));
        if (old)
          for (let i = 0; i < old.count; i++)
            await io.remove(`${key}:${old.generation}:${i}`).catch(() => {});
      });
    queues.set(key, operation);
    return operation;
  }
  async function deletePlanDraft(key: string) {
    await queues.get(key)?.catch(() => {});
    const old = JSON.parse((await io.read(key)) ?? "null");
    await io.remove(key);
    memory.delete(key);
    if (old)
      for (let i = 0; i < old.count; i++)
        await io.remove(`${key}:${old.generation}:${i}`);
  }

  return { cachedPlanDraft, readPlanDraft, writePlanDraft, deletePlanDraft };
}
