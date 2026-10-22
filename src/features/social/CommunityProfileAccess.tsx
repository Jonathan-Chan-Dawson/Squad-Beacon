import { useFocusEffect } from "expo-router";
import { communityTypeLabel } from "./communityPresentation";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ProfileLink, ProfileSection } from "@/src/features/people/components/ProfilePrimitives";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import type { ID } from "@/src/shared/types";
import type { SocialDirectorySummary, SocialEntityType } from "./types";

export interface CommunitySummaryState {
  summary: SocialDirectorySummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads a bounded exact-ID directory summary. Snapshot and account changes
 * invalidate the prior result immediately; the server remains the authority.
 */
export function useCommunitySummary(
  type: SocialEntityType,
  id: ID | null | undefined,
): CommunitySummaryState {
  const { data, userId, viewerEpoch, loadCommunitySummary } = useBeacon();
  const requestId = useRef(0);
  const latest = useRef({ data, id, type, userId, viewerEpoch, loadCommunitySummary });
  useLayoutEffect(() => {
    latest.current = { data, id, type, userId, viewerEpoch, loadCommunitySummary };
  }, [data, id, type, userId, viewerEpoch, loadCommunitySummary]);
  const [result, setResult] = useState<{
    type: SocialEntityType;
    id: string | null;
    userId: string | null;
    viewerEpoch: number;
    snapshot: typeof data;
    summary: SocialDirectorySummary | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  useFocusEffect(useCallback(() => {
    const targetId = typeof id === "string" && id.length <= 100 ? id : null;
    if (!targetId || !userId || data.viewer_id !== userId) return;
    let live = true;
    const request = ++requestId.current;
    const snapshot = data;
    void loadCommunitySummary(type, targetId).then((summary) => {
      if (!live || request !== requestId.current) return;
      setResult({ type, id: targetId, userId, viewerEpoch, snapshot, summary, loading: false, error: null });
    }).catch((failure) => {
      if (!live || request !== requestId.current) return;
      setResult({
        type,
        id: targetId,
        userId,
        viewerEpoch,
        snapshot,
        summary: null,
        loading: false,
        error: failure instanceof Error ? failure.message : "Community unavailable.",
      });
    });
    return () => {
      live = false;
      requestId.current += 1;
    };
  }, [data, id, loadCommunitySummary, type, userId, viewerEpoch]));

  const refresh = useCallback(async () => {
    const { data, id, type, userId, viewerEpoch, loadCommunitySummary } = latest.current;
    const targetId = typeof id === "string" && id.length <= 100 ? id : null;
    const snapshot = data;
    const request = ++requestId.current;
    if (!targetId || !userId || snapshot.viewer_id !== userId) {
      setResult({ type, id: targetId, userId, viewerEpoch, snapshot, summary: null, loading: false, error: null });
      return;
    }
    setResult({ type, id: targetId, userId, viewerEpoch, snapshot, summary: null, loading: true, error: null });
    try {
      const summary = await loadCommunitySummary(type, targetId);
      if (request !== requestId.current) return;
      setResult({ type, id: targetId, userId, viewerEpoch, snapshot, summary, loading: false, error: null });
    } catch (failure) {
      if (request !== requestId.current) return;
      setResult({
        type,
        id: targetId,
        userId,
        viewerEpoch,
        snapshot,
        summary: null,
        loading: false,
        error: failure instanceof Error ? failure.message : "Community unavailable.",
      });
    }
  }, []);

  const expectedId = typeof id === "string" && id.length <= 100 ? id : null;
  const current = !!result && result.type === type && result.id === expectedId &&
    result.userId === userId && result.viewerEpoch === viewerEpoch && result.snapshot === data;
  return {
    summary: current ? result.summary : null,
    loading: !!expectedId && !!userId && (!current || result.loading),
    error: current ? result.error : null,
    refresh,
  };
}

/**
 * Provides the safe community summary to a route without implying membership.
 * Render each public/member-only section with its own existing permission gate.
 */
export function SafeCommunityProfile({
  type,
  id,
  render,
  loadingFallback = null,
  unavailableFallback = null,
}: {
  type: SocialEntityType;
  id: ID | null | undefined;
  render: (
    summary: SocialDirectorySummary,
    access: { isMember: boolean; refresh: () => Promise<void> },
  ) => React.ReactNode;
  loadingFallback?: React.ReactNode;
  unavailableFallback?: React.ReactNode;
}) {
  const { summary, loading, refresh } = useCommunitySummary(type, id);
  if (loading) return <>{loadingFallback}</>;
  if (!summary) return <>{unavailableFallback}</>;
  return <>{render(summary, { isMember: summary.membership_status === "active", refresh })}</>;
}

export interface CommunityRelationshipContext {
  parentType: "space" | "organization";
  parentId: ID;
}

const relationshipTypeLabel = communityTypeLabel;

function RelationshipContextRow({
  context,
  current,
  onOpen,
  maxItems,
  entityType,
}: {
  context: CommunityRelationshipContext;
  current?: { type: SocialEntityType; id: ID };
  onOpen: (summary: SocialDirectorySummary) => void;
  maxItems: number;
  entityType: SocialEntityType | "all";
}) {
  const { summary, loading: summaryLoading } = useCommunitySummary(context.parentType, context.parentId);
  const { searchDirectory, data, userId, viewerEpoch } = useBeacon();
  const { styles } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState(0);
  const [pageResult, setPageResult] = useState<{
    key: string;
    snapshot: typeof data;
    userId: string | null;
    viewerEpoch: number;
    rows: SocialDirectorySummary[];
  } | null>(null);
  const currentKey = current ? `${current.type}:${current.id}` : "";
  const queryKey = `${context.parentType}:${context.parentId}:${entityType}:${currentKey}:${userId ?? ""}:${viewerEpoch}:${expandedVersion}:${maxItems}`;
  const matchingPage = pageResult?.key === queryKey && pageResult.snapshot === data &&
    pageResult.userId === userId && pageResult.viewerEpoch === viewerEpoch;
  const rows = matchingPage ? pageResult.rows : [];
  const loading = expanded && !matchingPage;

  useEffect(() => {
    let live = true;
    if (!expanded) return () => { live = false; };
    const snapshot = data;
    void searchDirectory({
      query: "",
      entityType,
      pageSize: 12,
      pageOffset: 0,
      parentType: context.parentType,
      parentId: context.parentId,
    }).then((page) => {
      if (!live) return;
      setPageResult({
        key: queryKey,
        snapshot,
        userId,
        viewerEpoch,
        rows: page.filter((row) => `${row.entity_type}:${row.entity_id}` !== currentKey).slice(0, maxItems),
      });
    }).catch(() => {
      if (live) setPageResult({ key: queryKey, snapshot, userId, viewerEpoch, rows: [] });
    });
    return () => { live = false; };
  }, [context.parentId, context.parentType, currentKey, data, entityType, expanded, maxItems, queryKey, searchDirectory, userId, viewerEpoch]);

  if (summaryLoading || !summary) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Hide" : "Show"} related communities in ${summary.name}`}
        accessibilityState={{ expanded }}
        onPress={() => {
          if (!expanded) setExpandedVersion((version) => version + 1);
          setExpanded(!expanded);
        }}
        style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}
      >
        <CommunityAvatar type={summary.entity_type} size={36} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={styles.body}>{summary.name}</Text>
          <Text style={styles.muted}>{relationshipTypeLabel(summary.entity_type)}</Text>
        </View>
        <Text style={styles.muted}>{expanded ? "-" : "+"}</Text>
      </Pressable>
      {expanded ? (
        <View style={{ paddingLeft: 16 }}>
          <ProfileLink
            title={`View ${relationshipTypeLabel(summary.entity_type)}`}
            detail="Open this community profile"
            onPress={() => onOpen(summary)}
          />
          {rows.map((row) => (
            <ProfileLink
              key={`${row.entity_type}:${row.entity_id}`}
              title={row.name}
              detail={relationshipTypeLabel(row.entity_type)}
              icon={<CommunityAvatar type={row.entity_type} size={32} />}
              onPress={() => onOpen(row)}
            />
          ))}
          {!rows.length && !loading ? <Text style={styles.muted}>No other communities are listed here.</Text> : null}
          {loading ? <Text style={styles.muted}>Loading related communities...</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Shows every known relationship as its own safe profile link. Sibling rows are
 * fetched from the bounded directory only when that relationship is expanded.
 */
export function RelationshipDisclosure({
  contexts,
  current,
  onOpen,
  title = "Related communities",
  maxItems = 3,
  entityType,
}: {
  contexts: readonly CommunityRelationshipContext[];
  current?: { type: SocialEntityType; id: ID };
  onOpen: (summary: SocialDirectorySummary) => void;
  title?: string;
  /** The preview is capped at three; use the parent profile for full browsing. */
  maxItems?: number;
  entityType?: SocialEntityType | "all";
}) {
  const boundedMaxItems = Math.min(3, Math.max(0, Math.trunc(maxItems)));
  const relatedEntityType = entityType ?? current?.type ?? "all";
  const uniqueContexts = new Map<string, CommunityRelationshipContext>();
  for (const context of contexts)
    uniqueContexts.set(`${context.parentType}:${context.parentId}`, context);
  if (!uniqueContexts.size) return null;
  return (
    <ProfileSection title={title}>
      {[...uniqueContexts.values()].map((context) => (
        <RelationshipContextRow
          key={`${context.parentType}:${context.parentId}`}
          context={context}
          current={current}
          onOpen={onOpen}
          maxItems={boundedMaxItems}
          entityType={relatedEntityType}
        />
      ))}
    </ProfileSection>
  );
}
