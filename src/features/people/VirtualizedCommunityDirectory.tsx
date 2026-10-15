import { FlashList } from "@shopify/flash-list";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { performDirectoryAction } from "@/src/features/social/directoryActions";
import type { SocialDirectoryQuery } from "@/src/features/social/directory";
import type {
  SocialDirectorySummary,
  SocialEntityType,
} from "@/src/features/social/types";
import { useBeacon } from "@/src/shared/store";
import type { Data } from "@/src/shared/types";
import { Button, Empty, Txt } from "@/src/shared/ui";
import { SocialDirectorySummaryCard } from "./components/SocialDirectorySummaryCard";

const PAGE_SIZE = 20;

type DirectoryResult = {
  key: string;
  snapshot: Data;
  viewerId: string;
  viewerEpoch: number;
  rows: SocialDirectorySummary[];
  nextOffset: number;
  hasMore: boolean;
  error: boolean;
};

/**
 * Full, server-paged community directory for a focused profile route. Place it
 * in a `Screen` with `scroll={false}` so FlashList owns vertical scrolling.
 */
export function VirtualizedCommunityDirectory({
  query,
  queryLabel,
  entityType = "all",
  parentType,
  parentId,
  allowedEntityIds,
  onOpen,
}: {
  query: string;
  queryLabel?: string;
  entityType?: "all" | SocialEntityType;
  parentType?: "space" | "organization";
  parentId?: string;
  /** Restricts a mixed server page to independently authorized association IDs. */
  allowedEntityIds?: readonly string[];
  onOpen: (summary: SocialDirectorySummary) => void;
}) {
  const { data, userId, viewerEpoch, loading: snapshotLoading, act, searchDirectory } = useBeacon();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<DirectoryResult | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [loadingMoreFor, setLoadingMoreFor] = useState<string | null>(null);
  const [loadMoreErrorFor, setLoadMoreErrorFor] = useState<string | null>(null);
  const generation = useRef(0);
  const loadingMoreKey = useRef<string | null>(null);
  const liveContext = useRef({ data, userId, viewerEpoch });

  useEffect(() => {
    liveContext.current = { data, userId, viewerEpoch };
  }, [data, userId, viewerEpoch]);

  const normalizedQuery = query.trim();
  const queryTooShort = normalizedQuery.length === 1;
  const parentScope = parentType && parentId ? `${parentType}:${parentId}` : "";
  const key = `${userId ?? "signed-out"}|${data.viewer_id ?? "no-snapshot"}|${viewerEpoch}|${normalizedQuery}|${entityType}|${parentScope}|${revision}`;
  const contextCurrent = !!userId && data.viewer_id === userId;
  const current = result?.key === key && result.snapshot === data &&
    result.viewerId === userId && result.viewerEpoch === viewerEpoch
    ? result
    : null;
  const loadingMore = loadingMoreFor === key;
  const loadMoreError = loadMoreErrorFor === key;
  const allowedIds = useMemo(
    () => allowedEntityIds === undefined ? null : new Set(allowedEntityIds),
    [allowedEntityIds],
  );
  const visibleRows = current?.rows.filter((row) => !allowedIds || allowedIds.has(row.entity_id)) ?? [];

  useEffect(() => {
    if (!contextCurrent || queryTooShort) return;
    const request = ++generation.current;
    let live = true;
    const snapshot = data;
    const viewer = userId!;
    const input: SocialDirectoryQuery = {
      query: normalizedQuery,
      entityType,
      pageSize: PAGE_SIZE,
      pageOffset: 0,
      ...(parentScope && parentType && parentId ? { parentType, parentId } : {}),
    };
    void searchDirectory(input).then((rows) => {
      const context = liveContext.current;
      if (
        !live ||
        generation.current !== request ||
        context.data !== snapshot ||
        context.userId !== viewer ||
        context.viewerEpoch !== viewerEpoch
      ) return;
      setResult({
        key,
        snapshot,
        viewerId: viewer,
        viewerEpoch,
        rows,
        nextOffset: rows.length,
        hasMore: rows.length === PAGE_SIZE,
        error: false,
      });
    }).catch(() => {
      const context = liveContext.current;
      if (
        !live ||
        generation.current !== request ||
        context.data !== snapshot ||
        context.userId !== viewer ||
        context.viewerEpoch !== viewerEpoch
      ) return;
      setResult({ key, snapshot, viewerId: viewer, viewerEpoch, rows: [], nextOffset: 0, hasMore: false, error: true });
    });
    return () => {
      live = false;
      if (generation.current === request) generation.current += 1;
    };
  }, [contextCurrent, data, entityType, key, normalizedQuery, parentId, parentScope, parentType, queryTooShort, searchDirectory, userId, viewerEpoch]);

  const loadMore = useCallback(async () => {
    if (!current || !current.hasMore || loadingMoreKey.current === key) return;
    const request = generation.current;
    const snapshot = data;
    const viewer = userId;
    const offset = current.nextOffset;
    if (!viewer || data.viewer_id !== viewer || offset > 5000) return;
    loadingMoreKey.current = key;
    setLoadingMoreFor(key);
    setLoadMoreErrorFor(null);
    try {
      const next = await searchDirectory({
        query: normalizedQuery,
        entityType,
        pageSize: PAGE_SIZE,
        pageOffset: offset,
        ...(parentScope && parentType && parentId ? { parentType, parentId } : {}),
      });
      const context = liveContext.current;
      if (
        generation.current !== request ||
        context.data !== snapshot ||
        context.userId !== viewer ||
        context.viewerEpoch !== viewerEpoch
      ) return;
      setResult((previous) => {
        if (previous?.key !== key || previous.snapshot !== snapshot) return previous;
        const seen = new Set(previous.rows.map((row) => `${row.entity_type}:${row.entity_id}`));
        const uniqueNext = next.filter((row) => {
          const rowKey = `${row.entity_type}:${row.entity_id}`;
          if (seen.has(rowKey)) return false;
          seen.add(rowKey);
          return true;
        });
        const nextOffset = offset + next.length;
        return {
          ...previous,
          rows: [...previous.rows, ...uniqueNext],
          nextOffset,
          hasMore: next.length === PAGE_SIZE && offset < 5000,
        };
      });
    } catch {
      if (liveContext.current.data === snapshot && liveContext.current.userId === viewer)
        setLoadMoreErrorFor(key);
    } finally {
      if (loadingMoreKey.current === key) loadingMoreKey.current = null;
      setLoadingMoreFor((active) => active === key ? null : active);
    }
  }, [current, data, entityType, key, normalizedQuery, parentId, parentScope, parentType, searchDirectory, userId, viewerEpoch]);

  const runAction = useCallback(async (summary: SocialDirectorySummary) => {
    if (!userId || data.viewer_id !== userId || liveContext.current.data !== data ||
      liveContext.current.userId !== userId || liveContext.current.viewerEpoch !== viewerEpoch ||
      (allowedIds && !allowedIds.has(summary.entity_id)) || !current?.rows.some(
      (row) => row.entity_type === summary.entity_type && row.entity_id === summary.entity_id,
      )) throw new Error("Refresh discovery to continue.");
    const actionKey = `${summary.entity_type}:${summary.entity_id}`;
    setPendingAction(actionKey);
    try {
      await performDirectoryAction(summary, data, userId, act);
      if (liveContext.current.data === data && liveContext.current.userId === userId && liveContext.current.viewerEpoch === viewerEpoch)
        setRevision((value) => value + 1);
    } finally {
      if (liveContext.current.data === data && liveContext.current.userId === userId && liveContext.current.viewerEpoch === viewerEpoch)
        setPendingAction(null);
    }
  }, [act, allowedIds, current, data, userId, viewerEpoch]);

  const renderItem = useCallback(({ item }: { item: SocialDirectorySummary }) => {
    const rowKey = `${item.entity_type}:${item.entity_id}`;
    const unavailableSquadInvite = item.action === "invited" && item.entity_type === "squad" &&
      !data.squad_invites.some((invite) => invite.squad_id === item.entity_id && invite.recipient_id === userId);
    return (
      <SocialDirectorySummaryCard
        summary={item}
        compact
        previewLabel="Open profile"
        showJoinedStatus
        actionDisabled={unavailableSquadInvite}
        pending={pendingAction === rowKey}
        onPreview={() => onOpen(item)}
        onAction={() => runAction(item)}
      />
    );
  }, [data.squad_invites, onOpen, pendingAction, runAction, userId]);

  const listHeader = queryLabel ? (
    <View style={{ paddingBottom: 8 }}>
      <Txt muted>{queryLabel}</Txt>
    </View>
  ) : null;
  const emptyComponent = queryTooShort ? (
    <Empty title="Add another character" body="Community search starts with two characters." />
  ) : !userId ? (
    <Empty title="Sign in to browse" body="Community discovery is available to signed-in accounts." />
  ) : !contextCurrent ? (
    <Txt muted>{snapshotLoading ? "Loading community access..." : "Refresh your profile to browse communities."}</Txt>
  ) : !current ? (
    <Txt muted>Loading communities...</Txt>
  ) : current.error ? (
    <View style={{ gap: 12, padding: 16 }}>
      <Empty title="Couldn't load communities" body="Try the directory again." />
      <Button title="Try again" onPress={() => setRevision((value) => value + 1)} />
    </View>
  ) : (
    <Empty title="No matching communities" body="Try another name or description." />
  );

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <FlashList
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        data={visibleRows}
        keyExtractor={(item) => `${item.entity_type}:${item.entity_id}`}
        renderItem={renderItem}
        extraData={{ pendingAction, revision }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={current?.hasMore ? (
          <View style={{ gap: 8, paddingVertical: 10 }}>
            {loadMoreError ? <Txt muted>Couldn&apos;t load more results. Try again.</Txt> : null}
            <Button
              compact
              secondary
              title={loadingMore ? "Loading..." : loadMoreError ? "Try again" : "Load more"}
              disabled={loadingMore}
              onPress={() => void loadMore()}
            />
          </View>
        ) : null}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        onRefresh={() => setRevision((value) => value + 1)}
        refreshing={!!userId && contextCurrent && !current && !queryTooShort}
      />
    </View>
  );
}
