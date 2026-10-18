import {
  BeaconCardEngagement,
  BeaconToolMenuRows,
} from "./BeaconCardEngagement";
import { ActionRow, ContextMenu, MenuGroup } from "@/src/shared/ContextMenu";
import {
  cardSecondaryMetadata,
  compactCountdown,
  discoveryPrimaryLabel,
} from "../cardPresentation";
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
  ChevronRight,
  UsersRound,
  CircleHelp,
  LogOut,
  X,
  UserRound,
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
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { useNow } from "@/src/shared/useNow";
import { HomeAction } from "./HomeAction";
import { BeaconIcon } from "./BeaconIcon";

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
  /** Homepage-only display treatments; other lists retain their existing layout. */
  presentation?: "personal-preview" | "home" | "discovery";
  decorationEmoji?: string | null;
  /** Use the compact home/list treatment while keeping the same permission and RSVP callbacks. */
  compact?: boolean;
  /** Emphasize a confirmed personal Beacon on the home hub. */
  featured?: boolean;
  planRelation?: string | null;
  compactFooter?: React.ReactNode;
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
  /** Existing approval can allow an invitation to be accepted without another request. */
  joinApprovalGranted?: boolean;
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
  presentation,
  decorationEmoji,
  compact = false,
  featured = false,
  planRelation,
  compactFooter,
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
  joinApprovalGranted,
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
  const menuAnchor = useRef<View>(null);
  const menuContinuation = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      menuContinuation.current = null;
    },
    [],
  );
  const afterMenu = (callback: () => void) => {
    menuContinuation.current = callback;
    setMenuVisible(false);
  };
  const menuDismissed = () => {
    const callback = menuContinuation.current;
    menuContinuation.current = null;
    callback?.();
  };
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
  const editorial = presentation === "home" || presentation === "discovery";
  const secondaryMetadata = cardSecondaryMetadata(title, location, hostName);
  const categoryToken = tokens.categories[category] ?? tokens.categories.Other;

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
      return editorial
        ? compactCountdown("Ends", endsInMinutes)
        : endsInMinutes === 1
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
  const compactOpensActivity =
    featured ||
    isHost ||
    isCancelled ||
    isEnded ||
    isSolo ||
    requestPending ||
    isGoing ||
    full ||
    isClosed;
  const compactPrimaryTitle = editorial
    ? discoveryPrimaryLabel({
        pending: requestPending,
        opens: compactOpensActivity,
        requiresApproval: approvalRequired && !approved,
        approvalGranted: joinApprovalGranted,
      })
    : featured
      ? isLive
        ? "Return to Beacon"
        : "Open Beacon"
      : isHost
        ? "Manage"
        : compactOpensActivity
          ? isLive && isGoing
            ? "Return"
            : "Open"
          : approvalRequired && !approved
            ? "Request"
            : "I’m In";
  const onCompactPrimaryPress = () => {
    if (compactOpensActivity) onOpen();
    else void runRsvp("going");
  };

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

  if (presentation === "personal-preview")
    return (
      <Pressable
        testID="personal-activity-preview"
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}`}
        onPress={onOpen}
        style={({ pressed }) => ({
          minHeight: 68,
          paddingHorizontal: 10,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <BeaconIcon emoji={decorationEmoji} category={category} size={32} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              lineHeight: 20,
              fontWeight: "500",
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: isLive ? colors.accent : colors.textSecondary,
              fontSize: 12,
              lineHeight: 16,
              fontWeight: "400",
            }}
          >
            {[whenText, isHost ? "Hosting" : isGoing ? "Going" : responseLabel]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        <ChevronRight size={17} color={colors.textSecondary} />
      </Pressable>
    );

  const card = (
    <Card
      testID={`beacon-feed-card-${activityId}`}
      style={{
        padding: editorial ? 0 : compact ? tokens.space.sm : tokens.space.md,
        gap: editorial ? 0 : compact ? tokens.space.sm : tokens.space.md,
        borderWidth: editorial ? 0 : 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        borderLeftWidth: editorial ? 0 : 4,
        borderLeftColor: categoryToken.color,
        borderRadius: editorial ? 0 : tokens.radius.card,
        backgroundColor: colors.surface,
      }}
    >
      {editorial ? (
        <>
          <View
            testID="discovery-editorial-row"
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              paddingVertical: 8,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${title}`}
              onPress={onOpen}
              style={{ width: 64, gap: 6 }}
            >
              <View
                testID="beacon-category-artwork"
                style={{
                  width: 64,
                  height: 68,
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: categoryToken.tint,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    width: 58,
                    height: 58,
                    borderRadius: 29,
                    borderWidth: 1,
                    borderColor: categoryToken.color,
                    opacity: 0.15,
                    top: -18,
                    right: -18,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    borderWidth: 1,
                    borderColor: categoryToken.color,
                    opacity: 0.15,
                    bottom: -12,
                    left: -8,
                  }}
                />
                <BeaconIcon
                  emoji={decorationEmoji}
                  category={category}
                  size={38}
                />
              </View>
              <Text
                numberOfLines={2}
                style={{
                  color: categoryToken.color,
                  fontSize: 10,
                  lineHeight: 14,
                  textAlign: "center",
                  fontWeight: "500",
                }}
              >
                {category}
              </Text>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${title} details`}
                  onPress={onOpen}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 44,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    accessibilityRole="header"
                    numberOfLines={2}
                    style={{
                      color: colors.textPrimary,
                      fontSize: 16,
                      lineHeight: 21,
                      fontWeight: "500",
                    }}
                  >
                    {title}
                  </Text>
                </Pressable>
                <View
                  testID="discovery-going-count"
                  style={{
                    flexShrink: 0,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    paddingTop: 3,
                  }}
                >
                  <UsersRound size={12} color={colors.textSecondary} />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      lineHeight: 16,
                    }}
                  >
                    {goingCount} going
                  </Text>
                </View>
              </View>
              <View
                style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
              >
                <Clock3
                  size={13}
                  color={isLive ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={{
                    flex: 1,
                    color: isLive ? colors.accent : colors.textSecondary,
                    fontSize: 12,
                    lineHeight: 17,
                  }}
                >
                  {isLive ? `Live · ${whenText}` : whenText}
                </Text>
              </View>
              {secondaryMetadata ? (
                <View
                  style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
                >
                  {secondaryMetadata.kind === "online" ? (
                    <Monitor size={13} color={colors.textSecondary} />
                  ) : secondaryMetadata.kind === "host" ? (
                    <UserRound size={13} color={colors.textSecondary} />
                  ) : (
                    <MapPin size={13} color={colors.textSecondary} />
                  )}
                  <Text
                    testID="discovery-secondary-metadata"
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: colors.textSecondary,
                      fontSize: 12,
                      lineHeight: 17,
                    }}
                  >
                    {secondaryMetadata.label}
                  </Text>
                </View>
              ) : null}
              {responseLabel ? (
                <Text
                  style={{
                    color: isGoing ? colors.accent : colors.textSecondary,
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                >
                  {responseLabel}
                </Text>
              ) : null}
              {actionError ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.danger, fontSize: 12 }}
                >
                  {actionError}
                </Text>
              ) : null}
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 4,
            }}
          >
            <BeaconCardEngagement activityId={activityId} />
            <View
              testID="discovery-card-actions"
              style={{
                marginLeft: "auto",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 4,
                flexWrap: "wrap",
              }}
            >
              <View>
                <HomeAction
                  title={
                    busyAction === "rsvp" ? "Updating…" : compactPrimaryTitle
                  }
                  label={compactPrimaryTitle}
                  primary
                  disabled={busyAction !== null}
                  onPress={onCompactPrimaryPress}
                  testID={`home-beacon-action-${activityId}`}
                />
              </View>
              <HomeAction
                label={saved ? "Remove from saved Beacons" : "Save Beacon"}
                onPress={() =>
                  void runAction(
                    "save",
                    onSave,
                    "Could not update saved Beacons.",
                  )
                }
                disabled={busyAction !== null}
                plain
                icon={
                  <Bookmark
                    size={17}
                    fill={saved ? colors.accent : "none"}
                    color={saved ? colors.accent : colors.textSecondary}
                  />
                }
              />
              <View ref={menuAnchor} collapsable={false}>
                <HomeAction
                  label="More Beacon actions"
                  onPress={() => setMenuVisible(true)}
                  disabled={busyAction !== null}
                  plain
                  icon={
                    <MoreHorizontal size={18} color={colors.textSecondary} />
                  }
                />
              </View>
            </View>
          </View>
        </>
      ) : compact ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: tokens.space.sm,
            }}
          >
            <ActivityBadge category={category} size={36} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.space.xs,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color: categoryToken.color,
                    fontSize: tokens.type.caption.fontSize,
                    lineHeight: tokens.type.caption.lineHeight,
                    fontWeight: tokens.type.weight.bold,
                    textTransform: "uppercase",
                    letterSpacing: 0.45,
                  }}
                >
                  {category}
                  {featured ? (isLive ? " · LIVE" : " · UP NEXT") : ""}
                </Text>
                {isLive ? (
                  <LiveIndicator reducedMotion={reducedMotion} />
                ) : null}
                <Text
                  accessibilityLabel={`${goingCount} ${goingCount === 1 ? "person" : "people"} going`}
                  numberOfLines={1}
                  style={{
                    color: colors.textSecondary,
                    ...tokens.type.caption,
                    fontWeight: tokens.type.weight.semibold,
                  }}
                >
                  {goingCount} going
                </Text>
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
            </View>
            <View ref={menuAnchor} collapsable={false}>
              <IconButton
                label="More Beacon actions"
                onPress={() => setMenuVisible(true)}
                disabled={busyAction !== null}
              >
                <MoreHorizontal size={20} color={colors.textPrimary} />
              </IconButton>
            </View>
          </View>

          {actionError ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{ color: colors.danger, ...tokens.type.caption }}
            >
              {actionError}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.space.sm,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{ color: colors.textSecondary, ...tokens.type.caption }}
              >
                {[hostName, location?.label].filter(Boolean).join(" · ")}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: isLive ? colors.accent : colors.textSecondary,
                  ...tokens.type.caption,
                }}
              >
                {[
                  whenText,
                  isHost
                    ? "Hosting"
                    : isGoing
                      ? "Going"
                      : requestPending
                        ? "Request pending"
                        : rsvpStatus === "interested"
                          ? "Maybe"
                          : "Beacon",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <PrimaryButton
              compact
              title={busyAction === "rsvp" ? "Updating…" : compactPrimaryTitle}
              loading={busyAction === "rsvp"}
              disabled={busyAction !== null}
              onPress={onCompactPrimaryPress}
              accessibilityLabel={
                featured
                  ? compactPrimaryTitle
                  : isHost
                    ? `Manage ${title}`
                    : compactPrimaryTitle
              }
            />
          </View>
          {planRelation ? (
            <Text
              numberOfLines={1}
              style={{ color: colors.textSecondary, ...tokens.type.caption }}
            >
              Plan · {planRelation}
            </Text>
          ) : null}
          {compactFooter}
        </>
      ) : (
        <>
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
                {isLive ? (
                  <LiveIndicator reducedMotion={reducedMotion} />
                ) : null}
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
                <View ref={menuAnchor} collapsable={false}>
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
                    accessibilityLabel={
                      isLive ? `Live now, ${whenText}` : whenText
                    }
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
                  style={{
                    color: colors.textSecondary,
                    ...tokens.type.caption,
                  }}
                >
                  {target > goingCount
                    ? `Need ${Math.max(0, target - goingCount)} more`
                    : "Goal met"}
                </Text>
              ) : null}
              {capacityRemaining !== null ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    ...tokens.type.caption,
                  }}
                >
                  {capacityRemaining}{" "}
                  {capacityRemaining === 1 ? "spot" : "spots"} left
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
        </>
      )}
    </Card>
  );

  return (
    <View style={{ gap: tokens.space.xs }}>
      {!compact && canSwipe ? (
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
      <ContextMenu
        title={title}
        visible={menuVisible}
        anchorRef={menuAnchor}
        onClose={() => setMenuVisible(false)}
        onDismiss={menuDismissed}
      >
        {compact && !isHost && !isEnded && !isCancelled && !isSolo ? (
          <MenuGroup title="Participation">
            {requestPending ? (
              <ActionRow
                label="Cancel request"
                icon={<X size={18} color={colors.textSecondary} />}
                disabled={busyAction !== null}
                onPress={() => afterMenu(() => void runRsvp("withdraw"))}
              />
            ) : isGoing ? (
              <ActionRow
                label={onChangeRSVP ? "Change RSVP" : "Leave Beacon"}
                icon={<LogOut size={18} color={colors.textSecondary} />}
                disabled={busyAction !== null}
                onPress={() =>
                  afterMenu(() => {
                    if (onChangeRSVP)
                      void runAction(
                        "change",
                        onChangeRSVP,
                        "Could not open RSVP options.",
                      );
                    else void runRsvp("withdraw");
                  })
                }
              />
            ) : (
              <ActionRow
                label="Maybe"
                selected={rsvpStatus === "interested"}
                icon={<CircleHelp size={18} color={colors.textSecondary} />}
                disabled={busyAction !== null || rsvpStatus === "interested"}
                onPress={() => afterMenu(() => void runRsvp("interested"))}
              />
            )}
          </MenuGroup>
        ) : null}
        {compact && (onMap || onChat) ? (
          <MenuGroup title="Activity">
            {onMap ? (
              <ActionRow
                label="View on Map"
                icon={<MapPin size={18} color={colors.textSecondary} />}
                onPress={() => afterMenu(onMap)}
              />
            ) : null}
            {onChat ? (
              <ActionRow
                label="Open Chat"
                icon={<MessageCircle size={18} color={colors.textSecondary} />}
                onPress={() => afterMenu(onChat)}
              />
            ) : null}
          </MenuGroup>
        ) : null}
        <BeaconToolMenuRows activityId={activityId} afterMenu={afterMenu} />
        <MenuGroup title="Save & Share">
          <ActionRow
            label={saved ? "Unsave Beacon" : "Save Beacon"}
            icon={<Bookmark size={18} color={colors.textSecondary} />}
            disabled={busyAction !== null}
            onPress={() =>
              afterMenu(
                () =>
                  void runAction(
                    "save",
                    onSave,
                    "Could not update saved Beacons.",
                  ),
              )
            }
          />
          <ActionRow
            label="Share Beacon"
            icon={<Share2 size={18} color={colors.textSecondary} />}
            disabled={busyAction !== null}
            onPress={() =>
              afterMenu(
                () =>
                  void runAction(
                    "share",
                    onShare,
                    "Could not share this Beacon.",
                  ),
              )
            }
          />
        </MenuGroup>
        {onReport && !isHost ? (
          <MenuGroup title="Safety">
            <ActionRow
              label="Report Beacon"
              danger
              icon={<Flag size={18} color={colors.danger} />}
              disabled={busyAction !== null}
              onPress={() =>
                afterMenu(
                  () =>
                    void runAction(
                      "report",
                      onReport,
                      "Could not open the report flow.",
                    ),
                )
              }
            />
          </MenuGroup>
        ) : null}
      </ContextMenu>
    </View>
  );
}
