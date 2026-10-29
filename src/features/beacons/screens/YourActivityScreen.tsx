import { ActivityActionBar } from "@/src/features/activity/ActivityActionBar";
import { ActivityEmbedded } from "@/src/features/activity/ActivityFrame";
import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { shareBeaconInvitation } from "@/src/features/sharing/shareBeacon";
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  History,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import {
  useDesignTheme,
  Card,
  SecondaryButton,
} from "@/src/shared/design-system";
import { confirmedHubActivities } from "@/src/features/beacons/hubSelectors";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { BeaconFeedCard } from "@/src/features/beacons/components/BeaconFeedCard";
import type { ActivityHistorySummary } from "@/src/features/beacons/activityHistory";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import { canViewProfile } from "@/src/features/profile/privacy";
import { usePastMemoryThumbnails } from "@/src/features/beacons/usePastMemoryThumbnails";
import { matchesSearch } from "@/src/shared/search";
import { activityFeedCardProps } from "./activityFeedCard";
import {
  historyStatusLabel,
  initialHistoryExpanded,
  selectActivityPeriods,
  showHistoryForSearch,
} from "./activityScreenSelectors";

type HistoryGroup = { key: string; rows: ActivityHistorySummary[] };

function monthKey(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "unknown";
}

function monthTitle(key: string) {
  if (key === "unknown") return "Earlier";
  const date = new Date(`${key}-01T12:00:00`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString([], { month: "long", year: "numeric" })
    : "Earlier";
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date unavailable";
}

function backToBeacons() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/activities");
}

export default function YourActivityScreen() {
  const embedded = useContext(ActivityEmbedded);
  const { colors, tokens } = useDesignTheme();
  const insets = useSafeAreaInsets();
  const compactHeader = useWindowDimensions().width < 380;
  const now = useNow();
  const params = useLocalSearchParams<{ historyExpanded?: string }>();
  const {
    data,
    userId,
    act,
    loading,
    refresh,
    getViewerEpoch,
    viewerEpoch,
    loadActivityHistory,
  } = useBeacon();
  const confirmed = useMemo(
    () => confirmedHubActivities(data, userId),
    [data, userId],
  );
  const periods = useMemo(
    () => selectActivityPeriods(confirmed, now),
    [confirmed, now],
  );
  const hasCurrentOrUpcoming =
    periods.active.length + periods.upcoming.length > 0;
  const [historyExpandedOverride, setHistoryExpandedOverride] = useState<
    boolean | null
  >(() => (params.historyExpanded === "yes" ? true : null));
  const historyExpanded =
    historyExpandedOverride ??
    initialHistoryExpanded(hasCurrentOrUpcoming, loading);
  const [historyQuery, setHistoryQuery] = useState("");
  const [settledSearch, setSettledSearch] = useState({
    query: "",
    revision: 0,
  });
  const [historyRows, setHistoryRows] = useState<ActivityHistorySummary[]>([]);
  const [historyOwner, setHistoryOwner] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const historyRequest = useRef(0);
  const historySearchRevision = useRef(0);
  const mounted = useRef(true);
  const latestUser = useRef(userId);
  const latestSnapshotUser = useRef(data.viewer_id);
  const historyEligibilityKey = useMemo(
    () =>
      JSON.stringify(
        confirmed
          .map((activity) => {
            const host = data.profiles.find(
              (profile) => profile.id === activity.owner_id,
            );
            const readableHost =
              host && canViewProfile(data, host, userId) ? host.name : null;
            return [
              activity.id,
              activity.title,
              activity.category,
              activity.description ?? null,
              readableHost,
              activity.status,
              activity.mode,
              activity.starts_at,
              activity.ends_at,
              activity.owner_id,
              activity.status !== "scheduled" ||
                Date.parse(activity.ends_at) <= now,
              canViewBeaconMeetingDetails(data, activity.id, userId),
            ];
          })
          .sort((left, right) =>
            String(left[0]).localeCompare(String(right[0])),
          ),
      ),
    [confirmed, data, now, userId],
  );

  useEffect(() => {
    mounted.current = true;
    latestUser.current = userId;
    latestSnapshotUser.current = data.viewer_id;
    return () => {
      mounted.current = false;
      historyRequest.current += 1;
    };
  }, [data.viewer_id, userId]);

  useEffect(() => {
    const query = historyQuery.trim();
    const revision = historySearchRevision.current;
    const timer = setTimeout(
      () =>
        setSettledSearch((current) =>
          current.query === query && current.revision === revision
            ? current
            : { query, revision },
        ),
      220,
    );
    return () => clearTimeout(timer);
  }, [historyQuery]);

  useEffect(() => {
    const requestId = ++historyRequest.current;
    let active = true;
    const viewer = userId;
    const epoch = getViewerEpoch();
    const isCurrent = () =>
      active &&
      mounted.current &&
      historyRequest.current === requestId &&
      latestUser.current === viewer &&
      latestSnapshotUser.current === viewer &&
      epoch === getViewerEpoch();

    const timer = setTimeout(() => {
      setHistoryRows([]);
      setHistoryOwner(null);
      setHistoryCursor(null);
      setHistoryHasMore(false);
      setHistoryError("");
      setHistoryLoading(true);
      setHistoryLoadingMore(false);
      if (!viewer || data.viewer_id !== viewer) {
        setHistoryLoading(false);
        return;
      }
      void loadActivityHistory({
        query: settledSearch.query || undefined,
        pageSize: 3,
      })
        .then((page) => {
          if (!isCurrent()) return;
          setHistoryRows(page.rows);
          setHistoryOwner(viewer);
          setHistoryCursor(page.nextCursor);
          setHistoryHasMore(page.hasMore);
        })
        .catch((failure: unknown) => {
          if (!isCurrent()) return;
          setHistoryError(
            failure instanceof Error
              ? failure.message
              : "Past experiences could not load.",
          );
        })
        .finally(() => {
          if (isCurrent()) setHistoryLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    data.viewer_id,
    getViewerEpoch,
    historyEligibilityKey,
    loadActivityHistory,
    reload,
    settledSearch.query,
    settledSearch.revision,
    userId,
    viewerEpoch,
  ]);

  const openActivity = useCallback(
    (id: string) => {
      const note = data.activities.find(
        (a) =>
          a.id === id &&
          a.solo_purpose === "activity_note" &&
          a.owner_id === userId,
      );
      if (note) router.push({ pathname: "/activity-note", params: { id } });
      else router.push({ pathname: "/activity/[id]", params: { id } });
    },
    [data.activities, userId],
  );

  const respond = useCallback(
    async (activityId: string, status: "going" | "interested" | "withdraw") => {
      const activity = data.activities.find((row) => row.id === activityId);
      if (
        !userId ||
        data.viewer_id !== userId ||
        !activity ||
        activity.mode === "solo" ||
        activity.owner_id === userId ||
        !canReadBeaconActivity(data, activity, userId)
      ) {
        throw new Error("This Beacon does not accept your RSVP.");
      }
      await act("rsvp", { id: activity.id, status });
    },
    [act, data, userId],
  );

  const shareActivity = useCallback(
    async (activityId: string) => {
      const activity = data.activities.find((row) => row.id === activityId);
      if (!activity) throw new Error("This Beacon is no longer available.");
      await shareBeaconInvitation(data,userId,activity);
    },
    [data,userId],
  );

  const loadMore = useCallback(async () => {
    if (
      !historyCursor ||
      historyLoadingMore ||
      historyLoading ||
      !userId ||
      data.viewer_id !== userId
    )
      return;
    const requestId = historyRequest.current;
    const epoch = getViewerEpoch();
    const viewer = userId;
    const cursor = historyCursor;
    const query = settledSearch.query || undefined;
    const isCurrent = () =>
      mounted.current &&
      historyRequest.current === requestId &&
      latestUser.current === viewer &&
      latestSnapshotUser.current === viewer &&
      epoch === getViewerEpoch();
    setHistoryLoadingMore(true);
    setHistoryError("");
    try {
      const page = await loadActivityHistory({ query, cursor, pageSize: 20 });
      if (!isCurrent()) return;
      setHistoryRows((current) => {
        const ids = new Set(current.map((row) => row.id));
        return [...current, ...page.rows.filter((row) => !ids.has(row.id))];
      });
      setHistoryCursor(page.nextCursor);
      setHistoryHasMore(page.hasMore);
    } catch (failure) {
      if (isCurrent())
        setHistoryError(
          failure instanceof Error
            ? failure.message
            : "More past experiences could not load.",
        );
    } finally {
      if (isCurrent()) setHistoryLoadingMore(false);
    }
  }, [
    data.viewer_id,
    getViewerEpoch,
    historyCursor,
    historyLoading,
    historyLoadingMore,
    loadActivityHistory,
    settledSearch.query,
    userId,
  ]);

  const retryHistory = useCallback(() => {
    historyRequest.current += 1;
    setHistoryError("");
    setHistoryLoading(true);
    setReload((value) => value + 1);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
      retryHistory();
    } catch {
      setHistoryError("Your activity could not refresh. Try again.");
    } finally {
      setRefreshing(false);
    }
  }, [refresh, retryHistory]);

  const onHistorySearch = useCallback(
    (value: string) => {
      const next = value.slice(0, 80);
      if (next.trim() === historyQuery.trim()) {
        setHistoryQuery(next);
        return;
      }
      historySearchRevision.current += 1;
      historyRequest.current += 1;
      setHistoryQuery(next);
      setHistoryRows([]);
      setHistoryOwner(null);
      setHistoryCursor(null);
      setHistoryHasMore(false);
      setHistoryError("");
      setHistoryLoading(true);
      setHistoryLoadingMore(false);
    },
    [historyQuery],
  );

  const createBeacon = useCallback(() => router.push("/create"), []);
  const exploreBeacons = useCallback(() => router.push("/browse-beacons"), []);
  const isSearching = !!historyQuery.trim();
  const showHistoryRows = showHistoryForSearch(historyExpanded, historyQuery);
  const currentActivitiesById = useMemo(
    () =>
      new Map(
        [
          ...confirmed,
          ...data.activities.filter(
            (a) => a.owner_id === userId && a.solo_purpose === "activity_note",
          ),
        ].map((activity) => [activity.id, activity]),
      ),
    [confirmed, data.activities, userId],
  );
  const visibleHistoryRows = useMemo(
    () =>
      historyOwner === userId && data.viewer_id === userId
        ? historyRows.filter((row) => currentActivitiesById.has(row.id))
        : [],
    [currentActivitiesById, data.viewer_id, historyOwner, historyRows, userId],
  );
  const groups = useMemo<HistoryGroup[]>(() => {
    const result: HistoryGroup[] = [];
    for (const row of visibleHistoryRows) {
      const key = monthKey(
        currentActivitiesById.get(row.id)?.starts_at ?? row.startsAt,
      );
      const previous = result[result.length - 1];
      if (previous?.key === key) previous.rows.push(row);
      else result.push({ key, rows: [row] });
    }
    return result;
  }, [currentActivitiesById, visibleHistoryRows]);
  const query = historyQuery.trim();
  const searchedPeriods = useMemo(() => {
    if (!query || !userId || data.viewer_id !== userId) return periods;
    const matches = (activity: (typeof confirmed)[number]) => {
      const host = data.profiles.find(
        (profile) => profile.id === activity.owner_id,
      );
      const readableHost =
        host && canViewProfile(data, host, userId) ? host.name : undefined;
      const place = canViewBeaconMeetingDetails(data, activity.id, userId)
        ? data.places.find((row) => row.activity_id === activity.id)
        : undefined;
      return matchesSearch(
        query,
        activity.title,
        activity.category,
        activity.description,
        readableHost,
        place?.label,
      );
    };
    return {
      active: periods.active.filter(matches),
      upcoming: periods.upcoming.filter(matches),
    };
  }, [data, periods, query, userId]);
  const allEmpty =
    !hasCurrentOrUpcoming &&
    !visibleHistoryRows.length &&
    !historyLoading &&
    !historyError &&
    !isSearching;
  const historyActivityIds = useMemo(
    () => new Set(visibleHistoryRows.map((row) => row.id)),
    [visibleHistoryRows],
  );
  const historyActivities = useMemo(
    () =>
      data.activities.filter((activity) => historyActivityIds.has(activity.id)),
    [data.activities, historyActivityIds],
  );
  const memoryThumbnails = usePastMemoryThumbnails(
    data,
    historyActivities,
    userId,
    showHistoryRows,
  );

  const renderPersonalCard = (activityId: string) => {
    const activity = data.activities.find((row) => row.id === activityId);
    if (!activity || !userId) return null;
    const response = data.rsvps.find(
      (row) => row.activity_id === activity.id && row.user_id === userId,
    );
    return (
      <BeaconFeedCard
        key={activity.id}
        compact
        {...activityFeedCardProps(data, activity, userId, now, {
          onOpen: () => openActivity(activity.id),
          onRSVP: (status) => respond(activity.id, status),
          onChangeRSVP:
            response?.status === "going" || response?.status === "requested"
              ? () => openActivity(activity.id)
              : undefined,
          onSave: () =>
            act("save_beacon", {
              activity_id: activity.id,
              saved: !data.beacon_favorites.some(
                (favorite) =>
                  favorite.owner_id === userId &&
                  favorite.activity_id === activity.id,
              ),
            }).then(() => undefined),
          onShare: () => shareActivity(activity.id),
        })}
      />
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg }}
      testID="your-activity-screen"
    >
      {!embedded && (
        <View
          style={{
            paddingTop: insets.top,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: tokens.layout.contentMaxWidth,
              alignSelf: "center",
              minHeight: 58,
              paddingHorizontal: tokens.layout.screenGutter,
              flexDirection: "row",
              alignItems: "center",
              gap: compactHeader ? 2 : tokens.space.xs,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Beacons"
              onPress={backToBeacons}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={21} color={colors.textPrimary} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                testID="your-activity-header"
                accessibilityRole="header"
                numberOfLines={1}
                style={{
                  color: colors.textPrimary,
                  ...tokens.type.titleSmall,
                  ...(compactHeader ? tokens.type.body : {}),
                  fontWeight: "800",
                }}
              >
                Your Activity
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Beacon"
              onPress={createBeacon}
              style={{
                minHeight: 44,
                paddingHorizontal: tokens.space.xs,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  ...tokens.type.caption,
                  fontWeight: "700",
                }}
              >
                + Create Beacon
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse Beacons"
              onPress={exploreBeacons}
              style={{
                minWidth: 44,
                height: 44,
                paddingHorizontal: tokens.space.xs,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: tokens.space.xxs,
              }}
            >
              <Compass size={19} color={colors.accent} />
              <Text
                style={{
                  color: colors.accent,
                  ...tokens.type.caption,
                  fontWeight: "700",
                }}
              >
                Browse
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {embedded && (
        <View
          style={{
            paddingHorizontal: tokens.layout.screenGutter,
            paddingTop: tokens.space.xs,
            paddingBottom: tokens.space.xxs,
          }}
        >
          <ActivityActionBar
            items={[
              {
                label: "Create Beacon",
                accessibilityLabel: "Create Beacon",
                icon: Plus,
                primary: true,
                onPress: createBeacon,
              },
              {
                label: "Browse",
                accessibilityLabel: "Browse Beacons",
                icon: Compass,
                onPress: exploreBeacons,
              },
            ]}
          />
        </View>
      )}
      <ScrollView
        testID="your-activity-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{
          width: "100%",
          maxWidth: tokens.layout.contentMaxWidth,
          alignSelf: "center",
          paddingHorizontal: tokens.layout.screenGutter,
          paddingTop: tokens.space.md,
          paddingBottom: insets.bottom + tokens.layout.scrollClearance,
          gap: tokens.space.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: tokens.radius.button,
            backgroundColor: colors.surface,
            paddingHorizontal: tokens.space.md,
          }}
        >
          <TextInput
            testID="your-activity-search"
            accessibilityLabel="Search your activities"
            value={historyQuery}
            onChangeText={onHistorySearch}
            placeholder="Search your activities"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            style={
              {
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                color: colors.textPrimary,
                ...tokens.type.body,
                outlineStyle: "none",
              } as never
            }
          />
          {historyQuery ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear activity search"
              onPress={() => onHistorySearch("")}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  ...tokens.type.caption,
                  fontWeight: "700",
                }}
              >
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
        {allEmpty ? (
          <View testID="your-activity-empty">
            <SemanticEmpty
              name="empty.upcoming"
              illustration="emptyUpcoming"
              density="hero"
              action={{ label: "Explore Beacons", onPress: exploreBeacons }}
              secondaryActions={[
                { label: "Create Beacon", onPress: createBeacon },
              ]}
            />
          </View>
        ) : null}
        {!allEmpty && searchedPeriods.active.length ? (
          <View
            style={{ gap: tokens.space.sm }}
            testID="your-activity-now-section"
          >
            <Text
              accessibilityRole="header"
              style={{ color: colors.textPrimary, ...tokens.type.titleSmall }}
            >
              Happening Now
            </Text>
            {searchedPeriods.active.map((activity) =>
              renderPersonalCard(activity.id),
            )}
          </View>
        ) : null}
        {!allEmpty && searchedPeriods.upcoming.length ? (
          <View
            style={{ gap: tokens.space.sm }}
            testID="your-activity-upcoming-section"
          >
            <Text
              accessibilityRole="header"
              style={{ color: colors.textPrimary, ...tokens.type.titleSmall }}
            >
              Coming Up
            </Text>
            {searchedPeriods.upcoming.map((activity) =>
              renderPersonalCard(activity.id),
            )}
          </View>
        ) : null}

        {!allEmpty ? (
          <View
            style={{ gap: tokens.space.sm }}
            testID="your-activity-history-section"
          >
            {showHistoryRows ? (
              <View
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.space.sm,
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: colors.textPrimary,
                    ...tokens.type.titleSmall,
                  }}
                >
                  Past Experiences
                </Text>
                {!isSearching ? (
                  <Pressable
                    testID="your-activity-history-disclosure"
                    accessibilityRole="button"
                    accessibilityLabel="Collapse past experiences"
                    accessibilityState={{ expanded: true }}
                    onPress={() => setHistoryExpandedOverride(false)}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronUp size={19} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable
                testID="your-activity-history-disclosure"
                accessibilityRole="button"
                accessibilityLabel="Expand past experiences"
                accessibilityState={{ expanded: false }}
                onPress={() => setHistoryExpandedOverride(true)}
                style={({ pressed }) => ({
                  minHeight: 66,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.space.md,
                  paddingHorizontal: tokens.space.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: tokens.radius.card,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.84 : 1,
                })}
              >
                <History size={22} color={colors.accent} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      ...tokens.type.secondary,
                      fontWeight: "700",
                    }}
                  >
                    Past Experiences
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.textSecondary,
                      ...tokens.type.caption,
                    }}
                  >
                    Your history, memories, and completed plans
                  </Text>
                </View>
                <ChevronDown size={19} color={colors.textSecondary} />
              </Pressable>
            )}

            {showHistoryRows ? (
              <>
                {historyError ? (
                  <Card
                    style={{ gap: tokens.space.sm, borderColor: colors.danger }}
                  >
                    <Text
                      accessibilityRole="alert"
                      style={{ color: colors.danger, ...tokens.type.secondary }}
                    >
                      {historyError}
                    </Text>
                    <SecondaryButton title="Try again" onPress={retryHistory} />
                  </Card>
                ) : null}
                {historyLoading && !visibleHistoryRows.length ? (
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel="Loading past experiences"
                    style={{
                      minHeight: 64,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: tokens.space.sm,
                    }}
                  >
                    <ActivityIndicator color={colors.accent} />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        ...tokens.type.secondary,
                      }}
                    >
                      Loading past experiences
                    </Text>
                  </View>
                ) : null}
                {visibleHistoryRows.length
                  ? groups.map((group) => (
                      <View key={group.key} style={{ gap: tokens.space.xs }}>
                        <Text
                          accessibilityRole="header"
                          style={{
                            color: colors.textPrimary,
                            ...tokens.type.titleSmall,
                          }}
                        >
                          {monthTitle(group.key)}
                        </Text>
                        {group.rows.map((row) => {
                          const activity = currentActivitiesById.get(row.id);
                          const title = activity?.title ?? row.title;
                          const startsAt = activity?.starts_at ?? row.startsAt;
                          const label =
                            activity?.status === "cancelled"
                              ? "Cancelled"
                              : activity?.status === "completed"
                                ? "Completed"
                                : historyStatusLabel(row.historyLabel);
                          return (
                            <View
                              key={row.id}
                              testID={`your-activity-history-${row.id}`}
                              style={{
                                minWidth: 0,
                                padding: tokens.space.sm,
                                borderRadius: tokens.radius.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.surface,
                                gap: tokens.space.xs,
                              }}
                            >
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Open ${title}, ${label}, ${formatHistoryDate(startsAt)}. View Beacon details and memories`}
                                accessibilityHint="Opens Beacon details and memories"
                                onPress={() => openActivity(row.id)}
                                style={{
                                  minHeight: 64,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: tokens.space.sm,
                                }}
                              >
                                {memoryThumbnails[row.id] ? (
                                  <Image
                                    accessibilityLabel="Beacon memory"
                                    source={{ uri: memoryThumbnails[row.id] }}
                                    style={{
                                      width: 52,
                                      height: 52,
                                      borderRadius: tokens.radius.sm,
                                      backgroundColor: colors.surfaceRaised,
                                    }}
                                  />
                                ) : (
                                  <CalendarDays
                                    size={22}
                                    color={colors.textSecondary}
                                  />
                                )}
                                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                                  <Text
                                    numberOfLines={2}
                                    style={{
                                      color: colors.textPrimary,
                                      ...tokens.type.secondary,
                                      fontWeight: "700",
                                    }}
                                  >
                                    {title}
                                  </Text>
                                  <Text
                                    numberOfLines={2}
                                    style={{
                                      color: colors.textSecondary,
                                      ...tokens.type.caption,
                                    }}
                                  >
                                    {formatHistoryDate(startsAt)} ·{" "}
                                    {row.viewerRole === "host"
                                      ? "Hosted by you"
                                      : "Going RSVP"}{" "}
                                    · {label}
                                  </Text>
                                </View>
                                <ChevronRight
                                  size={17}
                                  color={colors.textSecondary}
                                />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    ))
                  : null}
                {!historyLoading &&
                !historyError &&
                !visibleHistoryRows.length &&
                isSearching ? (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      ...tokens.type.secondary,
                    }}
                  >
                    No past experiences match this search.
                  </Text>
                ) : null}
                {historyHasMore ? (
                  <SecondaryButton
                    testID="your-activity-show-more"
                    title={historyLoadingMore ? "Loading…" : "Show More"}
                    disabled={historyLoadingMore || historyLoading}
                    onPress={() => void loadMore()}
                  />
                ) : null}
                {historyLoadingMore ? (
                  <Text
                    accessibilityRole="progressbar"
                    style={{
                      textAlign: "center",
                      color: colors.textSecondary,
                      ...tokens.type.caption,
                    }}
                  >
                    Loading more experiences…
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
