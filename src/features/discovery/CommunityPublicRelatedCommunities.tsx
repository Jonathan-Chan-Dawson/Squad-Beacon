import { openCommunityProfile } from "@/src/features/social/communityNavigation";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";
import {
  ProfileLink,
  ProfileSection,
} from "@/src/features/people/components/ProfilePrimitives";
import { CommunityMembershipAction } from "./BeaconCommunityRow";
import { Button, Empty, Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import type {
  SocialDirectorySummary,
  SocialEntityType,
} from "@/src/features/social/types";
import type { Data } from "@/src/shared/types";

const PAGE_SIZE = 20;

interface RelatedCommunitiesResult {
  key: string;
  snapshot: Data;
  viewerId: string;
  viewerEpoch: number;
  rows: SocialDirectorySummary[];
  nextOffset: number;
  hasMore: boolean;
  error: boolean;
}

function parentTypeFor(
  type: SocialEntityType,
): "space" | "organization" | null {
  return type === "space" || type === "organization" ? type : null;
}

/** Bounded children are loaded through the authorized summary directory. */
export function CommunityPublicRelatedCommunities({
  summary,
}: {
  summary: SocialDirectorySummary;
}) {
  const { data, userId, viewerEpoch, searchDirectory } = useBeacon();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<RelatedCommunitiesResult | null>(null);
  const [pageState, setPageState] = useState<{
    key: string;
    loading: boolean;
    error: boolean;
  } | null>(null);
  const generation = useRef(0);
  const pageGeneration = useRef(0);
  const loadingMoreKey = useRef<string | null>(null);
  const parentType = parentTypeFor(summary.entity_type);
  const key = `${summary.entity_type}:${summary.entity_id}:${userId ?? ""}:${viewerEpoch}:${revision}`;
  const liveContext = useRef({ key, data, userId, viewerEpoch });
  useLayoutEffect(() => {
    liveContext.current = { key, data, userId, viewerEpoch };
    pageGeneration.current += 1;
    loadingMoreKey.current = null;
  }, [data, key, userId, viewerEpoch]);
  const current =
    result?.key === key &&
    result.snapshot === data &&
    result.viewerId === userId &&
    result.viewerEpoch === viewerEpoch
      ? result
      : null;
  const loadingMore = pageState?.key === key && pageState.loading;
  const loadingMoreError = pageState?.key === key && pageState.error;

  useEffect(() => {
    if (!parentType || !userId || data.viewer_id !== userId) return;
    let active = true;
    const request = ++generation.current;
    const snapshot = data;
    const viewer = userId;
    const epoch = viewerEpoch;
    const isCurrentRequest = () => {
      const context = liveContext.current;
      return (
        active &&
        generation.current === request &&
        context.key === key &&
        context.data === snapshot &&
        context.userId === viewer &&
        context.viewerEpoch === epoch
      );
    };
    void searchDirectory({
      query: "",
      entityType: "all",
      pageSize: PAGE_SIZE,
      pageOffset: 0,
      parentType,
      parentId: summary.entity_id,
    })
      .then((rows) => {
        if (!isCurrentRequest()) return;
        setResult({
          key,
          snapshot,
          viewerId: viewer,
          viewerEpoch: epoch,
          rows: rows.filter(
            (row) =>
              row.entity_id !== summary.entity_id ||
              row.entity_type !== summary.entity_type,
          ),
          nextOffset: rows.length,
          hasMore: rows.length === PAGE_SIZE,
          error: false,
        });
      })
      .catch(() => {
        if (!isCurrentRequest()) return;
        setResult({
          key,
          snapshot,
          viewerId: viewer,
          viewerEpoch: epoch,
          rows: [],
          nextOffset: 0,
          hasMore: false,
          error: true,
        });
      });
    return () => {
      active = false;
      if (generation.current === request) generation.current += 1;
    };
  }, [
    data,
    key,
    parentType,
    searchDirectory,
    summary.entity_id,
    summary.entity_type,
    userId,
    viewerEpoch,
  ]);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const loadMore = useCallback(async () => {
    if (
      !current ||
      !current.hasMore ||
      !parentType ||
      !userId ||
      data.viewer_id !== userId ||
      loadingMoreKey.current === key
    )
      return;
    loadingMoreKey.current = key;
    setPageState({ key, loading: true, error: false });
    const request = generation.current;
    const pageRequest = ++pageGeneration.current;
    const snapshot = data;
    const viewer = userId;
    const epoch = viewerEpoch;
    const offset = current.nextOffset;
    const isCurrentRequest = () => {
      const context = liveContext.current;
      return (
        pageGeneration.current === pageRequest &&
        generation.current === request &&
        context.key === key &&
        context.data === snapshot &&
        context.userId === viewer &&
        context.viewerEpoch === epoch
      );
    };
    try {
      const next = await searchDirectory({
        query: "",
        entityType: "all",
        pageSize: PAGE_SIZE,
        pageOffset: offset,
        parentType,
        parentId: summary.entity_id,
      });
      if (!isCurrentRequest()) return;
      setResult((previous) => {
        if (previous?.key !== key || previous.snapshot !== snapshot)
          return previous;
        const seen = new Set(
          previous.rows.map((row) => `${row.entity_type}:${row.entity_id}`),
        );
        const unique = next.filter((row) => {
          const rowKey = `${row.entity_type}:${row.entity_id}`;
          if (seen.has(rowKey)) return false;
          seen.add(rowKey);
          return true;
        });
        const nextOffset = offset + next.length;
        return {
          ...previous,
          rows: [...previous.rows, ...unique],
          nextOffset,
          hasMore: next.length === PAGE_SIZE && nextOffset < 5000,
        };
      });
    } catch {
      if (isCurrentRequest())
        setPageState({ key, loading: false, error: true });
    } finally {
      if (pageGeneration.current === pageRequest) {
        if (loadingMoreKey.current === key) loadingMoreKey.current = null;
        setPageState((previous) =>
          previous?.key === key ? { ...previous, loading: false } : previous,
        );
      }
    }
  }, [
    current,
    data,
    key,
    parentType,
    searchDirectory,
    summary.entity_id,
    userId,
    viewerEpoch,
  ]);

  if (!parentType) return null;
  return (
    <ProfileSection
      title={
        summary.entity_type === "organization"
          ? "Communities in this Network"
          : "Squads in this Organization"
      }
    >
      {!userId || data.viewer_id !== userId ? (
        <Txt muted>Sign in to see communities you can open.</Txt>
      ) : !current ? (
        <Txt muted>Loading related communities...</Txt>
      ) : current.error ? (
        <View style={{ gap: 8 }}>
          <Empty
            title="Related communities are unavailable"
            body="Try loading this community list again."
          />
          <Button title="Try again" secondary compact onPress={refresh} />
        </View>
      ) : !current.rows.length ? (
        <Txt muted>No related communities are listed here.</Txt>
      ) : (
        <View style={{ gap: 10 }}>
          {current.rows.map((row) => (
            <View
              key={`${row.entity_type}:${row.entity_id}`}
              style={{ gap: 4 }}
            >
              <ProfileLink
                title={row.name}
                detail={`${communityTypeLabel(row.entity_type)} · ${row.member_count} ${row.member_count === 1 ? "member" : "members"}`}
                icon={<CommunityAvatar type={row.entity_type} size={32} />}
                onPress={() => openCommunityProfile(row)}
              />
              <CommunityMembershipAction
                summary={row}
                onChanged={refresh}
                allowCancel
              />
            </View>
          ))}
          {loadingMoreError ? (
            <Txt muted>More communities could not load. Try again.</Txt>
          ) : null}
          {current.hasMore ? (
            <Button
              title={
                loadingMore
                  ? "Loading..."
                  : loadingMoreError
                    ? "Try again"
                    : "Load more"
              }
              secondary
              compact
              disabled={loadingMore}
              onPress={() => void loadMore()}
            />
          ) : null}
        </View>
      )}
    </ProfileSection>
  );
}
