import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/src/shared/supabase";
import { scoreRewards, type BeaconScore } from "./beaconScore";

const demoHistory: BeaconScore["history"] = [
  { id: 1, kind: "host", points: 500, earned_at: "" },
  { id: 2, kind: "attend", points: 500, earned_at: "" },
  { id: 3, kind: "attend", points: 500, earned_at: "" },
];

/** Profile mounts this hook in a viewer-keyed component. */
export function useBeaconScore(userId: string | null, demo: boolean) {
  const alive = useRef(false);
  const revision = useRef(0);
  const [remote, setRemote] = useState<BeaconScore>();
  const [offline, setOffline] = useState(false);
  const [demoBadge, setDemoBadge] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (badge?: boolean) => {
      if (!userId || demo || !supabase) return;
      const request = ++revision.current;
      try {
        const { data, error } = await supabase.rpc("sync_beacon_score", {
          p_owner: userId,
          p_stream: "00000000-0000-0000-0000-000000000001",
          p_taps: 0,
          p_legacy: 0,
          p_show_badge: badge ?? null,
        });
        if (error) throw error;
        if (alive.current && request === revision.current) {
          setRemote(data as BeaconScore);
          setOffline(false);
        }
      } catch (error) {
        if (alive.current && request === revision.current) setOffline(true);
        if (badge !== undefined) throw error;
      }
    },
    [demo, userId],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  return {
    points: demo ? 1500 : (remote?.total ?? 0),
    ready: !!userId,
    synced: demo || remote !== undefined,
    offline,
    showBadge: demo ? demoBadge : remote?.show_badge === true,
    history: demo ? demoHistory : (remote?.history ?? []),
    rewards: remote?.rewards ?? scoreRewards,
    refresh,
    toggleBadge: async () => {
      if (demo) setDemoBadge((value) => !value);
      else await refresh(!remote?.show_badge);
    },
  };
}
