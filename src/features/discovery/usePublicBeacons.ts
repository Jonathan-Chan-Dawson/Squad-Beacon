import { beaconPinImage, beaconPinSymbol } from "@/src/features/maps/beaconPinArtwork";
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
  enabled = true,
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
      if (enabled) refresh();
    }, [enabled, refresh]),
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
    if (!enabled || (userId && data.viewer_id !== userId) || demo || !supabase) return;
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
          if (!current || !userId || !data.capabilities?.beacon_map_icons || !parsed.length) return;
          void Promise.resolve(supabase!.rpc("public_beacon_map_icons", {
            activity_ids: parsed.slice(0, 50).map((row) => row.activity_id),
          })).then(({ data: rows, error }) => {
            if (!current || epoch !== getViewerEpoch() || error || !Array.isArray(rows)) return;
            const icons = new Map<string, string>();
            for (const row of rows) {
              const icon = beaconPinSymbol(row?.map_icon) ?? beaconPinImage(row?.map_icon);
              if (typeof row?.activity_id === "string" && icon) icons.set(row.activity_id, icon);
            }
            if (!icons.size) return;
            setResult(previous => previous?.key === key && previous.snapshot === data ? {
              ...previous,
              rows: previous.rows.map(row => ({ ...row, map_icon: icons.get(row.activity_id) })),
              focused: previous.focused ? { ...previous.focused, map_icon: icons.get(previous.focused.activity_id) } : null,
            } : previous);
          }).catch(() => {});
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
    enabled,
    demo,
    userId,
    query,
    latitude,
    longitude,
    getViewerEpoch,
    key,
    publicId,
  ]);
  if (!enabled) return { rows: [], focused: null, error: undefined, ready: false, refresh };
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
      rows: demoPublicBeacons(data, userId, query).map(row => {
        const activity = data.activities.find(beacon => beacon.id === row.activity_id && beacon.map_icon_public);
        return { ...row, map_icon: activity?.map_icon };
      }),
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
