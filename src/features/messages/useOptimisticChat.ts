import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  OptimisticChatQueue,
  type CanonicalChatMessage,
} from "./optimisticQueue";

export function useOptimisticChat({
  scope,
  authorId,
  canonical,
  canWrite,
  send,
}: {
  scope: string;
  authorId: string | null;
  canonical: CanonicalChatMessage[];
  canWrite: boolean;
  send: (body: string) => Promise<unknown>;
}) {
  const [queue] = useState(() => new OptimisticChatQueue());
  const snapshot = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    queue.getSnapshot,
  );
  const [draftState, setDraftState] = useState({ scope, body: "" });
  const [errorState, setErrorState] = useState({ scope, text: "" });
  if (draftState.scope !== scope) {
    setDraftState({ scope, body: "" });
    setErrorState({ scope, text: "" });
  }
  const latest = useRef({ scope, authorId, canonical, canWrite, send });
  useLayoutEffect(() => {
    latest.current = { scope, authorId, canonical, canWrite, send };
    if (queue.scope !== scope) queue.reset(scope);
    queue.observe(canonical);
  }, [scope, authorId, canonical, canWrite, send, queue]);
  const draft = draftState.scope === scope ? draftState.body : "";
  const setDraft = (body: string) => setDraftState({ scope, body });
  useEffect(() => {
    if (queue.scope !== latest.current.scope) queue.reset(latest.current.scope);
    return () => {
      latest.current = { ...latest.current, scope: "unmounted" };
      queue.reset("unmounted");
    };
  }, [queue]);

  async function submit(retryId?: string) {
    const current = latest.current;
    if (!current.canWrite || !current.authorId) {
      setErrorState({
        scope: current.scope,
        text: "This chat is read-only or unavailable.",
      });
      return;
    }
    const token = retryId
      ? queue.retry(retryId, current.canonical)
      : queue.begin(draft, current.authorId, current.canonical);
    if (!token) return;
    const row = queue.rows.find((item) => item.id === token.id)!;
    const submittedBody = row.body;
    setErrorState({ scope: current.scope, text: "" });
    try {
      const result = await current.send(submittedBody);
      if (!queue.isCurrentAttempt(token)) return;
      const id =
        result &&
        typeof result === "object" &&
        "id" in result &&
        typeof result.id === "string"
          ? result.id
          : undefined;
      const createdAt =
        result &&
        typeof result === "object" &&
        "created_at" in result &&
        typeof result.created_at === "string"
          ? result.created_at
          : undefined;
      queue.complete(token, id, createdAt);
      if (latest.current.scope === token.scope) {
        queue.observe(latest.current.canonical);
        setDraftState((previous) =>
          previous.scope === token.scope &&
          previous.body.trim() === submittedBody
            ? { scope: token.scope, body: "" }
            : previous,
        );
      }
    } catch (error) {
      if (!queue.isCurrentAttempt(token)) return;
      queue.fail(
        token,
        error instanceof Error ? error.message : "Message could not be sent.",
      );
      if (latest.current.scope === token.scope)
        queue.observe(latest.current.canonical);
    }
  }
  return {
    draft,
    setDraft,
    submit,
    rows: snapshot.scope === scope ? snapshot.rows : [],
    busy: snapshot.scope === scope && snapshot.busy,
    error: errorState.scope === scope ? errorState.text : "",
  };
}
