import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
} from "react";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { usePreferences } from "./preferences";
import { useReducedMotion } from "./design-system";

const Bars = createContext({
  hidden: false,
  setHidden: (_id: string, _hidden: boolean) => {},
});

export function SystemBarsProvider({ children }: React.PropsWithChildren) {
  const [requests, setRequests] = useState<Set<string>>(() => new Set());
  const setHidden = useCallback(
    (id: string, hidden: boolean) =>
      setRequests((previous) => {
        const next = new Set(previous);
        if (hidden) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  return (
    <Bars.Provider value={{ hidden: requests.size > 0, setHidden }}>
      {children}
    </Bars.Provider>
  );
}

/** Opt in only while an immersive screen is focused; never changes system navigation. */
export function useImmersiveStatusBar(hidden = false) {
  const id = useId();
  const { setHidden } = useContext(Bars);
  useFocusEffect(
    useCallback(() => {
      if (hidden) setHidden(id, true);
      return () => {
        if (hidden) setHidden(id, false);
      };
    }, [hidden, id, setHidden]),
  );
}

export const useSystemBars = () => useContext(Bars);

export function AppSystemBars() {
  const { resolvedAppearance } = usePreferences();
  const { hidden } = useSystemBars();
  const reduced = useReducedMotion();
  return (
    <StatusBar
      style={resolvedAppearance === "dark" ? "light" : "dark"}
      hidden={hidden}
      animated={!reduced}
    />
  );
}

/** Mount only for an explicitly immersive route or presentation. */
export function ImmersiveStatusBar() {
  useImmersiveStatusBar(true);
  return null;
}
