import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import {
  ArrowUpRight,
  Clock3,
  MapPin,
  Navigation,
  X,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";
import { beaconCapacity } from "@/src/features/beacons/permissions";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { MapBeaconRsvp } from "@/src/features/maps/MapBeaconRsvp";
import type { Activity, ActivityPlace, ID } from "@/src/shared/types";
import { activityWhen } from "@/src/shared/domain";
import {
  AvatarStack,
  GlassBar,
  ProgressBar,
  useReducedMotion,
  useDesignTheme,
} from "@/src/shared/design-system";
import { IconButton } from "@/src/shared/ui";
import type { MapViewerCoordinate } from "@/src/features/maps/MapResultsSheet";

function isFlashListLayoutNotReady(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "index out of bounds, not enough layouts"
  );
}

export type MapPreviewCarouselProps = {
  /** Readable Beacons currently represented in the visible map region. */
  visibleActivities: readonly Activity[];
  selectedId: ID | null;
  viewerCoordinate?: MapViewerCoordinate | null;
  onSelect: (id: ID) => void;
  onOpenDetail: (id: ID) => void;
  onDirections?: (id: ID) => void;
  onDismiss: () => void;
  hidden?: boolean;
};

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

function PreviewCard({
  activity,
  width,
  cardHeight,
  viewerCoordinate,
  onOpenDetail,
  onDirections,
  onDismiss,
}: {
  activity: Activity;
  width: number;
  cardHeight: number;
  viewerCoordinate?: MapViewerCoordinate | null;
  onOpenDetail: (id: ID) => void;
  onDirections?: (id: ID) => void;
  onDismiss: () => void;
}) {
  const { data, userId } = useBeacon();
  const { colors, tokens } = useDesignTheme();
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
    <Pressable
      accessible={false}
      testID="map-tooltip-card"
      onPress={() => onOpenDetail(activity.id)}
      style={{ width }}
    >
      <GlassBar
        style={{
          width,
          minHeight: cardHeight,
          padding: 14,
          borderRadius: 24,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          boxShadow: `0 8px 28px ${colors.textPrimary}25`,
          gap: 10,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${activity.title} Beacon details`}
            onPress={() => onOpenDetail(activity.id)}
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <ActivityBadge category={activity.category} size={38} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
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
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                {owner ? <ProfileAvatar profile={owner} size={20} /> : null}
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
                <ArrowUpRight size={14} color={colors.accent} />
              </View>
            </View>
          </Pressable>
          {hasPhysicalDestination && onDirections ? (
            <IconButton
              label={`Directions to ${place?.label ?? "Beacon"}`}
              onPress={() => onDirections(activity.id)}
            >
              <Navigation size={18} color={colors.accent} />
            </IconButton>
          ) : null}
          <IconButton label="Dismiss Beacon preview" onPress={onDismiss}>
            <X size={18} color={colors.textSecondary} />
          </IconButton>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${activity.title} Beacon details`}
          onPress={() => onOpenDetail(activity.id)}
          style={{ gap: 10 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {canReadPlace ? (
              <>
                <Clock3 size={15} color={colors.accent} />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 13,
                    fontWeight: "600",
                    flexShrink: 1,
                  }}
                >
                  {activityWhen(activity, new Date(now))}
                </Text>
                <MapPin size={15} color={colors.textSecondary} />
                <Text
                  numberOfLines={1}
                  style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}
                >
                  {place?.online_url
                    ? "Virtual"
                    : (place?.label ?? "Place to be decided")}
                </Text>
              </>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Meeting details aren’t shared with you yet.
              </Text>
            )}
            {canReadPlace && locationDistance ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {locationDistance}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <AvatarStack people={people} limit={4} size={26} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {capacity.count} going
            </Text>
            {activity.target_count != null &&
            activity.target_count > capacity.count ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                · need {activity.target_count - capacity.count} more
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
                {capacity.remaining}{" "}
                {capacity.remaining === 1 ? "spot" : "spots"} left
              </Text>
            ) : null}
          </View>
          {progressGoal ? (
            <ProgressBar
              value={capacity.count}
              max={progressGoal}
              label={`${capacity.count} of ${progressGoal} Beacon places`}
              style={{ height: tokens.space.xs }}
            />
          ) : null}
        </Pressable>
        <MapBeaconRsvp activity={activity} compact />
      </GlassBar>
    </Pressable>
  );
}

export function MapPreviewCarousel({
  visibleActivities,
  selectedId,
  viewerCoordinate,
  onSelect,
  onOpenDetail,
  onDirections,
  onDismiss,
  hidden = false,
}: MapPreviewCarouselProps) {
  const { data, userId } = useBeacon();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { tokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const listRef = useRef<FlashListRef<Activity>>(null);
  const cardWidth = screenWidth - tokens.layout.screenGutter * 2;
  const cardHeight = Math.max(204, Math.min(260, screenHeight * 0.36));
  const stride = cardWidth + 12;
  const listLoaded = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const pendingSelection = useRef<{ id: ID } | null>(null);
  const scrollInFlight = useRef<{ id: ID } | null>(null);
  const latestFlushPendingSelection = useRef<() => void>(() => undefined);
  const userDragActive = useRef(false);
  const userMomentumActive = useRef(false);
  const userDragResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readable = useMemo(
    () =>
      visibleActivities.filter(
        (activity) => !!userId && canReadBeaconActivity(data, activity, userId),
      ),
    [data, userId, visibleActivities],
  );
  const activities = useMemo(() => {
    const selected = readable.find((activity) => activity.id === selectedId);
    if (!selected) return [];
    const selectedPlace =
      userId && canReadBeaconMeetingDetails(data, selected, userId)
        ? data.places.find((place) => place.activity_id === selected.id)
        : undefined;
    if (
      selectedPlace?.online_url ||
      selectedPlace?.latitude == null ||
      selectedPlace.longitude == null
    )
      return [selected];
    return readable.filter((activity) => {
      if (activity.id === selected.id) return true;
      if (!userId || !canReadBeaconMeetingDetails(data, activity, userId))
        return false;
      const place = data.places.find(
        (candidate) => candidate.activity_id === activity.id,
      );
      return (
        !!place &&
        !place.online_url &&
        place.latitude != null &&
        place.longitude != null
      );
    });
  }, [data, readable, selectedId, userId]);
  const selectedIndex = activities.findIndex(
    (activity) => activity.id === selectedId,
  );

  const flushPendingSelection = useCallback(() => {
    if (
      hidden ||
      !listLoaded.current ||
      scrollInFlight.current != null ||
      scrollFrame.current != null
    )
      return;
    const request = pendingSelection.current;
    if (!request) return;

    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      if (
        hidden ||
        pendingSelection.current !== request ||
        scrollInFlight.current != null
      )
        return;

      const index = activities.findIndex(
        (activity) => activity.id === request.id,
      );
      const list = listRef.current;
      if (index < 0 || index >= activities.length || !list) return;
      const committedData = list.props.data;
      if (
        !committedData ||
        index >= committedData.length ||
        committedData[index]?.id !== request.id
      )
        return;

      // FlashList 2 may commit the data change before the selected item's
      // layout exists. Wait for onLoad/onCommitLayoutEffect to retry instead
      // of calling scrollToIndex with an index beyond the current layouts.
      let layout: ReturnType<FlashListRef<Activity>["getLayout"]>;
      try {
        layout = list.getLayout(index);
      } catch (error) {
        if (isFlashListLayoutNotReady(error)) return;
        throw error;
      }
      if (!layout || layout.width <= 0 || layout.height <= 0) return;

      scrollInFlight.current = request;
      const settleScroll = (completed: boolean) => {
        if (scrollInFlight.current !== request) return;
        scrollInFlight.current = null;
        if (completed && pendingSelection.current === request)
          pendingSelection.current = null;
        if (pendingSelection.current && pendingSelection.current !== request)
          latestFlushPendingSelection.current();
      };

      try {
        void list
          .scrollToIndex({
            index,
            animated: !reducedMotion,
            viewPosition: 0,
          })
          .then(() => settleScroll(true))
          .catch((error: unknown) => {
            settleScroll(false);
            if (isFlashListLayoutNotReady(error)) return;
            throw error;
          });
      } catch (error) {
        settleScroll(false);
        if (isFlashListLayoutNotReady(error)) return;
        throw error;
      }
    });
  }, [activities, hidden, reducedMotion]);
  useLayoutEffect(() => {
    latestFlushPendingSelection.current = flushPendingSelection;
  }, [flushPendingSelection]);

  useEffect(() => {
    if (scrollFrame.current != null) {
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = null;
    }
    if (hidden || !selectedId || selectedIndex < 0) {
      pendingSelection.current = null;
      if (hidden) listLoaded.current = false;
      return;
    }

    const request = { id: selectedId };
    pendingSelection.current = request;
    flushPendingSelection();
    return () => {
      if (pendingSelection.current === request)
        pendingSelection.current = null;
      if (scrollFrame.current != null) {
        cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = null;
      }
    };
  }, [activities, flushPendingSelection, hidden, selectedId, selectedIndex]);

  const handleListLoad = useCallback(() => {
    listLoaded.current = true;
    flushPendingSelection();
  }, [flushPendingSelection]);

  const renderItem = useCallback(
    ({ item }: { item: Activity }) => (
      <PreviewCard
        activity={item}
        width={cardWidth}
        cardHeight={cardHeight}
        viewerCoordinate={viewerCoordinate}
        onOpenDetail={onOpenDetail}
        onDirections={onDirections}
        onDismiss={onDismiss}
      />
    ),
    [
      cardHeight,
      cardWidth,
      onDirections,
      onDismiss,
      onOpenDetail,
      viewerCoordinate,
    ],
  );
  const keyExtractor = useCallback((activity: Activity) => activity.id, []);
  const ItemSeparator = useCallback(() => <View style={{ width: 12 }} />, []);
  const selectFromUserScroll = useCallback(
    (offset: number) => {
      const index = Math.max(
        0,
        Math.min(activities.length - 1, Math.round(offset / stride)),
      );
      const activity = activities[index];
      if (activity && activity.id !== selectedId) onSelect(activity.id);
    },
    [activities, onSelect, selectedId, stride],
  );
  const onScrollBeginDrag = useCallback(() => {
    if (userDragResetTimer.current != null) {
      clearTimeout(userDragResetTimer.current);
      userDragResetTimer.current = null;
    }
    userDragActive.current = true;
    userMomentumActive.current = false;
  }, []);
  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (userDragResetTimer.current != null)
        clearTimeout(userDragResetTimer.current);
      const offset = event.nativeEvent.contentOffset.x;
      userDragResetTimer.current = setTimeout(() => {
        userDragResetTimer.current = null;
        if (!userDragActive.current || userMomentumActive.current) return;
        userDragActive.current = false;
        selectFromUserScroll(offset);
      }, 250);
    },
    [selectFromUserScroll],
  );
  const onMomentumScrollBegin = useCallback(() => {
    if (!userDragActive.current) return;
    userMomentumActive.current = true;
    if (userDragResetTimer.current != null) {
      clearTimeout(userDragResetTimer.current);
      userDragResetTimer.current = null;
    }
  }, []);
  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!userDragActive.current || !userMomentumActive.current) return;
      userDragActive.current = false;
      userMomentumActive.current = false;
      selectFromUserScroll(event.nativeEvent.contentOffset.x);
    },
    [selectFromUserScroll],
  );

  useEffect(
    () => () => {
      if (userDragResetTimer.current != null)
        clearTimeout(userDragResetTimer.current);
      if (scrollFrame.current != null)
        cancelAnimationFrame(scrollFrame.current);
    },
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > 12 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy < -46) {
            const current = activities.find(
              (activity) => activity.id === selectedId,
            );
            if (current) onOpenDetail(current.id);
          } else if (gesture.dy > 46) {
            onDismiss();
          }
        },
      }),
    [activities, onDismiss, onOpenDetail, selectedId],
  );

  if (hidden || !selectedId || selectedIndex < 0) return null;

  return (
    <View
      testID="map-tooltip"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: tokens.layout.screenGutter,
        right: tokens.layout.screenGutter,
        bottom: 108,
        zIndex: 30,
        elevation: Platform.OS === "web" ? undefined : 30,
        alignItems: "center",
      }}
      {...panResponder.panHandlers}
    >
      <FlashList
        ref={listRef}
        horizontal
        data={activities}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        extraData={selectedId}
        onLoad={handleListLoad}
        onCommitLayoutEffect={flushPendingSelection}
        snapToInterval={stride}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollBegin={onMomentumScrollBegin}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingHorizontal: 0 }}
        style={{ width: cardWidth, height: cardHeight }}
      />
    </View>
  );
}
