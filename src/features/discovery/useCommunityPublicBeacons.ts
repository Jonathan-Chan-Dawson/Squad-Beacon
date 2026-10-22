import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useFocusEffect } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import { demoBeaconCommunities } from "./beaconCommunities";
import { demoPublicBeacons, parsePublicBeaconRows } from "./publicDirectory";
import type { PublicBeaconSummary } from "./types";
import type { SocialEntityType } from "@/src/features/social/types";

const PAGE_SIZE = 20;

interface CommunityBeaconResult {
  key: string;
  snapshot: ReturnType<typeof useBeacon>["data"];
  rows: PublicBeaconSummary[];
  nextOffset: number;
  hasMore: boolean;
  error: boolean;
}

function uniqueBeacons(
  current: readonly PublicBeaconSummary[],
  next: readonly PublicBeaconSummary[],
) {
  const seen = new Set(current.map((row) => row.activity_id));
  return next.filter((row) => {
    if (seen.has(row.activity_id)) return false;
    seen.add(row.activity_id);
    return true;
  });
}

/** Loads only the server-approved public projection associated with a profile. */
export function useCommunityPublicBeacons(
  type: SocialEntityType,
  entityId: string | null | undefined,
) {
  const { data, userId, viewerEpoch, getViewerEpoch, demo } = useBeacon();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<CommunityBeaconResult | null>(null);
  const [pageState, setPageState] = useState<{
    key: string;
    loading: boolean;
    error: boolean;
  } | null>(null);
  const [demoLimit, setDemoLimit] = useState(PAGE_SIZE);
  const generation = useRef(0);
  const pageGeneration = useRef(0);
  const pendingPage = useRef(false);
  const targetId =
    typeof entityId === "string" &&
    entityId.length > 0 &&
    entityId.length <= 100
      ? entityId
      : null;
  const key = JSON.stringify([userId, viewerEpoch, type, targetId, revision]);
  const liveContext = useRef({ key, data, userId, viewerEpoch });
  useLayoutEffect(() => {
    liveContext.current = { key, data, userId, viewerEpoch };
    pageGeneration.current += 1;
    pendingPage.current = false;
  }, [data, key, userId, viewerEpoch]);

  const refresh = useCallback(() => {
    pendingPage.current = false;
    setDemoLimit(PAGE_SIZE);
    setRevision((value) => value + 1);
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (!targetId || !userId || data.viewer_id !== userId || demo || !supabase)
      return;
    let active = true;
    const request = ++generation.current;
    const snapshot = data;
    const epoch = getViewerEpoch();
    void supabase
      .rpc("community_public_beacons", {
        p_entity_type: type,
        p_entity_id: targetId,
        p_limit: PAGE_SIZE,
        p_offset: 0,
      })
      .then(
        ({ data: rows, error }) => {
          if (
            !active ||
            generation.current !== request ||
            epoch !== getViewerEpoch()
          )
            return;
          const parsed = error ? [] : parsePublicBeaconRows(rows);
          setResult({
            key,
            snapshot,
            rows: parsed,
            nextOffset: parsed.length,
            hasMore: parsed.length === PAGE_SIZE,
            error: !!error,
          });
        },
        () => {
          if (
            !active ||
            generation.current !== request ||
            epoch !== getViewerEpoch()
          )
            return;
          setResult({
            key,
            snapshot,
            rows: [],
            nextOffset: 0,
            hasMore: false,
            error: true,
          });
        },
      );
    return () => {
      active = false;
      if (generation.current === request) generation.current += 1;
    };
  }, [data, demo, getViewerEpoch, key, targetId, type, userId]);

  const current =
    result?.key === key && result.snapshot === data ? result : null;
  const loadingMore = pageState?.key === key && pageState.loading;
  const loadingMoreError = pageState?.key === key && pageState.error;
  const demoRows =
    demo && userId && targetId
      ? (() => {
          const publicRows = demoPublicBeacons(data, userId, "");
          const associations = demoBeaconCommunities(
            data,
            userId,
            publicRows.map((row) => row.activity_id),
          );
          const allowed = new Set(
            associations.flatMap((row) =>
              row.summary.entity_type === type &&
              row.summary.entity_id === targetId
                ? [row.activity_id]
                : [],
            ),
          );
          return publicRows.flatMap((summary) => {
            if (!allowed.has(summary.activity_id)) return [];
            return [summary];
          });
        })()
      : [];
  const rows = demo ? demoRows.slice(0, demoLimit) : (current?.rows ?? []);

  const loadMore = useCallback(async () => {
    if (demo) {
      if (demoRows.length > demoLimit)
        setDemoLimit((limit) => limit + PAGE_SIZE);
      return;
    }
    if (
      !current ||
      !current.hasMore ||
      !targetId ||
      !userId ||
      data.viewer_id !== userId ||
      !supabase ||
      pendingPage.current
    )
      return;
    pendingPage.current = true;
    setPageState({ key, loading: true, error: false });
    const request = generation.current;
    const pageRequest = ++pageGeneration.current;
    const snapshot = data;
    const epoch = getViewerEpoch();
    const offset = current.nextOffset;
    const isCurrentRequest = () => {
      const context = liveContext.current;
      return (
        pageGeneration.current === pageRequest &&
        generation.current === request &&
        context.key === key &&
        context.data === snapshot &&
        context.userId === userId &&
        context.viewerEpoch === viewerEpoch &&
        epoch === getViewerEpoch()
      );
    };
    try {
      const { data: page, error } = await supabase.rpc(
        "community_public_beacons",
        {
          p_entity_type: type,
          p_entity_id: targetId,
          p_limit: PAGE_SIZE,
          p_offset: offset,
        },
      );
      if (error) throw error;
      if (!isCurrentRequest()) return;
      const parsed = parsePublicBeaconRows(page);
      const additions = uniqueBeacons(current.rows, parsed);
      setResult((previous) => {
        if (previous?.key !== key || previous.snapshot !== snapshot)
          return previous;
        const nextOffset = offset + parsed.length;
        return {
          ...previous,
          rows: [...previous.rows, ...additions],
          nextOffset,
          hasMore: parsed.length === PAGE_SIZE && nextOffset < 5000,
        };
      });
    } catch {
      if (isCurrentRequest())
        setPageState({ key, loading: false, error: true });
    } finally {
      if (pageGeneration.current === pageRequest) {
        pendingPage.current = false;
        setPageState((previous) =>
          previous?.key === key ? { ...previous, loading: false } : previous,
        );
      }
    }
  }, [
    current,
    data,
    demo,
    demoLimit,
    demoRows.length,
    getViewerEpoch,
    key,
    targetId,
    type,
    userId,
    viewerEpoch,
  ]);

  return {
    rows,
    ready: demo ? !!userId && data.viewer_id === userId : !!current,
    error: demo ? false : (current?.error ?? false),
    hasMore: demo ? demoRows.length > demoLimit : (current?.hasMore ?? false),
    loadingMore,
    loadingMoreError,
    loadMore,
    refresh,
  };
}
