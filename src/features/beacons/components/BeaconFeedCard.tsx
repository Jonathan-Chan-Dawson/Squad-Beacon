import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  Flag,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Share2,
  Star,
  UsersRound,
} from "lucide-react-native";
import Swipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { router } from "expo-router";
import type { Activity, Category, Data } from "@/src/shared/types";
import { AvatarStack, useDesignTheme } from "@/src/shared/design-system";
import { ActionRow, ContextMenu, MenuGroup } from "@/src/shared/ContextMenu";
import { useBeacon } from "@/src/shared/store";
import { usePreferences } from "@/src/shared/preferences";
import { activityWhen } from "@/src/shared/domain";
import {
  DiscoveryBeaconCard,
  type CardPlanContext,
} from "@/src/features/discovery/DiscoveryBeaconCard";
import {
  beaconMarkerState,
  beaconMarkerColor,
  prepareMapIdentity,
} from "@/src/features/maps/markerIdentity";
import { beaconArtworkStyles } from "./BeaconCardArtwork";
import { BeaconCardShortcuts } from "./BeaconCardShortcuts";
import { HomeAction } from "./HomeAction";
import {
  ParticipationActions,
  ParticipationButtons,
  useBeaconParticipation,
} from "../useBeaconParticipation";
import { useAvailabilityNow } from "../availabilityClock";
import { beaconCardShortcuts } from "../beaconCardShortcuts";
import { cardSocialPreview } from "../cardSocialPreview";
import { cardSecondaryMetadata, compactCountdown } from "../cardPresentation";
import { hubToolShortcuts } from "../hubSelectors";
import { rewardTint } from "../rewardLooks";
import { resolveActivityToolEntry } from "../activityToolEntry";
import {
  readablePlanForActivity,
  readablePlanStopPosition,
} from "../screens/discoveryPlan";
import { beaconRoleFor } from "../permissions";

export type FeedRsvpStatus =
  "going" | "interested" | "requested" | "invited" | "declined" | "unknown";
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
  /** Discovery lists prioritize participation and omit personal Smart Features. */
  presentation?: "discovery";
  mapPreview?: boolean;
  mapIcon?: string | null;
  /** Accessible controls owned by the containing surface, such as Map close. */
  headerAccessory?: React.ReactNode;
  demoArtwork?: boolean;
  decorationAccent?: string | null;
  decorationEmoji?: string | null;
  /** Use the compact home/list treatment while keeping the same permission and RSVP callbacks. */
  compact?: boolean;
  planContext?: CardPlanContext;
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
  /** Opens the attendee roster when the current viewer is authorized. */
  onOpenPeople?: () => void;
  /** Reject on failure so the card can show an error and avoid success feedback. */
  onRSVP: (status: FeedRsvpAction) => Promise<void> | void;
  /** Opens the route's RSVP choices when the viewer is already Going. */
  onChangeRSVP?: () => Promise<void> | void;
  /** Optional accessible label for Map or other destination-specific details actions. */
  detailsLabel?: string;
  onMap?: () => void;
  onChat?: () => void;
  onSave: () => Promise<void> | void;
  onShare: () => Promise<void> | void;
  /** The route should open its confirmed Report flow. */
  onReport?: () => Promise<void> | void;
  /** Temporarily disables PagerView while the swipe rail owns a gesture. */
  onCardSwipeStateChange?: (active: boolean) => void;
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

const identityBySnapshot = new WeakMap<
  Data,
  ReturnType<typeof prepareMapIdentity>
>();

function cardIdentity(data: Data, viewer: string | null) {
  if (!viewer || data.viewer_id !== viewer) return undefined;
  const existing = identityBySnapshot.get(data);
  if (existing) return existing;
  const next = prepareMapIdentity(data, viewer);
  identityBySnapshot.set(data, next);
  return next;
}

export function BeaconFeedCard(props: BeaconFeedCardProps) {
  const { userId, viewerEpoch } = useBeacon();
  return (
    <BeaconFeedCardBody
      key={`${props.activityId}:${userId}:${viewerEpoch}`}
      {...props}
    />
  );
}

function BeaconFeedCardBody({
  activityId,
  title,
  category,
  activityMode,
  startsAt,
  endsAt,
  activityStatus,
  whenLabel,
  hostName,
  location,
  goingCount,
  rsvpStatus,
  approved,
  approvalRequired,
  isHost,
  isFull,
  isClosed,
  isPast,
  saved,
  onOpen,
  onMap,
  onChat,
  onSave,
  onShare,
  onReport,
  onOpenPeople,
  onCardSwipeStateChange,
  mapPreview = false,
  compact = false,
  presentation,
  mapIcon,
  headerAccessory,
  demoArtwork,
  decorationAccent,
  decorationEmoji,
  compactFooter,
  planContext,
  detailsLabel,
}: BeaconFeedCardProps) {
  const { colors, tokens } = useDesignTheme();
  const { data, userId, getViewerEpoch } = useBeacon();
  const { showAvatars } = usePreferences();
  const participation = useBeaconParticipation(activityId);
  const social = cardSocialPreview(data, userId, activityId);
  const activity =
    participation.state?.activity ??
    data.activities.find((row) => row.id === activityId);
  const now = useAvailabilityNow(Date.parse(endsAt));
  const latest = useRef({ data, userId });
  const [menuVisible, setMenuVisible] = useState(false);
  const menuAnchor = useRef<View>(null);
  const continuation = useRef<(() => void) | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const swipeable = useRef<SwipeableMethods | null>(null);
  const swipeActive = useRef(false);
  const swipeCallback = useRef(onCardSwipeStateChange);
  useEffect(() => {
    latest.current = { data, userId };
    swipeCallback.current = onCardSwipeStateChange;
  }, [data, userId, onCardSwipeStateChange]);
  useEffect(
    () => () => {
      continuation.current = null;
      if (swipeActive.current) swipeCallback.current?.(false);
    },
    [],
  );
  const notifySwipe = useCallback((active: boolean) => {
    if (swipeActive.current === active) return;
    swipeActive.current = active;
    swipeCallback.current?.(active);
  }, []);
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const cancelled = activityStatus === "cancelled";
  const completed = activityStatus === "completed";
  const ended =
    !cancelled && (isPast || completed || (Number.isFinite(end) && end <= now));
  const live =
    !ended && activityStatus === "scheduled" && start <= now && now < end;
  const pending =
    rsvpStatus === "requested" ||
    (rsvpStatus === "going" && approvalRequired && !approved);
  const going = rsvpStatus === "going" && !pending;
  const canSwipe =
    !mapPreview &&
    !compact &&
    !isHost &&
    !isClosed &&
    !ended &&
    !cancelled &&
    !isFull &&
    activityMode !== "solo" &&
    !pending &&
    !going &&
    !participation.operation.busy;
  const tone = tokens.categories[category] ?? tokens.categories.Other;
  const identity = cardIdentity(data, userId);
  const markerState =
    activity && identity
      ? beaconMarkerState(data, activity, identity, now)
      : undefined;
  const relationshipColor = beaconMarkerColor(markerState);
  const premiumStyle =
    identity &&
    data.premium_tool_configs?.find(
      (config) =>
        config.activity_id === activityId && config.kind === "appearance",
    )?.settings.style;
  const cycleArtwork = demoArtwork
    ? beaconArtworkStyles[
        Array.from(activityId).reduce(
          (sum, char) => sum + char.charCodeAt(0),
          0,
        ) % beaconArtworkStyles.length
      ]
    : undefined;
  const secondary = cardSecondaryMetadata(title, location, hostName);
  const effectiveTime =
    cancelled || ended
      ? undefined
      : live
        ? compactCountdown("Ends", Math.max(1, Math.ceil((end - now) / 60000)))
        : activity
          ? activityWhen(activity, new Date(now))
          : whenLabel;
  const status = cancelled
    ? "Cancelled"
    : completed
      ? "Completed"
      : ended
        ? "Ended"
        : isHost
          ? "Hosting"
          : pending
            ? "Requested"
            : going
              ? "Going"
              : rsvpStatus === "interested"
                ? "Interested"
                : rsvpStatus === "invited"
                  ? "Invited"
                  : isClosed
                    ? "Closed"
                    : undefined;
  const people = social?.rosterAllowed
    ? social.attendeeAvatars
    : social?.friendAvatars;
  const shortcuts = beaconCardShortcuts(data, userId, activityId);
  const linkedPlan =
    !planContext && activity && userId
      ? readablePlanForActivity(data, activity, userId)
      : undefined;
  const cardPlan =
    planContext ??
    (linkedPlan && activity && userId
      ? {
          title: linkedPlan.title,
          stepIndex: activity.plan_step_index,
          stop: readablePlanStopPosition(data, activity, linkedPlan, userId),
          onPress: () =>
            router.push({
              pathname: "/plan/[id]",
              params: { id: linkedPlan.id },
            }),
        }
      : undefined);
  const tool =
    presentation == null && !mapPreview && activity && (isHost || going)
      ? hubToolShortcuts(data, activity, userId).find(
          (entry) => entry.tool === "checklist" && !entry.label.endsWith("/0"),
        )
      : undefined;
  const canTapPrimary =
    participation.state?.choices ||
    participation.state?.allowed.includes("join");
  const openLabel = isHost || going ? "Open Beacon" : "View Beacon";
  const afterMenu = (action: () => void) => {
    continuation.current = action;
    setMenuVisible(false);
  };
  const runAction = async (
    action: () => Promise<void> | void,
    fallback: string,
  ) => {
    if (lock.current) return;
    const epoch = getViewerEpoch();
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      if (getViewerEpoch() === epoch)
        setError(
          failure instanceof Error && failure.message.trim()
            ? failure.message
            : fallback,
        );
    } finally {
      lock.current = false;
      if (getViewerEpoch() === epoch) setBusy(false);
    }
  };
  const openTool = () => {
    const current = latest.current;
    const next = current.data.activities.find((row) => row.id === activityId);
    if (
      current.userId !== userId ||
      resolveActivityToolEntry(
        current.data,
        next,
        current.userId,
        "tools",
        "checklist",
      ).tool !== "checklist"
    )
      return;
    router.push({
      pathname: "/activity/[id]",
      params: { id: activityId, tab: "tools", tool: "checklist" },
    });
  };

  const bookmark = (
    <HomeAction
      label={saved ? "Unsave Beacon" : "Save Beacon"}
      selected={saved}
      plain
      disabled={busy}
      icon={
        <Bookmark
          size={19}
          color={saved ? colors.accent : colors.textSecondary}
          fill={saved ? colors.accent : "none"}
        />
      }
      onPress={() => void runAction(onSave, "Could not update saved Beacons.")}
    />
  );
  const card = (
    <DiscoveryBeaconCard
      density={mapPreview ? "compact" : "standard"}
      mapPreview={mapPreview}
      activityId={activityId}
      title={title}
      category={category}
      mapIcon={mapIcon ?? activity?.map_icon}
      artworkVariant={cycleArtwork}
      decorationAccent={decorationAccent}
      decorationEmoji={decorationEmoji}
      relationshipColor={relationshipColor}
      cosmeticTint={
        (identity
          ? rewardTint(data.equipped_looks?.[activityId]?.card)
          : undefined) ??
        (premiumStyle === "sunrise"
          ? tokens.categories.Creative.color
          : premiumStyle === "ocean"
            ? tokens.categories.Study.color
            : undefined)
      }
      whenLabel={effectiveTime}
      statusLabel={
        activity &&
        userId &&
        !ended &&
        !cancelled &&
        beaconRoleFor(data, activity, userId) === "coowner"
          ? "Co-hosting"
          : status
      }
      isLive={live}
      hostLabel={
        secondary?.kind === "host" && !isHost ? secondary.label : undefined
      }
      locationLabel={secondary?.kind !== "host" ? secondary?.label : undefined}
      goingCount={social?.capacity.count ?? goingCount}
      capacity={social?.capacity}
      friendsGoing={social?.friendCount}
      socialAvatars={
        showAvatars && people?.length ? (
          <AvatarStack people={people} size={24} limit={3} />
        ) : undefined
      }
      planContext={cardPlan}
      headerAccessory={headerAccessory}
      context={compactFooter}
      smartFeature={
        tool ? (
          <Pressable
            accessibilityRole="button"
            onPress={openTool}
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: 8,
              borderRadius: 10,
              backgroundColor: colors.surfaceRaised,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <ListChecks size={18} color={colors.accent} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                style={{ ...tokens.type.secondary, color: colors.textPrimary }}
              >
                Checklist
              </Text>
              <Text
                style={{ ...tokens.type.caption, color: colors.textSecondary }}
              >
                {tool.label.replace(/^Checklist\s*/, "")} complete
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null
      }
      onDetails={onOpen}
      detailsLabel={detailsLabel}
      menu={
        mapPreview ? (
          bookmark
        ) : (
          <>
            {bookmark}
            <View ref={menuAnchor} collapsable={false}>
              <HomeAction
                label="More Beacon actions"
                plain
                disabled={busy}
                icon={<MoreHorizontal size={20} color={colors.textSecondary} />}
                onPress={() => setMenuVisible(true)}
              />
            </View>
          </>
        )
      }
      shortcutActions={
        <BeaconCardShortcuts activityId={activityId} section="social" />
      }
      actionShortcuts={
        <BeaconCardShortcuts
          activityId={activityId}
          section="actions"
          onChat={onChat}
        />
      }
      primaryAction={
        isHost || going || !canTapPrimary || ended || cancelled ? (
          <HomeAction
            title={openLabel}
            label={isHost ? "Hosting management" : openLabel}
            prominent
            primary
            stretch
            onPress={onOpen}
          />
        ) : (
          <ParticipationButtons
            controller={participation}
            onOpen={onOpen}
            primaryOnly
            prominent
            stretch
            showMaybe={false}
          />
        )
      }
      feedback={
        participation.feedback || error ? (
          <>
            {participation.feedback}
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={{ color: colors.danger, ...tokens.type.caption }}
              >
                {error}
              </Text>
            ) : null}
          </>
        ) : null
      }
    />
  );

  return (
    <View testID={mapPreview ? undefined : `beacon-feed-card-${activityId}`}>
      {canSwipe ? (
        <Swipeable
          ref={swipeable}
          friction={1.15}
          leftThreshold={102}
          rightThreshold={102}
          overshootLeft={false}
          overshootRight={false}
          containerStyle={{ borderRadius: 16, overflow: "hidden" }}
          onSwipeableOpenStartDrag={() => notifySwipe(true)}
          onSwipeableCloseStartDrag={() => notifySwipe(false)}
          onSwipeableWillClose={() => notifySwipe(false)}
          onSwipeableClose={() => notifySwipe(false)}
          onSwipeableOpen={(direction) => {
            if (canSwipe)
              void participation.perform(
                direction === SwipeDirection.RIGHT ? "join" : "maybe",
              );
            swipeable.current?.close();
            notifySwipe(false);
          }}
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
              color={tone.color}
              backgroundColor={tone.tint}
              icon={<Star size={17} color={tone.color} />}
            />
          )}
        >
          {card}
        </Swipeable>
      ) : (
        card
      )}
      {!mapPreview && (
        <ContextMenu
          title={title}
          mode="context"
          visible={menuVisible}
          anchorRef={menuAnchor}
          onClose={() => setMenuVisible(false)}
          onDismiss={() => {
            const action = continuation.current;
            continuation.current = null;
            action?.();
          }}
        >
          {participation.state?.allowed.length ? (
            <MenuGroup title="Participation">
              {participation.state.choices && (
                <ActionRow
                  label="Change RSVP"
                  icon={<CircleHelp size={18} color={colors.textSecondary} />}
                  onPress={() => afterMenu(participation.openChoices)}
                />
              )}
              <ParticipationActions
                state={participation.state}
                busy={participation.operation.busy}
                onPerform={participation.perform}
                after={afterMenu}
                omitJoin
              />
            </MenuGroup>
          ) : null}
          <MenuGroup title="Beacon actions">
            {social?.rosterAllowed && onOpenPeople && (
              <ActionRow
                label="People"
                icon={<UsersRound size={18} color={colors.textSecondary} />}
                onPress={() =>
                  afterMenu(() => {
                    const current = latest.current;
                    if (
                      current.userId === userId &&
                      cardSocialPreview(
                        current.data,
                        current.userId,
                        activityId,
                      )?.rosterAllowed
                    )
                      onOpenPeople();
                  })
                }
              />
            )}
            {shortcuts?.canMap && onMap && (
              <ActionRow
                label="View on Map"
                icon={<MapPin size={18} color={colors.textSecondary} />}
                onPress={() =>
                  afterMenu(() => {
                    const current = latest.current;
                    if (
                      current.userId === userId &&
                      beaconCardShortcuts(
                        current.data,
                        current.userId,
                        activityId,
                      )?.canMap
                    )
                      onMap();
                  })
                }
              />
            )}
            <ActionRow
              label="Share Beacon"
              icon={<Share2 size={18} color={colors.textSecondary} />}
              disabled={busy}
              onPress={() =>
                afterMenu(
                  () => void runAction(onShare, "Could not share this Beacon."),
                )
              }
            />
          </MenuGroup>
          {onReport && !isHost && (
            <MenuGroup title="Safety">
              <ActionRow
                label="Report Beacon"
                danger
                icon={<Flag size={18} color={colors.danger} />}
                disabled={busy}
                onPress={() =>
                  afterMenu(
                    () =>
                      void runAction(
                        onReport,
                        "Could not open the report flow.",
                      ),
                  )
                }
              />
            </MenuGroup>
          )}
        </ContextMenu>
      )}
      {participation.dialogs}
    </View>
  );
}
