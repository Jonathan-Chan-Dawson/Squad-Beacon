import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import { ArrowLeft, Compass, Map, Search, SlidersHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { useExploration, matchesExplorationArea } from "@/src/shared/exploration";
import { browseBeacons, type SortOrder } from "@/src/shared/browsing";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { activeOrganizationRole } from "@/src/features/organizations/domain";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { matchesBeaconFilters } from "@/src/features/maps/filtering";
import { AdvancedMapFilters, type MapAudienceChoice } from "@/src/features/maps/AdvancedMapFilters";
import { mapAdvancedFilterCount, matchesSelectedCategories } from "@/src/features/maps/mapUIselectors";
import { BeaconFeedCard } from "@/src/features/beacons/components/BeaconFeedCard";
import { useDesignTheme, Card, PrimaryButton, SecondaryButton } from "@/src/shared/design-system";
import { Sheet } from "@/src/shared/ui";
import { activityFeedCardProps } from "./activityFeedCard";
import type { Activity } from "@/src/shared/types";

type BrowseSection = "now" | "upcoming";

function backToBeacons() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/activities");
}

function browseAudience(audience: string) {
  if (audience === "Public") return "public";
  return audience;
}

export default function BrowseBeaconsScreen() {
  const { colors, tokens } = useDesignTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const params = useLocalSearchParams<{ section?: string }>();
  const { data, userId, act, loading, error, refresh } = useBeacon();
  const exploration = useExploration();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Partial<Record<BrowseSection, number>>>({});
  const pendingSection = useRef<BrowseSection | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(() =>
    exploration.filters.category === "All categories" ? [] : [exploration.filters.category],
  );
  const sort: SortOrder = "Soonest";
  const [rsvpActivityId, setRsvpActivityId] = useState<string | null>(null);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const activeCategories = useMemo(
    () => selectedCategories.length
      ? selectedCategories
      : exploration.filters.category === "All categories" ? [] : [exploration.filters.category],
    [exploration.filters.category, selectedCategories],
  );

  const browseData = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return data;
    const placeReadableIds = new Set(data.activities
      .filter((activity) => canViewBeaconMeetingDetails(data, activity.id, userId))
      .map((activity) => activity.id));
    return { ...data, places: data.places.filter((place) => placeReadableIds.has(place.activity_id)) };
  }, [data, userId]);

  const audiences = useMemo<MapAudienceChoice[]>(() => {
    if (!userId || data.viewer_id !== userId) return [];
    const lists = data.lists.flatMap((list) => {
      const owner = data.profiles.find((profile) => profile.id === list.owner_id);
      const member = list.owner_id === userId || data.list_members.some((row) => row.list_id === list.id && row.user_id === userId);
      const blocked = data.blocks.some((row) =>
        (row.blocker_id === list.owner_id && row.blocked_id === userId) ||
        (row.blocker_id === userId && row.blocked_id === list.owner_id),
      );
      return member && !blocked && (list.owner_id === userId || (!!owner && canViewProfile(data, owner, userId)))
        ? [{ id: list.id, label: list.name, kind: "List" as const }]
        : [];
    });
    const squads = data.squads.filter((squad) => canOpenSquadProfile(data, squad.id, userId))
      .map((squad) => ({ id: squad.id, label: squad.name, kind: "Squad" as const }));
    const organizations = data.organizations.flatMap((organization) => {
      if (!activeOrganizationRole(organization, data.organization_members, userId)) return [];
      if (data.organization_bans.some((ban) => ban.organization_id === organization.id && ban.user_id === userId)) return [];
      const blocked = data.blocks.some((block) =>
        (block.blocker_id === organization.owner_id && block.blocked_id === userId) ||
        (block.blocker_id === userId && block.blocked_id === organization.owner_id),
      );
      return blocked ? [] : [{ id: organization.id, label: organization.name, kind: "Organization" as const }];
    });
    return [...lists, ...squads, ...organizations];
  }, [data, userId]);

  const planOptions = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return [];
    return data.plans.filter((plan) =>
      (plan.owner_id === userId && !plan.squad_id) ||
      (!!plan.squad_id && canOpenSquadProfile(data, plan.squad_id, userId)),
    ).map((plan) => ({ id: plan.id, label: `${plan.title} · ${plan.start_date}` }));
  }, [data, userId]);

  const periodActivities = useCallback((period: "Active" | "Upcoming") => {
    if (!userId || data.viewer_id !== userId) return [] as Activity[];
    const category = activeCategories.length === 1 ? activeCategories[0] : "All categories";
    return browseBeacons(browseData, userId, {
      period,
      sort,
      query: exploration.query,
      category,
      audience: browseAudience(exploration.filters.audience),
      joined: exploration.filters.join === "I'm In",
    }, now)
      .filter((activity) => activity.mode !== "solo")
      .filter((activity) => canReadBeaconActivity(data, activity, userId))
      .filter((activity) => !(activity.plan_id && activity.plan_step && activity.plan_started_at == null))
      .filter((activity) => matchesSelectedCategories(activity.category, activeCategories))
      .filter((activity) => !exploration.filters.planId || activity.plan_id === exploration.filters.planId)
      .filter((activity) => matchesBeaconFilters(data, activity, userId, exploration.filters, now, {
        includeBaseFilters: false,
        query: exploration.query,
      }))
      .filter((activity) => {
        const place = canViewBeaconMeetingDetails(data, activity.id, userId)
          ? data.places.find((row) => row.activity_id === activity.id)
          : undefined;
        const coordinate = place?.online_url == null && place?.latitude != null && place.longitude != null
          ? { latitude: place.latitude, longitude: place.longitude }
          : null;
        return place?.online_url != null || matchesExplorationArea(exploration.area, coordinate);
      });
  }, [activeCategories, browseData, data, exploration.area, exploration.filters, exploration.query, now, sort, userId]);

  const nowActivities = useMemo(() => periodActivities("Active"), [periodActivities]);
  const upcomingActivities = useMemo(() => periodActivities("Upcoming"), [periodActivities]);
  const totalCount = nowActivities.length + upcomingActivities.length;
  const filterCount = mapAdvancedFilterCount(exploration.filters, activeCategories);

  const focusSection = useCallback((section: BrowseSection) => {
    pendingSection.current = section;
    const y = sectionY.current[section];
    if (y == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - tokens.space.sm), animated: true });
      if (pendingSection.current === section) pendingSection.current = null;
    });
  }, [tokens.space.sm]);

  useFocusEffect(useCallback(() => {
    const target = params.section === "now" || params.section === "upcoming" ? params.section : null;
    if (!target) return;
    pendingSection.current = target;
    const frame = requestAnimationFrame(() => focusSection(target));
    return () => cancelAnimationFrame(frame);
  }, [focusSection, params.section]));

  const onSectionLayout = useCallback((section: BrowseSection, y: number) => {
    sectionY.current[section] = y;
    if (pendingSection.current === section) focusSection(section);
  }, [focusSection]);

  const openActivity = useCallback((activityId: string) => {
    router.push({ pathname: "/activity/[id]", params: { id: activityId } });
  }, []);
  const openMap = useCallback((activityId?: string) => {
    router.push(activityId
      ? { pathname: "/(tabs)", params: { beacon: activityId } }
      : "/(tabs)");
  }, []);
  const respond = useCallback(async (activityId: string, status: "going" | "interested" | "withdraw") => {
    const activity = data.activities.find((row) => row.id === activityId);
    if (!userId || data.viewer_id !== userId || !activity || activity.mode === "solo" || activity.owner_id === userId || !canReadBeaconActivity(data, activity, userId)) {
      throw new Error("This Beacon is no longer available to join.");
    }
    await act("rsvp", { id: activity.id, status });
  }, [act, data, userId]);
  const shareActivity = useCallback(async (activityId: string) => {
    const activity = data.activities.find((row) => row.id === activityId);
    if (!activity) throw new Error("This Beacon is no longer available.");
    const url = ExpoLinking.createURL(`/activity/${activity.id}`);
    await Share.share({ title: activity.title, message: `${activity.title}\n${url}`, url });
  }, [data.activities]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRequestError("");
    try { await refresh(); }
    catch (failure) { setRequestError(failure instanceof Error ? failure.message : "Beacons could not refresh."); }
    finally { setRefreshing(false); }
  }, [refresh]);
  const completeRsvp = useCallback(async (status: "going" | "interested" | "withdraw") => {
    if (!rsvpActivityId) return;
    setRsvpBusy(true);
    setRequestError("");
    try {
      await respond(rsvpActivityId, status);
      setRsvpActivityId(null);
    } catch (failure) {
      setRequestError(failure instanceof Error ? failure.message : "Could not update your response.");
    } finally { setRsvpBusy(false); }
  }, [respond, rsvpActivityId]);

  const renderCard = (activity: Activity) => {
    if (!userId) return null;
    const response = data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === userId);
    return (
      <BeaconFeedCard
        key={activity.id}
        compact
        {...activityFeedCardProps(data, activity, userId, now, {
          onOpen: () => openActivity(activity.id),
          onRSVP: (status) => respond(activity.id, status),
          onChangeRSVP: response?.status === "going" || response?.status === "requested"
            ? () => setRsvpActivityId(activity.id)
            : undefined,
          onSave: () => act("save_beacon", {
            activity_id: activity.id,
            saved: !data.beacon_favorites.some((favorite) => favorite.owner_id === userId && favorite.activity_id === activity.id),
          }).then(() => undefined),
          onShare: () => shareActivity(activity.id),
        })}
      />
    );
  };

  const section = (key: BrowseSection, title: string, rows: Activity[]) => (
    <View
      key={key}
      testID={`browse-beacons-${key}`}
      onLayout={(event) => onSectionLayout(key, event.nativeEvent.layout.y)}
      style={{ gap: tokens.space.sm }}
    >
      <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space.sm }}>
        <Text accessibilityRole="header" style={{ flex: 1, minWidth: 0, color: colors.textPrimary, ...tokens.type.titleSmall }}>{title}</Text>
        <Text style={{ color: colors.textSecondary, ...tokens.type.caption }}>{rows.length}</Text>
      </View>
      {rows.length
        ? rows.map(renderCard)
        : <Text style={{ paddingVertical: tokens.space.sm, color: colors.textSecondary, ...tokens.type.secondary }}>{key === "now" ? "Nothing is happening right now." : "Nothing is coming up yet."}</Text>}
    </View>
  );

  const selectedRsvpActivity = data.activities.find((activity) => activity.id === rsvpActivityId);
  const selectedRsvp = selectedRsvpActivity && data.rsvps.find((row) => row.activity_id === selectedRsvpActivity.id && row.user_id === userId);
  const hasResults = totalCount > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="browse-beacons-screen">
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: "100%", maxWidth: tokens.layout.contentMaxWidth, alignSelf: "center", minHeight: 58, paddingHorizontal: tokens.layout.screenGutter, flexDirection: "row", alignItems: "center", gap: tokens.space.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Beacons" onPress={backToBeacons} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={21} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text testID="browse-beacons-header" accessibilityRole="header" numberOfLines={1} style={{ color: colors.textPrimary, ...tokens.type.titleSmall, fontWeight: "800" }}>Browse Beacons</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open map" onPress={() => openMap()} style={{ minWidth: 44, height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: tokens.space.xxs }}>
            <Map size={19} color={colors.accent} />
            <Text style={{ color: colors.accent, ...tokens.type.caption, fontWeight: "700" }}>Map</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        testID="browse-beacons-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{ width: "100%", maxWidth: tokens.layout.contentMaxWidth, alignSelf: "center", paddingHorizontal: tokens.layout.screenGutter, paddingTop: tokens.space.md, paddingBottom: insets.bottom + tokens.layout.scrollClearance, gap: tokens.space.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: tokens.space.sm }}>
          <View style={{ minHeight: 46, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: tokens.radius.button, backgroundColor: colors.surface, paddingHorizontal: tokens.space.md }}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              testID="browse-beacons-search"
              accessibilityLabel="Search Beacons"
              value={exploration.query}
              onChangeText={exploration.setQuery}
              placeholder="Activity, host, or place"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              style={{ flex: 1, minWidth: 0, minHeight: 44, paddingLeft: tokens.space.sm, color: colors.textPrimary, ...tokens.type.body, outlineStyle: "none" } as never}
            />
            <Pressable testID="browse-beacons-filter-button" accessibilityRole="button" accessibilityLabel={`Filters${filterCount ? `, ${filterCount} active` : ""}`} accessibilityState={{ selected: filterCount > 0 }} onPress={() => setFiltersOpen(true)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <SlidersHorizontal size={19} color={filterCount ? colors.accent : colors.textSecondary} />
            </Pressable>
          </View>
          {(exploration.area || filterCount > 0) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space.xs }}>
              {exploration.area ? <Pressable accessibilityRole="button" accessibilityLabel={`Map area: ${exploration.area.label}. Open map`} onPress={() => openMap()} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: tokens.space.sm, borderRadius: tokens.radius.pill, backgroundColor: colors.surfaceRaised }}><Compass size={14} color={colors.accent} /><Text numberOfLines={1} style={{ maxWidth: 200, color: colors.textSecondary, ...tokens.type.caption }}>{exploration.area.label}</Text></Pressable> : null}
              {filterCount > 0 ? <Text style={{ alignSelf: "center", color: colors.textSecondary, ...tokens.type.caption }}>{filterCount} filter{filterCount === 1 ? "" : "s"} active</Text> : null}
            </View>
          ) : null}
        </View>

        {requestError || error ? (
          <Card style={{ gap: tokens.space.sm, borderColor: colors.danger }}>
            <Text accessibilityRole="alert" style={{ color: colors.danger, ...tokens.type.secondary }}>{requestError || error}</Text>
            <SecondaryButton title="Try again" onPress={() => void onRefresh()} />
          </Card>
        ) : null}
        {loading && !data.activities.length ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Loading Beacons" style={{ minHeight: 80, alignItems: "center", justifyContent: "center", gap: tokens.space.xs }}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.textSecondary, ...tokens.type.secondary }}>Loading Beacons</Text></View>
        ) : null}
        {!(loading && !data.activities.length) && !hasResults ? (
          <Card style={{ alignItems: "center", gap: tokens.space.sm, padding: tokens.space.lg }} testID="browse-beacons-empty">
            <Compass size={28} color={colors.accent} />
            <Text accessibilityRole="header" style={{ textAlign: "center", color: colors.textPrimary, ...tokens.type.titleSmall }}>No Beacons match right now</Text>
            <Text style={{ textAlign: "center", color: colors.textSecondary, ...tokens.type.secondary }}>Try another search or explore a different area.</Text>
            <View style={{ width: "100%", gap: tokens.space.xs }}>
              <SecondaryButton title="Explore on Map" onPress={() => openMap()} />
              <PrimaryButton title="Create a Beacon" onPress={() => router.push("/create")} />
            </View>
          </Card>
        ) : null}
        {hasResults ? section("now", "Happening Now", nowActivities) : null}
        {hasResults ? section("upcoming", "Coming Up", upcomingActivities) : null}
      </ScrollView>

      <AdvancedMapFilters
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={exploration.filters}
        onChange={(next) => {
          exploration.setFilters(next);
          setSelectedCategories(next.category === "All categories" ? [] : [next.category]);
        }}
        audiences={audiences}
        planOptions={planOptions}
        resultCount={totalCount}
        selectedCategories={activeCategories}
        onCategoriesChange={(next) => {
          setSelectedCategories(next);
          if (exploration.filters.category !== "All categories") {
            exploration.setFilters({ ...exploration.filters, category: "All categories" });
          }
        }}
      />
      <Sheet title="Your response" visible={!!rsvpActivityId} onClose={() => { if (!rsvpBusy) { setRsvpActivityId(null); setRequestError(""); } }}>
        {selectedRsvpActivity ? <Text style={{ color: colors.textSecondary, ...tokens.type.secondary }}>{selectedRsvpActivity.title}</Text> : null}
        {requestError ? <Text accessibilityRole="alert" style={{ color: colors.danger, ...tokens.type.caption }}>{requestError}</Text> : null}
        <PrimaryButton title={rsvpBusy ? "Updating…" : "I'm In"} disabled={rsvpBusy} onPress={() => void completeRsvp("going")} />
        <SecondaryButton title="Maybe" disabled={rsvpBusy} onPress={() => void completeRsvp("interested")} />
        {selectedRsvp && (selectedRsvp.status === "going" || selectedRsvp.status === "requested") ? <SecondaryButton title={selectedRsvp.status === "requested" && !isApprovedGoing(selectedRsvpActivity!, selectedRsvp) ? "Cancel request" : "Withdraw"} disabled={rsvpBusy} onPress={() => void completeRsvp("withdraw")} /> : null}
      </Sheet>
    </View>
  );
}
