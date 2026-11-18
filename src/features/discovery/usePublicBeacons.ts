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
  publicId?: string,
) {
  const {
    data,
    userId,
    demo,
    getViewerEpoch,
    viewerEpoch,
    demoScenario,
    switchDemoScenario,
  } = useBeacon();
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
    focused: PublicBeaconSummary | null;
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
    publicId,
  ]);
  useEffect(() => {
    if ((userId && data.viewer_id !== userId) || demo || !supabase) return;
    let current = true;
    const epoch = getViewerEpoch();
    const timer = setTimeout(() => {
      void Promise.all([
        supabase!.rpc(
          userId ? "public_beacon_search" : "browse_guest_beacons",
          {
            p_query: query,
            p_lat: latitude,
            p_lng: longitude,
            ...(!userId ? { p_id: null } : {}),
          },
        ),
        publicId
          ? supabase!.rpc("browse_guest_beacons", {
              p_query: "",
              p_lat: null,
              p_lng: null,
              p_id: publicId,
            })
          : Promise.resolve({ data: [], error: null }),
      ])
        .then(([{ data: rows, error }, exact]) => {
          const focused = exact.error
            ? null
            : (parsePublicBeaconRows(exact.data)[0] ?? null);
          const parsed = error ? [] : parsePublicBeaconRows(rows);
          if (
            focused &&
            !parsed.some((row) => row.activity_id === focused.activity_id)
          )
            parsed.push(focused);
          if (current && epoch === getViewerEpoch())
            setResult({
              snapshot: data,
              key,
              rows: parsed,
              focused,
              ...(error || exact.error
                ? { error: "Public Beacons could not load. Try again shortly." }
                : publicId && !focused
                  ? { error: "This public preview is no longer available." }
                  : {}),
            });
        })
        .catch(() => {
          if (current && epoch === getViewerEpoch())
            setResult({
              snapshot: data,
              key,
              rows: [],
              focused: null,
              error: "Public Beacons could not load. Try again shortly.",
            });
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [
    data,
    demo,
    userId,
    query,
    latitude,
    longitude,
    getViewerEpoch,
    key,
    publicId,
  ]);
  if (__DEV__ && demo && userId && demoScenario === "offline")
    return {
      rows: [],
      focused: null,
      error: "Simulated connection error. Reconnect to try again.",
      ready: true,
      refresh: () => switchDemoScenario("disconnected"),
    };
  if (demo && userId)
    return {
      rows: demoPublicBeacons(data, userId, query),
      focused: publicId
        ? (demoPublicBeacons(data, userId, "").find(
            (row) => row.activity_id === publicId,
          ) ?? null)
        : null,
      error: undefined,
      ready: true,
      refresh,
    };
  return result?.snapshot === data && result.key === key
    ? { ...result, ready: true, refresh }
    : {
        rows: [],
        // Keep the exact preview mounted during a same-viewer snapshot refresh.
        focused: result?.key === key ? result.focused : null,
        error: undefined,
        ready: false,
        refresh,
      };
}
