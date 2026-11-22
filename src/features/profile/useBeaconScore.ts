import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { supabase } from "@/src/shared/supabase";
import { applyScoreTaps, scoreRewards, type BeaconScore } from "./beaconScore";
import {
  readSavedViewerDeviceDefaults,
  writeViewerDeviceDefaults,
  type ViewerDeviceDefaults,
} from "./settings/deviceDefaults";

type Stream = NonNullable<ViewerDeviceDefaults["beaconScoreStream"]>;
const demoHistory: BeaconScore["history"] = [
  { id: 1, kind: "host", points: 500, earned_at: "" },
  { id: 2, kind: "attend", points: 500, earned_at: "" },
  { id: 3, kind: "attend", points: 500, earned_at: "" },
];
const demoPoints = 1500;

/** Mounted in the viewer-keyed Profile body. Each device owns a durable tap stream. */
export function useBeaconScore(userId: string | null, demo: boolean) {
  const current = useRef<{ taps: number; stream: Stream } | null>(null);
  const acknowledged = useRef<number | null>(null);
  const lastSync = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const saved = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(false);
  const [local, setLocal] = useState<typeof current.current>(null);
  const [remote, setRemote] = useState<BeaconScore | null>(null);
  const [offline, setOffline] = useState(false);
  const [demoBadge, setDemoBadge] = useState(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const sync = useCallback(
    async (badge?: boolean) => {
      if (!userId || demo || !current.current || !supabase) return;
      if (pending.current) {
        if (badge === undefined) return;
        await pending.current.catch(() => {});
      }
      const stream = current.current.stream;
      const request = (async () => {
        try {
          await saved.current;
          const { data, error } = await supabase!.rpc("sync_beacon_score", {
            p_owner: userId,
            p_stream: stream.id,
            p_taps: stream.total,
            p_legacy: stream.legacy,
            p_show_badge: badge ?? null,
          });
          if (error) throw error;
          const result = data as BeaconScore;
          acknowledged.current = result.credited;
          lastSync.current = Date.now();
          if (alive.current) {
            setRemote(result);
            setOffline(false);
          }
        } catch (error) {
          // Offline taps remain durable. A later retry sends the same stream total.
          if (alive.current) setOffline(true);
          if (badge !== undefined) throw error;
        }
      })();
      pending.current = request;
      try {
        await request;
      } finally {
        if (pending.current === request) pending.current = null;
      }
    },
    [userId, demo],
  );

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void readSavedViewerDeviceDefaults(userId)
      .catch(() => ({}) as ViewerDeviceDefaults)
      .then((defaults) => {
        if (!active || current.current) return;
        const taps = defaults.tinyBeaconTaps ?? 0;
        const stream = defaults.beaconScoreStream ?? {
          id: randomUUID(),
          total: 0,
          legacy: taps,
        };
        const next = { taps, stream };
        current.current = next;
        setLocal(next);
        saved.current = writeViewerDeviceDefaults(userId, {
          tinyBeaconTaps: taps,
          beaconScoreStream: stream,
        });
        void saved.current.catch(() => {});
        void sync();
      });
    return () => {
      active = false;
    };
  }, [userId, sync]);

  useFocusEffect(
    useCallback(() => {
      void sync();
      const timer = setInterval(() => {
        if (
          acknowledged.current !== current.current?.stream.total ||
          Date.now() - lastSync.current >= 30_000
        )
          void sync();
      }, 2500);
      return () => {
        clearInterval(timer);
        if (acknowledged.current !== current.current?.stream.total) void sync();
      };
    }, [sync]),
  );

  const tap = () => {
    if (!userId || !current.current) return null;
    const { taps, stream } = current.current;
    if (stream.total >= Number.MAX_SAFE_INTEGER) return null;
    const next = {
      taps: Math.min(taps + 1, Number.MAX_SAFE_INTEGER),
      stream: { ...stream, total: stream.total + 1 },
    };
    current.current = next;
    setLocal(next);
    saved.current = writeViewerDeviceDefaults(userId, {
      tinyBeaconTaps: next.taps,
      beaconScoreStream: next.stream,
    });
    void saved.current.catch(() => {});
    return next.taps;
  };
  const pendingTaps = Math.max(0, (local?.stream.total ?? 0) - (remote?.credited ?? 0));
  const startingPoints = demo ? demoPoints + (local?.stream.legacy ?? 0) : (remote?.total ?? 0);
  const progress = applyScoreTaps(startingPoints, pendingTaps + (remote?.tap_remainder ?? 0));
  const tapPoints = progress.points - demoPoints;
  return {
    points: progress.points,
    tapRate: progress.rate,
    tapRemainder: progress.remaining,
    taps: local?.taps ?? 0,
    ready: local !== null,
    synced: demo || remote !== null,
    offline,
    showBadge: demo ? demoBadge : remote?.show_badge === true,
    history: demo
      ? [
          ...(tapPoints > 0
            ? [
                {
                  id: 0,
                  kind: "tap" as const,
                  points: tapPoints,
                  earned_at: "",
                },
              ]
            : []),
          ...demoHistory,
        ]
      : (remote?.history ?? []),
    rewards: remote?.rewards ?? scoreRewards,
    tap,
    refresh: () => sync(),
    toggleBadge: async () => {
      if (demo) setDemoBadge((current) => !current);
      else await sync(!remote?.show_badge);
    },
  };
}
