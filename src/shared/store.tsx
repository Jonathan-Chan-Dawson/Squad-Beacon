import { randomUUID } from "expo-crypto";
import { demoRoutineCalendar, parseRoutineCalendarResult, validateRoutineCalendarRange, type RoutineCalendarRange, type RoutineCalendarResult } from "@/src/features/beacons/calendarRoutineProjection";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { normalizeProfileQuery, parseProfileContentPage, profilePermissionKey, selectProfileContent, type ProfileContentQuery, type ProfileContentPage } from "@/src/features/profile/profileContent";
import * as Network from "expo-network";
import type { Session } from "@supabase/supabase-js";
import { supabase, rpc, clearPendingRequests } from "@/src/shared/supabase";
import { DEMO_ID, demoAction, makeDemo } from "@/src/shared/demo";
import {
  normalizeActivityHistoryQuery,
  parseActivityHistoryPage,
  searchActivityHistoryInData,
  type ActivityHistoryPage,
  type ActivityHistoryQuery,
} from "@/src/features/beacons/activityHistory";
import {
  Data,
  Payload,
  emptyData,
  normalizeData,
  type Profile,
} from "@/src/shared/types";
import { clearPush, stopDeviceLocation } from "@/src/platform/device";
import {
  normalizeSocialDirectoryQuery,
  getCommunitySummary,
  parseCommunityProfileSummary,
  searchSocialDirectoryInData,
  type SocialDirectoryQuery,
} from "@/src/features/social/directory";
import {
  parseSocialDirectoryRows,
  type SocialDirectorySummary,
  type SocialEntityType,
} from "@/src/features/social/types";
type Store = {
  data: Data;
  userId: string | null;
  demo: boolean;
  loading: boolean;
  error: string | null;
  session: Session | null;
  refresh: () => Promise<void>;
  getCurrentProfile: () => Profile | null;
  getViewerEpoch: () => number;
  viewerEpoch: number;
  act: (action: string, payload?: Payload, requestId?: string) => Promise<Record<string, unknown>>;
  loadRoutineCalendar: (range: RoutineCalendarRange) => Promise<RoutineCalendarResult>;
  searchDirectory: (
    input: SocialDirectoryQuery,
  ) => Promise<SocialDirectorySummary[]>;
  loadCommunitySummary: (
    type: SocialEntityType,
    id: string,
  ) => Promise<SocialDirectorySummary | null>;
  loadActivityHistory: (input?: ActivityHistoryQuery) => Promise<ActivityHistoryPage>;
  loadProfileContent: (input: ProfileContentQuery) => Promise<ProfileContentPage>;
  startDemo: () => void;
  signOut: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function BeaconProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<Data>(emptyData),
    [demo, setDemo] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(!!supabase),
    [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  const demoRequests = useRef(new Map<string, Record<string, unknown>>());
  const setData = useCallback((next: Data) => {
    // Sequential actions can reuse a callback before React commits the next render.
    dataRef.current = next;
    setDataState(next);
  }, []);
  const getCurrentProfile = useCallback(() => {
    const viewer = demo ? DEMO_ID : (session?.user.id ?? null);
    const snapshot = dataRef.current;
    if (!viewer || snapshot.viewer_id !== viewer) return null;
    const profile = snapshot.profiles.find((person) => person.id === viewer);
    return profile ? structuredClone(profile) : null;
  }, [demo, session?.user.id]);
  const epoch = useRef(0),
    fetchId = useRef(0);
  const [viewerEpoch, setViewerEpoch] = useState(0);
  const viewerEpochRef = useRef(0);
  const getViewerEpoch = useCallback(() => viewerEpochRef.current, []);
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
        viewerEpochRef.current++;
        setViewerEpoch(viewerEpochRef.current);
        setData(emptyData());
        if (event === "SIGNED_OUT") clearPendingRequests();
      }
      setSession(next);
      setDemo(false);
      if (event === "SIGNED_IN") setLoading(true);
    });
    return () => subscription.unsubscribe();
  }, [setData]);
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
      if (next?.capabilities?.living_activity === true) {
        const result=await supabase.rpc("beacon_action",{action:"reconcile_current_activity",payload:{},request_id:randomUUID()});
        if (generation !== epoch.current || sequence !== fetchId.current) return;
        if (!result.error) {
          const updated=await supabase.rpc("beacon_snapshot");
          if (generation !== epoch.current || sequence !== fetchId.current) return;
          if (!updated.error) Object.assign(next,updated.data);
        }
      }
      setData({
        ...normalizeData(next),
        viewer_id: session.user.id,
        location_recipients: recipients ?? [],
      });
      setError(null);
    }
    setLoading(false);
  }, [session, demo, setData]);
  const loadRoutineCalendar = useCallback(async (input: RoutineCalendarRange) => {
    const range=validateRoutineCalendarRange(input);
    if (demo) return demoRoutineCalendar(dataRef.current,DEMO_ID,range,Date.now());
    if (!session || !supabase || dataRef.current.viewer_id!==session.user.id) throw new Error("Refresh your profile before loading Routine dates.");
    const viewer=session.user.id, generation=epoch.current;
    const {data: result,error: failure}=await supabase.rpc("calendar_routine_occurrences",{start_on:range.startOn,end_on:range.endOn});
    const {data: auth}=await supabase.auth.getSession();
    if (generation!==epoch.current || auth.session?.user.id!==viewer || dataRef.current.viewer_id!==viewer) throw new Error("Your calendar session changed. Refresh to continue.");
    if (failure) throw new Error(failure.code==="PGRST202" || failure.code==="42883" ? "Routine calendar needs a backend update; existing activities remain available." : failure.message);
    return parseRoutineCalendarResult(result,viewer,range);
  },[demo,session]);
  const searchDirectory = useCallback(
    async (input: SocialDirectoryQuery) => {
      const query = normalizeSocialDirectoryQuery(input);
      if (!query) return [];
      if (demo) return searchSocialDirectoryInData(data, DEMO_ID, query);
      if (!session || !supabase || data.viewer_id !== session.user.id)
        return [];
      const viewerId = session.user.id;
      const generation = epoch.current;
      const { data: rows, error: failure } = await supabase.rpc(
        "social_directory_search",
        {
          p_query: query.query,
          p_entity_type: query.entityType ?? "all",
          p_page_size: query.pageSize ?? 20,
          p_page_offset: query.pageOffset ?? 0,
          p_parent_type: query.parentType ?? null,
          p_parent_id: query.parentId ?? null,
        },
      );
      const { data: currentAuth } = await supabase.auth.getSession();
      if (
        generation !== epoch.current ||
        currentAuth.session?.user.id !== viewerId ||
        !session ||
        session.user.id !== viewerId
      )
        return [];
      if (failure) throw new Error(failure.message);
      return parseSocialDirectoryRows(rows);
    },
    [data, demo, session],
  );
  const loadCommunitySummary = useCallback(
    async (type: SocialEntityType, id: string) => {
      if (demo) return getCommunitySummary(type, id, dataRef.current, DEMO_ID);
      const snapshot = dataRef.current;
      if (!id || id.length > 100 || !session || !supabase || snapshot.viewer_id !== session.user.id)
        return null;
      const viewerId = session.user.id;
      const generation = epoch.current;
      const { data: rows, error: failure } = await supabase.rpc(
        "community_profile_summary",
        { p_entity_type: type, p_entity_id: id },
      );
      const { data: currentAuth } = await supabase.auth.getSession();
      if (
        generation !== epoch.current ||
        currentAuth.session?.user.id !== viewerId ||
        !session ||
        session.user.id !== viewerId ||
        dataRef.current.viewer_id !== viewerId ||
        dataRef.current !== snapshot
      )
        return null;
      if (failure) throw new Error(failure.message);
      return parseCommunityProfileSummary(rows, type, id);
    },
    [demo, session],
  );
  const loadActivityHistory = useCallback(async (input: ActivityHistoryQuery = {}) => {
    const query = normalizeActivityHistoryQuery(input);
    if (demo) return searchActivityHistoryInData(dataRef.current, DEMO_ID, query);
    if (!session || !supabase || dataRef.current.viewer_id !== session.user.id)
      throw new Error("Refresh your profile before loading activity history.");
    const viewer = session.user.id;
    const generation = epoch.current;
    const { data: result, error: failure } = await supabase.rpc("activity_history_page", {
      p_query: query.query || null,
      p_cursor: query.cursor,
      p_page_size: query.pageSize,
    });
    const { data: currentAuth } = await supabase.auth.getSession();
    if (
      generation !== epoch.current ||
      currentAuth.session?.user.id !== viewer ||
      !session ||
      session.user.id !== viewer ||
      dataRef.current.viewer_id !== viewer
    )
      throw new Error("Your activity history session changed. Refresh to continue.");
    if (failure) throw new Error(failure.message);
    return parseActivityHistoryPage(result);
  }, [demo, session]);
  const loadProfileContent = useCallback(
    async (input: ProfileContentQuery) => {
      const query = normalizeProfileQuery(input);
      const snapshot = dataRef.current;
      if (demo) return selectProfileContent(snapshot, DEMO_ID, query);
      if (!session || !supabase || snapshot.viewer_id !== session.user.id)
        throw new Error("Refresh your profile before loading experiences.");
      const viewer = session.user.id;
      const generation = epoch.current;
      const { data: result, error: failure } = await supabase.rpc(
        "profile_content_page",
        {
          p_person: query.personId,
          p_filter: query.filter,
          p_query: query.query || null,
          p_cursor: query.cursor,
          p_page_size: query.pageSize,
        },
      );
      const { data: auth } = await supabase.auth.getSession();
      if (
        generation !== epoch.current ||
        auth.session?.user.id !== viewer ||
        profilePermissionKey(dataRef.current) !== profilePermissionKey(snapshot)
      )
        throw new Error("Your profile access changed. Please retry.");
      if (failure) throw new Error(failure.message);
      return parseProfileContentPage(result);
    },
    [demo, session],
  );
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
  }, [session, demo, refresh, setData]);
  const act = useCallback(
    async (action: string, payload: Payload = {}, requestId?: string) => {
      if (demo) {
        const baseData = dataRef.current;
        if (baseData.viewer_id !== DEMO_ID)
          throw new Error(
            "The demo session ended. Open the demo again to continue.",
          );
        const atomic = action === "create_activity_with_invitees" || action === "create_plan_beacon_with_invitees";
        const requestKey = requestId ? `${DEMO_ID}:${action}:${requestId}` : "";
        if (requestKey && demoRequests.current.has(requestKey)) return demoRequests.current.get(requestKey)!;
        let next: Data;
        try { next = demoAction(baseData, action, payload); }
        catch (failure) {
          if ((atomic || action === "rsvp") && failure instanceof Error) Object.assign(failure,{definitive:true});
          throw failure;
        }
        setData(next);
        if (atomic) {
          const created=next.activities.find((item)=>!baseData.activities.some((previous)=>previous.id===item.id));
          const result={id:created?.id,event:action,committed:true,invited_ids:payload.invitee_ids};
          if (requestKey) demoRequests.current.set(requestKey,result);
          return result;
        }
        if (["save_activity_note","end_activity_note","update_presence","reconcile_current_activity"].includes(action)) {
          const note=next.activities.find(a => a.owner_id===DEMO_ID && a.solo_purpose==="activity_note" && (!baseData.activities.some(b => b.id===a.id) || a.id===payload.id));
          const result={event:action,id:note?.id ?? payload.id,committed:true};
          if(requestKey) demoRequests.current.set(requestKey,result);
          return result;
        }
        if (action === "save_status_note" || action === "clear_status_notes") {
          const created = next.activities.find((item) => !baseData.activities.some((old) => old.id === item.id));
          const edited = next.activities.find((item) => baseData.activities.some((old) => old.id === item.id && old.status === "scheduled" && item.status === "scheduled" && (old.title !== item.title || old.ends_at !== item.ends_at)));
          const source = baseData.activities.filter((item) => item.owner_id === DEMO_ID && item.mode === "solo" && item.status === "scheduled" && Date.parse(item.starts_at) <= Date.now() && Date.parse(item.ends_at) > Date.now()).sort((a,b) => b.starts_at.localeCompare(a.starts_at))[0];
          const cleared = baseData.activities.filter((old) => old.status === "scheduled" && next.activities.some((item) => item.id === old.id && item.status === "cancelled")).length;
          return { event: action, cleared_count: cleared, ...(action === "save_status_note" ? { id: created?.id ?? edited?.id ?? payload.source_id ?? source?.id } : {}) };
        }
        if (action === "react_status") return { event: action, id: payload.id };
        if (action === "join_public_beacon") return { status: next.rsvps.find(row => row.activity_id === payload.activity_id && row.user_id === DEMO_ID)?.status ?? "going" };
        if (action === "create_space") {
          const space = next.spaces.find(
            (item) => !baseData.spaces.some((old) => old.id === item.id),
          );
          return space ? { id: space.id, space_id: space.id } : {};
        }
        if (action === "create_space_from_squads") {
          const space = next.spaces.find(
            (item) => !baseData.spaces.some((old) => old.id === item.id),
          );
          return space
            ? {
                id: space.id,
                space_id: space.id,
                linked_squad_count: next.space_squads.filter(
                  (row) => row.space_id === space.id,
                ).length,
              }
            : {};
        }
        if (action === "organize_squad_into_space") {
          const space = next.spaces.find(
            (item) => !baseData.spaces.some((old) => old.id === item.id),
          );
          if (!space) return {};
          const sourceSquadId = String(payload.squad_id ?? "");
          return {
            id: space.id,
            space_id: space.id,
            source_squad_id: sourceSquadId,
            copied_member_count: next.space_members.filter(
              (row) =>
                row.space_id === space.id && row.user_id !== space.owner_id,
            ).length,
            skipped_member_count: Math.max(
              0,
              baseData.squad_members.filter(
                (row) =>
                  row.squad_id === sourceSquadId &&
                  row.user_id !== space.owner_id,
              ).length -
                next.space_members.filter(
                  (row) =>
                    row.space_id === space.id && row.user_id !== space.owner_id,
                ).length,
            ),
          };
        }
        if (action === "create_organization") {
          const organization = next.organizations.find(
            (item) => !baseData.organizations.some((old) => old.id === item.id),
          );
          return organization
            ? { id: organization.id, organization_id: organization.id }
            : {};
        }
        if (action === "create_activity" || action === "create_plan_beacon") {
          const activity = next.activities.find(
            (item) => !baseData.activities.some((old) => old.id === item.id),
          );
          return activity ? { id: activity.id } : {};
        }
        if (action === "create_plan" || action === "run_routine_once" || action === "run_routine_now") {
          const plan = next.plans.find(
            (item) => !baseData.plans.some((old) => old.id === item.id),
          );
          return plan
            ? { id: plan.id, plan_id: plan.id, occurrence_plan_id: plan.id }
            : {};
        }
        if (action === "create_routine") {
          const routine = next.plan_routines.find(
            (item) => !baseData.plan_routines.some((old) => old.id === item.id),
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
            (item) =>
              !baseData.group_messages.some((old) => old.id === item.id),
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
                !baseData.planning_threads.some((old) => old.id === item.id),
            );
          const result=thread ? { id: thread.id, status: thread.status } : {};
          if(requestKey)demoRequests.current.set(requestKey,result);
          return result;
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
                !baseData.planning_proposals.some((old) => old.id === item.id),
            );
          const result=proposal ? { id: proposal.id, thread_id: proposal.thread_id } : {};
          if(requestKey)demoRequests.current.set(requestKey,result);
          return result;
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
      const generation = epoch.current;
      const viewer = session.user.id;
      const atomicCreation = action === "create_activity_with_invitees" || action === "create_plan_beacon_with_invitees";
      const actorScoped = atomicCreation || ["rsvp","save_activity_note","end_activity_note","update_presence","save_status_note","create_planning_thread","add_council_proposal"].includes(action);
      const assertAtomicViewer = () => {
        if (actorScoped && (generation !== epoch.current || dataRef.current.viewer_id !== viewer)) throw new Error(action === "rsvp" ? "Your account changed. Refresh before responding." : "Your account changed before publication. Return to the account that started this Beacon.");
      };
      assertAtomicViewer();
      const network = await Network.getNetworkStateAsync();
      assertAtomicViewer();
      if (
        network.isConnected === false ||
        network.isInternetReachable === false
      )
        throw new Error("Reconnect to save changes. Nothing was queued.");
      const result = await rpc(action, payload, requestId, actorScoped ? viewer : undefined);
      assertAtomicViewer();
      if (generation === epoch.current) await refresh();
      assertAtomicViewer();
      return result;
    },
    [demo, session, refresh, setData],
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
    viewerEpochRef.current++;
    setViewerEpoch(viewerEpochRef.current);
    clearPendingRequests();
    demoRequests.current.clear();
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
        getCurrentProfile,
        getViewerEpoch,
        viewerEpoch,
        act,
        searchDirectory,
        loadCommunitySummary,
        loadActivityHistory,
        loadProfileContent,
        loadRoutineCalendar,
        startDemo: () => {
          demoRequests.current.clear();
          epoch.current++;
          viewerEpochRef.current++;
          setViewerEpoch(viewerEpochRef.current);
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
