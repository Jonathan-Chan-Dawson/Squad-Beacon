import React, { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { canReadOrganization } from "./domain";
import { performDirectoryAction } from "@/src/features/social/directoryActions";
import type { SocialDirectorySummary } from "@/src/features/social/types";
import { SocialDirectorySummaryCard } from "@/src/features/people/components/SocialDirectorySummaryCard";
import { Empty, Txt } from "@/src/shared/ui";

const PREVIEW_SIZE = 5;
const PAGE_SIZE = 20;
const LABELS = { space: "Organization", squad: "Squad" } as const;

/** A bounded child preview built only from safe, independently authorized summaries. */
export function OrganizationRelatedPreview({
  organizationId,
  entityType,
}: {
  organizationId: string;
  entityType: "space" | "squad";
}) {
  const { data, userId, viewerEpoch, act, searchDirectory, loadCommunitySummary } = useBeacon();
  const liveContext = useRef({ data, userId, viewerEpoch });
  useEffect(() => {
    liveContext.current = { data, userId, viewerEpoch };
  }, [data, userId, viewerEpoch]);
  const [result, setResult] = useState<{
    key: string;
    snapshot: typeof data;
    userId: string | null;
    viewerEpoch: number;
    rows: SocialDirectorySummary[];
    error: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const generation = useRef(0);
  const key = `${organizationId}:${entityType}:${userId ?? ""}:${viewerEpoch}:${revision}`;
  useEffect(() => {
    let active = true;
    const request = ++generation.current;
    const snapshot = data;
    const viewer = userId;
    const epoch = viewerEpoch;
    const isCurrent = () => {
      const context = liveContext.current;
      return active && request === generation.current && context.data === snapshot &&
        context.userId === viewer && context.viewerEpoch === epoch;
    };
    void (async () => {
      const rows = new Map<string, SocialDirectorySummary>();
      if (entityType === "space") {
        const page = await searchDirectory({
          query: "",
          entityType,
          pageSize: PAGE_SIZE,
          pageOffset: 0,
          parentType: "organization",
          parentId: organizationId,
        });
        if (!isCurrent()) return;
        for (const summary of page) {
          if (summary.entity_type === "space") rows.set(summary.entity_id, summary);
        }
      } else if (userId && data.viewer_id === userId && canReadOrganization(data, organizationId, userId) &&
        data.organization_squads.some((link) => link.organization_id === organizationId)) {
        const orderedIds = [...new Set(data.organization_squads
          .filter((link) => link.organization_id === organizationId)
          .map((link) => link.squad_id))].sort((a, b) => a.localeCompare(b));
        for (let offset = 0; offset < Math.min(orderedIds.length, 20) && rows.size < PREVIEW_SIZE; offset += 5) {
          const summaries = await Promise.all(
            orderedIds.slice(offset, offset + 5).map((directId) => loadCommunitySummary("squad", directId)),
          );
          if (!isCurrent()) return;
          for (const summary of summaries) {
            if (summary?.entity_type === "squad") rows.set(summary.entity_id, summary);
          }
        }
      }
      if (!isCurrent()) return;
      setResult({
        key,
        snapshot,
        userId: viewer,
        viewerEpoch: epoch,
        rows: [...rows.values()]
          .sort((a, b) => Number(b.membership_status === "active") - Number(a.membership_status === "active") ||
            a.name.localeCompare(b.name) || a.entity_id.localeCompare(b.entity_id))
          .slice(0, PREVIEW_SIZE),
        error: false,
      });
    })().catch(() => {
      if (isCurrent()) setResult({
        key,
        snapshot,
        userId: viewer,
        viewerEpoch: epoch,
        rows: [],
        error: true,
      });
    });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [data, entityType, key, loadCommunitySummary, organizationId, searchDirectory, userId, viewerEpoch]);

  const current = result?.key === key && result.snapshot === data &&
    result.userId === userId && result.viewerEpoch === viewerEpoch
    ? result
    : null;
  async function takeAction(summary: SocialDirectorySummary) {
    if (!userId || data.viewer_id !== userId || liveContext.current.data !== data ||
      liveContext.current.userId !== userId || liveContext.current.viewerEpoch !== viewerEpoch ||
      !current?.rows.some((row) => row.entity_type === summary.entity_type && row.entity_id === summary.entity_id))
      throw new Error("Refresh this profile to continue.");
    setPendingId(summary.entity_id);
    try {
      await performDirectoryAction(summary, data, userId, act);
      if (liveContext.current.data === data && liveContext.current.userId === userId &&
        liveContext.current.viewerEpoch === viewerEpoch) setRevision((value) => value + 1);
    } finally {
      if (liveContext.current.data === data && liveContext.current.userId === userId &&
        liveContext.current.viewerEpoch === viewerEpoch) setPendingId(null);
    }
  }

  if (!current) return <Txt muted>Loading linked {LABELS[entityType]}s...</Txt>;
  if (current?.error) return <Empty title={`Linked ${LABELS[entityType]}s are unavailable`} body="Open the full directory to try again." />;
  if (!current?.rows.length) return null;
  return (
    <>
      {current.rows.map((summary) => (
        <SocialDirectorySummaryCard
          key={`${summary.entity_type}:${summary.entity_id}`}
          summary={summary}
          compact
          showJoinedStatus
          previewLabel="Open profile"
          pending={pendingId === summary.entity_id}
          onPreview={() => {
            if (summary.entity_type === "space") router.push({ pathname: "/space/[id]", params: { id: summary.entity_id } });
            else if (summary.entity_type === "squad") router.push({ pathname: "/squad/[id]", params: { id: summary.entity_id } });
          }}
          onAction={() => takeAction(summary)}
        />
      ))}
    </>
  );
}
