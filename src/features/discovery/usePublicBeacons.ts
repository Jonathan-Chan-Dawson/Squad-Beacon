import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import { demoPublicBeacons, parsePublicBeaconRows } from "./publicDirectory";
import type { PublicBeaconSummary } from "./types";
import type { Coordinate } from "@/src/shared/exploration";

export function usePublicBeacons(
  query: string,
  coordinate?: Coordinate | null,
) {
  const { data, userId, demo, getViewerEpoch, viewerEpoch } = useBeacon();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  const [result, setResult] = useState<{
    snapshot: typeof data;
    key: string;
    rows: PublicBeaconSummary[];
    error?: string;
  } | null>(null);
  const latitude = coordinate
    ? Math.round(coordinate.latitude * 10) / 10
    : null;
  const longitude = coordinate
    ? Math.round(coordinate.longitude * 10) / 10
    : null;
  const key = JSON.stringify([
    userId,
    viewerEpoch,
    query,
    latitude,
    longitude,
    revision,
  ]);
  useEffect(() => {
    if (!userId || data.viewer_id !== userId || demo || !supabase) return;
    let current = true;
    const epoch = getViewerEpoch();
    const timer = setTimeout(() => {
      void Promise.resolve(
        supabase!.rpc("public_beacon_search", {
          p_query: query,
          p_lat: latitude,
          p_lng: longitude,
        }),
      )
        .then(({ data: rows, error }) => {
          if (current && epoch === getViewerEpoch())
            setResult({
              snapshot: data,
              key,
              rows: error ? [] : parsePublicBeaconRows(rows),
              ...(error
                ? { error: "Public Beacons could not load. Try again shortly." }
                : {}),
            });
        })
        .catch(() => {
          if (current && epoch === getViewerEpoch())
            setResult({
              snapshot: data,
              key,
              rows: [],
              error: "Public Beacons could not load. Try again shortly.",
            });
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [data, demo, userId, query, latitude, longitude, getViewerEpoch, key]);
  if (demo && userId)
    return {
      rows: demoPublicBeacons(data, userId, query),
      error: undefined,
      ready: true,
      refresh,
    };
  return result?.snapshot === data && result.key === key
    ? { ...result, ready: true, refresh }
    : { rows: [], error: undefined, ready: false, refresh };
}
