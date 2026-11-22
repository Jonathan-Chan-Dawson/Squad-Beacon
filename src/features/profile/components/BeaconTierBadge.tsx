import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import { scoreTiers } from "../beaconScore";

export function BeaconTierBadge({ personId }: { personId: string }) {
  const { userId, viewerEpoch, demo, getViewerEpoch } = useBeacon();
  const [result, setResult] = useState<{
    person: string;
    viewer: string;
    epoch: number;
    tier: number | null;
  }>();
  useFocusEffect(
    useCallback(() => {
      if (!supabase || demo || !userId) return;
      let active = true;
      void Promise.resolve(
        supabase.rpc("beacon_score_profile_tier", { p_person: personId }),
      )
        .then(({ data, error }) => {
          if (active && getViewerEpoch() === viewerEpoch)
            setResult({
              person: personId,
              viewer: userId,
              epoch: viewerEpoch,
              tier: !error && Number.isInteger(data) ? data : null,
            });
        })
        .catch(() => {
          if (active && getViewerEpoch() === viewerEpoch)
            setResult({
              person: personId,
              viewer: userId,
              epoch: viewerEpoch,
              tier: null,
            });
        });
      return () => {
        active = false;
      };
    }, [personId, userId, viewerEpoch, demo, getViewerEpoch]),
  );
  const tier =
    !demo &&
    result?.person === personId &&
    result.viewer === userId &&
    result.epoch === viewerEpoch &&
    result.tier != null
      ? scoreTiers[result.tier]
      : null;
  return tier ? <Txt muted>Beacon tier · {tier.label}</Txt> : null;
}
