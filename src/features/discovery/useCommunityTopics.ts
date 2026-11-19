import { useEffect, useState } from "react";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import type { SocialEntityType } from "@/src/features/social/types";
import type { BeaconTopic } from "./beaconTopics";

/** Keep a choice through profile refreshes and scope it to the current viewer. */
export function useCommunityTopicSelection(entity: string | undefined) {
  const { userId, viewerEpoch } = useBeacon();
  const scope = JSON.stringify([userId, viewerEpoch, entity]);
  const [selection, setSelection] = useState<{ scope: string; id: string | null }>();
  return {
    selectedTopic: selection?.scope === scope ? selection.id : null,
    onSelectTopic: (id: string | null) => setSelection({ scope, id }),
  };
}

export function useCommunityTopics(type?: SocialEntityType, entity?: string) {
  const { data, userId, demo, viewerEpoch, getViewerEpoch } = useBeacon();
  const enabled =
    !!userId && data.viewer_id === userId && !!data.capabilities?.beacon_topics;
  const key = JSON.stringify([type, entity, userId, viewerEpoch]);
  const [result, setResult] = useState<{
    key: string;
    snapshot: typeof data;
    rows: BeaconTopic[];
  }>();
  useEffect(() => {
    if (!enabled || demo || !type || !entity || !supabase) return;
    let current = true;
    const epoch = getViewerEpoch();
    void Promise.resolve(
      supabase.rpc("community_beacon_topics", { kind: type, entity }),
    )
      .then(({ data: rows, error }) => {
        if (!current || epoch !== getViewerEpoch()) return;
        setResult({
          key,
          snapshot: data,
          rows:
            error || !Array.isArray(rows)
              ? []
              : rows
                  .filter(
                    (row) =>
                      typeof row?.id === "string" &&
                      typeof row?.name === "string",
                  )
                  .slice(0, 6),
        });
      })
      .catch(() => {
        if (current && epoch === getViewerEpoch())
          setResult({ key, snapshot: data, rows: [] });
      });
    return () => {
      current = false;
    };
  }, [enabled, demo, type, entity, getViewerEpoch, key, data]);
  if (!enabled || !type || !entity)
    return { rows: [] as BeaconTopic[], ready: true };
  if (demo)
    return {
      rows: (data.beacon_topics ?? []).filter(
        (row) =>
          !row.archived && row.entity_type === type && row.entity_id === entity,
      ),
      ready: true,
    };
  const ready = result?.key === key && result.snapshot === data;
  return { rows: ready ? result.rows : [], ready };
}
