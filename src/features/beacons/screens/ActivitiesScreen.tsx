import { StatusReactionPicker } from "../components/feed/StatusReactionPicker";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarDays } from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { usePreferences } from "@/src/shared/preferences";
import { useExploration, matchesExplorationArea } from "@/src/shared/exploration";
import { activityWhen, friendIds } from "@/src/shared/domain";
import { browseBeacons, crew } from "@/src/shared/browsing";
import { canReadBeaconActivity, canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { canViewBeaconMeetingDetails, selectFreshVisiblePersonLocation, selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { matchesBeaconFilters } from "@/src/features/maps/filtering";
import { matchesSelectedCategories } from "@/src/features/maps/mapUIselectors";
import { beaconCapacity, beaconSeatCount, isApprovedGoing } from "@/src/features/beacons/permissions";
import { BeaconFeedCard, type BeaconFeedCardProps } from "@/src/features/beacons/components/BeaconFeedCard";
import { SharedStatusControl } from "@/src/features/beacons/components/feed/SharedStatusControl";
import { type SafeFriendNowRow } from "@/src/features/beacons/components/feed/FriendsNow";
import { GlassBar, Skeleton, useDesignTheme } from "@/src/shared/design-system";
import { Button, Field, InboxButton, Sheet, Txt, uiHaptics, useTheme } from "@/src/shared/ui";
import { usePlanningResponses } from "@/src/features/people/usePlanningResponses";
import { ResponsesSheet } from "@/src/features/people/components/ResponsesSheet";
import { confirmedHubActivities, hubInviteeParams, hubToolShortcuts, isHubActivityStarted, nearestHubActivity, toggleHubFriend } from "@/src/features/beacons/hubSelectors";
import { matchesSearch } from "@/src/shared/search";
import { HubFriendRow, HubFriendsFade } from "@/src/features/beacons/components/feed/HubFriends";
import { canReactToSoloActivity, visibleSoloActivity } from "@/src/features/maps/soloActivity";

const PAGE_GUTTER = 16;
const COLLAPSED_FRIENDS = 3;

export default function ActivitiesScreen() {
  const { styles } = useTheme();
  const { colors: designColors, tokens } = useDesignTheme();
  const { data, userId, act, loading, error: storeError, refresh } = useBeacon();
  const exploration = useExploration();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const params = useLocalSearchParams<{ filter?: string; participation?: string; confirmed?: string }>();
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState("");
  const [savedToolsOpen, setSavedToolsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [reportActivityId, setReportActivityId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [rsvpActivityId, setRsvpActivityId] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [selectionOwner, setSelectionOwner] = useState(userId);
  const { height: windowHeight } = useWindowDimensions();
  const { showAvatars } = usePreferences();

  if (selectionOwner !== userId) {
    setSelectionOwner(userId);
    setSelectedFriendIds([]);
    setSelectionError("");
    setFriendQuery("");
    setFriendPickerOpen(false);
  }

  useFocusEffect(
    useCallback(() => {
      if (params.filter === "Past") {
        router.replace({
          pathname: "/your-activity",
          params: { historyExpanded: "yes" },
        } as Href);
      } else if (params.confirmed === "yes" || params.participation === "confirmed") {
        router.replace("/your-activity" as Href);
      } else if (params.filter === "Now" || params.filter === "Upcoming") {
        router.replace({
          pathname: "/browse-beacons",
          params: { section: params.filter === "Now" ? "now" : "upcoming" },
        } as Href);
      }
    }, [params.confirmed, params.filter, params.participation]),
  );

  const confirmedActivities = useMemo(() => confirmedHubActivities(data, userId), [data, userId]);
  const featuredActivity = nearestHubActivity(confirmedActivities, now);

  const friends = useMemo<SafeFriendNowRow[]>(() => {
    if (!userId || data.viewer_id !== userId) return [];
    return friendIds(data, userId)
      .flatMap((personId) => {
        const preview = selectPersonPreview(data, personId, userId, now);
        if (!preview.canMessage) return [];
        const profile = preview.canViewFullProfile ? preview.profile : undefined;
        const activity = preview.beacon;
        const status = preview.canViewFullProfile ? visibleSoloActivity(data, personId, userId, now) : undefined;
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

  const personalPlans = data.plans.filter((plan) => plan.owner_id === userId && plan.squad_id === null);
  const ownTemplates = data.templates.filter((template) => template.owner_id === userId);
  const savedBeacons = data.beacon_favorites.filter((favorite) =>
    favorite.owner_id === userId && data.activities.some((activity) => activity.id === favorite.activity_id),
  );
  const toolkitCounts = {
    plans: personalPlans.length,
    favorites: data.favorites.filter((favorite) => favorite.owner_id === userId).length + savedBeacons.length,
    templates: ownTemplates.length,
    library:
      data.library_folder_items.filter((item) => item.owner_id === userId).length +
      data.library_saved_checklists.filter((item) => item.owner_id === userId).length,
  };
  const { cards: responseCards, invitations } = usePlanningResponses(now, () => setResponsesOpen(false));
  const responseCount = responseCards.length + invitations.length;

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

  const shareActivity = useCallback(async (activity: Activity) => {
    const url = ExpoLinking.createURL("/activity/" + activity.id);
    const message = activity.title + " · " + activityWhen(activity, new Date(now)) + "\n" + url;
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
            (status === "Going" || status === "Hosting") && canViewProfile(data, person, userId!),
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
    };
  }, [act, data, findActivityPlace, goToActivity, goToMap, now, respond, shareActivity, showAvatars, userId]);

  const browseData = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return data;
    const placeReadableIds = new Set(data.activities
      .filter((activity) => canViewBeaconMeetingDetails(data, activity.id, userId))
      .map((activity) => activity.id));
    return { ...data, places: data.places.filter((place) => placeReadableIds.has(place.activity_id)) };
  }, [data, userId]);

  const loadBrowseActivities = useCallback((period: "Active" | "Upcoming") => {
    if (!userId || data.viewer_id !== userId) return [] as Activity[];
    return browseBeacons(
      browseData,
      userId,
      { period, sort: "Soonest", query: exploration.query, category: "All categories", audience: exploration.filters.audience, joined: false },
      now,
    )
      .filter((activity) => activity.mode !== "solo")
      .filter((activity) => canReadBeaconActivity(data, activity, userId))
      .filter(isHubActivityStarted)
      .filter((activity) => matchesSelectedCategories(activity.category, exploration.filters.category === "All categories" ? [] : [exploration.filters.category]))
      .filter((activity) => {
        const place = canViewBeaconMeetingDetails(data, activity.id, userId)
          ? data.places.find((row) => row.activity_id === activity.id)
          : undefined;
        const coordinate = place?.online_url == null && place?.latitude != null && place.longitude != null
          ? { latitude: place.latitude, longitude: place.longitude }
          : null;
        return place?.online_url != null || matchesExplorationArea(exploration.area, coordinate);
      })
      .filter((activity) => period !== "Upcoming" || matchesBeaconFilters(browseData, activity, userId, exploration.filters, now, {
        includeBaseFilters: false,
        query: exploration.query,
      }));
  }, [browseData, data, exploration.area, exploration.filters, exploration.query, now, userId]);
  const nowActivities = useMemo(() => loadBrowseActivities("Active"), [loadBrowseActivities]);
  const upcomingActivities = useMemo(() => loadBrowseActivities("Upcoming"), [loadBrowseActivities]);
  const nowPreview = nowActivities.find((activity) => activity.id !== featuredActivity?.id);
  const upcomingPreview = upcomingActivities.find((activity) => activity.id !== featuredActivity?.id);
  const selectedRsvpActivity = data.activities.find((activity) => activity.id === rsvpActivityId);
  const selectedRsvp = selectedRsvpActivity && data.rsvps.find((row) => row.activity_id === selectedRsvpActivity.id && row.user_id === userId);
  const savedFriendFavorites = data.favorites.filter((entry) => entry.owner_id === userId && entry.kind === "friend");
  const savedSquadFavorites = data.favorites.filter((entry) => entry.owner_id === userId && entry.kind === "squad");

  const toggleSelection = (id: string) => {
    setSelectedFriendIds((current) => toggleHubFriend(current, id));
    setSelectionError("");
  };
  const planWithSelection = () => {
    if (!selectedFriendIds.length) { setFriendPickerOpen(true); return; }
    try {
      const inviteParams = hubInviteeParams(selectedFriendIds, friends.map((friend) => friend.id));
      setSelectionError("");
      setFriendPickerOpen(false);
      router.push({ pathname: "/create", params: inviteParams });
    } catch (failure) {
      setSelectionError(failure instanceof Error ? failure.message : "Review your selected friends.");
      setFriendPickerOpen(true);
    }
  };
  const planTitle = selectedFriendIds.length ? "Plan with " + selectedFriendIds.length + " Selected" : "Plan with Friends";
  const renderHubFriend = (friend: SafeFriendNowRow) => {
    const solo = visibleSoloActivity(data, friend.id, userId, now);
    const canReact = solo && canReactToSoloActivity(data, solo, userId, now);
    return <HubFriendRow
      key={friend.id}
      friend={friend}
      selected={selectedFriendIds.includes(friend.id)}
      onSelect={() => toggleSelection(friend.id)}
      onProfile={(id) => router.push({ pathname: "/person/[id]", params: { id } })}
      onMessage={(id) => router.push({ pathname: "/messages/[id]", params: { id } })}
      onToggleStar={(id) => { void toggleFriendStar(id); }}
      onOpenBeacon={goToActivity}
      reactionAction={canReact ? <StatusReactionPicker activityId={solo.id} compact /> : undefined}
    />;
  };
  const browse = (section?: "now" | "upcoming") => router.push(
    section
      ? { pathname: "/browse-beacons", params: { section } } as Href
      : "/browse-beacons" as Href,
  );
  const hubHeading = (title: string, link: string, onPress: () => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space.sm }}>
      <Text accessibilityRole="header" style={{ color: designColors.textPrimary, ...tokens.type.titleSmall }}>{title}</Text>
      <Button compact secondary title={link} onPress={onPress} />
    </View>
  );
  const visibleError = requestError || storeError;
  const featureTools = featuredActivity && userId && canUseBeaconModules(data, featuredActivity, userId)
    ? hubToolShortcuts(data, featuredActivity, userId).slice(0, 2)
    : [];
  const visibleFriends = friends.slice(0, COLLAPSED_FRIENDS);

  async function report() {
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
  }

  return (
    <View style={{ flex: 1, backgroundColor: designColors.bg }}>
      <View style={{ paddingTop: insets.top, backgroundColor: designColors.bg }}>
        <GlassBar style={{ borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: designColors.border }}>
          <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space.sm, paddingHorizontal: tokens.layout.screenGutter }}>
            <Text accessibilityRole="header" style={{ flex: 1, color: designColors.textPrimary, fontSize: 24, lineHeight: 30, fontWeight: "800" }}>Beacons</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open calendar" onPress={() => router.push("/calendar" as Href)}
              style={{ width: tokens.layout.minTapTarget, height: tokens.layout.minTapTarget, alignItems: "center", justifyContent: "center" }}>
              <CalendarDays size={22} color={designColors.textSecondary} />
            </Pressable>
            <InboxButton />
          </View>
        </GlassBar>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: PAGE_GUTTER, gap: tokens.space.md, paddingBottom: tokens.layout.tabBarHeight + insets.bottom + tokens.layout.scrollClearance }}
      >
        {visibleError ? (
          <View accessibilityRole="alert" style={{ gap: tokens.space.xs, padding: tokens.space.md, borderWidth: 1, borderColor: designColors.danger, borderRadius: tokens.radius.card, backgroundColor: designColors.surface }}>
            <Text style={{ color: designColors.danger, ...tokens.type.secondary }}>{visibleError}</Text>
            <Button title="Try again" secondary onPress={() => void handleRefresh()} />
          </View>
        ) : null}

        <SharedStatusControl compact />

        <View style={{ gap: tokens.space.sm }}>
          {hubHeading("Friends Right Now", "See all", () => setFriendPickerOpen(true))}
          {visibleFriends.map(renderHubFriend)}
          {!friends.length ? (
            <View style={{ paddingVertical: tokens.space.sm, gap: tokens.space.xs }}>
              <Txt muted>{loading ? "Loading friends…" : "Find your people to make plans together."}</Txt>
              <Button compact secondary title="Find friends" onPress={goFindFriends} />
            </View>
          ) : null}
          <HubFriendsFade />
          <Button title={planTitle} onPress={planWithSelection} />
          {selectedFriendIds.length ? <Button compact secondary title={"Review " + selectedFriendIds.length + " selected"} onPress={() => setFriendPickerOpen(true)} /> : null}
        </View>

        <View style={{ gap: tokens.space.sm }}>
          {hubHeading("Your Activity", "See all", () => router.push("/your-activity" as Href))}
          {featuredActivity ? (
            <BeaconFeedCard
              compact
              featured
              planRelation={featuredActivity.plan_id
                ? data.plans.find((plan) => plan.id === featuredActivity.plan_id)?.title
                : undefined}
              compactFooter={featureTools.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm }}>
                  {featureTools.map((shortcut) => (
                    <Button
                      key={shortcut.tool}
                      compact
                      secondary
                      title={shortcut.label}
                      onPress={() => router.push({
                        pathname: "/activity/[id]",
                        params: {
                          id: featuredActivity.id,
                          tab: shortcut.tool === "chat" ? "chat" : "tools",
                          ...(shortcut.tool !== "chat" ? { tool: shortcut.tool } : {}),
                        },
                      })}
                    />
                  ))}
                </View>
              ) : undefined}
              {...buildCardProps(featuredActivity)}
            />
          ) : (
            <View style={{ gap: tokens.space.xs }}>
              <Txt muted>{loading ? "Loading your activity…" : "No confirmed plans yet."}</Txt>
              {!loading ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.sm }}>
                  <Button compact secondary title="Create Beacon" onPress={() => router.push("/create")} />
                  <Button compact secondary title="Explore Beacons" onPress={() => browse()} />
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={{ gap: tokens.space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space.sm }}>
            <Text accessibilityRole="header" style={{ color: designColors.textPrimary, ...tokens.type.titleSmall }}>Beacons</Text>
            <Button compact secondary title="Browse" onPress={() => browse()} />
          </View>
          {hubHeading("Happening Now", "See all", () => browse("now"))}
          {loading && !data.activities.length ? (
            <View style={{ gap: tokens.space.sm }}>
              <Skeleton height={18} width="42%" />
              <Skeleton height={96} borderRadius={tokens.radius.card} />
            </View>
          ) : nowPreview ? (
            <BeaconFeedCard compact {...buildCardProps(nowPreview)} />
          ) : (
            <Txt muted>A little quiet right now.</Txt>
          )}
          {hubHeading("Coming Up", "See all", () => browse("upcoming"))}
          {upcomingPreview ? (
            <BeaconFeedCard compact {...buildCardProps(upcomingPreview)} />
          ) : (
            <Txt muted>Nothing coming up yet.</Txt>
          )}
        </View>

        <Button secondary title="Saved & Tools" onPress={() => setSavedToolsOpen(true)} />
      </ScrollView>

      <Sheet title="Plan with Friends" visible={friendPickerOpen} scrollable={false} onClose={() => setFriendPickerOpen(false)}>
        <Field label="Search friends" value={friendQuery} onChangeText={setFriendQuery} placeholder="Friend name" />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Txt muted>{selectedFriendIds.length} selected</Txt>
          <Button compact secondary title="Find friends" onPress={() => { setFriendPickerOpen(false); goFindFriends(); }} />
        </View>
        {selectionError ? <Text accessibilityRole="alert" style={{ color: designColors.danger, ...tokens.type.caption }}>{selectionError}</Text> : null}
        {!!selectedFriendIds.length ? (
          <ScrollView horizontal style={{ maxHeight: 48 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ alignItems: "center", gap: tokens.space.xs }}>
            <Button compact secondary title="Clear selection" onPress={() => { setSelectedFriendIds([]); setSelectionError(""); }} />
            {selectedFriendIds.map((id) => <Button key={id} compact secondary title={"Remove " + (friends.find((friend) => friend.id === id)?.name ?? "unavailable friend")} onPress={() => toggleSelection(id)} />)}
          </ScrollView>
        ) : null}
        <View style={{ height: Math.max(120, Math.min(320, windowHeight - 430 - (selectedFriendIds.length ? 48 : 0) - (selectionError ? 48 : 0))) }}>
          <BottomSheetFlatList
            data={friends.filter((friend) => matchesSearch(friendQuery, friend.name))}
            extraData={{ selectedFriendIds, reactions: data.reactions }}
            keyExtractor={(friend) => friend.id}
            renderItem={({ item }) => renderHubFriend(item)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Txt muted>No friends match your search.</Txt>}
          />
        </View>
        <Button title={planTitle} disabled={!selectedFriendIds.length} onPress={planWithSelection} />
      </Sheet>

      <Sheet title="Saved & Tools" visible={savedToolsOpen} onClose={() => setSavedToolsOpen(false)}>
        {responseCount > 0 ? <Button compact secondary title={"Review " + responseCount + " responses & invitations"} onPress={() => { setSavedToolsOpen(false); setResponsesOpen(true); }} /> : null}
        <Button compact secondary title={"Plans · " + toolkitCounts.plans} onPress={() => { setSavedToolsOpen(false); router.push("/plans"); }} />
        <Button compact secondary title={"Favorites · " + toolkitCounts.favorites} onPress={() => { setSavedToolsOpen(false); setFavoritesOpen(true); }} />
        <Button compact secondary title={"My Templates · " + toolkitCounts.templates} onPress={() => { setSavedToolsOpen(false); setTemplatesOpen(true); }} />
        <Button compact secondary title={"Library · " + toolkitCounts.library} onPress={() => { setSavedToolsOpen(false); router.push("/library"); }} />
      </Sheet>

      <ResponsesSheet
        visible={responsesOpen}
        onClose={() => setResponsesOpen(false)}
        pings={responseCards.filter((item) => item.kind === "ping")}
        votes={responseCards.filter((item) => item.kind === "vote")}
        draws={responseCards.filter((item) => item.kind === "draw")}
        invitations={invitations}
        onCreate={() => { setResponsesOpen(false); router.push("/councils"); }}
      />

      <Sheet title="Your favorites" visible={favoritesOpen} onClose={() => setFavoritesOpen(false)}>
        <Txt muted>Favorites are private and never change who can see your Beacons.</Txt>
        <Text style={styles.h2}>Friends</Text>
        {savedFriendFavorites.map((favorite) => {
          const profile = data.profiles.find((person) => person.id === favorite.target_id);
          const canRead = !!userId && !!profile && canViewProfile(data, profile, userId);
          return (
            <Button key={favorite.target_id} secondary title={(canRead ? profile!.name : "Friend") + " · Remove favorite"} onPress={async () => {
              try { await act("favorite", { id: favorite.target_id, kind: "friend", add: false }); }
              catch (failure) { setRequestError(failure instanceof Error ? failure.message : "Could not update favorites."); }
            }} />
          );
        })}
        <Text style={styles.h2}>Squads</Text>
        {savedSquadFavorites.map((favorite) => {
          const squad = data.squads.find((item) => item.id === favorite.target_id);
          const visible = !!userId && !!squad && canOpenSquadProfile(data, squad.id, userId);
          return visible ? <Button key={favorite.target_id} secondary title={squad!.name + " · Remove favorite"} onPress={async () => {
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
            <Button title={"Use " + template.name} onPress={() => { setTemplatesOpen(false); router.push({ pathname: "/create", params: { template: template.id } }); }} />
            <Button title={"Edit " + template.name} secondary onPress={() => { setTemplatesOpen(false); router.push({ pathname: "/create", params: { template: template.id, editTemplate: "yes" } }); }} />
            <Button title={"Delete " + template.name} secondary onPress={async () => {
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
