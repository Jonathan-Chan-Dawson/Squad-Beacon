import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Bookmark,
  Check,
  Clock3,
  Flag,
  MapPin,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Share2,
  Star,
} from "lucide-react-native";
import Swipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { Activity, Category } from "@/src/shared/types";
import {
  Avatar,
  AvatarStack,
  Card,
  IconButton,
  PrimaryButton,
  SecondaryButton,
  uiHaptics,
  useDesignTheme,
  useReducedMotion,
} from "@/src/shared/design-system";
import { Sheet } from "@/src/shared/ui";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { useNow } from "@/src/shared/useNow";

export type FeedRsvpStatus = "going" | "interested" | "requested" | "invited";
export type FeedRsvpAction = "going" | "interested" | "withdraw";

export type BeaconFeedAvatar = {
  id: string;
  name: string;
};

export type BeaconFeedLocation = {
  label: string;
  kind: "physical" | "online";
  /** A distance string calculated from a fresh, authorized location. */
  distanceLabel?: string | null;
};

export interface BeaconFeedCardProps {
  activityId: string;
  title: string;
  category: Category;
  activityMode: Activity["mode"];
  startsAt: string;
  endsAt: string;
  activityStatus: Activity["status"];
  whenLabel?: string;
  hostName: string;
  /** A URI the caller is already authorized to show. */
  hostAvatarUri?: string | null;
  /** Omit this field when the viewer cannot read the location. */
  location?: BeaconFeedLocation | null;
  /** Only profiles permitted by the caller should be passed here. */
  goingAvatars: readonly BeaconFeedAvatar[];
  goingCount: number;
  target: number | null;
  capacityRemaining: number | null;
  rsvpStatus: FeedRsvpStatus | null;
  approved: boolean;
  approvalRequired: boolean;
  isHost: boolean;
  isFull: boolean;
  isClosed: boolean;
  isPast: boolean;
  saved: boolean;
  onOpen: () => void;
  /** Reject on failure so the card can show an error and avoid success feedback. */
  onRSVP: (status: FeedRsvpAction) => Promise<void> | void;
  /** Opens the route's RSVP choices when the viewer is already Going. */
  onChangeRSVP?: () => Promise<void> | void;
  onMap?: () => void;
  onChat?: () => void;
  onSave: () => Promise<void> | void;
  onShare: () => Promise<void> | void;
  /** The route should open its confirmed Report flow. */
  onReport?: () => Promise<void> | void;
  /** Temporarily disables PagerView while the swipe rail owns a gesture. */
  onCardSwipeStateChange?: (active: boolean) => void;
}

type CardAction = "rsvp" | "change" | "save" | "share" | "report" | null;

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

function formatDateTime(value: number) {
  if (!Number.isFinite(value)) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function LiveIndicator({ reducedMotion }: { reducedMotion: boolean }) {
  const { colors } = useDesignTheme();
  const pulse = useSharedValue(0);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.58 + pulse.value * 0.42,
    transform: [{ scale: 0.88 + pulse.value * 0.12 }],
  }));

  useEffect(() => {
    cancelAnimation(pulse);
    if (!reducedMotion) {
      pulse.value = withRepeat(
        withTiming(1, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    } else {
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotion]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Animated.View
        accessibilityElementsHidden
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.accent,
          },
          pulseStyle,
        ]}
      />
      <Text
        style={{
          color: colors.accent,
          fontWeight: "700",
          fontSize: 12,
          lineHeight: 16,
        }}
      >
        Live
      </Text>
    </View>
  );
}

function SwipeReveal({
  progress,
  label,
  color,
  backgroundColor,
  icon,
  style,
}: {
  progress: SharedValue<number>;
  label: string;
  color: string;
  backgroundColor: string;
  icon: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value)),
  }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: 132,
          minHeight: 150,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 12,
          backgroundColor,
        },
        style,
        animatedStyle,
      ]}
    >
      {icon}
      <Text
        style={{
          color,
          fontSize: 14,
          lineHeight: 18,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export function BeaconFeedCard({
  activityId,
  title,
  category,
  activityMode,
  startsAt,
  endsAt,
  activityStatus,
  whenLabel,
  hostName,
  hostAvatarUri,
  location,
  goingAvatars,
  goingCount,
  target,
  capacityRemaining,
  rsvpStatus,
  approved,
  approvalRequired,
  isHost,
  isFull,
  isClosed,
  isPast,
  saved,
  onOpen,
  onRSVP,
  onChangeRSVP,
  onMap,
  onChat,
  onSave,
  onShare,
  onReport,
  onCardSwipeStateChange,
}: BeaconFeedCardProps) {
  const { colors, tokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const now = useNow();
  const [menuVisible, setMenuVisible] = useState(false);
  const [busyAction, setBusyAction] = useState<CardAction>(null);
  const [actionError, setActionError] = useState("");
  const actionLock = useRef(false);
  const swipeableRef = useRef<SwipeableMethods | null>(null);
  const swipeActiveRef = useRef(false);
  const swipeCallbackRef = useRef(onCardSwipeStateChange);

  const startTime = Date.parse(startsAt);
  const endTime = Date.parse(endsAt);
  const validInterval =
    Number.isFinite(startTime) &&
    Number.isFinite(endTime) &&
    endTime > startTime;
  const isLive =
    activityStatus === "scheduled" &&
    validInterval &&
    startTime <= now &&
    endTime > now;
  const elapsedPercent = isLive
    ? Math.max(
        0,
        Math.min(100, ((now - startTime) / (endTime - startTime)) * 100),
      )
    : 0;
  const endsInMinutes = isLive
    ? Math.max(1, Math.ceil((endTime - now) / 60_000))
    : 0;
  const isEnded =
    isPast ||
    activityStatus === "completed" ||
    (validInterval && endTime <= now);
  const isCancelled = activityStatus === "cancelled";
  const requestPending =
    rsvpStatus === "requested" ||
    (rsvpStatus === "going" && approvalRequired && !approved);
  const isGoing = rsvpStatus === "going" && !requestPending;
  const isResponseClosed = isHost || isEnded || isCancelled || isClosed;
  const isSolo = activityMode === "solo";
  // Remaining spots are informational for soft capacity; only the canonical strict limit closes joining.
  const full = isFull;
  const canSwipe =
    !isResponseClosed &&
    !isSolo &&
    !full &&
    !requestPending &&
    !isGoing &&
    busyAction === null;
  const categoryToken = tokens.categories[category];

  const notifySwipeState = useCallback((active: boolean) => {
    if (swipeActiveRef.current === active) return;
    swipeActiveRef.current = active;
    swipeCallbackRef.current?.(active);
  }, []);

  useEffect(() => {
    swipeCallbackRef.current = onCardSwipeStateChange;
  }, [onCardSwipeStateChange]);

  useEffect(
    () => () => {
      if (swipeActiveRef.current) {
        swipeActiveRef.current = false;
        swipeCallbackRef.current?.(false);
      }
    },
    [],
  );

  const runRsvp = useCallback(
    async (status: FeedRsvpAction) => {
      if (
        actionLock.current ||
        busyAction !== null ||
        isHost ||
        isSolo ||
        isEnded ||
        isCancelled
      )
        return;
      if (status === "going" && (isClosed || full)) return;
      // Existing responses can be withdrawn even when new joins are closed or full.
      if (
        status === "withdraw" &&
        !isGoing &&
        !requestPending &&
        rsvpStatus !== "interested"
      )
        return;
      actionLock.current = true;
      setBusyAction("rsvp");
      setActionError("");
      try {
        await onRSVP(status);
        if (status !== "withdraw") void uiHaptics.success();
      } catch (error) {
        setActionError(readableError(error, "Could not update your response."));
      } finally {
        actionLock.current = false;
        setBusyAction(null);
        swipeableRef.current?.close();
        notifySwipeState(false);
      }
    },
    [
      busyAction,
      full,
      isHost,
      isSolo,
      isEnded,
      isCancelled,
      isClosed,
      isGoing,
      requestPending,
      rsvpStatus,
      notifySwipeState,
      onRSVP,
    ],
  );

  const runAction = useCallback(
    async (
      action: Exclude<CardAction, "rsvp" | null>,
      callback: () => Promise<void> | void,
      fallback: string,
    ) => {
      if (actionLock.current || busyAction !== null) return;
      actionLock.current = true;
      setBusyAction(action);
      setActionError("");
      try {
        await callback();
      } catch (error) {
        setActionError(readableError(error, fallback));
      } finally {
        actionLock.current = false;
        setBusyAction(null);
      }
    },
    [busyAction],
  );

  const whenText = (() => {
    if (isCancelled) return "Cancelled";
    if (isEnded) return "Ended";
    if (isLive) {
      return endsInMinutes === 1
        ? "Ends in 1 min"
        : `Ends in ${endsInMinutes} min`;
    }
    if (validInterval && startTime > now) {
      const minutes = Math.ceil((startTime - now) / 60_000);
      if (minutes < 60)
        return minutes <= 1 ? "Starts now" : `Starts in ${minutes} min`;
      return whenLabel || formatDateTime(startTime);
    }
    return whenLabel || "";
  })();

  const primaryTitle = isHost
    ? "Manage Beacon"
    : isCancelled
      ? "Cancelled"
      : isEnded
        ? "Ended"
        : isSolo
          ? "Solo activity"
          : requestPending
            ? "Request pending"
            : isGoing
              ? onChangeRSVP
                ? "Going ✓"
                : "I'm Out"
              : full
                ? "Full"
                : isClosed
                  ? "Closed"
                  : approvalRequired && !approved
                    ? "Request to join"
                    : rsvpStatus === "invited"
                      ? "Accept invitation"
                      : "I'm In";
  const primaryDisabled =
    busyAction !== null ||
    (!isHost &&
      (isCancelled ||
        isEnded ||
        isSolo ||
        requestPending ||
        (!isGoing && (isClosed || full))));

  const onPrimaryPress = () => {
    if (isHost) {
      onOpen();
    } else if (isGoing && onChangeRSVP) {
      void runAction("change", onChangeRSVP, "Could not open RSVP options.");
    } else if (isGoing) {
      void runRsvp("withdraw");
    } else if (!primaryDisabled) {
      void runRsvp("going");
    }
  };

  const onSwipeableOpen = (
    direction: SwipeDirection.LEFT | SwipeDirection.RIGHT,
  ) => {
    if (!canSwipe) {
      swipeableRef.current?.close();
      notifySwipeState(false);
      return;
    }
    void runRsvp(direction === SwipeDirection.RIGHT ? "going" : "interested");
  };

  const responseLabel = requestPending
    ? "Request pending"
    : rsvpStatus === "invited"
      ? "You are invited"
      : isGoing
        ? "You are going"
        : rsvpStatus === "interested"
          ? "You are considering it"
          : "";

  const card = (
    <Card
      testID={`beacon-feed-card-${activityId}`}
      style={{
        padding: tokens.space.md,
        gap: tokens.space.md,
        borderLeftWidth: 4,
        borderLeftColor: categoryToken.color,
        borderRadius: tokens.radius.card,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: tokens.space.sm,
        }}
      >
        <ActivityBadge category={category} size={42} />
        <View style={{ flex: 1, minWidth: 0, gap: tokens.space.xs }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: tokens.space.xs,
            }}
          >
            <Text
              style={{
                color: categoryToken.color,
                fontSize: tokens.type.caption.fontSize,
                lineHeight: tokens.type.caption.lineHeight,
                fontWeight: tokens.type.weight.bold,
                textTransform: "uppercase",
                letterSpacing: 0.45,
              }}
            >
              {category}
            </Text>
            {isLive ? <LiveIndicator reducedMotion={reducedMotion} /> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${title} details`}
            onPress={onOpen}
            onLongPress={() => {
              setMenuVisible(true);
              void uiHaptics.light();
            }}
            delayLongPress={450}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              accessibilityRole="header"
              numberOfLines={2}
              maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
              style={{
                color: colors.textPrimary,
                ...tokens.type.titleSmall,
                fontWeight: tokens.type.weight.bold,
              }}
            >
              {title}
            </Text>
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.space.sm,
            }}
          >
            {hostAvatarUri ? (
              <Image
                accessibilityLabel={`${hostName}'s profile photo`}
                source={{ uri: hostAvatarUri }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: colors.surfaceRaised,
                }}
              />
            ) : (
              <Avatar
                name={hostName}
                size={30}
                accessibilityLabel={`Avatar for ${hostName}`}
              />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={tokens.type.denseMaxMultiplier}
                style={{
                  color: colors.textPrimary,
                  ...tokens.type.secondary,
                  fontWeight: tokens.type.weight.semibold,
                }}
              >
                {hostName}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  ...tokens.type.caption,
                }}
              >
                Host
              </Text>
            </View>
            <IconButton
              label="More Beacon actions"
              onPress={() => setMenuVisible(true)}
              disabled={busyAction !== null}
            >
              <MoreHorizontal size={20} color={colors.textPrimary} />
            </IconButton>
          </View>
        </View>
      </View>

      {whenText || location ? (
        <View style={{ gap: tokens.space.xs }}>
          {whenText ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.space.xs,
              }}
            >
              {isLive ? (
                <Clock3 size={16} color={colors.accent} />
              ) : (
                <Clock3 size={16} color={colors.textSecondary} />
              )}
              <Text
                accessibilityLabel={isLive ? `Live now, ${whenText}` : whenText}
                style={{
                  color: isLive ? colors.accent : colors.textSecondary,
                  ...tokens.type.secondary,
                  fontWeight: isLive
                    ? tokens.type.weight.semibold
                    : tokens.type.weight.regular,
                }}
              >
                {whenText}
              </Text>
            </View>
          ) : null}
          {isLive ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${title} elapsed time`}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(elapsedPercent),
              }}
              style={{
                height: 4,
                borderRadius: 2,
                overflow: "hidden",
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <View
                style={{
                  width: `${elapsedPercent}%`,
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          ) : null}
          {location ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.space.xs,
              }}
            >
              {location.kind === "online" ? (
                <Monitor size={16} color={categoryToken.color} />
              ) : (
                <MapPin size={16} color={categoryToken.color} />
              )}
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.textPrimary,
                  ...tokens.type.secondary,
                }}
              >
                {location.label}
              </Text>
              {location.distanceLabel ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textSecondary,
                    ...tokens.type.caption,
                  }}
                >
                  {location.distanceLabel}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.space.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          {goingAvatars.length ? (
            <AvatarStack people={goingAvatars} size={30} limit={3} />
          ) : null}
          <Text
            numberOfLines={1}
            accessibilityLabel={`${goingCount} ${goingCount === 1 ? "person" : "people"} going`}
            style={{
              flexShrink: 1,
              color: colors.textPrimary,
              ...tokens.type.secondary,
              fontWeight: tokens.type.weight.semibold,
            }}
          >
            {goingCount} going
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          {target !== null && target > 0 ? (
            <Text
              style={{ color: colors.textSecondary, ...tokens.type.caption }}
            >
              {target > goingCount
                ? `Need ${Math.max(0, target - goingCount)} more`
                : "Goal met"}
            </Text>
          ) : null}
          {capacityRemaining !== null ? (
            <Text
              style={{ color: colors.textSecondary, ...tokens.type.caption }}
            >
              {capacityRemaining} {capacityRemaining === 1 ? "spot" : "spots"}{" "}
              left
            </Text>
          ) : null}
        </View>
      </View>

      {responseLabel ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: isGoing ? colors.accent : colors.textSecondary,
            ...tokens.type.caption,
            fontWeight: tokens.type.weight.semibold,
          }}
        >
          {responseLabel}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: tokens.space.sm }}>
        <PrimaryButton
          title={busyAction === "rsvp" ? "Updating…" : primaryTitle}
          loading={busyAction === "rsvp" || busyAction === "change"}
          disabled={primaryDisabled || busyAction !== null}
          onPress={onPrimaryPress}
          accessibilityLabel={
            isHost
              ? `Manage ${title}`
              : isGoing && onChangeRSVP
                ? "Change RSVP"
                : primaryTitle
          }
          style={{ flex: 1, minHeight: 52 }}
        />
        {requestPending ? (
          <SecondaryButton
            title="Cancel request"
            compact
            disabled={busyAction !== null || isEnded || isCancelled}
            loading={busyAction === "rsvp"}
            onPress={() => void runRsvp("withdraw")}
            style={{ minHeight: 52 }}
          />
        ) : !isHost && !isEnded && !isCancelled && !isSolo && !isGoing ? (
          <SecondaryButton
            title={rsvpStatus === "interested" ? "Maybe ✓" : "Maybe"}
            compact
            disabled={busyAction !== null || rsvpStatus === "interested"}
            loading={busyAction === "rsvp"}
            onPress={() => void runRsvp("interested")}
            accessibilityState={{ selected: rsvpStatus === "interested" }}
            style={{ minWidth: 94, minHeight: 52 }}
          />
        ) : null}
      </View>

      {onMap || onChat || saved ? (
        <View style={{ flexDirection: "row", gap: tokens.space.sm }}>
          {onMap ? (
            <IconButton label={`View ${title} on map`} onPress={onMap}>
              <MapPin size={19} color={categoryToken.color} />
            </IconButton>
          ) : null}
          {onChat ? (
            <IconButton label={`Open ${title} chat`} onPress={onChat}>
              <MessageCircle size={19} color={categoryToken.color} />
            </IconButton>
          ) : null}
          {saved ? (
            <Text
              accessibilityLabel="Saved Beacon"
              style={{
                marginLeft: "auto",
                alignSelf: "center",
                color: colors.accent,
                ...tokens.type.caption,
                fontWeight: tokens.type.weight.semibold,
              }}
            >
              Saved
            </Text>
          ) : null}
        </View>
      ) : null}

      {actionError ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger, ...tokens.type.caption }}
        >
          {actionError}
        </Text>
      ) : null}
    </Card>
  );

  return (
    <View style={{ gap: tokens.space.xs }}>
      {canSwipe ? (
        <Swipeable
          ref={swipeableRef}
          enabled={canSwipe}
          friction={1.15}
          leftThreshold={102}
          rightThreshold={102}
          overshootLeft={false}
          overshootRight={false}
          containerStyle={{
            borderRadius: tokens.radius.card,
            overflow: "hidden",
          }}
          childrenContainerStyle={{ borderRadius: tokens.radius.card }}
          onSwipeableOpenStartDrag={() => notifySwipeState(true)}
          onSwipeableCloseStartDrag={() => notifySwipeState(false)}
          onSwipeableWillClose={() => notifySwipeState(false)}
          onSwipeableClose={() => notifySwipeState(false)}
          onSwipeableOpen={onSwipeableOpen}
          renderLeftActions={(progress) => (
            <SwipeReveal
              progress={progress}
              label="I'm In"
              color={colors.onAccent}
              backgroundColor={colors.accent}
              icon={<Check size={18} color={colors.onAccent} />}
            />
          )}
          renderRightActions={(progress) => (
            <SwipeReveal
              progress={progress}
              label="Maybe"
              color={categoryToken.color}
              backgroundColor={categoryToken.tint}
              icon={<Star size={17} color={categoryToken.color} />}
            />
          )}
        >
          {card}
        </Swipeable>
      ) : (
        card
      )}
      <Sheet
        title="Beacon actions"
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        maxHeightPercent={60}
      >
        <Text style={{ color: colors.textSecondary, ...tokens.type.secondary }}>
          {title}
        </Text>
        <SecondaryButton
          title={saved ? "Remove from saved Beacons" : "Save Beacon"}
          icon={<Bookmark size={18} color={colors.textPrimary} />}
          disabled={busyAction !== null}
          onPress={() => {
            setMenuVisible(false);
            void runAction("save", onSave, "Could not update saved Beacons.");
          }}
          style={{ minHeight: 48 }}
        />
        <SecondaryButton
          title="Share Beacon"
          icon={<Share2 size={18} color={colors.textPrimary} />}
          disabled={busyAction !== null}
          onPress={() => {
            setMenuVisible(false);
            void runAction("share", onShare, "Could not share this Beacon.");
          }}
          style={{ minHeight: 48 }}
        />
        {onReport ? (
          <SecondaryButton
            title="Report Beacon"
            icon={<Flag size={18} color={colors.danger} />}
            disabled={busyAction !== null}
            onPress={() => {
              setMenuVisible(false);
              void runAction(
                "report",
                onReport,
                "Could not open the report flow.",
              );
            }}
            style={{ minHeight: 48 }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}
