import React, { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { ConfirmDialog } from "@/src/shared/Dialogs";

/** Local protection only: no writes, account state, or durable draft storage. */
export function useDraftProtection(
  dirty: boolean,
  discard: () => void,
  busy = false,
) {
  const navigation = useNavigation();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [allowed, setAllowed] = useState(false);
  const discarded = useRef(false);
  const removing = useRef(false);
  usePreventRemove(dirty && !allowed, ({ data }) => {
    removing.current = true;
    if (!busy) setPending(() => () => navigation.dispatch(data.action));
  });
  useEffect(() => {
    if (allowed && pending) pending();
  }, [allowed, pending]);
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty || typeof window === "undefined")
      return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const close = (next: () => void) => {
    if (busy) return;
    if (dirty) {
      removing.current = false;
      discarded.current = false;
      setPending(() => next);
    } else next();
  };
  return {
    close,
    dialog: (
      <ConfirmDialog
        title="Discard unsaved changes?"
        message="Your saved Plan stays available. These edits have not been saved."
        visible={!!pending && !allowed}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        closeOnConfirm={false}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (discarded.current) return;
          discarded.current = true;
          discard();
          // Let usePreventRemove observe the new state before replaying navigation.
          if (removing.current) setAllowed(true);
          else {
            pending?.();
            setPending(null);
            discarded.current = false;
          }
        }}
      />
    ),
  };
}
