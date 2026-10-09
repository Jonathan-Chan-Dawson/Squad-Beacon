import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import {
  CalendarDays,
  Compass,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react-native";
import type { Activity, Category } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useExploration, matchesExplorationArea } from "@/src/shared/exploration";
import { usePreferences } from "@/src/shared/preferences";
import { activityWhen, friendIds } from "@/src/shared/domain";
import { browseBeacons, type SortOrder } from "@/src/shared/browsing";
import { canReadBeaconActivity, canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canViewBeaconMeetingDetails, selectFreshVisiblePersonLocation, selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { activeOrganizationRole } from "@/src/features/organizations/domain";
import { beaconCapacity, beaconSeatCount, isApprovedGoing } from "@/src/features/beacons/permissions";
import { crew } from "@/src/shared/browsing";
import { matchesBeaconFilters } from "@/src/features/maps/filtering";
import { matchesSelectedCategories, mapAdvancedFilterCount } from "@/src/features/maps/mapUIselectors";
import { AdvancedMapFilters, type MapAudienceChoice } from "@/src/features/maps/AdvancedMapFilters";
import { BeaconFeedCard, type BeaconFeedCardProps } from "@/src/features/beacons/components/BeaconFeedCard";
import { StatusPanel, type FeedStatusSave } from "@/src/features/beacons/components/feed/StatusPanel";
import { FriendsNowHeader, FriendNowRow, type FriendsNowFilter, type SafeFriendNowRow } from "@/src/features/beacons/components/feed/FriendsNow";
import { PastHistoryEmpty, PastHistoryRow, PastMonthHeader, PastWeeklyProgressView, getPastMonthKey, type PastWeeklyProgress, type SafePastHistoryRow } from "@/src/features/beacons/components/feed/PastPanels";
import { PastToolkit } from "@/src/features/beacons/components/feed/PastPanels";
import { PeriodTabs } from "@/src/features/beacons/PeriodTabs";
import FeedPager from "@/src/features/beacons/FeedPager";
import type { FeedPage } from "@/src/features/beacons/FeedPager.types";
import { usePastMemoryThumbnails } from "@/src/features/beacons/usePastMemoryThumbnails";
import { DemoChip, GlassBar, Skeleton, useDesignTheme } from "@/src/shared/design-system";
import { Button, Chips, Field, InboxButton, Sheet, Txt, uiHaptics, useTheme } from "@/src/shared/ui";
import { usePlanningResponses } from "@/src/features/people/usePlanningResponses";
import { ResponsesSheet } from "@/src/features/people/components/ResponsesSheet";
import type { ExplorationFilters } from "@/src/shared/exploration";

type FeedItem =
  | { key: string; type: "status" }
  | { key: string; type: "friends-header" }
  | { key: string; type: "friend"; friend: SafeFriendNowRow }
  | { key: string; type: "friends-expand"; expanded: boolean }
  | { key: string; type: "friends-find" }
  | { key: string; type: "section"; title: string }
  | { key: string; type: "activity"; activity: Activity; index: number }
  | { key: string; type: "week" }
  | { key: string; type: "responses"; count: number }
  | { key: string; type: "area-controls"; activeFilters: number }
  | { key: string; type: "day"; date: Date; dateKey: string }
  | { key: string; type: "toolkit" }
  | { key: string; type: "weekly"; items: PastWeeklyProgress[] }
  | { key: string; type: "month"; date: string }
  | { key: string; type: "history"; row: SafePastHistoryRow }
  | { key: string; type: "past-empty" }
  | { key: string; type: "empty"; title: string; body: string }
  | { key: string; type: "skeleton"; index: number }
  | { key: string; type: "error"; message: string };

const PAGE_GUTTER = 16;
const COLLAPSED_FRIENDS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function localDayKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayTitle(date: Date) {
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function firstDayOfWeek(now: number) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function isLayoutNotReady(error: unknown) {
  return error instanceof Error && error.message === "index out of bounds, not enough layouts";
}

function emptyFilters(filters: ExplorationFilters): ExplorationFilters {
  return {
    ...filters,
    audience: "Everyone",
    category: "All categories",
    time: "All",
    planId: null,
    when: "Any",
    join: "Any",
    format: "Any",
    starredOnly: false,
  };
}

export default function ActivitiesScreen() {
  const { styles } = useTheme();
  const { colors: designColors, tokens } = useDesignTheme();
  const { data, userId, act, demo, loading, error: storeError, refresh } = useBeacon();
  const exploration = useExploration();
  const insets = useSafeAreaInsets();
  const periodicNow = useNow();
  const [acknowledgedStatusTime, setAcknowledgedStatusTime] = useState(0);
  // A successful status starts after the last periodic tick. Advance the clock on
  // acknowledgement so the canonical record is visible immediately.
  const now = Math.max(periodicNow, acknowledgedStatusTime);
  const reducedMotion = useReducedMotion();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { showAvatars } = usePreferences();
  const [page, setPage] = useState<FeedPage>("Now");
  const [scrollY] = useState(() => new RNAnimated.Value(0));
  const [pageSwipeEnabled, setPageSwipeEnabled] = useState(true);
  const setCardGestureActive = useCallback((active: boolean) => setPageSwipeEnabled(!active), []);
  const [refreshing, setRefreshing] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [basicFiltersOpen, setBasicFiltersOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [reportActivityId, setReportActivityId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [rsvpActivityId, setRsvpActivityId] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [friendFilter, setFriendFilter] = useState<FriendsNowFilter>("everyone");
  const [friendsExpanded, setFriendsExpanded] = useState(false);
  const [joined, setJoined] = useState(false);
  const [sort, setSort] = useState<SortOrder>("Soonest");
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(() =>
    exploration.filters.category === "All categories" ? [] : [exploration.filters.category],
  );
  const [scrollOffsets] = useState<Record<FeedPage, number>>({ Now: 0, Upcoming: 0, Past: 0 });
  const listRefs = useRef<Partial<Record<FeedPage, FlashListRef<FeedItem>>>>({});
  const pendingUpcomingDate = useRef<string | null>(null);
  const upcomingLayoutRevision = useRef(0);
  const flushUpcomingDateRef = useRef<() => void>(() => {});

  useFocusEffect(
    useCallback(() => {
      if (params.filter === "Past") setPage("Past");
    }, [params.filter]),
  );

  const setActivePage = useCallback((next: FeedPage) => {
    setPage((current) => (current === next ? current : next));
    scrollY.setValue(scrollOffsets[next]);
  }, [scrollOffsets, scrollY]);

  const ownStatusActivity = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return undefined;
    return data.activities
      .filter((activity) =>
        activity.owner_id === userId &&
        activity.mode === "solo" &&
        activity.status === "scheduled" &&
        Number.isFinite(Date.parse(activity.starts_at)) &&
        Number.isFinite(Date.parse(activity.ends_at)) &&
        Date.parse(activity.starts_at) <= now &&
        Date.parse(activity.ends_at) > now,
      )
      .sort((left, right) => right.starts_at.localeCompare(left.starts_at))[0];
  }, [data.activities, data.viewer_id, now, userId]);
  const ownProfile = data.profiles.find((profile) => profile.id === userId);

  const friends = useMemo<SafeFriendNowRow[]>(() => {
    if (!userId || data.viewer_id !== userId) return [];
    return friendIds(data, userId)
      .flatMap((personId) => {
        const preview = selectPersonPreview(data, personId, userId, now);
        if (!preview.canMessage) return [];
        const profile = preview.canViewFullProfile ? preview.profile : undefined;
        const activity = preview.beacon;
        const status = preview.canViewFullProfile ? data.activities
          .filter((row) => row.owner_id === personId && row.mode === "solo" && row.status === "scheduled" &&
            Date.parse(row.starts_at) <= now && Date.parse(row.ends_at) > now && canReadBeaconActivity(data, row, userId))
          .sort((left, right) => left.starts_at.localeCompare(right.starts_at))[0] : undefined;
        const availability = preview.availability;
        const statusText =
          availability === "available"
            ? status?.title || "Free to hang"
            : availability === "ending-soon"
              ? status?.title || "Free to hang · ending soon"
              : availability === "unavailable"
                ? status?.title || "Busy"
                : status?.title || "No status shared";
        const location = selectFreshVisiblePersonLocation(data, personId, userId, now);
        return [{
          id: personId,
          name: profile?.name ?? "Friend",
          ...(profile ? { profile } : {}),
          availability,
          statusText,
          until: status?.ends_at ?? null,
          starred: preview.starred,
          hasFreshSharedLocation: !!location,
          ...(activity && activity.mode !== "solo" && Date.parse(activity.starts_at) <= now && Date.parse(activity.ends_at) > now ? { activeBeaconId: activity.id } : {}),
        } satisfies SafeFriendNowRow];
      })
      .sort((left, right) => {
        const rank = (friend: SafeFriendNowRow) =>
          (friend.starred ? 2 : 0) +
          (friend.availability === "available" || friend.availability === "ending-soon" ? 1 : 0);
        return rank(right) - rank(left) || left.name.localeCompare(right.name);
      });
  }, [data, now, userId]);

  const filteredFriends = useMemo(
    () => friends.filter((friend) =>
      friendFilter === "everyone" ||
      (friendFilter === "free"
        ? friend.availability === "available" || friend.availability === "ending-soon"
        : friend.starred),
    ),
    [friendFilter, friends],
  );
  const shownFriends = friendsExpanded
    ? filteredFriends
    : filteredFriends.slice(0, COLLAPSED_FRIENDS);

  const mapAudiences = useMemo<MapAudienceChoice[]>(() => {
    if (!userId || data.viewer_id !== userId) return [];
    const lists = data.lists
      .filter((list) => {
        const owner = data.profiles.find((profile) => profile.id === list.owner_id);
        const isMember = list.owner_id === userId || data.list_members.some(
          (row) => row.list_id === list.id && row.user_id === userId,
        );
        const blocked = data.blocks.some((row) =>
          (row.blocker_id === list.owner_id && row.blocked_id === userId) ||
          (row.blocker_id === userId && row.blocked_id === list.owner_id),
        );
        return isMember && !blocked && (list.owner_id === userId || (!!owner && canViewProfile(data, owner, userId)));
      })
      .map((list) => ({ id: list.id, label: list.name, kind: "List" as const }));
    const squads = data.squads
      .filter((squad) => canOpenSquadProfile(data, squad.id, userId))
      .map((squad) => ({ id: squad.id, label: squad.name, kind: "Squad" as const }));
    const organizations = data.organizations
      .filter((organization) => {
        if (!activeOrganizationRole(organization, data.organization_members, userId)) return false;
        if (data.organization_bans.some((ban) => ban.organization_id === organization.id && ban.user_id === userId)) return false;
        return !data.blocks.some((block) =>
          (block.blocker_id === organization.owner_id && block.blocked_id === userId) ||
          (block.blocker_id === userId && block.blocked_id === organization.owner_id),
        );
      })
      .map((organization) => ({ id: organization.id, label: organization.name, kind: "Organization" as const }));
    return [...lists, ...squads, ...organizations];
  }, [data, userId]);

  const planOptions = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return [];
    return data.plans
      .filter((plan) =>
        (plan.owner_id === userId && !plan.squad_id) ||
        (!!plan.squad_id && canOpenSquadProfile(data, plan.squad_id, userId)),
      )
      .map((plan) => ({ id: plan.id, label: `${plan.title} · ${plan.start_date}` }));
  }, [data, userId]);

  const activeCategories = useMemo(() => selectedCategories.length
    ? selectedCategories
    : exploration.filters.category === "All categories"
      ? []
      : [exploration.filters.category], [exploration.filters.category, selectedCategories]);
  const advancedFilterCount = mapAdvancedFilterCount(exploration.filters, activeCategories);
  const readableActivities = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return [] as Activity[];
    const browsePeriod = page === "Now" ? "Active" : page;
    const activities = browseBeacons(
      data,
      userId,
      {
        period: browsePeriod,
        sort,
        query: exploration.query,
        category: "All categories",
        audience: page === "Past" ? "Everyone" : exploration.filters.audience,
        joined,
      },
      now,
    )
      .filter((activity) => activity.mode !== "solo")
      .filter((activity) => canReadBeaconActivity(data, activity, userId))
      .filter((activity) => matchesSelectedCategories(activity.category, activeCategories))
      .filter((activity) => {
        const place = canViewBeaconMeetingDetails(data, activity.id, userId)
          ? data.places.find((row) => row.activity_id === activity.id)
          : undefined;
        const coordinate =
          place?.online_url == null && place?.latitude != null && place.longitude != null
            ? { latitude: place.latitude, longitude: place.longitude }
            : null;
        return place?.online_url != null || matchesExplorationArea(exploration.area, coordinate);
      })
      .filter((activity) =>
        page === "Upcoming"
          ? matchesBeaconFilters(data, activity, userId, exploration.filters, now, {
              includeBaseFilters: false,
              query: exploration.query,
            })
          : true,
      );
    if (page === "Now" && sort === "Soonest") {
      const favorite = (kind: string, id: string) => data.favorites.some(
        (entry) => entry.owner_id === userId && entry.kind === kind && entry.target_id === id,
      );
      activities.sort((left, right) => {
        const rank = (activity: Activity) => Number(
          favorite("friend", activity.owner_id) ||
          (activity.audience === "squad" && favorite("squad", activity.audience_id ?? "")) ||
          data.rsvps.some((rsvp) =>
            rsvp.activity_id === activity.id && rsvp.status === "going" && favorite("friend", rsvp.user_id),
          ),
        );
        return rank(right) - rank(left) || left.ends_at.localeCompare(right.ends_at);
      });
    }
    return activities;
  }, [
    activeCategories,
    data,
    exploration.area,
    exploration.filters,
    exploration.query,
    joined,
    now,
    page,
    sort,
    userId,
  ]);

  const nowActivities = useMemo(() => {
    if (page === "Now") return readableActivities;
    if (!userId || data.viewer_id !== userId) return [] as Activity[];
    return browseBeacons(data, userId, {
      period: "Active",
      sort,
      query: exploration.query,
      category: "All categories",
      audience: exploration.filters.audience,
      joined,
    }, now)
      .filter((activity) => activity.mode !== "solo" && canReadBeaconActivity(data, activity, userId))
      .filter((activity) => matchesSelectedCategories(activity.category, activeCategories));
  }, [activeCategories, data, exploration.filters.audience, exploration.query, joined, now, page, readableActivities, sort, userId]);

  const upcomingActivities = useMemo(() => {
    if (page === "Upcoming") return readableActivities;
    if (!userId || data.viewer_id !== userId) return [] as Activity[];
    return browseBeacons(data, userId, {
      period: "Upcoming",
      sort,
      query: exploration.query,
      category: "All categories",
      audience: exploration.filters.audience,
      joined,
    }, now)
      .filter((activity) => activity.mode !== "solo" && canReadBeaconActivity(data, activity, userId))
      .filter((activity) => matchesSelectedCategories(activity.category, activeCategories))
      .filter((activity) => matchesBeaconFilters(data, activity, userId, exploration.filters, now, { includeBaseFilters: false, query: exploration.query }));
  }, [activeCategories, data, exploration.filters, exploration.query, joined, now, page, readableActivities, sort, userId]);

  const pastActivities = useMemo(() => {
    if (page === "Past") return readableActivities;
    if (!userId || data.viewer_id !== userId) return [] as Activity[];
    return browseBeacons(data, userId, {
      period: "Past",
      sort,
      query: exploration.query,
      category: "All categories",
      audience: "Everyone",
      joined: false,
    }, now)
      .filter((activity) => activity.mode !== "solo" && canReadBeaconActivity(data, activity, userId))
      .filter((activity) => matchesSelectedCategories(activity.category, activeCategories));
  }, [activeCategories, data, exploration.query, now, page, readableActivities, sort, userId]);

  const { count: responsesCount, cards: responseCards, invitations } = usePlanningResponses(now, () => setResponsesOpen(false));

  const personalPlans = data.plans.filter((plan) => plan.owner_id === userId && plan.squad_id === null);
  const ownTemplates = data.templates.filter((template) => template.owner_id === userId);
  const savedBeacons = data.beacon_favorites.filter((favorite) =>
    favorite.owner_id === userId && data.activities.some((activity) => activity.id === favorite.activity_id),
  );
  const toolkitCounts = {
    plans: personalPlans.length,
    favorites:
      data.favorites.filter((favorite) => favorite.owner_id === userId).length + savedBeacons.length,
    templates: ownTemplates.length,
    library:
      data.library_folder_items.filter((item) => item.owner_id === userId).length +
      data.library_saved_checklists.filter((item) => item.owner_id === userId).length,
  };

  const weeklyProgress = useMemo<PastWeeklyProgress[]>(() => {
    const goals = ownProfile?.aspiration_goals ?? [];
    if (!userId || data.viewer_id !== userId || goals.length === 0) return [];
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const nextMonday = new Date(monday.getTime() + 7 * DAY_MS);
    return goals.flatMap((goal) => {
      const current = data.activities.filter((activity) =>
        activity.owner_id === userId &&
        activity.status === "completed" &&
        activity.aspiration_ids?.includes(goal.id) &&
        Date.parse(activity.ends_at) >= monday.getTime() &&
        Date.parse(activity.ends_at) < nextMonday.getTime(),
      ).length;
      return Number.isInteger(goal.target_per_week) && goal.target_per_week > 0
        ? [{ title: goal.title, current, target: goal.target_per_week }]
        : [];
    });
  }, [data.activities, data.viewer_id, now, ownProfile?.aspiration_goals, userId]);

  const memoryThumbnails = usePastMemoryThumbnails(data, pastActivities, userId, page === "Past");
  const pastHistoryRows = useMemo<SafePastHistoryRow[]>(() =>
    pastActivities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      date: activity.ends_at,
      people: beaconSeatCount(data, activity),
      thumbnailUri: memoryThumbnails[activity.id],
    })),
  [data, memoryThumbnails, pastActivities]);

  const nowItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      { key: "status", type: "status" },
      { key: "friends-header", type: "friends-header" },
    ];
    shownFriends.forEach((friend) => items.push({ key: `friend:${friend.id}`, type: "friend", friend }));
    if (filteredFriends.length > COLLAPSED_FRIENDS) {
      items.push({ key: "friends-expand", type: "friends-expand", expanded: friendsExpanded });
    }
    items.push({ key: "friends-find", type: "friends-find" });
    items.push({ key: "now-section", type: "section", title: "Happening now" });
    if (nowActivities.length) {
      nowActivities.forEach((activity, index) => items.push({ key: `now:${activity.id}`, type: "activity", activity, index }));
    } else {
      items.push({
        key: "now-empty",
        type: "empty",
        title: "A little quiet right now.",
        body: "Your next good memory can start with a small plan.",
      });
    }
    return items;
  }, [filteredFriends.length, friendsExpanded, nowActivities, shownFriends]);

  const upcomingItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      { key: "week-strip", type: "week" },
      ...(responsesCount > 0 ? [{ key: "responses", type: "responses" as const, count: responsesCount }] : []),
      { key: "area-controls", type: "area-controls", activeFilters: advancedFilterCount },
    ];
    const groups = new Map<string, { date: Date; activities: Activity[] }>();
    for (const activity of upcomingActivities) {
      const date = new Date(activity.starts_at);
      const key = localDayKey(date);
      const group = groups.get(key);
      if (group) group.activities.push(activity);
      else groups.set(key, { date, activities: [activity] });
    }
    if (!groups.size) {
      items.push({
        key: "upcoming-empty",
        type: "empty",
        title: "Nothing coming up yet.",
        body: "Try another area or make a plan of your own.",
      });
      return items;
    }
    for (const [dateKey, group] of groups) {
      items.push({ key: `day:${dateKey}`, type: "day", date: group.date, dateKey });
      group.activities.forEach((activity, index) =>
        items.push({ key: `upcoming:${activity.id}`, type: "activity", activity, index }),
      );
    }
    return items;
  }, [advancedFilterCount, upcomingActivities, responsesCount]);

  const pastItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [{ key: "toolkit", type: "toolkit" }];
    if (weeklyProgress.length) items.push({ key: "weekly-progress", type: "weekly", items: weeklyProgress });
    if (!pastHistoryRows.length) {
      items.push({ key: "past-empty", type: "past-empty" });
      return items;
    }
    let previousMonth = "";
    for (const row of pastHistoryRows) {
      const month = getPastMonthKey(row.date);
      if (month !== previousMonth) {
        items.push({ key: `month:${month}`, type: "month", date: row.date });
        previousMonth = month;
      }
      items.push({ key: `history:${row.id}`, type: "history", row });
    }
    return items;
  }, [pastHistoryRows, weeklyProgress]);

  const loadingItems = useMemo<FeedItem[]>(() =>
    Array.from({ length: 6 }, (_, index) => ({ key: `loading:${index}`, type: "skeleton", index })),
  []);

  const itemsForPage = (currentPage: FeedPage) =>
    loading && data.activities.length === 0
      ? loadingItems
      : currentPage === "Now"
        ? nowItems
        : currentPage === "Upcoming"
          ? upcomingItems
          : pastItems;

  const goToActivity = useCallback((id: string) => {
    router.push({ pathname: "/activity/[id]", params: { id } });
  }, []);
  const goToMap = useCallback((id: string) => {
    router.push({ pathname: "/(tabs)", params: { beacon: id } });
  }, []);
  const goFindFriends = useCallback(() => router.push("/find-friends"), []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRequestError("");
    try {
      await refresh();
    } catch (failure) {
      setRequestError(failure instanceof Error ? failure.message : "Could not refresh Beacons.");
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const createStatus = useCallback(async (value: FeedStatusSave) => {
    if (!userId || data.viewer_id !== userId) throw new Error("Refresh your profile before sharing a status.");
    const startsAt = new Date().toISOString();
    const audience = ownStatusActivity?.audience ?? "friends";
    const audienceId = ownStatusActivity?.audience_id ?? null;
    const payload = {
      title: value.title.trim(),
      description: "",
      available: value.available,
      category: ownStatusActivity?.category ?? "Social",
      mode: "solo",
      starts_at: startsAt,
      ends_at: value.endsAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      audience,
      audience_id: audienceId,
      target_count: null,
      approval_required: false,
      aspiration_ids: [],
      label: "",
      online_url: null,
      latitude: null,
      longitude: null,
    };
    if (!payload.title) throw new Error("Add a short status note.");
    if (Date.parse(payload.ends_at) <= Date.parse(payload.starts_at)) throw new Error("Choose an end time in the future.");
    const result = await act("create_activity", payload);
    return typeof result.id === "string" ? result.id : null;
  }, [act, data.viewer_id, ownStatusActivity, userId]);

  const saveStatus = useCallback(async (value: FeedStatusSave) => {
    setStatusSaving(true);
    setStatusError("");
    try {
      if (!ownStatusActivity) {
        await createStatus(value);
      } else if (ownStatusActivity.available === value.available) {
        await act("edit_activity", {
          id: ownStatusActivity.id,
          title: value.title.trim(),
          starts_at: ownStatusActivity.starts_at,
          ends_at: value.endsAt,
        });
      } else {
        const createdId = await createStatus(value);
        try {
          await act("activity_status", { id: ownStatusActivity.id, status: "cancelled" });
        } catch {
          setRequestError("Your new status is live, but the previous status could not be cleared.");
        }
        if (!createdId) setRequestError("Your status was saved. Refresh to verify its current state.");
      }
      setAcknowledgedStatusTime(Date.now());
      setStatusEditorOpen(false);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Could not save your status.";
      setStatusError(message);
      throw failure;
    } finally {
      setStatusSaving(false);
    }
  }, [act, createStatus, ownStatusActivity]);

  const clearStatus = useCallback(async () => {
    if (!ownStatusActivity) return;
    setStatusSaving(true);
    setStatusError("");
    try {
      await act("activity_status", { id: ownStatusActivity.id, status: "cancelled" });
      setAcknowledgedStatusTime(Date.now());
      setStatusEditorOpen(false);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Could not clear your status.";
      setStatusError(message);
      throw failure;
    } finally {
      setStatusSaving(false);
    }
  }, [act, ownStatusActivity]);

  const shareActivity = useCallback(async (activity: Activity) => {
    const url = ExpoLinking.createURL(`/activity/${activity.id}`);
    const message = `${activity.title} · ${activityWhen(activity, new Date(now))}\n${url}`;
    await Share.share({ title: activity.title, message, url });
  }, [now]);

  const toggleFriendStar = useCallback(async (friendId: string) => {
    if (!userId || data.viewer_id !== userId) return;
    const current = data.favorites.some((entry) =>
      entry.owner_id === userId && entry.kind === "friend" && entry.target_id === friendId,
    );
    try {
      await act("favorite", { id: friendId, kind: "friend", add: !current });
    } catch (failure) {
      setRequestError(failure instanceof Error ? failure.message : "Could not update that favorite.");
    }
  }, [act, data.favorites, data.viewer_id, userId]);

  const report = useCallback(async () => {
    if (!reportActivityId || !reportReason.trim()) return;
    setReportBusy(true);
    setRequestError("");
    try {
      await act("report", { id: reportActivityId, reason: reportReason.trim() });
      setReportActivityId(null);
      setReportReason("");
    } catch (failure) {
      setRequestError(failure instanceof Error ? failure.message : "Could not submit that report.");
    } finally {
      setReportBusy(false);
    }
  }, [act, reportActivityId, reportReason]);

  const respond = useCallback(async (activity: Activity, status: "going" | "interested" | "withdraw") => {
    if (!userId || data.viewer_id !== userId || !canReadBeaconActivity(data, activity, userId)) {
      throw new Error("This Beacon is no longer available to you.");
    }
    if (activity.mode === "solo" || activity.owner_id === userId) throw new Error("This Beacon does not accept your RSVP.");
    await act("rsvp", { id: activity.id, status });
  }, [act, data, userId]);

  const handleRsvpSheet = useCallback(async (status: "going" | "interested" | "withdraw") => {
    const activity = data.activities.find((item) => item.id === rsvpActivityId);
    if (!activity) return;
    setRsvpBusy(true);
    setRequestError("");
    try {
      await respond(activity, status);
      if (status === "going") void uiHaptics.success();
      setRsvpActivityId(null);
    } catch (failure) {
      setRequestError(failure instanceof Error ? failure.message : "Could not update your response.");
    } finally {
      setRsvpBusy(false);
    }
  }, [data.activities, respond, rsvpActivityId]);

  const findActivityPlace = useCallback((activity: Activity) => {
    if (!userId || data.viewer_id !== userId || !canViewBeaconMeetingDetails(data, activity.id, userId)) return undefined;
    return data.places.find((place) => place.activity_id === activity.id);
  }, [data, userId]);

  const buildCardProps = useCallback((activity: Activity): BeaconFeedCardProps => {
    const hostCandidate = data.profiles.find((profile) => profile.id === activity.owner_id);
    const hostProfile = userId && data.viewer_id === userId && hostCandidate && canViewProfile(data, hostCandidate, userId)
      ? hostCandidate
      : undefined;
    const place = findActivityPlace(activity);
    const rsvp = data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === userId);
    const acceptedCount = beaconSeatCount(data, activity);
    const capacity = beaconCapacity(data, activity);
    const liveOrUpcoming = activity.status === "scheduled" && Date.parse(activity.ends_at) > now;
    const hasHostOrCanRead = !!userId && data.viewer_id === userId;
    const safeAvatars = showAvatars && hasHostOrCanRead
      ? crew(data, activity)
          .filter(({ person, status }) =>
            (status === "Going" || status === "Hosting") &&
            canViewProfile(data, person, userId!),
          )
          .filter(({ person }) =>
            person.id === activity.owner_id ||
            isApprovedGoing(activity, data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === person.id)),
          )
          .slice(0, 4)
          .map(({ person }) => ({ id: person.id, name: person.name }))
      : [];
    const canOpenChat = !!userId && activity.enable_chat !== false && canUseBeaconModules(data, activity, userId);
    const friendHost = !!userId && friendIds(data, userId).includes(activity.owner_id);
    const saved = data.beacon_favorites.some((favorite) => favorite.owner_id === userId && favorite.activity_id === activity.id);
    const canMap = !!place && place.online_url == null;
    const location = place
      ? place.online_url
        ? { label: "Online", kind: "online" as const }
        : { label: place.label || "Place to be decided", kind: "physical" as const }
      : null;
    return {
      activityId: activity.id,
      title: activity.title,
      category: activity.category,
      startsAt: activity.starts_at,
      endsAt: activity.ends_at,
      activityStatus: activity.status,
      activityMode: activity.mode,
      whenLabel: activityWhen(activity, new Date(now)),
      hostName: hostProfile?.name ?? (activity.owner_id === userId ? "You" : "Beacon host"),
      hostAvatarUri: null,
      location,
      goingAvatars: safeAvatars,
      goingCount: acceptedCount,
      target: activity.target_count ?? null,
      capacityRemaining: activity.capacity_limit == null ? null : Math.max(0, activity.capacity_limit - acceptedCount),
      rsvpStatus: rsvp?.status ?? null,
      approved: isApprovedGoing(activity, rsvp),
      approvalRequired: activity.approval_required || activity.mode === "invite",
      isHost: activity.owner_id === userId,
      isFull: capacity.full,
      isClosed: capacity.closed || !liveOrUpcoming,
      isPast: !liveOrUpcoming,
      saved,
      onOpen: () => goToActivity(activity.id),
      onRSVP: (status) => respond(activity, status),
      onChangeRSVP: rsvp?.status === "going" || rsvp?.status === "requested"
        ? () => { setRequestError(""); setRsvpActivityId(activity.id); }
        : undefined,
      onMap: canMap ? () => goToMap(activity.id) : undefined,
      onChat: canOpenChat
        ? () => router.push({ pathname: "/activity/[id]", params: { id: activity.id, tab: "chat" } })
        : friendHost
          ? () => router.push({ pathname: "/messages/[id]", params: { id: activity.owner_id } })
          : undefined,
      onSave: () => act("save_beacon", { activity_id: activity.id, saved: !saved }).then(() => undefined),
      onShare: () => shareActivity(activity),
      onReport: () => { setRequestError(""); setReportActivityId(activity.id); setReportReason(""); },
      onCardSwipeStateChange: setCardGestureActive,
    };
  }, [act, data, findActivityPlace, goToActivity, goToMap, now, respond, setCardGestureActive, shareActivity, showAvatars, userId]);

  const flushUpcomingDate = useCallback(() => {
    const pendingDate = pendingUpcomingDate.current;
    const list = listRefs.current.Upcoming;
    if (!pendingDate || !list) return;
    const index = upcomingItems.findIndex((item) => item.type === "day" && item.dateKey === pendingDate);
    if (index < 0) {
      pendingUpcomingDate.current = null;
      return;
    }
    const revisionAtRequest = upcomingLayoutRevision.current;
    try {
      void list.scrollToIndex({ index, animated: !reducedMotion, viewPosition: 0 }).then(() => {
        if (pendingUpcomingDate.current === pendingDate) pendingUpcomingDate.current = null;
      }).catch((failure: unknown) => {
        if (isLayoutNotReady(failure)) {
          if (upcomingLayoutRevision.current !== revisionAtRequest && pendingUpcomingDate.current) {
            requestAnimationFrame(() => flushUpcomingDateRef.current());
          }
          return;
        }
        setRequestError(failure instanceof Error ? failure.message : "Could not jump to that date.");
      });
    } catch (failure) {
      if (!isLayoutNotReady(failure)) setRequestError(failure instanceof Error ? failure.message : "Could not jump to that date.");
    }
  }, [reducedMotion, upcomingItems]);
  useEffect(() => { flushUpcomingDateRef.current = flushUpcomingDate; }, [flushUpcomingDate]);
  useEffect(() => {
    if (pendingUpcomingDate.current) requestAnimationFrame(() => flushUpcomingDateRef.current());
  }, [upcomingItems]);
  const scrollToUpcomingDate = useCallback((dateKey: string) => {
    pendingUpcomingDate.current = dateKey;
    requestAnimationFrame(() => flushUpcomingDateRef.current());
  }, []);

  const renderItem = (item: FeedItem, index: number) => {
    const entering = reducedMotion ? undefined : FadeInDown.delay(Math.min(index * 35, 245)).duration(220);
    switch (item.type) {
      case "status":
        return (
          <StatusPanel
            profile={ownProfile}
            status={ownStatusActivity ? {
              id: ownStatusActivity.id,
              title: ownStatusActivity.title,
              available: ownStatusActivity.available === true,
              startsAt: ownStatusActivity.starts_at,
              endsAt: ownStatusActivity.ends_at,
            } : null}
            editorVisible={statusEditorOpen}
            saving={statusSaving}
            error={statusError}
            onCreate={() => { setStatusError(""); setStatusEditorOpen(true); }}
            onEdit={() => { setStatusError(""); setStatusEditorOpen(true); }}
            onCloseEditor={() => setStatusEditorOpen(false)}
            onSave={saveStatus}
            onClear={clearStatus}
            onConvert={() => ownStatusActivity && router.push({ pathname: "/create", params: { kind: "beacon", repeat: ownStatusActivity.id } })}
          />
        );
      case "friends-header":
        return <FriendsNowHeader count={friends.length} filter={friendFilter} onFilterChange={setFriendFilter} />;
      case "friend":
        return (
          <FriendNowRow
            friend={item.friend}
            onProfile={(id) => router.push({ pathname: "/person/[id]", params: { id } })}
            onMessage={(id) => router.push({ pathname: "/messages/[id]", params: { id } })}
            onToggleStar={(id) => { void toggleFriendStar(id); }}
            onOpenBeacon={goToActivity}
          />
        );
      case "friends-expand":
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: item.expanded }}
            accessibilityLabel={item.expanded ? "Show fewer friends" : "Show more friends"}
            onPress={() => setFriendsExpanded((value) => !value)}
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: designColors.accent, ...tokens.type.secondary, fontWeight: "700" }}>
              {item.expanded ? "Show less" : `See all ${filteredFriends.length} friends`}
            </Text>
          </Pressable>
        );
      case "friends-find":
        return <Button title="Find friends" secondary onPress={goFindFriends} />;
      case "section":
        return (
          <View style={{ minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[styles.h2, { ...tokens.type.titleSmall }]}>{item.title}</Text>
            <View style={{ flexDirection: "row" }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Search Beacons" onPress={() => setBasicFiltersOpen(true)} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
                <Search size={18} color={designColors.textSecondary} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Filter Beacons" onPress={() => setFiltersOpen(true)} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
                <SlidersHorizontal size={18} color={designColors.textSecondary} />
              </Pressable>
            </View>
          </View>
        );
      case "activity":
        return (
          <Animated.View entering={entering}>
            <BeaconFeedCard key={item.activity.id} {...buildCardProps(item.activity)} />
          </Animated.View>
        );
      case "week": {
        const start = firstDayOfWeek(now);
        const eventCounts = new Map<string, number>();
        for (const activity of upcomingActivities) {
          const key = localDayKey(activity.starts_at);
          eventCounts.set(key, (eventCounts.get(key) ?? 0) + 1);
        }
        return (
          <View style={{ gap: tokens.space.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space.xs }}>
              <CalendarDays size={17} color={designColors.accent} />
              <Text style={{ color: designColors.textPrimary, ...tokens.type.titleSmall }}>This week</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space.xs }}>
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const day = new Date(start.getTime() + dayIndex * DAY_MS);
                const key = localDayKey(day);
                const count = eventCounts.get(key) ?? 0;
                const selected = key === localDayKey(new Date(now));
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${dayTitle(day)}${count ? `, ${count} Beacons` : ", no Beacons"}`}
                    onPress={() => scrollToUpcomingDate(key)}
                    style={{ width: 46, minHeight: 66, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: tokens.radius.card, borderWidth: 1, borderColor: selected ? designColors.accent : designColors.border, backgroundColor: selected ? designColors.surfaceRaised : designColors.surface }}
                  >
                    <Text style={{ color: designColors.textSecondary, ...tokens.type.caption }}>{day.toLocaleDateString([], { weekday: "short" })}</Text>
                    <Text style={{ color: designColors.textPrimary, ...tokens.type.secondary, fontWeight: "700" }}>{day.getDate()}</Text>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: count ? designColors.accent : "transparent" }} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      }
      case "responses":
        return (
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.count} pending planning responses and invitations`} onPress={() => setResponsesOpen(true)} style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: tokens.space.sm, paddingHorizontal: tokens.space.md, borderRadius: tokens.radius.card, backgroundColor: designColors.surfaceRaised }}>
            <CalendarDays size={18} color={designColors.accent} />
            <Text style={{ flex: 1, color: designColors.textPrimary, ...tokens.type.secondary, fontWeight: "700" }}>{item.count} responses & invitations need you</Text>
            <Text style={{ color: designColors.accent, ...tokens.type.caption, fontWeight: "700" }}>Review</Text>
          </Pressable>
        );
      case "area-controls":
        return (
          <View style={{ flexDirection: "row", gap: tokens.space.xs }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Explore area: ${exploration.area?.label ?? "Everywhere"}`} onPress={() => setAreaOpen(true)} style={{ flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", gap: tokens.space.xs, paddingHorizontal: tokens.space.sm, borderRadius: tokens.radius.button, borderWidth: 1, borderColor: designColors.border, backgroundColor: designColors.surface }}>
              <Compass size={17} color={designColors.accent} />
              <Text numberOfLines={1} style={{ flex: 1, color: designColors.textPrimary, ...tokens.type.caption }}>{exploration.area?.label ?? "Everywhere"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Search Beacons" onPress={() => setBasicFiltersOpen(true)} style={{ width: 46, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: tokens.radius.button, borderWidth: 1, borderColor: designColors.border, backgroundColor: designColors.surface }}>
              <Search size={17} color={designColors.textSecondary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Advanced filters${item.activeFilters ? `, ${item.activeFilters} active` : ""}`} accessibilityState={{ selected: item.activeFilters > 0 }} onPress={() => setFiltersOpen(true)} style={{ minWidth: 80, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: tokens.space.xs, paddingHorizontal: tokens.space.xs, borderRadius: tokens.radius.button, borderWidth: 1, borderColor: item.activeFilters ? designColors.accent : designColors.border, backgroundColor: designColors.surface }}>
              <SlidersHorizontal size={16} color={item.activeFilters ? designColors.accent : designColors.textSecondary} />
              <Text style={{ color: designColors.textPrimary, ...tokens.type.caption, fontWeight: "700" }}>Filter{item.activeFilters ? ` · ${item.activeFilters}` : ""}</Text>
            </Pressable>
          </View>
        );
      case "day":
        return (
          <View style={{ backgroundColor: designColors.bg, paddingVertical: tokens.space.xs }}>
            <Text accessibilityRole="header" style={{ color: designColors.textPrimary, ...tokens.type.titleSmall }}>{dayTitle(item.date)}</Text>
          </View>
        );
      case "toolkit":
        return (
          <PastToolkit
            counts={toolkitCounts}
            onPlans={() => router.push("/plans")}
            onFavorites={() => setFavoritesOpen(true)}
            onTemplates={() => setTemplatesOpen(true)}
            onLibrary={() => router.push("/library")}
          />
        );
      case "weekly":
        return <PastWeeklyProgressView items={item.items} />;
      case "month":
        return (
          <View style={{ backgroundColor: designColors.bg, paddingVertical: tokens.space.xs }}>
            <PastMonthHeader date={item.date} />
          </View>
        );
      case "history":
        return <PastHistoryRow row={item.row} onPress={() => goToActivity(item.row.id)} />;
      case "past-empty":
        return <PastHistoryEmpty onCreate={() => router.push("/create")} />;
      case "empty":
        return (
          <View style={{ gap: tokens.space.sm }}>
            <View style={{ padding: tokens.space.lg, alignItems: "center", gap: tokens.space.xs }}>
              <MapPin size={25} color={designColors.textSecondary} />
              <Text style={{ color: designColors.textPrimary, ...tokens.type.titleSmall }}>{item.title}</Text>
              <Text style={{ color: designColors.textSecondary, ...tokens.type.secondary, textAlign: "center" }}>{item.body}</Text>
            </View>
            <Button title="Create a Beacon" onPress={() => router.push("/create")} />
          </View>
        );
      case "skeleton":
        return (
          <View style={{ gap: tokens.space.sm, paddingVertical: tokens.space.xs }}>
            <Skeleton height={18} width="42%" />
            <Skeleton height={item.index === 0 ? 130 : 96} borderRadius={tokens.radius.card} />
          </View>
        );
      case "error":
        return (
          <View accessibilityRole="alert" style={{ gap: tokens.space.xs, padding: tokens.space.md, borderWidth: 1, borderColor: designColors.danger, borderRadius: tokens.radius.card, backgroundColor: designColors.surface }}>
            <Text style={{ color: designColors.danger, ...tokens.type.secondary }}>{item.message}</Text>
            <Button title="Try again" secondary onPress={() => void handleRefresh()} />
          </View>
        );
      default:
        return null;
    }
  };

  const visibleError = requestError || storeError;
  const makeItems = (currentPage: FeedPage) => {
    const base = itemsForPage(currentPage);
    return visibleError
      ? [{ key: "feed-error", type: "error", message: visibleError } as FeedItem, ...base]
      : base;
  };
  const renderPage = (currentPage: FeedPage) => {
    const pageItems = makeItems(currentPage);
    const stickyHeaderIndices = pageItems.flatMap((item, index) =>
      item.type === "day" || item.type === "month" ? [index] : [],
    );
    return (
      <FlashList<FeedItem>
        ref={(instance) => { listRefs.current[currentPage] = instance ?? undefined; }}
        data={pageItems}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.type}
        renderItem={({ item, index }) => renderItem(item, index)}
        stickyHeaderIndices={stickyHeaderIndices}
        onLoad={() => {
          if (currentPage !== "Upcoming") return;
          upcomingLayoutRevision.current += 1;
          flushUpcomingDateRef.current();
        }}
        onCommitLayoutEffect={() => {
          if (currentPage !== "Upcoming") return;
          upcomingLayoutRevision.current += 1;
          flushUpcomingDateRef.current();
        }}
        onScroll={(event) => {
          const offset = event.nativeEvent.contentOffset.y;
          scrollOffsets[currentPage] = offset;
          if (page === currentPage) scrollY.setValue(offset);
        }}
        scrollEventThrottle={16}
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: PAGE_GUTTER,
          paddingTop: tokens.space.sm,
          paddingBottom: tokens.layout.tabBarHeight + insets.bottom + tokens.layout.scrollClearance,
        }}
        style={{ flex: 1, minHeight: 0 }}
      />
    );
  };

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 110],
    outputRange: [demo ? 128 : 100, 58],
    extrapolate: "clamp",
  });
  const titleSize = scrollY.interpolate({
    inputRange: [0, 110],
    outputRange: [36, 24],
    extrapolate: "clamp",
  });
  const demoOpacity = scrollY.interpolate({
    inputRange: [0, 40, 95],
    outputRange: [1, 0.35, 0],
    extrapolate: "clamp",
  });

  const selectedRsvpActivity = data.activities.find((activity) => activity.id === rsvpActivityId);
  const selectedRsvp = selectedRsvpActivity && data.rsvps.find((row) => row.activity_id === selectedRsvpActivity.id && row.user_id === userId);
  const savedFriendFavorites = data.favorites.filter((entry) => entry.owner_id === userId && entry.kind === "friend");
  const savedSquadFavorites = data.favorites.filter((entry) => entry.owner_id === userId && entry.kind === "squad");

  return (
    <View style={{ flex: 1, backgroundColor: designColors.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: designColors.bg }}>
        <GlassBar style={{ borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: designColors.border }}>
          <RNAnimated.View style={{ height: headerHeight, overflow: "hidden", justifyContent: "flex-end", paddingHorizontal: tokens.layout.screenGutter, paddingBottom: tokens.space.sm }}>
            {demo ? (
              <RNAnimated.View style={{ position: "absolute", left: tokens.layout.screenGutter, top: tokens.space.xs, opacity: demoOpacity }}>
                <DemoChip />
              </RNAnimated.View>
            ) : null}
            <View style={{ minHeight: tokens.layout.minTapTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space.sm }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: designColors.textSecondary, ...tokens.type.caption, fontWeight: "700", letterSpacing: 0.6 }}>MAKE TIME TOGETHER</Text>
                <RNAnimated.Text accessibilityRole="header" style={{ color: designColors.textPrimary, fontSize: titleSize, lineHeight: 42, fontWeight: "800" }}>Beacons</RNAnimated.Text>
              </View>
              <InboxButton />
            </View>
          </RNAnimated.View>
        </GlassBar>
      </View>
      <View style={{ paddingHorizontal: tokens.layout.screenGutter, paddingTop: tokens.space.xs, paddingBottom: tokens.space.xs, backgroundColor: designColors.bg }}>
        <PeriodTabs
          value={page}
          onChange={setActivePage}
          nowCount={nowActivities.length}
          upcomingCount={upcomingActivities.length}
        />
      </View>
      <FeedPager page={page} onPageSelected={setActivePage} pageSwipeEnabled={pageSwipeEnabled} reducedMotion={reducedMotion}>
        {[renderPage("Now"), renderPage("Upcoming"), renderPage("Past")]}
      </FeedPager>

      <AdvancedMapFilters
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={exploration.filters}
        onChange={(nextFilters) => {
          exploration.setFilters(nextFilters);
          setSelectedCategories(nextFilters.category === "All categories" ? [] : [nextFilters.category]);
        }}
        audiences={mapAudiences}
        planOptions={planOptions}
        resultCount={upcomingActivities.length}
        selectedCategories={activeCategories}
        onCategoriesChange={(nextCategories) => {
          setSelectedCategories(nextCategories);
          if (exploration.filters.category !== "All categories") {
            exploration.setFilters({ ...exploration.filters, category: "All categories" });
          }
        }}
      />

      <Sheet title="Search and sort Beacons" visible={basicFiltersOpen} onClose={() => setBasicFiltersOpen(false)}>
        <Field label="Search" value={exploration.query} onChangeText={exploration.setQuery} placeholder="Activity, friend, or place" />
        <View style={{ gap: tokens.space.xs }}>
          <Text style={styles.label}>Participation</Text>
          <Chips options={["Everyone", "I'm going"]} value={joined ? "I'm going" : "Everyone"} onChange={(value) => setJoined(value === "I'm going")} showSelectedCheckmark={false} />
        </View>
        <View style={{ gap: tokens.space.xs }}>
          <Text style={styles.label}>Sort</Text>
          <Chips options={["Soonest", "Most momentum", "Latest first", "A to Z"] as const} value={sort} onChange={setSort} showSelectedCheckmark={false} />
        </View>
        <Txt muted>{"Friends' availability is separate from Beacon attendance."}</Txt>
        <Button title="Reset filters" secondary onPress={() => {
          exploration.setQuery("");
          exploration.setFilters(emptyFilters(exploration.filters));
          setSelectedCategories([]);
          setJoined(false);
          setSort("Soonest");
        }} />
        <Button title="Done" onPress={() => setBasicFiltersOpen(false)} />
      </Sheet>

      <Sheet title="Explore an area" visible={areaOpen} onClose={() => setAreaOpen(false)}>
        <Text style={{ color: designColors.textSecondary, ...tokens.type.secondary }}>This uses the same area shown on Map.</Text>
        <View style={{ minHeight: 50, flexDirection: "row", alignItems: "center", gap: tokens.space.sm, padding: tokens.space.sm, borderRadius: tokens.radius.card, backgroundColor: designColors.surfaceRaised }}>
          <MapPin size={18} color={designColors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: designColors.textPrimary, ...tokens.type.secondary, fontWeight: "700" }}>Current area</Text>
            <Text style={{ color: designColors.textSecondary, ...tokens.type.caption }}>{exploration.area?.label ?? "Everywhere"}</Text>
          </View>
        </View>
        <Button title="Choose an area on Map" onPress={() => {
          setAreaOpen(false);
          router.push({ pathname: "/(tabs)", params: { search: "yes" } });
        }} />
        {exploration.area ? <Button title="Explore everywhere" secondary onPress={() => { exploration.setArea(null); setAreaOpen(false); }} /> : null}
        <Button title="Done" secondary onPress={() => setAreaOpen(false)} />
      </Sheet>

      <ResponsesSheet visible={responsesOpen} onClose={() => setResponsesOpen(false)}
        pings={responseCards.filter((item) => item.kind === "ping")}
        votes={responseCards.filter((item) => item.kind === "vote")}
        draws={responseCards.filter((item) => item.kind === "draw")}
        invitations={invitations}
        onCreate={() => { setResponsesOpen(false); router.push("/councils"); }} />

      <Sheet title="Your favorites" visible={favoritesOpen} onClose={() => setFavoritesOpen(false)}>
        <Txt muted>Favorites are private and never change who can see your Beacons.</Txt>
        <Text style={styles.h2}>Friends</Text>
        {savedFriendFavorites.map((favorite) => {
          const profile = data.profiles.find((person) => person.id === favorite.target_id);
          const canRead = !!userId && !!profile && canViewProfile(data, profile, userId);
          return (
            <Button key={favorite.target_id} secondary title={`${canRead ? profile!.name : "Friend"} · Remove favorite`} onPress={async () => {
              try { await act("favorite", { id: favorite.target_id, kind: "friend", add: false }); }
              catch (failure) { setRequestError(failure instanceof Error ? failure.message : "Could not update favorites."); }
            }} />
          );
        })}
        <Text style={styles.h2}>Squads</Text>
        {savedSquadFavorites.map((favorite) => {
          const squad = data.squads.find((item) => item.id === favorite.target_id);
          const visible = !!userId && !!squad && canOpenSquadProfile(data, squad.id, userId);
          return visible ? <Button key={favorite.target_id} secondary title={`${squad!.name} · Remove favorite`} onPress={async () => {
            try { await act("favorite", { id: favorite.target_id, kind: "squad", add: false }); }
            catch (failure) { setRequestError(failure instanceof Error ? failure.message : "Could not update favorites."); }
          }} /> : null;
        })}
        <Text style={styles.h2}>Saved Beacons</Text>
        {!savedBeacons.length ? <Txt muted>Save a Beacon from its card to keep it easy to find.</Txt> : null}
        {savedBeacons.map((favorite) => {
          const activity = data.activities.find((item) => item.id === favorite.activity_id);
          if (!activity || !userId || !canReadBeaconActivity(data, activity, userId)) return null;
          return (
            <View key={favorite.activity_id} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space.xs }}>
              <Pressable onPress={() => { setFavoritesOpen(false); goToActivity(activity.id); }} style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>
                <Text numberOfLines={1} style={{ color: designColors.textPrimary, ...tokens.type.secondary }}>{activity.title}</Text>
              </Pressable>
              <Button compact secondary title="Remove" onPress={async () => {
                try { await act("save_beacon", { activity_id: activity.id, saved: false }); }
                catch (failure) { setRequestError(failure instanceof Error ? failure.message : "Could not update favorites."); }
              }} />
            </View>
          );
        })}
        <Button title="Done" onPress={() => setFavoritesOpen(false)} />
      </Sheet>

      <Sheet title="My templates" visible={templatesOpen} onClose={() => setTemplatesOpen(false)}>
        <Button title="New template" onPress={() => { setTemplatesOpen(false); router.push({ pathname: "/create", params: { editTemplate: "yes" } }); }} />
        {!ownTemplates.length ? <Txt muted>Save your usual coffee, study session, or game. Next time, the details are ready.</Txt> : null}
        {ownTemplates.map((template) => (
          <View key={template.id} style={{ gap: tokens.space.xs, padding: tokens.space.md, borderWidth: 1, borderColor: designColors.border, borderRadius: tokens.radius.card }}>
            <Text style={{ color: designColors.textPrimary, ...tokens.type.titleSmall }}>{template.name}</Text>
            <Txt muted>{template.title} · {template.minutes} min</Txt>
            <Button title={`Use ${template.name}`} onPress={() => { setTemplatesOpen(false); router.push({ pathname: "/create", params: { template: template.id } }); }} />
            <Button title={`Edit ${template.name}`} secondary onPress={() => { setTemplatesOpen(false); router.push({ pathname: "/create", params: { template: template.id, editTemplate: "yes" } }); }} />
            <Button title={`Delete ${template.name}`} secondary onPress={async () => {
              try { await act("delete_template", { id: template.id }); }
              catch (failure) { setRequestError(failure instanceof Error ? failure.message : "Could not delete that template."); }
            }} />
          </View>
        ))}
        <Button title="Done" onPress={() => setTemplatesOpen(false)} />
      </Sheet>

      <Sheet title="Your response" visible={!!rsvpActivityId} onClose={() => setRsvpActivityId(null)}>
        {selectedRsvpActivity ? <Text style={{ color: designColors.textSecondary, ...tokens.type.secondary }}>{selectedRsvpActivity.title}</Text> : null}
        {requestError ? <Text accessibilityRole="alert" style={{ color: designColors.danger, ...tokens.type.caption }}>{requestError}</Text> : null}
        <Button title={selectedRsvpActivity?.approval_required ? "Request to join" : "I'm In"} disabled={rsvpBusy || !!selectedRsvpActivity && beaconCapacity(data, selectedRsvpActivity).full && selectedRsvp?.status !== "going"} onPress={() => selectedRsvpActivity && void handleRsvpSheet("going")} />
        <Button title="Maybe" secondary disabled={rsvpBusy} onPress={() => selectedRsvpActivity && void handleRsvpSheet("interested")} />
        {selectedRsvp ? <Button title="I'm Out" secondary disabled={rsvpBusy} onPress={() => void handleRsvpSheet("withdraw")} /> : null}
      </Sheet>

      <Sheet title="Report Beacon" visible={!!reportActivityId} onClose={() => { if (!reportBusy) { setReportActivityId(null); setReportReason(""); } }}>
        <Text style={{ color: designColors.textSecondary, ...tokens.type.secondary }}>Tell us why this Beacon should be reviewed. It will not be reported until you submit.</Text>
        <Field label="Reason" value={reportReason} onChangeText={setReportReason} placeholder="Describe the concern" multiline />
        {requestError ? <Text accessibilityRole="alert" style={{ color: designColors.danger, ...tokens.type.caption }}>{requestError}</Text> : null}
        <Button title={reportBusy ? "Sending report…" : "Submit report"} disabled={reportBusy || !reportReason.trim()} onPress={() => void report()} />
        <Button title="Cancel" secondary disabled={reportBusy} onPress={() => { setReportActivityId(null); setReportReason(""); }} />
      </Sheet>
    </View>
  );
}
