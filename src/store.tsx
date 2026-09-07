import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import type { Session } from "@supabase/supabase-js";
import { supabase, rpc, clearPendingRequests } from "./supabase";
import { DEMO_ID, demoAction, makeDemo } from "./demo";
import { Data, Payload, emptyData } from "./types";
import { clearPush, stopDeviceLocation } from "./device";
type Store = {
  data: Data;
  userId: string | null;
  demo: boolean;
  loading: boolean;
  error: string | null;
  session: Session | null;
  refresh: () => Promise<void>;
  act: (action: string, payload?: Payload) => Promise<Record<string, unknown>>;
  startDemo: () => void;
  signOut: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function BeaconProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(emptyData),
    [demo, setDemo] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(!!supabase),
    [error, setError] = useState<string | null>(null);
  const epoch = useRef(0),
    fetchId = useRef(0);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      if (error) setError(error.message);
      setLoading(!!data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        epoch.current++;
        setData(emptyData());
        if (event === "SIGNED_OUT") clearPendingRequests();
      }
      setSession(next);
      setDemo(false);
      if (event === "SIGNED_IN") setLoading(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    if (demo || !session || !supabase) return;
    const generation = epoch.current,
      sequence = ++fetchId.current;
    const [{ data: next, error: failure }, { data: recipients }] =
      await Promise.all([
        supabase.rpc("beacon_snapshot"),
        supabase.rpc("beacon_location_recipients"),
      ]);
    if (generation !== epoch.current || sequence !== fetchId.current) return;
    if (failure) {
      setData(emptyData());
      setError(failure.message);
    } else {
      setData({
        ...emptyData(),
        ...next,
        location_recipients: recipients ?? [],
      });
      setError(null);
    }
    setLoading(false);
  }, [session, demo]);
  useEffect(() => {
    if (demo || !session || !supabase) return;
    // Refresh crosses an async database boundary; state changes happen after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === "active" || AppState.currentState == null)
        void refresh();
    }, 15000);
    const channel = supabase
      .channel("inbox-" + session.user.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notices",
          filter: "recipient_id=eq." + session.user.id,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    const listener = AppState.addEventListener("change", (state) => {
      epoch.current++;
      setData(emptyData());
      setLoading(true);
      clearPendingRequests();
      if (state === "active") {
        supabase!.auth.startAutoRefresh();
        void refresh();
      } else supabase!.auth.stopAutoRefresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
      void supabase!.removeChannel(channel);
    };
  }, [session, demo, refresh]);
  const act = useCallback(
    async (action: string, payload: Payload = {}) => {
      if (demo) {
        const next = demoAction(data, action, payload);
        setData(next);
        return {};
      }
      if (!session) throw new Error("Sign in to continue.");
      const network = await Network.getNetworkStateAsync();
      if (
        network.isConnected === false ||
        network.isInternetReachable === false
      )
        throw new Error("Reconnect to save changes. Nothing was queued.");
      const generation = epoch.current;
      const result = await rpc(action, payload);
      if (generation === epoch.current) await refresh();
      return result;
    },
    [demo, session, refresh, data],
  );
  async function signOut() {
    if (!demo && session) {
      await rpc("stop_location");
      await stopDeviceLocation();
      await clearPush();
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
    }
    epoch.current++;
    clearPendingRequests();
    setDemo(false);
    setSession(null);
    setData(emptyData());
    setError(null);
  }
  return (
    <Context.Provider
      value={{
        data,
        userId: demo ? DEMO_ID : (session?.user.id ?? null),
        demo,
        session,
        loading,
        error,
        refresh,
        act,
        startDemo: () => {
          epoch.current++;
          setDemo(true);
          setData(makeDemo());
          setLoading(false);
          setError(null);
        },
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useBeacon() {
  const value = useContext(Context);
  if (!value) throw new Error("BeaconProvider required");
  return value;
}
