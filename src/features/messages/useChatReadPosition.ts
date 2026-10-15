import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import {
  afterReadMarker,
  compareChatMessages,
  type ChatReadMarker,
} from "./readMarkers";
import type { CanonicalChatMessage } from "./optimisticQueue";

export function useChatReadPosition({
  scopeKey,
  canonical,
  marker,
  action,
  payload,
  enabled,
}: {
  scopeKey: string;
  canonical: CanonicalChatMessage[];
  marker?: ChatReadMarker;
  action: string;
  payload: Record<string, string | undefined>;
  enabled: boolean;
}) {
  const { act, userId } = useBeacon();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const requested = useRef("");
  const latest = canonical.reduce<CanonicalChatMessage | undefined>(
    (last, row) => (!last || compareChatMessages(last, row) < 0 ? row : last),
    undefined,
  );
  const unread = canonical
    .filter(
      (row) =>
        row.authorId !== userId &&
        afterReadMarker({ id: row.id, created_at: row.createdAt }, marker),
    )
    .reduce<CanonicalChatMessage | undefined>(
      (first, row) =>
        !first || compareChatMessages(first, row) > 0 ? row : first,
      undefined,
    );
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      requested.current = scopeKey;
      return () => setFocused(false);
    }, [scopeKey]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  const args = useRef({ act, payload });
  useEffect(() => {
    args.current = { act, payload };
  }, [act, payload]);
  useEffect(() => {
    if (
      !enabled ||
      !focused ||
      !active ||
      !latest ||
      visibleId !== latest.id ||
      !afterReadMarker({ id: latest.id, created_at: latest.createdAt }, marker)
    )
      return;
    const identity = `${scopeKey}:${latest.id}`;
    if (requested.current === identity) return;
    requested.current = identity;
    void args.current
      .act(action, { ...args.current.payload, message_id: latest.id })
      .catch(() => {
        if (requested.current === identity) requested.current = "";
      });
  }, [enabled, focused, active, latest, visibleId, scopeKey, marker, action]);
  return { firstUnreadId: unread?.id, onLatestVisible: setVisibleId };
}
