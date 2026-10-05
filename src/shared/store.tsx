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
import { supabase, rpc, clearPendingRequests } from "@/src/shared/supabase";
import { DEMO_ID, demoAction, makeDemo } from "@/src/shared/demo";
import { Data, Payload, emptyData, normalizeData } from "@/src/shared/types";
import { clearPush, stopDeviceLocation } from "@/src/platform/device";
import {
  normalizeSocialDirectoryQuery,
  searchSocialDirectoryInData,
  type SocialDirectoryQuery,
} from "@/src/features/social/directory";
import {
  parseSocialDirectoryRows,
  type SocialDirectorySummary,
} from "@/src/features/social/types";
type Store = {
  data: Data;
  userId: string | null;
  demo: boolean;
  loading: boolean;
  error: string | null;
  session: Session | null;
  refresh: () => Promise<void>;
  act: (action: string, payload?: Payload) => Promise<Record<string, unknown>>;
  searchDirectory: (input: SocialDirectoryQuery) => Promise<SocialDirectorySummary[]>;
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
        ...normalizeData(next),
        viewer_id: session.user.id,
        location_recipients: recipients ?? [],
      });
      setError(null);
    }
    setLoading(false);
  }, [session, demo]);
  const searchDirectory = useCallback(async (input: SocialDirectoryQuery) => {
    const query = normalizeSocialDirectoryQuery(input);
    if (!query) return [];
    if (demo) return searchSocialDirectoryInData(data, DEMO_ID, query);
    if (!session || !supabase || data.viewer_id !== session.user.id) return [];
    const viewerId = session.user.id;
    const generation = epoch.current;
    const { data: rows, error: failure } = await supabase.rpc("social_directory_search", {
      p_query: query.query,
      p_entity_type: query.entityType ?? "all",
      p_page_size: query.pageSize ?? 20,
      p_page_offset: query.pageOffset ?? 0,
      p_parent_type: query.parentType ?? null,
      p_parent_id: query.parentId ?? null,
    });
    const { data: currentAuth } = await supabase.auth.getSession();
    if (
      generation !== epoch.current ||
      currentAuth.session?.user.id !== viewerId ||
      !session || session.user.id !== viewerId
    ) return [];
    if (failure) throw new Error(failure.message);
    return parseSocialDirectoryRows(rows);
  }, [data, demo, session]);
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_messages",
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
        if (action === "create_space") {
          const space = next.spaces.find(
            (item) => !data.spaces.some((old) => old.id === item.id),
          );
          return space ? { id: space.id, space_id: space.id } : {};
        }
        if (action === "create_space_from_squads") {
          const space = next.spaces.find((item) => !data.spaces.some((old) => old.id === item.id));
          return space ? { id: space.id, space_id: space.id, linked_squad_count: next.space_squads.filter((row) => row.space_id === space.id).length } : {};
        }
        if (action === "organize_squad_into_space") {
          const space = next.spaces.find((item) => !data.spaces.some((old) => old.id === item.id));
          if (!space) return {};
          const sourceSquadId = String(payload.squad_id ?? "");
          return {
            id: space.id,
            space_id: space.id,
            source_squad_id: sourceSquadId,
            copied_member_count: next.space_members.filter((row) => row.space_id === space.id && row.user_id !== space.owner_id).length,
            skipped_member_count: Math.max(0, data.squad_members.filter((row) => row.squad_id === sourceSquadId && row.user_id !== space.owner_id).length - next.space_members.filter((row) => row.space_id === space.id && row.user_id !== space.owner_id).length),
          };
        }
        if (action === "create_organization") {
          const organization = next.organizations.find(
            (item) => !data.organizations.some((old) => old.id === item.id),
          );
          return organization
            ? { id: organization.id, organization_id: organization.id }
            : {};
        }
        if (action === "create_activity") {
          const activity = next.activities.find(
            (item) => !data.activities.some((old) => old.id === item.id),
          );
          return activity ? { id: activity.id } : {};
        }
        if (action === "create_plan" || action === "run_routine_once") {
          const plan = next.plans.find(
            (item) => !data.plans.some((old) => old.id === item.id),
          );
          return plan
            ? { id: plan.id, plan_id: plan.id, occurrence_plan_id: plan.id }
            : {};
        }
        if (action === "create_routine") {
          const routine = next.plan_routines.find(
            (item) => !data.plan_routines.some((old) => old.id === item.id),
          );
          return routine
            ? {
                id: routine.id,
                plan_id: routine.plan_id,
                next_occurrence_on: routine.next_occurrence_on,
              }
            : {};
        }
        if (action === "send_group_message") {
          const message = next.group_messages.find(
            (item) => !data.group_messages.some((old) => old.id === item.id),
          );
          return message
            ? {
                id: message.id,
                scope: message.scope,
                organization_id: message.organization_id,
                squad_id: message.squad_id,
                created_at: message.created_at,
              }
            : {};
        }
        if (action === "mark_group_chat_read") {
          const scope = payload.scope;
          const row = next.group_message_reads.find(
            (item) =>
              item.user_id === next.viewer_id &&
              item.scope === scope &&
              (scope === "organization"
                ? item.organization_id === payload.organization_id
                : item.squad_id === payload.squad_id),
          );
          return row
            ? {
                scope: row.scope,
                organization_id: row.organization_id,
                squad_id: row.squad_id,
                read_at: row.last_read_at,
              }
            : {};
        }
        if (action === "create_planning_thread") {
          const thread =
            next.planning_threads.find((item) => item.id === payload.id) ??
            next.planning_threads.find(
              (item) =>
                !data.planning_threads.some((old) => old.id === item.id),
            );
          return thread ? { id: thread.id, status: thread.status } : {};
        }
        if (action === "convert_planning_ping") {
          const thread = next.planning_threads.find(
            (item) => item.id === payload.thread_id,
          );
          return thread?.materialized_activity_id
            ? {
                id: thread.materialized_activity_id,
                activity_id: thread.materialized_activity_id,
                status: thread.status,
              }
            : {};
        }
        if (action === "add_council_proposal") {
          const proposal =
            next.planning_proposals.find((item) => item.id === payload.id) ??
            next.planning_proposals.find(
              (item) =>
                !data.planning_proposals.some((old) => old.id === item.id),
            );
          return proposal
            ? { id: proposal.id, thread_id: proposal.thread_id }
            : {};
        }
        if (
          action === "resolve_planning_thread" ||
          action === "replace_council_winner"
        ) {
          const thread = next.planning_threads.find(
            (item) => item.id === payload.thread_id,
          );
          return {
            id: thread?.materialized_activity_id ?? null,
            activity_id: thread?.materialized_activity_id ?? null,
            status: thread?.status,
            winner_proposal_id: thread?.winner_proposal_id ?? null,
          };
        }
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
        searchDirectory,
        startDemo: () => {
          epoch.current++;
          setDemo(true);
          setData(normalizeData(makeDemo()));
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
