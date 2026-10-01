import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { defaultWidgetPreferences, type WidgetPreferences } from "./types";
import {
  readWidgetPreferences,
  saveWidgetPreferences,
} from "./preferencesStorage";

type WidgetPreferencesContextValue = {
  preferences: WidgetPreferences;
  ready: boolean;
  error: string;
  updatePreferences: (patch: Partial<WidgetPreferences>) => void;
};
const Context = createContext<WidgetPreferencesContextValue | null>(null);
type PreferencesState = {
  accountId: string | null;
  preferences: WidgetPreferences;
  ready: boolean;
  error: string;
};

export function WidgetPreferencesProvider({
  accountId,
  children,
}: {
  accountId: string | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<PreferencesState>(() => ({
    accountId,
    preferences: defaultWidgetPreferences(),
    ready: false,
    error: "",
  }));
  const current =
    state.accountId === accountId
      ? state
      : {
          accountId,
          preferences: defaultWidgetPreferences(),
          ready: false,
          error: "",
        };
  const { preferences, ready, error } = current;
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void readWidgetPreferences(accountId).then((saved) => {
      if (!active) return;
      setState({ accountId, preferences: saved, ready: true, error: "" });
    });
    return () => {
      active = false;
    };
  }, [accountId]);

  const updatePreferences = useCallback(
    (patch: Partial<WidgetPreferences>) => {
      const next = {
        ...preferences,
        ...patch,
        circles: patch.circles ?? preferences.circles,
      };
      setState({ accountId, preferences: next, ready: true, error: "" });
      if (!accountId) return;
      writes.current = writes.current.then(async () => {
        try {
          await saveWidgetPreferences(accountId, next);
        } catch {
          setState((previous) =>
            previous.accountId === accountId
              ? {
                  ...previous,
                  error:
                    "These widget settings could not be saved on this device.",
                }
              : previous,
          );
        }
      });
    },
    [accountId, preferences],
  );

  return (
    <Context.Provider value={{ preferences, ready, error, updatePreferences }}>
      {children}
    </Context.Provider>
  );
}

export function useWidgetPreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("WidgetPreferencesProvider required");
  return value;
}
