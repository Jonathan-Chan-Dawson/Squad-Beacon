import { LivingActivityHighlights } from "../components/feed/LivingActivitySection";
import { homePresentation } from "@/src/features/onboarding/presentation";
import { useOnboarding } from "@/src/features/onboarding/runtime";
import {
  HomeInvitation,
  SemanticEmpty,
} from "@/src/features/onboarding/OnboardingUI";
import { currentActivity } from "../livingActivity";
import { discoveryActivities } from "../discoverySelectors";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import * as ExpoLinking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, CalendarDays, ChevronRight } from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { usePreferences } from "@/src/shared/preferences";
import { useExploration } from "@/src/shared/exploration";
import { activityWhen, friendIds } from "@/src/shared/domain";
import { crew } from "@/src/shared/browsing";
import {
  canReadBeaconActivity,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import { canViewProfile } from "@/src/features/profile/privacy";
import {
  beaconCapacity,
  beaconSeatCount,
  isApprovedGoing,
} from "@/src/features/beacons/permissions";
import {
  BeaconFeedCard,
  type BeaconFeedCardProps,
} from "@/src/features/beacons/components/BeaconFeedCard";
import { SharedStatusControl } from "@/src/features/beacons/components/feed/SharedStatusControl";
import { SocialFriendsSection } from "@/src/features/beacons/components/feed/SocialFriendsSection";
import { HomeAction } from "@/src/features/beacons/components/HomeAction";
import { GlassBar, Skeleton, useDesignTheme } from "@/src/shared/design-system";
import {
  Button,
  Field,
  InboxButton,
  Sheet,
  Txt,
  uiHaptics,
} from "@/src/shared/ui";
import {
  confirmedHubActivities,
  personalHubPreview,
} from "@/src/features/beacons/hubSelectors";

const PAGE_GUTTER = 16;

export default function ActivitiesScreen() {
  const { colors: designColors, tokens } = useDesignTheme();
  const {
    data,
    userId,
    act,
    loading,
    error: storeError,
    refresh,
    demoScenario,
    demo,
    switchDemoScenario,
  } = useBeacon();
  const exploration = useExploration();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const progress = useOnboarding();
  const simulatedError = __DEV__ && demo && demoScenario === "offline";
  const home = homePresentation(
    data,
    userId,
    now,
    progress.keys,
    progress.status,
    loading,
    storeError || simulatedError,
    progress.firstEntrySession,
  );
  const hasPersonal =
    personalHubPreview(confirmedHubActivities(data, userId), now).length > 0 ||
    !!(userId && currentActivity(data, userId, userId, now));
  const params = useLocalSearchParams<{
    filter?: string;
    participation?: string;
    confirmed?: string;
  }>();
  const [refreshing, setRefreshing] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [reportActivityId, setReportActivityId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [rsvpActivityId, setRsvpActivityId] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const { showAvatars } = usePreferences();

  useFocusEffect(
    useCallback(() => {
      if (params.filter === "Past") {
        router.replace({
          pathname: "/your-activity",
          params: { historyExpanded: "yes" },
        } as Href);
      } else if (
        params.confirmed === "yes" ||
        params.participation === "confirmed"
      ) {
        router.replace("/your-activity" as Href);
      } else if (params.filter === "Now" || params.filter === "Upcoming") {
        router.replace({
          pathname: "/browse-beacons",
          params: { section: params.filter === "Now" ? "now" : "upcoming" },
        } as Href);
      }
    }, [params.confirmed, params.filter, params.participation]),
  );

  const confirmedActivities = useMemo(
    () => confirmedHubActivities(data, userId),
    [data, userId],
  );
  const personalPreview = personalHubPreview(confirmedActivities, now);

  const goToActivity = useCallback((id: string) => {
    router.push({ pathname: "/activity/[id]", params: { id } });
  }, []);
  const goToMap = useCallback((id: string) => {
    router.push({ pathname: "/(tabs)", params: { beacon: id } });
  }, []);
  const handleRefresh = useCallback(async () => {
    if (simulatedError) {
      switchDemoScenario("disconnected");
      return;
    }
    setRefreshing(true);
    setRequestError("");
    try {
      await refresh();
    } catch (failure) {
      setRequestError(
        failure instanceof Error
          ? failure.message
          : "Could not refresh Beacons.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [refresh, simulatedError, switchDemoScenario]);

  const shareActivity = useCallback(
    async (activity: Activity) => {
      const url = ExpoLinking.createURL("/activity/" + activity.id);
      const message =
        activity.title +
        " · " +
        activityWhen(activity, new Date(now)) +
        "\n" +
        url;
      await Share.share({ title: activity.title, message, url });
    },
    [now],
  );

  const respond = useCallback(
    async (activity: Activity, status: "going" | "interested" | "withdraw") => {
      if (
        !userId ||
        data.viewer_id !== userId ||
        !canReadBeaconActivity(data, activity, userId)
      ) {
        throw new Error("This Beacon is no longer available to you.");
      }
      if (activity.mode === "solo" || activity.owner_id === userId)
        throw new Error("This Beacon does not accept your RSVP.");
      await act("rsvp", { id: activity.id, status });
    },
    [act, data, userId],
  );

  const handleRsvpSheet = useCallback(
    async (status: "going" | "interested" | "withdraw") => {
      const activity = data.activities.find(
        (item) => item.id === rsvpActivityId,
      );
      if (!activity) return;
      setRsvpBusy(true);
      setRequestError("");
      try {
        await respond(activity, status);
        if (status === "going") void uiHaptics.success();
        setRsvpActivityId(null);
      } catch (failure) {
        setRequestError(
          failure instanceof Error
            ? failure.message
            : "Could not update your response.",
        );
      } finally {
        setRsvpBusy(false);
      }
    },
    [data.activities, respond, rsvpActivityId],
  );

  const findActivityPlace = useCallback(
    (activity: Activity) => {
      if (
        !userId ||
        data.viewer_id !== userId ||
        !canViewBeaconMeetingDetails(data, activity.id, userId)
      )
        return undefined;
      return data.places.find((place) => place.activity_id === activity.id);
    },
    [data, userId],
  );

  const buildCardProps = useCallback(
    (activity: Activity): BeaconFeedCardProps => {
      const hostCandidate = data.profiles.find(
        (profile) => profile.id === activity.owner_id,
      );
      const hostProfile =
        userId &&
        data.viewer_id === userId &&
        hostCandidate &&
        canViewProfile(data, hostCandidate, userId)
          ? hostCandidate
          : undefined;
      const place = findActivityPlace(activity);
      const rsvp = data.rsvps.find(
        (row) => row.activity_id === activity.id && row.user_id === userId,
      );
      const acceptedCount = beaconSeatCount(data, activity);
      const capacity = beaconCapacity(data, activity);
      const liveOrUpcoming =
        activity.status === "scheduled" && Date.parse(activity.ends_at) > now;
      const hasHostOrCanRead = !!userId && data.viewer_id === userId;
      const safeAvatars =
        showAvatars && hasHostOrCanRead
          ? crew(data, activity)
              .filter(
                ({ person, status }) =>
                  (status === "Going" || status === "Hosting") &&
                  canViewProfile(data, person, userId!),
              )
              .filter(
                ({ person }) =>
                  person.id === activity.owner_id ||
                  isApprovedGoing(
                    activity,
                    data.rsvps.find(
                      (row) =>
                        row.activity_id === activity.id &&
                        row.user_id === person.id,
                    ),
                  ),
              )
              .slice(0, 4)
              .map(({ person }) => ({ id: person.id, name: person.name }))
          : [];
      const canOpenChat =
        !!userId &&
        activity.enable_chat !== false &&
        canUseBeaconModules(data, activity, userId);
      const friendHost =
        !!userId && friendIds(data, userId).includes(activity.owner_id);
      const saved = data.beacon_favorites.some(
        (favorite) =>
          favorite.owner_id === userId && favorite.activity_id === activity.id,
      );
      const canMap = !!place && place.online_url == null;
      const location = place
        ? place.online_url
          ? { label: "Online", kind: "online" as const }
          : {
              label: place.label || "Place to be decided",
              kind: "physical" as const,
            }
        : null;
      return {
        activityId: activity.id,
        title: activity.title,
        category: activity.category,
        decorationEmoji: activity.decoration_emoji,
        startsAt: activity.starts_at,
        endsAt: activity.ends_at,
        activityStatus: activity.status,
        activityMode: activity.mode,
        whenLabel: activityWhen(activity, new Date(now)),
        hostName:
          hostProfile?.name ??
          (activity.owner_id === userId ? "You" : "Beacon host"),
        hostAvatarUri: null,
        location,
        goingAvatars: safeAvatars,
        goingCount: acceptedCount,
        target: activity.target_count ?? null,
        capacityRemaining:
          activity.capacity_limit == null
            ? null
            : Math.max(0, activity.capacity_limit - acceptedCount),
        rsvpStatus: rsvp?.status ?? null,
        approved: isApprovedGoing(activity, rsvp),
        joinApprovalGranted: rsvp?.approved === true,
        approvalRequired:
          activity.approval_required || activity.mode === "invite",
        isHost: activity.owner_id === userId,
        isFull: capacity.full,
        isClosed: capacity.closed || !liveOrUpcoming,
        isPast: !liveOrUpcoming,
        saved,
        onOpen: () => goToActivity(activity.id),
        onRSVP: (status) => respond(activity, status),
        onChangeRSVP:
          rsvp?.status === "going" || rsvp?.status === "requested"
            ? () => {
                setRequestError("");
                setRsvpActivityId(activity.id);
              }
            : undefined,
        onMap: canMap ? () => goToMap(activity.id) : undefined,
        onChat: canOpenChat
          ? () =>
              router.push({
                pathname: "/activity/[id]",
                params: { id: activity.id, tab: "chat" },
              })
          : friendHost
            ? () =>
                router.push({
                  pathname: "/messages/[id]",
                  params: { id: activity.owner_id },
                })
            : undefined,
        onSave: () =>
          act("save_beacon", { activity_id: activity.id, saved: !saved }).then(
            () => undefined,
          ),
        onShare: () => shareActivity(activity),
        onReport: () => {
          setRequestError("");
          setReportActivityId(activity.id);
          setReportReason("");
        },
      };
    },
    [
      act,
      data,
      findActivityPlace,
      goToActivity,
      goToMap,
      now,
      respond,
      shareActivity,
      showAvatars,
      userId,
    ],
  );

  const loadBrowseActivities = useCallback(
    (period: "Active" | "Upcoming") =>
      discoveryActivities(
        data,
        userId,
        now,
        period,
        exploration.query,
        exploration.filters,
        exploration.area,
      ),
    [
      data,
      userId,
      now,
      exploration.query,
      exploration.filters,
      exploration.area,
    ],
  );
  const nowActivities = useMemo(
    () => loadBrowseActivities("Active"),
    [loadBrowseActivities],
  );
  const upcomingActivities = useMemo(
    () => loadBrowseActivities("Upcoming"),
    [loadBrowseActivities],
  );
  const nowPreview = nowActivities.slice(0, 2);
  const upcomingPreview = upcomingActivities.slice(0, 2);
  const selectedRsvpActivity = data.activities.find(
    (activity) => activity.id === rsvpActivityId,
  );
  const selectedRsvp =
    selectedRsvpActivity &&
    data.rsvps.find(
      (row) =>
        row.activity_id === selectedRsvpActivity.id && row.user_id === userId,
    );
  const browse = (section?: "now" | "upcoming") =>
    router.push(
      section
        ? ({ pathname: "/browse-beacons", params: { section } } as Href)
        : ("/browse-beacons" as Href),
    );
  const hubHeading = (title: string, link: string, onPress: () => void) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.space.sm,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: designColors.textPrimary,
          ...tokens.type.titleSmall,
          fontWeight: "500",
        }}
      >
        {title}
      </Text>
      <HomeAction title={link} onPress={onPress} plain />
    </View>
  );
  const visibleError =
    requestError ||
    storeError ||
    (simulatedError
      ? "Simulated connection error. Reconnect to load Beacons."
      : "");
  async function report() {
    if (!reportActivityId || !reportReason.trim()) return;
    setReportBusy(true);
    setRequestError("");
    try {
      await act("report", {
        id: reportActivityId,
        reason: reportReason.trim(),
      });
      setReportActivityId(null);
      setReportReason("");
    } catch (failure) {
      setRequestError(
        failure instanceof Error
          ? failure.message
          : "Could not submit that report.",
      );
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: designColors.bg }}>
      <View
        style={{ paddingTop: insets.top, backgroundColor: designColors.bg }}
      >
        <GlassBar
          style={{
            borderRadius: 0,
            borderWidth: 0,
            borderBottomWidth: 1,
            borderBottomColor: designColors.border,
          }}
        >
          <View
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: tokens.space.sm,
              paddingHorizontal: tokens.layout.screenGutter,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                color: designColors.textPrimary,
                fontSize: 22,
                lineHeight: 28,
                fontWeight: "500",
              }}
            >
              Beacons
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open calendar"
              onPress={() => router.push("/calendar" as Href)}
              style={{
                width: tokens.layout.minTapTarget,
                height: tokens.layout.minTapTarget,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarDays size={22} color={designColors.textSecondary} />
            </Pressable>
            <InboxButton />
          </View>
        </GlassBar>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
          />
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: PAGE_GUTTER,
          gap: 16,
          paddingBottom:
            tokens.layout.tabBarHeight +
            insets.bottom +
            tokens.layout.scrollClearance,
        }}
      >
        {visibleError ? (
          <View
            accessibilityRole="alert"
            style={{
              gap: tokens.space.xs,
              padding: tokens.space.md,
              borderWidth: 1,
              borderColor: designColors.danger,
              borderRadius: tokens.radius.card,
              backgroundColor: designColors.surface,
            }}
          >
            <Text
              style={{ color: designColors.danger, ...tokens.type.secondary }}
            >
              {visibleError}
            </Text>
            <Button
              title="Try again"
              secondary
              onPress={() => void handleRefresh()}
            />
          </View>
        ) : null}

        <SharedStatusControl compact />
        {home.pending > 0 ? (
          <Button
            secondary
            title="View invitations & responses"
            onPress={() => router.push("/responses")}
          />
        ) : null}
        {!hasPersonal &&
        (home.kind === "welcome" || home.kind === "compact") ? (
          <HomeInvitation
            welcome={home.kind === "welcome"}
            friends={home.friends}
          />
        ) : null}
        {home.kind === "loading" ? (
          <Skeleton height={160} borderRadius={12} />
        ) : null}
        {hasPersonal ? (
          <View
            testID="home-personal-timeline"
            style={{
              gap: 0,
              borderTopWidth: 1,
              borderTopColor: designColors.border,
              paddingTop: 12,
            }}
          >
            {hubHeading("Your Activity", "My Activity →", () =>
              router.push("/your-activity" as Href),
            )}
            {(data.is_demo || data.capabilities?.living_activity) && userId ? (
              <LivingActivityHighlights personId={userId} />
            ) : (
              <View style={{ borderRadius: 12, overflow: "hidden" }}>
                {personalPreview.length ? (
                  personalPreview.map((activity) => (
                    <BeaconFeedCard
                      key={activity.id}
                      presentation="personal-preview"
                      compact
                      {...buildCardProps(activity)}
                    />
                  ))
                ) : (
                  <Txt muted>
                    {loading
                      ? "Loading your activity…"
                      : "No confirmed plans yet."}
                  </Txt>
                )}
              </View>
            )}
          </View>
        ) : null}
        {home.friends ? (
          <View
            testID="home-friends-section"
            style={{
              borderTopWidth: 1,
              borderTopColor: designColors.border,
              paddingTop: 16,
            }}
          >
            <SocialFriendsSection key={userId ?? "signed-out"} />
          </View>
        ) : null}
        {nowPreview.length || upcomingPreview.length ? (
          <View
            testID="home-explore-beacons"
            style={{
              gap: 4,
              borderTopWidth: 1,
              borderTopColor: designColors.border,
              paddingTop: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: designColors.textPrimary,
                  ...tokens.type.titleSmall,
                  fontWeight: "500",
                }}
              >
                Explore Beacons
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <HomeAction
                  title="Explore all →"
                  onPress={() => browse()}
                  plain
                />
                <HomeAction
                  title="Map"
                  label="Explore Beacons on Map"
                  onPress={() =>
                    router.navigate({
                      pathname: "/(tabs)",
                      params: { mapDiscovery: "yes" },
                    })
                  }
                  plain
                />
              </View>
            </View>
            {loading && !data.activities.length ? (
              <Skeleton height={110} borderRadius={12} />
            ) : !nowPreview.length && !upcomingPreview.length ? (
              <Txt muted>No Beacons to explore right now.</Txt>
            ) : null}
            {nowPreview.length ? (
              <Text
                accessibilityRole="header"
                style={{
                  color: designColors.textSecondary,
                  fontSize: 12,
                  fontWeight: "500",
                  marginTop: 6,
                }}
              >
                Happening Now
              </Text>
            ) : null}
            {nowPreview.map((activity) => (
              <BeaconFeedCard
                key={activity.id}
                presentation="discovery"
                compact
                {...buildCardProps(activity)}
              />
            ))}
            {upcomingPreview.length ? (
              <Text
                accessibilityRole="header"
                style={{
                  color: designColors.textSecondary,
                  fontSize: 12,
                  fontWeight: "500",
                  marginTop: 6,
                }}
              >
                Coming Up
              </Text>
            ) : null}
            {upcomingPreview.map((activity) => (
              <BeaconFeedCard
                key={activity.id}
                presentation="discovery"
                compact
                {...buildCardProps(activity)}
              />
            ))}
          </View>
        ) : null}

        {home.kind === "compact" &&
        !nowPreview.length &&
        !upcomingPreview.length &&
        (exploration.query.trim() ||
          exploration.area ||
          exploration.filters.audience !== "Everyone" ||
          exploration.filters.category !== "All categories" ||
          exploration.filters.time !== "All" ||
          exploration.filters.planId) ? (
          <SemanticEmpty
            name="empty.filtered"
            density="inline"
            action={{
              label: "Clear filters",
              onPress: () => {
                exploration.setQuery("");
                exploration.setArea(null);
                exploration.setFilters({
                  audience: "Everyone",
                  category: "All categories",
                  time: "All",
                  planId: null,
                });
              },
            }}
          />
        ) : null}

        <View
          collapsable={false}
          style={{
            borderTopWidth: 1,
            borderTopColor: designColors.border,
            marginTop: 6,
            paddingTop: 12,
          }}
        >
          <Pressable
            testID="saved-tools-entry"
            accessibilityRole="button"
            accessibilityLabel="My Collection"
            onPress={() => router.push("/my-collection" as Href)}
            style={{
              minHeight: 60,
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: designColors.surfaceRaised,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bookmark size={18} color={designColors.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                style={{
                  color: designColors.textPrimary,
                  fontSize: 14,
                  lineHeight: 20,
                  fontWeight: "500",
                }}
              >
                My Collection
              </Text>
              <Text
                style={{
                  color: designColors.textSecondary,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                Saved Beacons, Plans, templates
              </Text>
            </View>
            <ChevronRight size={18} color={designColors.textSecondary} />
          </Pressable>
        </View>
      </ScrollView>

      <Sheet
        title="Your response"
        visible={!!rsvpActivityId}
        onClose={() => setRsvpActivityId(null)}
      >
        {selectedRsvpActivity ? (
          <Text
            style={{
              color: designColors.textSecondary,
              ...tokens.type.secondary,
            }}
          >
            {selectedRsvpActivity.title}
          </Text>
        ) : null}
        {requestError ? (
          <Text
            accessibilityRole="alert"
            style={{ color: designColors.danger, ...tokens.type.caption }}
          >
            {requestError}
          </Text>
        ) : null}
        <Button
          title={
            selectedRsvpActivity?.approval_required
              ? "Request to join"
              : "I'm In"
          }
          disabled={
            rsvpBusy ||
            (!!selectedRsvpActivity &&
              beaconCapacity(data, selectedRsvpActivity).full &&
              selectedRsvp?.status !== "going")
          }
          onPress={() => selectedRsvpActivity && void handleRsvpSheet("going")}
        />
        <Button
          title="Maybe"
          secondary
          disabled={rsvpBusy}
          onPress={() =>
            selectedRsvpActivity && void handleRsvpSheet("interested")
          }
        />
        {selectedRsvp ? (
          <Button
            title="I'm Out"
            secondary
            disabled={rsvpBusy}
            onPress={() => void handleRsvpSheet("withdraw")}
          />
        ) : null}
      </Sheet>

      <Sheet
        title="Report Beacon"
        visible={!!reportActivityId}
        onClose={() => {
          if (!reportBusy) {
            setReportActivityId(null);
            setReportReason("");
          }
        }}
      >
        <Text
          style={{
            color: designColors.textSecondary,
            ...tokens.type.secondary,
          }}
        >
          Tell us why this Beacon should be reviewed. It will not be reported
          until you submit.
        </Text>
        <Field
          label="Reason"
          value={reportReason}
          onChangeText={setReportReason}
          placeholder="Describe the concern"
          multiline
        />
        {requestError ? (
          <Text
            accessibilityRole="alert"
            style={{ color: designColors.danger, ...tokens.type.caption }}
          >
            {requestError}
          </Text>
        ) : null}
        <Button
          title={reportBusy ? "Sending report…" : "Submit report"}
          disabled={reportBusy || !reportReason.trim()}
          onPress={() => void report()}
        />
        <Button
          title="Cancel"
          secondary
          disabled={reportBusy}
          onPress={() => {
            setReportActivityId(null);
            setReportReason("");
          }}
        />
      </Sheet>
    </View>
  );
}
