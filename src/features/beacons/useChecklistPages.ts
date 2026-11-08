import { useEffect, useState } from "react";
import { useBeacon } from "@/src/shared/store";
import { supabase } from "@/src/shared/supabase";
import type {
  BeaconChecklistItem,
  BeaconChecklistSection,
} from "@/src/shared/types";
export function useChecklistPages(activityId: string, enabled: boolean) {
  const { data, userId, getViewerEpoch } = useBeacon();
  const [limit, setLimit] = useState(200);
  const [page, setPage] = useState<{
    activityId: string;
    viewer: string;
    items: BeaconChecklistItem[];
    sections: BeaconChecklistSection[];
    total: number;
    completed: number;
    more: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const epoch = getViewerEpoch();
    if (
      !enabled ||
      data.is_demo ||
      !data.capabilities?.premium_tools ||
      !supabase ||
      !userId
    )
      return;
    const client = supabase;
    const read = async (kind: "items" | "sections") => {
      const rows: (BeaconChecklistItem | BeaconChecklistSection)[] = [];
      let cursor: string | null = null,
        more = true,
        total = 0,
        completed = 0;
      while (more && rows.length < limit) {
        const response = await client.rpc("checklist_page", {
          activity_id: activityId,
          kind,
          cursor_id: cursor,
        });
        if (response.error) throw new Error(response.error.message);
        const r = response.data;
        if (!alive || epoch !== getViewerEpoch()) return null;
        if (
          r?.viewer_id !== userId ||
          !Array.isArray(r.rows) ||
          r.rows.length > 100 ||
          r.rows.some(
            (v: BeaconChecklistItem) =>
              v.activity_id !== activityId || typeof v.id !== "string",
          ) ||
          !Number.isInteger(r.total)
        )
          throw new Error("This checklist page could not be verified.");
        rows.push(...r.rows);
        more = r.has_more === true;
        total = r.total;
        completed = r.completed;
        cursor = rows.at(-1)?.id ?? null;
        if (more && !cursor)
          throw new Error("This checklist changed. Refresh it.");
      }
      return { rows, more, total, completed };
    };
    void Promise.all([read("items"), read("sections")])
      .then(([items, sections]) => {
        if (!alive || epoch !== getViewerEpoch() || !items || !sections) return;
        setPage({
          activityId,
          viewer: userId,
          items: items.rows as BeaconChecklistItem[],
          sections: sections.rows as BeaconChecklistSection[],
          total: items.total,
          completed: items.completed,
          more: items.more || sections.more,
        });
        setError("");
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [
    activityId,
    enabled,
    userId,
    data.is_demo,
    data.capabilities?.premium_tools,
    data.beacon_checklist_items,
    data.beacon_checklist_sections,
    getViewerEpoch,
    limit,
  ]);
  const valid =
    page?.activityId === activityId && page.viewer === userId ? page : null;
  return {
    items:
      valid?.items ??
      data.beacon_checklist_items.filter((i) => i.activity_id === activityId),
    sections:
      valid?.sections ??
      data.beacon_checklist_sections.filter(
        (s) => s.activity_id === activityId,
      ),
    total: valid?.total,
    completed: valid?.completed,
    more: valid?.more ?? false,
    loadMore: () => setLimit((n) => n + 100),
    error,
  };
}
