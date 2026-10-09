import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, Text, View } from "react-native";
import BottomSheet, {
  useBottomSheetScrollableCreator,
  type SNAP_POINT_TYPE,
} from "@gorhom/bottom-sheet";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import {
  ArrowUpRight,
  Clock3,
  List,
  MapPin,
  Navigation,
  WifiOff,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";
import { beaconCapacity } from "@/src/features/beacons/permissions";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { MapBeaconRsvp } from "@/src/features/maps/MapBeaconRsvp";
import type { Activity, ActivityPlace, ID, Profile } from "@/src/shared/types";
import { activityWhen } from "@/src/shared/domain";
import {
  AvatarStack,
  EmptyState,
  ProgressBar,
  Skeleton,
  useDesignTheme,
} from "@/src/shared/design-system";
import { Button, IconButton } from "@/src/shared/ui";

export type MapViewerCoordinate = { latitude: number; longitude: number };

export type MapResultsSheetRef = {
  scrollToActivity: (id: ID) => void;
  snapToIndex: (index: 0 | 1 | 2) => void;
  showClusterMembers: (ids: readonly ID[]) => void;
};

export type MapResultsSheetProps = {
  /** Already filtered to readable Beacons in the current visible map region. */
  visibleActivities: readonly Activity[];
  selectedId: ID | null;
  viewerCoordinate?: MapViewerCoordinate | null;
  /** Permission-safe Plan count from the current visible map query. */
  planCount?: number;
  /** When supplied, show this cluster's Beacon members; an empty array is a person-only cluster. */
  clusterActivityIds?: readonly ID[] | null;
  /** Screen-provided cluster people with fresh, explicitly shared locations. */
  clusterPeople?: readonly Profile[];
  loading?: boolean;
  offline?: boolean;
  clusterResetKey?: string | number;
  onSelect: (id: ID) => void;
  onSelectPerson?: (id: ID) => void;
  onOpenDetail: (id: ID) => void;
  onDirections?: (id: ID) => void;
  onDismiss?: () => void;
  onClearFilters?: () => void;
  onSearchWider?: () => void;
  onSnapChange?: (index: number) => void;
};

type MapResultItem =
  | { type: "activity"; id: ID; activity: Activity }
  | { type: "person"; id: ID; profile: Profile };

function distanceMiles(
  origin: MapViewerCoordinate | null | undefined,
  destination: ActivityPlace | undefined,
) {
  if (!origin || destination?.latitude == null || destination.longitude == null)
    return undefined;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(destination.latitude - origin.latitude);
  const dLon = toRadians(destination.longitude - origin.longitude);
  const lat1 = toRadians(origin.latitude);
  const lat2 = toRadians(destination.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(miles: number | undefined) {
  if (miles === undefined || !Number.isFinite(miles)) return undefined;
  if (miles < 0.1) return `${Math.max(1, Math.round(miles * 5280))} ft`;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

function ResultRow({
  activity,
  selected,
  viewerCoordinate,
  onSelect,
  onOpenDetail,
  onDirections,
}: {
  activity: Activity;
  selected: boolean;
  viewerCoordinate?: MapViewerCoordinate | null;
  onSelect: (id: ID) => void;
  onOpenDetail: (id: ID) => void;
  onDirections?: (id: ID) => void;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  const now = useNow();
  const ownerCandidate = data.profiles.find(
    (profile) => profile.id === activity.owner_id,
  );
  const owner =
    ownerCandidate && userId && canViewProfile(data, ownerCandidate, userId)
      ? ownerCandidate
      : undefined;
  const canReadPlace =
    !!userId && canReadBeaconMeetingDetails(data, activity, userId);
  const place = canReadPlace
    ? data.places.find((candidate) => candidate.activity_id === activity.id)
    : undefined;
  const locationDistance = distanceLabel(
    distanceMiles(viewerCoordinate, place),
  );
  const capacity = beaconCapacity(data, activity);
  const people = data.profiles
    .filter((person) => {
      if (!userId || !canViewProfile(data, person, userId)) return false;
      if (person.id === activity.owner_id) return true;
      const response = data.rsvps.find(
        (candidate) =>
          candidate.activity_id === activity.id &&
          candidate.user_id === person.id,
      );
      return (
        response?.status === "going" &&
        (response.approved ||
          !(activity.approval_required || activity.mode === "invite"))
      );
    })
    .map((person) => ({ id: person.id, name: person.name }));
  const needMore =
    activity.target_count != null && activity.target_count > capacity.count
      ? activity.target_count - capacity.count
      : 0;
  const progressGoal =
    activity.target_count != null && activity.target_count > 0
      ? activity.target_count
      : capacity.strict && capacity.limit != null && capacity.limit > 0
        ? capacity.limit
        : undefined;
  const hasPhysicalDestination =
    !!place &&
    !place.online_url &&
    place.latitude != null &&
    place.longitude != null;

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected ? colors.surfaceRaised : colors.surface,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${activity.title} Beacon`}
          accessibilityState={{ selected }}
          onPress={() => onSelect(activity.id)}
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <ActivityBadge category={activity.category} size={36} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {activity.title}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              {owner ? <ProfileAvatar profile={owner} size={18} /> : null}
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  flexShrink: 1,
                }}
              >
                {owner?.name ?? "Beacon host"}
              </Text>
            </View>
          </View>
        </Pressable>
        <IconButton
          label={`Open ${activity.title} Beacon details`}
          onPress={() => onOpenDetail(activity.id)}
        >
          <ArrowUpRight size={18} color={colors.accent} />
        </IconButton>
      </View>

      {(canReadPlace || locationDistance) && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Clock3 size={14} color={colors.textSecondary} />
          <Text
            numberOfLines={1}
            style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}
          >
            {activityWhen(activity, new Date(now))}
          </Text>
          {canReadPlace && (
            <>
              <MapPin size={14} color={colors.textSecondary} />
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  maxWidth: "45%",
                }}
              >
                {place?.online_url
                  ? "Virtual"
                  : (place?.label ?? "Place to be decided")}
              </Text>
            </>
          )}
          {locationDistance ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {locationDistance}
            </Text>
          ) : null}
          {hasPhysicalDestination && onDirections ? (
            <IconButton
              label={`Directions to ${place?.label ?? "Beacon"}`}
              onPress={() => onDirections(activity.id)}
            >
              <Navigation size={16} color={colors.accent} />
            </IconButton>
          ) : null}
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AvatarStack people={people} limit={3} size={24} />
        <Text
          style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}
        >
          {capacity.count} going
        </Text>
        {needMore > 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Need {needMore} more
          </Text>
        ) : null}
        {capacity.strict && capacity.remaining != null && !capacity.full ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginLeft: "auto",
            }}
          >
            {capacity.remaining} {capacity.remaining === 1 ? "spot" : "spots"}{" "}
            left
          </Text>
        ) : null}
      </View>
      {progressGoal ? (
        <ProgressBar
          value={capacity.count}
          max={progressGoal}
          label={`${capacity.count} of ${progressGoal} Beacon places`}
        />
      ) : null}
      <MapBeaconRsvp activity={activity} compact />
    </View>
  );
}

function PersonResultRow({
  profile,
  onSelect,
}: {
  profile: Profile;
  onSelect?: (id: ID) => void;
}) {
  const { data, userId } = useBeacon();
  const { colors } = useDesignTheme();
  if (!userId || !canViewProfile(data, profile, userId)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${profile.name} on map`}
      onPress={() => onSelect?.(profile.id)}
      style={{
        minHeight: 64,
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <ProfileAvatar profile={profile} size={36} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}
        >
          {profile.name}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Person
        </Text>
      </View>
      <MapPin size={18} color={colors.accent} />
    </Pressable>
  );
}

function LoadingRows() {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={{ padding: 14, borderRadius: 20, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Skeleton width={36} height={36} borderRadius={18} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="68%" height={16} />
              <Skeleton width="44%" height={12} />
            </View>
          </View>
          <Skeleton width="82%" height={12} />
          <Skeleton width="100%" height={40} borderRadius={14} />
        </View>
      ))}
    </View>
  );
}

function SheetList({
  items,
  selectedId,
  viewerCoordinate,
  listRef,
  onSelect,
  onSelectPerson,
  onOpenDetail,
  onDirections,
  onListLayoutReady,
}: {
  items: readonly MapResultItem[];
  selectedId: ID | null;
  viewerCoordinate?: MapViewerCoordinate | null;
  listRef: React.RefObject<FlashListRef<MapResultItem> | null>;
  onSelect: (id: ID) => void;
  onSelectPerson?: (id: ID) => void;
  onOpenDetail: (id: ID) => void;
  onDirections?: (id: ID) => void;
  onListLayoutReady: () => void;
}) {
  const renderScrollComponent = useBottomSheetScrollableCreator();
  const renderItem = useCallback(
    ({ item }: { item: MapResultItem }) =>
      item.type === "activity" ? (
        <ResultRow
          activity={item.activity}
          selected={item.id === selectedId}
          viewerCoordinate={viewerCoordinate}
          onSelect={onSelect}
          onOpenDetail={onOpenDetail}
          onDirections={onDirections}
        />
      ) : (
        <PersonResultRow profile={item.profile} onSelect={onSelectPerson} />
      ),
    [
      onDirections,
      onOpenDetail,
      onSelect,
      onSelectPerson,
      selectedId,
      viewerCoordinate,
    ],
  );
  const keyExtractor = useCallback(
    (item: MapResultItem) => `${item.type}:${item.id}`,
    [],
  );
  const getItemType = useCallback((item: MapResultItem) => item.type, []);
  const ItemSeparator = useCallback(() => <View style={{ height: 10 }} />, []);

  return (
    <FlashList
      ref={listRef}
      data={items}
      extraData={selectedId}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparator}
      renderScrollComponent={renderScrollComponent}
      onLoad={onListLayoutReady}
      onCommitLayoutEffect={onListLayoutReady}
      style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 20,
      }}
      keyboardShouldPersistTaps="handled"
    />
  );
}

export const MapResultsSheet = forwardRef<
  MapResultsSheetRef,
  MapResultsSheetProps
>(function MapResultsSheet(
  {
    visibleActivities,
    selectedId,
    viewerCoordinate,
    planCount: suppliedPlanCount,
    clusterActivityIds,
    clusterPeople,
    loading = false,
    offline = false,
    clusterResetKey,
    onSelect,
    onSelectPerson,
    onOpenDetail,
    onDirections,
    onClearFilters,
    onSearchWider,
    onSnapChange,
  },
  forwardedRef,
) {
  const sheetRef = useRef<BottomSheet>(null);
  const listRef = useRef<FlashListRef<MapResultItem>>(null);
  const { data, userId } = useBeacon();
  const { colors, tokens } = useDesignTheme();
  const insets = useSafeAreaInsets();
  const [snapIndex, setSnapIndex] = useState(0);
  const pendingScrollId = useRef<ID | null>(null);
  const scrollingId = useRef<ID | null>(null);
  const listLayoutReady = useRef(false);
  const layoutReadyRevision = useRef(0);
  const flushPendingScrollRef = useRef<() => void>(() => {});
  const latestItems = useRef<MapResultItem[]>([]);
  const scrollFrame = useRef<number | null>(null);
  const [clusterView, setClusterView] = useState<{
    resetKey: string | number | undefined;
    ids: readonly ID[];
  } | null>(null);
  const snapPoints = useMemo<(number | string)[]>(
    () => [96, "50%", "100%"],
    [],
  );
  const hasInternalCluster =
    clusterView !== null && clusterView.resetKey === clusterResetKey;
  const isClusterView =
    clusterActivityIds !== undefined
      ? clusterActivityIds !== null
      : hasInternalCluster;
  const clusterMembers =
    clusterActivityIds !== undefined
      ? clusterActivityIds
      : hasInternalCluster
        ? (clusterView?.ids ?? null)
        : null;
  const clusterIds = useMemo(() => clusterMembers ?? [], [clusterMembers]);

  const readableActivities = useMemo(
    () =>
      visibleActivities.filter(
        (activity) => !!userId && canReadBeaconActivity(data, activity, userId),
      ),
    [data, userId, visibleActivities],
  );
  const activities = useMemo(
    () =>
      isClusterView
        ? readableActivities.filter((activity) =>
            clusterIds.includes(activity.id),
          )
        : readableActivities,
    [clusterIds, isClusterView, readableActivities],
  );

  const people = useMemo(
    () =>
      isClusterView && userId
        ? (clusterPeople ?? []).filter((profile) =>
            canViewProfile(data, profile, userId),
          )
        : [],
    [clusterPeople, data, isClusterView, userId],
  );
  const items = useMemo<MapResultItem[]>(
    () => [
      ...activities.map((activity) => ({
        type: "activity" as const,
        id: activity.id,
        activity,
      })),
      ...people.map((profile) => ({
        type: "person" as const,
        id: profile.id,
        profile,
      })),
    ],
    [activities, people],
  );

  const flushPendingScroll = useCallback(() => {
    if (!listLayoutReady.current) return;
    const id = pendingScrollId.current;
    const list = listRef.current;
    if (!id || !list || scrollingId.current === id) return;
    const index = latestItems.current.findIndex((item) => item.id === id);
    if (index < 0) return;
    const committedData = list.props.data;
    if (
      !committedData ||
      index >= committedData.length ||
      committedData[index]?.id !== id
    ) return;
    let layout: ReturnType<typeof list.getLayout>;
    try {
      layout = list.getLayout(index);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "index out of bounds, not enough layouts"
      ) return;
      throw error;
    }
    if (
      !layout ||
      !Number.isFinite(layout.x) ||
      !Number.isFinite(layout.y) ||
      !Number.isFinite(layout.width) ||
      !Number.isFinite(layout.height) ||
      layout.width <= 0 ||
      layout.height <= 0
    ) return;
    const layoutRevisionAtRequest = layoutReadyRevision.current;
    scrollingId.current = id;
    const handleScrollError = (error: unknown) => {
      if (scrollingId.current === id) scrollingId.current = null;
      if (
        error instanceof Error &&
        error.message === "index out of bounds, not enough layouts"
      ) {
        // Keep the selection queued. Retry only if FlashList committed another
        // layout during this request; otherwise onLoad/onCommit will retry it.
        if (
          layoutReadyRevision.current !== layoutRevisionAtRequest &&
          pendingScrollId.current
        ) {
          if (scrollFrame.current != null)
            cancelAnimationFrame(scrollFrame.current);
          scrollFrame.current = requestAnimationFrame(() => {
            scrollFrame.current = null;
            flushPendingScrollRef.current();
          });
        }
        return;
      }
      console.error("[MapResultsSheet] Failed to scroll to the selected result", error);
    };
    try {
      void list
        .scrollToIndex({ index, animated: true, viewPosition: 0.24 })
        .then(() => {
          if (scrollingId.current === id) scrollingId.current = null;
          if (pendingScrollId.current === id) pendingScrollId.current = null;
          if (pendingScrollId.current) {
            if (scrollFrame.current != null)
              cancelAnimationFrame(scrollFrame.current);
            scrollFrame.current = requestAnimationFrame(() => {
              scrollFrame.current = null;
              flushPendingScrollRef.current();
            });
          }
        })
        .catch(handleScrollError);
    } catch (error) {
      handleScrollError(error);
    }
  }, []);

  useEffect(() => {
    flushPendingScrollRef.current = flushPendingScroll;
  }, [flushPendingScroll]);

  const schedulePendingScroll = useCallback(() => {
    if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      flushPendingScroll();
    });
  }, [flushPendingScroll]);

  const onListLayoutReady = useCallback(() => {
    listLayoutReady.current = true;
    layoutReadyRevision.current += 1;
    schedulePendingScroll();
  }, [schedulePendingScroll]);

  const scrollToActivity = useCallback((id: ID) => {
    pendingScrollId.current = id;
    schedulePendingScroll();
  }, [schedulePendingScroll]);

  useEffect(() => {
    latestItems.current = items;
    schedulePendingScroll();
  }, [items, schedulePendingScroll]);

  useEffect(() => {
    if (loading) {
      pendingScrollId.current = selectedId;
      return;
    }
    if (selectedId) scrollToActivity(selectedId);
    else pendingScrollId.current = null;
  }, [loading, scrollToActivity, selectedId]);

  useEffect(() => {
    listLayoutReady.current = false;
  }, [loading]);

  useEffect(() => () => {
    if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current);
    pendingScrollId.current = null;
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToActivity,
      snapToIndex: (index) => sheetRef.current?.snapToIndex(index),
      showClusterMembers: (ids) => {
        setClusterView({ resetKey: clusterResetKey, ids: [...new Set(ids)] });
        sheetRef.current?.snapToIndex(1);
      },
    }),
    [clusterResetKey, scrollToActivity],
  );

  const onSheetChange = useCallback(
    (index: number, _position: number, _type: SNAP_POINT_TYPE) => {
      setSnapIndex(index);
      onSnapChange?.(index);
    },
    [onSnapChange],
  );
  const toggleList = useCallback(() => {
    sheetRef.current?.snapToIndex(snapIndex === 0 ? 1 : 0);
  }, [snapIndex]);

  const linkedPlanCount = useMemo(
    () =>
      new Set(
        activities
          .map((activity) => activity.plan_id)
          .filter((planId): planId is string => !!planId),
      ).size,
    [activities],
  );
  const planCount = isClusterView
    ? linkedPlanCount
    : (suppliedPlanCount ?? linkedPlanCount);
  const beaconLabel = `${activities.length} Beacon${activities.length === 1 ? "" : "s"} nearby`;
  const planLabel = `${planCount} Plan${planCount === 1 ? "" : "s"}`;

  const emptyState = useMemo(
    () => (
      <View style={{ padding: 20, alignItems: "center" }}>
        <EmptyState
          title="Nothing here yet"
          body="Try clearing a filter or searching a wider area."
          action={
            onClearFilters
              ? { label: "Clear filters", onPress: onClearFilters }
              : undefined
          }
        />
        {onSearchWider ? (
          <Button
            title="Search wider"
            secondary
            compact
            onPress={onSearchWider}
          />
        ) : null}
      </View>
    ),
    [onClearFilters, onSearchWider],
  );
  const sheet = (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      animateOnMount={Platform.OS === "web" ? undefined : false}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      topInset={insets.top}
      bottomInset={0}
      containerStyle={Platform.OS === "web" ? undefined : { zIndex: 20, elevation: 20 }}
      onChange={onSheetChange}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderTopLeftRadius: tokens.radius.sheet,
        borderTopRightRadius: tokens.radius.sheet,
        boxShadow: `0 -8px 28px ${colors.textPrimary}22`,
      }}
      handleIndicatorStyle={{
        backgroundColor: colors.textSecondary,
        width: 38,
        height: 4,
        opacity: 0.45,
      }}
      style={Platform.OS === "web" ? { zIndex: 20 } : { zIndex: 20, elevation: 20 }}
    >
      <View style={{ flex: 1, minHeight: 0 }}>
        <View
          style={{
            minHeight: 46,
            paddingHorizontal: 16,
            paddingBottom: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: "700",
                flexShrink: 1,
              }}
            >
              {beaconLabel}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>·</Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.textSecondary, fontSize: 12 }}
            >
              {planLabel}
            </Text>
          </View>
          {offline ? (
            <View
              accessibilityLabel="Offline. Results may be out of date."
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <WifiOff size={12} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                Offline
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              snapIndex === 0 ? "Open Beacon list" : "Return to map"
            }
            onPress={toggleList}
            style={{
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: tokens.radius.pill,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            {snapIndex === 0 ? (
              <List size={16} color={colors.accent} />
            ) : (
              <MapPin size={16} color={colors.accent} />
            )}
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {snapIndex === 0 ? "List" : "Map"}
            </Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={{ flex: 1, minHeight: 0 }}>
            <LoadingRows />
          </View>
        ) : items.length === 0 ? (
          <View style={{ flex: 1, minHeight: 0 }}>{emptyState}</View>
        ) : (
          <View style={{ flex: 1, minHeight: 0 }}>
            <SheetList
              items={items}
              selectedId={selectedId}
              viewerCoordinate={viewerCoordinate}
              listRef={listRef}
              onSelect={onSelect}
              onSelectPerson={onSelectPerson}
              onOpenDetail={onOpenDetail}
              onDirections={onDirections}
              onListLayoutReady={onListLayoutReady}
            />
          </View>
        )}
      </View>
    </BottomSheet>
  );
  return Platform.OS === "web" ? sheet : (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        elevation: 20,
      }}
    >
      {sheet}
    </View>
  );
});
