const pending = new Set<string>();

/** Shared across compact controls and expanded preferences for the same account/thread. */
export async function submitPlanning<T>(
  viewer: string | null,
  threadId: string,
  submit: () => Promise<T>,
): Promise<T> {
  const key = `${viewer}:${threadId}`;
  if (pending.has(key))
    throw new Error("A response is already saving. Wait for it to finish.");
  pending.add(key);
  try {
    return await submit();
  } finally {
    pending.delete(key);
  }
}
