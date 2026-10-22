import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import {
  demoBeaconCommunities,
  parseBeaconCommunities,
  type BeaconCommunityAssociation,
} from "./beaconCommunities";

/** One bounded batch per page, scoped to the viewer, snapshot, and route focus. */
export function useBeaconCommunities(activityIds: readonly string[]) {
  const { data, userId, viewerEpoch, getViewerEpoch, demo } = useBeacon();
  const [revision, setRevision] = useState(0);
  const idsKey = JSON.stringify(
    [...new Set(activityIds)].filter(Boolean).sort(),
  );
  const key = JSON.stringify([userId, viewerEpoch, idsKey, revision]);
  const [result, setResult] = useState<{
    key: string;
    snapshot: typeof data;
    rows: BeaconCommunityAssociation[];
  } | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  useEffect(() => {
    if (
      !userId ||
      data.viewer_id !== userId ||
      demo ||
      !supabase ||
      idsKey === "[]"
    )
      return;
    let active = true;
    const epoch = getViewerEpoch();
    const ids = JSON.parse(idsKey) as string[];
    const batches = Array.from(
      { length: Math.ceil(ids.length / 50) },
      (_, index) => ids.slice(index * 50, index * 50 + 50),
    );
    void Promise.all(
      batches.map(async (batch) => {
        const { data: rows, error } = await supabase!.rpc(
          "beacon_community_summaries",
          { p_activity_ids: batch },
        );
        return error ? [] : parseBeaconCommunities(rows, batch);
      }),
    )
      .then((batches) => {
        if (active && epoch === getViewerEpoch())
          setResult({ key, snapshot: data, rows: batches.flat() });
      })
      .catch(() => {
        if (active && epoch === getViewerEpoch())
          setResult({ key, snapshot: data, rows: [] });
      });
    return () => {
      active = false;
    };
  }, [data, demo, getViewerEpoch, idsKey, key, userId]);
  if (!userId || data.viewer_id !== userId || idsKey === "[]")
    return { rows: [], ready: true, refresh };
  if (demo)
    return {
      rows: demoBeaconCommunities(data, userId, JSON.parse(idsKey)),
      ready: true,
      refresh,
    };
  const current = result?.snapshot === data && result.key === key;
  return { rows: current ? result.rows : [], ready: current, refresh };
}
