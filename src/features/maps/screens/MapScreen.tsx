import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams, usePathname } from "expo-router";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { LocateFixed, Layers3, Maximize2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BeaconMap, { type MapControlCommand, type MapStyle } from "@/src/features/maps/components/BeaconMap";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { matchesSearch } from "@/src/shared/search";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { Button, IconButton, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import { friendIds, locationIsFresh } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { deriveMapPointPriorities } from "@/src/features/maps/relevance";
import {
  explorationAreaTarget,
  matchesExplorationArea,
  type MapViewport,
  type ExplorationArea,
  type Coordinate,
  useExploration,
  isValidCoordinate,
} from "@/src/shared/exploration";
import type { ActivityPlace, Category, Profile } from "@/src/shared/types";
import type { WorldwidePlace } from "@/src/features/maps/placeSearch";
import { selectFreshVisiblePersonLocation } from "@/src/features/people/previews/personPreview";
import { MapExplorationHeader, type ActiveMapFilterChip, type MapQuickFilter } from "@/src/features/maps/MapExplorationHeader";
import { AdvancedMapFilters, type MapAudienceChoice } from "@/src/features/maps/AdvancedMapFilters";
import { matchesBeaconFilters, canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { PersonProfilePreview } from "@/src/features/people/previews/PersonProfilePreview";
import { SquadProfilePreview } from "@/src/features/people/previews/SquadProfilePreview";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { activeOrganizationRole } from "@/src/features/organizations/domain";
import { DemoChip, uiHaptics } from "@/src/shared/design-system";
import { tokens } from "@/src/theme";
import { MapSearchOverlay } from "@/src/features/maps/MapSearchOverlay";
import { MapCompassSheet } from "@/src/features/maps/MapCompassSheet";
import { SonarSharingIndicator } from "@/src/features/maps/SonarSharingIndicator";
import { activeSonarSession, getRecentMapSearchQueries, rememberMapSearchQuery } from "@/src/features/maps/sessionHelpers";
import { includeSelectedActivity, mapAdvancedFilterCount, matchesSelectedCategories, shouldSearchNewViewport } from "@/src/features/maps/mapUIselectors";
import { MapResultsSheet, type MapResultsSheetRef } from "@/src/features/maps/MapResultsSheet";
import { MapPreviewCarousel } from "@/src/features/maps/MapPreviewCarousel";
import { MapTooltip } from "@/src/features/maps/MapTooltip";
import { physicalDirectionsUrl } from "@/src/features/maps/directions";

const defaultFilters = {
  audience: "Everyone" as const,
  category: "All categories" as const,
  time: "All" as const,
  planId: null,
  when: "Any" as const,
  join: "Any" as const,
  format: "Any" as const,
  starredOnly: false,
};

function MapControl({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white + "E8",
        boxShadow: "0 3px 12px #132d2926",
      }}
    >
      {children}
    </Pressable>
  );
}

function validPhysicalPlace(place: ActivityPlace): place is ActivityPlace & { latitude: number; longitude: number } {
  return place.online_url == null && place.latitude != null && place.longitude != null && isValidCoordinate({ latitude: place.latitude, longitude: place.longitude });
}

export default function MapScreen() {
  const mapIsFocused = usePathname() === "/";
  const { colors, styles } = useTheme();
  const { showAvatars } = usePreferences();
  const exploration = useExploration();
  const { data, userId, demo, loading } = useBeacon();
  const params = useLocalSearchParams<{ beacon?: string; person?: string; created?: string; search?: string }>();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const now = useNow();
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [personPreviewId, setPersonPreviewId] = useState<string | null>(null);
  const [squadPreviewId, setSquadPreviewId] = useState<string | null>(null);
  const [organizationPreviewId, setOrganizationPreviewId] = useState<string | null>(null);
  const [compassBusy, setCompassBusy] = useState(false);
  const [compassMessage, setCompassMessage] = useState("");
  const [compassSheetOpen, setCompassSheetOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [clusterActivityIds, setClusterActivityIds] = useState<string[] | null>(null);
  const [clusterPersonIds, setClusterPersonIds] = useState<string[] | null>(null);
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false);
  const [searchPlaceOpen, setSearchPlaceOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [targetRevision, setTargetRevision] = useState(0);
  const [mapStyle, setMapStyle] = useState<MapStyle>("standard");
  const [controlCommand, setControlCommand] = useState<MapControlCommand | undefined>();
  const [searchAreaState, setSearchAreaState] = useState<"idle" | "loading" | "count">("idle");
  const [searchAreaCount, setSearchAreaCount] = useState(0);
  const [viewerCoordinate, setViewerCoordinate] = useState<Coordinate | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(() =>
    exploration.filters.category === "All categories" ? [] : [exploration.filters.category],
  );
  const [recentSearchState, setRecentSearchState] = useState(() => ({ viewerId: userId, queries: getRecentMapSearchQueries(userId) }));
  const [offline, setOffline] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [pickedMapPoint, setPickedMapPoint] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [searchAreaVisible, setSearchAreaVisible] = useState(false);
  const [filterSheetSnap, setFilterSheetSnap] = useState<0 | 1 | 2>(0);
  const mapResultsRef = useRef<MapResultsSheetRef>(null);
  const searchBaseline = useRef<MapViewport | null>(null);
  const latestViewport = useRef<MapViewport | null>(null);
  const processedRouteSelection = useRef<string | null>(null);
  const searchAreaTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (params.search !== "yes") return;
    const timer = setTimeout(() => {
      setPlaceSearchOpen(true);
      router.setParams({ search: undefined });
    }, 0);
    return () => clearTimeout(timer);
  }, [params.search]);
  useEffect(() => {
    if (params.created !== "yes") return;
    router.setParams({ created: undefined });
    const show = setTimeout(() => setCreatedNotice(true), 0);
    const hide = setTimeout(() => setCreatedNotice(false), 3200);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [params.created]);
  useEffect(() => () => searchAreaTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    let mounted = true;
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) setOffline(state.isConnected === false || state.isInternetReachable === false);
      } catch {
        if (mounted) setOffline(false);
      }
    };
    void checkNetwork();
    const timer = setInterval(() => void checkNetwork(), 25_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const snapshotReady = !!userId && data.viewer_id === userId;
  const friends = friendIds(data, userId ?? "");
  const selectedPersonLocation = person && userId
    ? selectFreshVisiblePersonLocation(data, person, userId, now)
    : undefined;
  const routeSelectedPersonLocation = params.person && userId
    ? selectFreshVisiblePersonLocation(data, params.person, userId, now)
    : undefined;

  function clearRouteSelection() {
    processedRouteSelection.current = JSON.stringify([userId, params.beacon ?? "", params.person ?? ""]);
    router.setParams({ beacon: undefined, person: undefined });
  }

  const safeActivities = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return [];
    const categories = selectedCategories.length
      ? selectedCategories
      : exploration.filters.category === "All categories"
        ? []
        : [exploration.filters.category];
    return data.activities
      .filter((activity) => canReadBeaconActivity(data, activity, userId))
      .filter((activity) => activity.status === "scheduled" && Date.parse(activity.ends_at) > now)
      .filter((activity) => matchesBeaconFilters(data, activity, userId, exploration.filters, now, { query: exploration.query }))
      .filter((activity) => matchesSelectedCategories(activity.category, categories));
  }, [data, exploration.filters, exploration.query, now, selectedCategories, userId]);

  const availabilityActivities = useMemo(() => snapshotReady && userId
    ? data.activities.filter((activity) => canReadBeaconActivity(data, activity, userId))
    : [], [data, snapshotReady, userId]);

  const safePlaces = useMemo(() => data.places.filter((place) => {
    const activity = data.activities.find((candidate) => candidate.id === place.activity_id);
    return !!userId && !!activity && canReadBeaconActivity(data, activity, userId) && canReadBeaconMeetingDetails(data, activity, userId);
  }), [data, userId]);

  const activities = useMemo(() => safeActivities.filter((activity) => {
    const place = safePlaces.find((candidate) => candidate.activity_id === activity.id);
    return place?.online_url != null || matchesExplorationArea(
      exploration.area,
      place && validPhysicalPlace(place) ? { latitude: place.latitude, longitude: place.longitude } : null,
    );
  }), [exploration.area, safeActivities, safePlaces]);

  const visibleActivities = useMemo(() => {
    if (!viewport) return activities;
    const visibleArea: ExplorationArea = {
      kind: "viewport",
      label: "Visible map area",
      coordinate: viewport.center,
      zoom: viewport.zoom,
      bounds: viewport.bounds,
    };
    return activities.filter((activity) => {
      const place = safePlaces.find((candidate) => candidate.activity_id === activity.id);
      return place?.online_url != null || matchesExplorationArea(
        visibleArea,
        place && validPhysicalPlace(place) ? { latitude: place.latitude, longitude: place.longitude } : null,
      );
    });
  }, [activities, safePlaces, viewport]);

  const visiblePlans = useMemo(() => userId && data.viewer_id === userId
    ? data.plans.filter((plan) => {
        if (plan.owner_id === userId && !plan.squad_id) return true;
        if (!plan.squad_id || !canOpenSquadProfile(data, plan.squad_id, userId)) return false;
        return !data.blocks.some((block) => (block.blocker_id === plan.owner_id && block.blocked_id === userId) || (block.blocker_id === userId && block.blocked_id === plan.owner_id));
      })
    : [], [data, userId]);
  const planFilterOptions = useMemo(() => visiblePlans.map((plan) => {
    const sameTitle = visiblePlans.filter((other) => other.title === plan.title);
    const sameDate = sameTitle.filter((other) => other.start_date === plan.start_date);
    return {
      id: plan.id,
      label: sameTitle.length === 1 ? plan.title : `${plan.title} · ${plan.start_date}${sameDate.length > 1 ? ` · ${plan.id.slice(0, 8)}` : ""}`,
    };
  }), [visiblePlans]);

  const mapAudiences = useMemo<MapAudienceChoice[]>(() => userId && data.viewer_id === userId ? [
    ...data.lists.filter((list) => {
      const owner = data.profiles.find((profile) => profile.id === list.owner_id);
      const member = list.owner_id === userId || data.list_members.some((row) => row.list_id === list.id && row.user_id === userId);
      const blocked = data.blocks.some((row) => (row.blocker_id === list.owner_id && row.blocked_id === userId) || (row.blocker_id === userId && row.blocked_id === list.owner_id));
      return member && !blocked && (list.owner_id === userId || (!!owner && canViewProfile(data, owner, userId)));
    }).map((list) => ({ id: list.id, label: list.name, kind: "List" as const })),
    ...data.squads.filter((squad) => canOpenSquadProfile(data, squad.id, userId)).map((squad) => ({ id: squad.id, label: squad.name, kind: "Squad" as const })),
    ...data.organizations.filter((organization) => {
      if (!activeOrganizationRole(organization, data.organization_members, userId)) return false;
      if (data.organization_bans.some((ban) => ban.organization_id === organization.id && ban.user_id === userId)) return false;
      return !data.blocks.some((block) => (block.blocker_id === organization.owner_id && block.blocked_id === userId) || (block.blocker_id === userId && block.blocked_id === organization.owner_id));
    }).map((organization) => ({ id: organization.id, label: organization.name, kind: "Organization" as const })),
  ] : [], [data, userId]);

  const mapLocations = useMemo(() => data.locations.filter((location) => {
    if (!snapshotReady || !userId || !showAvatars || !locationIsFresh(location, new Date(now))) return false;
    if (location.latitude == null || location.longitude == null || !isValidCoordinate({ latitude: location.latitude, longitude: location.longitude })) return false;
    const isSelectedPerson = selectedPersonLocation?.id === location.id;
    const audience = exploration.filters.audience;
    const accessibleSquadIds = data.squads.filter((squad) => canOpenSquadProfile(data, squad.id, userId)).map((squad) => squad.id);
    const audienceMatches = isSelectedPerson || audience === "Everyone" ||
      (audience === "Friends" ? friends.includes(location.owner_id) :
        audience === "Public" ? false :
          audience === "Squads" ? data.squad_members.some((member) => member.user_id === location.owner_id && accessibleSquadIds.includes(member.squad_id)) :
            data.squad_members.some((member) => member.user_id === location.owner_id && member.squad_id === audience));
    if (!audienceMatches || !canViewProfile(data, location.owner_id, userId)) return false;
    return isSelectedPerson || matchesExplorationArea(exploration.area, { latitude: location.latitude, longitude: location.longitude });
  }), [data, exploration.area, exploration.filters.audience, friends, now, selectedPersonLocation?.id, showAvatars, snapshotReady, userId]);

  const query = exploration.query.trim();
  const searchActivityResults = query ? safeActivities.slice(0, 5) : [];
  const searchPeopleResults: Profile[] = query && snapshotReady && userId
    ? data.profiles.filter((profile) => canViewProfile(data, profile, userId) && matchesSearch(query, profile.name, profile.username)).slice(0, 5)
    : [];
  const searchPlaceResults = safePlaces.filter((place) =>
    validPhysicalPlace(place) && safeActivities.some((activity) => activity.id === place.activity_id) && (!query || matchesSearch(query, place.label)),
  ).slice(0, 8);

  const visibleActivityIds = activities.map((activity) => activity.id);
  const clusterPriorities = userId
    ? deriveMapPointPriorities(data, userId, visibleActivityIds, showAvatars ? mapLocations.map((location) => location.owner_id) : [], now)
    : {};
  const focusedBeacon = selected && userId
    ? data.activities.find((activity) => activity.id === selected && canReadBeaconActivity(data, activity, userId))
    : undefined;
  const synchronizedActivities = useMemo(() => includeSelectedActivity(visibleActivities, focusedBeacon), [focusedBeacon, visibleActivities]);
  const synchronizedPlanCount = useMemo(() => {
    const linkedPlanIds = new Set(
      synchronizedActivities.flatMap((activity) => activity.plan_id ? [activity.plan_id] : []),
    );
    return visiblePlans.reduce((count, plan) => count + Number(linkedPlanIds.has(plan.id)), 0);
  }, [synchronizedActivities, visiblePlans]);
  const focusedPlace = focusedBeacon
    ? safePlaces.find((place) => place.activity_id === focusedBeacon.id && validPhysicalPlace(place))
    : undefined;
  const focusedCoordinate = person && selectedPersonLocation?.latitude != null && selectedPersonLocation.longitude != null
    ? { latitude: selectedPersonLocation.latitude, longitude: selectedPersonLocation.longitude }
    : focusedPlace
      ? { latitude: focusedPlace.latitude!, longitude: focusedPlace.longitude! }
      : null;
  const panel = !!selected || !!person;
  const baseExplorationTarget = useMemo(() => explorationAreaTarget(exploration.area), [exploration.area]);
  const explorationTarget = useMemo(() => baseExplorationTarget ? {
    ...baseExplorationTarget,
    revision: exploration.areaRevision + targetRevision,
  } : null, [baseExplorationTarget, exploration.areaRevision, targetRevision]);
  const activeCategories = useMemo(() => selectedCategories.length
    ? selectedCategories
    : exploration.filters.category === "All categories"
      ? []
      : [exploration.filters.category], [exploration.filters.category, selectedCategories]);
  const activeFilterCount = mapAdvancedFilterCount(exploration.filters, activeCategories);

  const activeChips = useMemo<ActiveMapFilterChip[]>(() => {
    const chips: ActiveMapFilterChip[] = [];
    const audienceLabel = exploration.filters.audience === "Everyone"
      ? ""
      : exploration.filters.audience === "Friends" || exploration.filters.audience === "Public" || exploration.filters.audience === "Squads"
        ? exploration.filters.audience
        : mapAudiences.find((option) => option.id === exploration.filters.audience)?.label ?? "Group";
    if (audienceLabel) chips.push({ key: "audience", label: audienceLabel });
    if (exploration.filters.time !== "All") chips.push({ key: "time", label: exploration.filters.time });
    if (exploration.filters.when && exploration.filters.when !== "Any") chips.push({ key: "when", label: exploration.filters.when });
    activeCategories.forEach((category) => chips.push({ key: `category:${category}`, label: category }));
    if (exploration.filters.join && exploration.filters.join !== "Any") chips.push({ key: "join", label: exploration.filters.join });
    if (exploration.filters.format && exploration.filters.format !== "Any") chips.push({ key: "format", label: exploration.filters.format });
    if (exploration.filters.starredOnly) chips.push({ key: "starred", label: "Starred only" });
    if (exploration.filters.planId) chips.push({ key: "plan", label: planFilterOptions.find((plan) => plan.id === exploration.filters.planId)?.label ?? "Plan" });
    return chips;
  }, [activeCategories, exploration.filters, mapAudiences, planFilterOptions]);

  const selectedQuickFilter: MapQuickFilter | null = exploration.filters.time === "Now"
    ? "Now"
    : exploration.filters.audience === "Friends"
      ? "Friends"
      : exploration.filters.audience === "Squads"
        ? "Squads"
        : exploration.filters.audience === "Public"
          ? "Public"
          : "All";

  const activeSonar = activeSonarSession(data.locations, userId, now);
  const compassSearchQuery = exploration.query;
  const recentQueries = recentSearchState.viewerId === userId
    ? recentSearchState.queries
    : getRecentMapSearchQueries(userId);

  useEffect(() => {
    if (!userId || data.viewer_id !== userId) return;
    const routeSelection = JSON.stringify([userId, params.beacon ?? "", params.person ?? ""]);
    if (processedRouteSelection.current === routeSelection) return;
    const frame = requestAnimationFrame(() => {
      processedRouteSelection.current = routeSelection;
      const validBeacon = !!params.beacon && data.activities.some((activity) => activity.id === params.beacon && canReadBeaconActivity(data, activity, userId));
      const validPerson = !!params.person && !!routeSelectedPersonLocation;
      if (validBeacon || validPerson) {
        setClusterActivityIds(null);
        setClusterPersonIds(null);
        setSelected(validBeacon ? params.beacon! : null);
        setPerson(validPerson ? params.person! : null);
      } else {
        const stale: { beacon?: undefined; person?: undefined } = {};
        if (params.beacon) stale.beacon = undefined;
        if (params.person) stale.person = undefined;
        if (Object.keys(stale).length) router.setParams(stale);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [data, params.beacon, params.person, routeSelectedPersonLocation, userId]);

  useFocusEffect(useCallback(() => {
    if (!snapshotReady || !userId) return;
    if (selected && !data.activities.some((activity) => activity.id === selected && canReadBeaconActivity(data, activity, userId))) {
      setSelected(null);
      router.setParams({ beacon: undefined });
    }
    if (person && !selectFreshVisiblePersonLocation(data, person, userId, now)) {
      setPerson(null);
      router.setParams({ person: undefined });
    }
  }, [data, now, person, selected, snapshotReady, userId]));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setClusterActivityIds(null);
      setClusterPersonIds(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [exploration.query, exploration.filters, selectedCategories, exploration.areaRevision]);

  function rememberSearch(value: string) {
    const next = rememberMapSearchQuery(value, userId);
    setRecentSearchState({ viewerId: userId, queries: next });
  }

  function chooseBeacon(id: string, source: "map" | "list" | "preview" | "search" = "map") {
    if (!userId || !data.activities.some((activity) => activity.id === id && canReadBeaconActivity(data, activity, userId))) return;
    uiHaptics.light();
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(id);
    setPerson(null);
    setPlaceSearchOpen(false);
    setPickMode(false);
    setPickedMapPoint(null);
    if (source === "map" || source === "preview" || source === "search") mapResultsRef.current?.snapToIndex(0);
  }

  function choosePerson(id: string) {
    if (!userId || !selectFreshVisiblePersonLocation(data, id, userId, now)) return;
    uiHaptics.light();
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setPerson(id);
    const beacon = safeActivities.find((activity) => activity.owner_id === id && activity.mode === "solo" && Date.parse(activity.starts_at) <= now && Date.parse(activity.ends_at) > now)
      ?? safeActivities.find((activity) => {
        const rsvp = data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === id);
        return !!rsvp && isApprovedGoing(activity, rsvp);
      })
      ?? safeActivities.find((activity) => activity.owner_id === id);
    setSelected(beacon?.id ?? null);
    setPlaceSearchOpen(false);
  }

  function startPickingLocation() {
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(null);
    setPerson(null);
    setPickedMapPoint(null);
    setPickMode(true);
    setPlaceSearchOpen(false);
  }

  function chooseKnownPlace(place: ActivityPlace) {
    if (!validPhysicalPlace(place)) return;
    clearRouteSelection();
    setSelected(null);
    setPerson(null);
    setPickedMapPoint({ latitude: place.latitude, longitude: place.longitude, label: place.label });
    setPickMode(false);
    setPlaceSearchOpen(false);
  }

  function exploreSavedPlace(place: ActivityPlace) {
    if (!validPhysicalPlace(place)) return;
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(null);
    setPerson(null);
    setPickMode(false);
    setPickedMapPoint(null);
    exploration.setQuery("");
    exploration.setArea({ kind: "place", label: place.label, coordinate: { latitude: place.latitude, longitude: place.longitude }, zoom: 15, source: "saved" });
    setPlaceSearchOpen(false);
    setSearchPlaceOpen(false);
    setCompassSheetOpen(false);
  }

  function exploreGooglePlace(place: WorldwidePlace) {
    if (Platform.OS !== "android" || !isValidCoordinate(place.coordinate)) return;
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(null);
    setPerson(null);
    setPickMode(false);
    setPickedMapPoint(null);
    exploration.setQuery("");
    exploration.setArea({ kind: "place", label: place.label, coordinate: place.coordinate, zoom: 13, source: "google", attributions: place.attributions });
    setPlaceSearchOpen(false);
    setSearchPlaceOpen(false);
    setCompassSheetOpen(false);
  }

  function handleViewportChange(next: MapViewport, userMoved = true) {
    const previous = latestViewport.current;
    latestViewport.current = next;
    setViewport(next);
    if (!searchBaseline.current) searchBaseline.current = next;
    if (!userMoved) {
      // Leaflet reports the final camera more than once (for example, on both
      // zoomend and moveend). Treat the duplicate completion as one gesture so
      // it cannot immediately dismiss the explicit area-search affordance.
      const sameCamera = previous != null &&
        previous.center.latitude === next.center.latitude &&
        previous.center.longitude === next.center.longitude &&
        previous.zoom === next.zoom &&
        previous.bounds.north === next.bounds.north &&
        previous.bounds.south === next.bounds.south &&
        previous.bounds.east === next.bounds.east &&
        previous.bounds.west === next.bounds.west;
      if (sameCamera) return;
      searchBaseline.current = next;
      setSearchAreaVisible(false);
      setClusterActivityIds(null);
      setClusterPersonIds(null);
      return;
    }
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    if (pickMode || pickedMapPoint) {
      setSearchAreaVisible(false);
      return;
    }
    setSearchAreaVisible(shouldSearchNewViewport(searchBaseline.current, next));
  }

  function runSearchThisArea() {
    if (!viewport || searchAreaState === "loading") return;
    const area: ExplorationArea = { kind: "viewport", label: "Selected area", coordinate: viewport.center, zoom: viewport.zoom, bounds: viewport.bounds };
    const resultCount = safeActivities.filter((activity) => {
      const place = safePlaces.find((candidate) => candidate.activity_id === activity.id);
      return place?.online_url != null || matchesExplorationArea(area, place && validPhysicalPlace(place) ? { latitude: place.latitude, longitude: place.longitude } : null);
    }).length;
    setSearchAreaCount(resultCount);
    setSearchAreaState("loading");
    searchBaseline.current = viewport;
    setSearchAreaVisible(true);
    exploration.setArea(area);
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    const showCount = setTimeout(() => {
      setSearchAreaState("count");
      const hide = setTimeout(() => {
        setSearchAreaState("idle");
        setSearchAreaVisible(false);
      }, 2000);
      searchAreaTimers.current.push(hide);
    }, 450);
    searchAreaTimers.current.push(showCount);
  }

  function resetFilters() {
    exploration.setFilters(defaultFilters);
    setSelectedCategories([]);
  }

  function removeActiveChip(key: string) {
    if (key.startsWith("category:")) {
      const category = key.slice("category:".length) as Category;
      const next = activeCategories.filter((value) => value !== category);
      setSelectedCategories(next);
      if (!next.length) exploration.setFilters({ ...exploration.filters, category: "All categories" });
      return;
    }
    const changes: Record<string, unknown> = {
      audience: key === "audience" ? "Everyone" : exploration.filters.audience,
      time: key === "time" ? "All" : exploration.filters.time,
      when: key === "when" ? "Any" : exploration.filters.when,
      join: key === "join" ? "Any" : exploration.filters.join,
      format: key === "format" ? "Any" : exploration.filters.format,
      planId: key === "plan" ? null : exploration.filters.planId,
      starredOnly: key === "starred" ? false : exploration.filters.starredOnly,
      category: "All categories",
    };
    exploration.setFilters({ ...exploration.filters, ...changes } as typeof exploration.filters);
  }

  function chooseQuickFilter(filter: MapQuickFilter) {
    if (filter === "All") {
      resetFilters();
      return;
    }
    if (filter === "Now") {
      exploration.setFilters({ ...exploration.filters, time: exploration.filters.time === "Now" ? "All" : "Now", when: "Any" });
      return;
    }
    const audience = filter === "Friends" ? "Friends" : filter === "Public" ? "Public" : "Squads";
    exploration.setFilters({
      ...exploration.filters,
      audience: exploration.filters.audience === audience ? "Everyone" : audience,
      time: exploration.filters.time === "Now" ? "All" : exploration.filters.time,
    });
  }

  async function handleUseMyLocation() {
    if (compassBusy) return;
    setCompassBusy(true);
    setCompassMessage("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setCompassMessage("Location permission is off. You can enable it in Settings, or keep exploring anywhere.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      if (!isValidCoordinate(coordinate)) throw new Error("The device returned an invalid location.");
      setViewerCoordinate(coordinate);
      exploration.setArea({ kind: "near-me", label: "Near me", coordinate, zoom: 13 });
      setCompassMessage("");
      setSearchAreaVisible(false);
      setCompassSheetOpen(false);
    } catch (failure) {
      setCompassMessage(failure instanceof Error ? failure.message : "Could not find your current location.");
    } finally {
      setCompassBusy(false);
    }
  }

  function openSettings() {
    if (Platform.OS === "web") return;
    void Linking.openSettings().catch(() => setCompassMessage("Open your device Settings to allow location access."));
  }

  function searchSubmit(value: string) {
    const next = value.trim().replace(/\s+/g, " ");
    if (next) rememberSearch(next);
    exploration.setQuery(next);
    setPlaceSearchOpen(!!next || placeSearchOpen);
  }

  function chooseRecent(queryValue: string) {
    exploration.setQuery(queryValue);
    setPlaceSearchOpen(true);
    setCompassSheetOpen(false);
    setSearchPlaceOpen(false);
  }

  function openActivityDetails(id: string) {
    if (!userId || !data.activities.some((activity) => activity.id === id && canReadBeaconActivity(data, activity, userId))) return;
    router.push({ pathname: "/activity/[id]", params: { id, from: "map" } });
  }

  function openDirections(id: string) {
    const activity = data.activities.find((candidate) => candidate.id === id);
    const place = safePlaces.find((candidate) => candidate.activity_id === id);
    if (!userId || !activity || !canReadBeaconActivity(data, activity, userId) || !canReadBeaconMeetingDetails(data, activity, userId) || !place || !validPhysicalPlace(place)) return;
    const url = physicalDirectionsUrl(place.latitude, place.longitude);
    if (url) void Linking.openURL(url).catch(() => undefined);
  }

  function createBeaconHere() {
    if (!pickedMapPoint) return;
    setPickedMapPoint(null);
    setPickMode(false);
    router.push({ pathname: "/create", params: { latitude: String(pickedMapPoint.latitude), longitude: String(pickedMapPoint.longitude), placeLabel: pickedMapPoint.label } });
  }

  const headerTop = insets.top + 7;
  const mapBottomClearance = 108;
  const activeAreaTarget = explorationTarget;
  const resultResetKey = `${exploration.query}:${JSON.stringify(exploration.filters)}:${activeCategories.join(",")}:${exploration.areaRevision}:${viewport ? JSON.stringify(viewport.bounds) : ""}`;
  const activeSearchVisible = placeSearchOpen || params.search === "yes";
  const shareIndicator = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <SonarSharingIndicator session={activeSonar} onExtend={() => router.push({ pathname: "/location", params: { extend: "yes" } })} />
    </View>
  );

  return (
    <KeyboardAvoidingView testID="full-map-screen" style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <BeaconMap
        fullScreen
        hideControls
        viewportInsets={{ top: insets.top + headerHeight + 16, right: 68, bottom: mapBottomClearance, left: 12 }}
        focused={pickedMapPoint ?? focusedCoordinate}
        activities={focusedBeacon && !activities.some((activity) => activity.id === selected) ? [...activities, focusedBeacon] : activities}
        availabilityActivities={availabilityActivities}
        places={safePlaces}
        locations={mapLocations}
        profiles={data.profiles}
        clusterPriorities={clusterPriorities}
        selectedActivityId={selected}
        onPick={pickMode ? (latitude, longitude) => setPickedMapPoint({ latitude, longitude, label: "Pinned map location" }) : undefined}
        selected={pickedMapPoint}
        onActivity={(id) => chooseBeacon(id, "map")}
        onPerson={choosePerson}
        onCluster={(nextCluster) => {
          uiHaptics.light();
          clearRouteSelection();
          setSelected(null);
          setPerson(null);
          const memberIds = nextCluster.members.filter((member) => member.kind === "beacon").map((member) => member.id.slice("beacon:".length)).filter((id) => activities.some((activity) => activity.id === id));
          const peopleIds = nextCluster.members.filter((member) => member.kind === "person").map((member) => member.id.slice("person:".length)).filter((id) => mapLocations.some((location) => location.owner_id === id) && !!data.profiles.find((profile) => profile.id === id && userId && canViewProfile(data, profile, userId)));
          if (memberIds.length || peopleIds.length) {
            setClusterActivityIds(memberIds);
            setClusterPersonIds(peopleIds);
            requestAnimationFrame(() => {
              mapResultsRef.current?.showClusterMembers(memberIds);
              mapResultsRef.current?.snapToIndex(1);
            });
          } else {
            setClusterActivityIds(null);
            setClusterPersonIds(null);
          }
        }}
        onMapTap={() => {
          setPlaceSearchOpen(false);
          setCompassSheetOpen(false);
          clearRouteSelection();
          setSelected(null);
          setPerson(null);
          setClusterActivityIds(null);
          setClusterPersonIds(null);
          router.setParams({ beacon: undefined, person: undefined });
        }}
        explorationTarget={activeAreaTarget}
        controlCommand={controlCommand}
        mapStyle={mapStyle}
        onRecenter={activeAreaTarget ? () => setTargetRevision((revision) => revision + 1) : undefined}
        onViewportChange={handleViewportChange}
      />

      <View style={{ position: "absolute", top: headerTop, left: 0, right: 0, zIndex: 20, elevation: 20 }}>
        <MapExplorationHeader
          query={exploration.query}
          onQueryChange={exploration.setQuery}
          onQuerySubmit={searchSubmit}
          onCompass={() => setCompassSheetOpen(true)}
          onQuickFilter={chooseQuickFilter}
          selectedQuickFilter={selectedQuickFilter}
          onOpenFilters={() => setAdvancedFiltersOpen(true)}
          activeFilterCount={activeFilterCount}
          activeChips={activeChips}
          onRemoveChip={removeActiveChip}
          searchAreaVisible={searchAreaVisible && !pickMode && !pickedMapPoint}
          searchAreaState={searchAreaState}
          searchAreaCount={searchAreaCount}
          onSearchThisArea={runSearchThisArea}
          onSearchFocus={() => setPlaceSearchOpen(true)}
          loading={loading}
          sharingIndicator={shareIndicator}
          onHeightChange={setHeaderHeight}
        />
      </View>

      {activeSearchVisible ? (
        <View style={{ position: "absolute", top: headerTop + headerHeight, left: 0, right: 0, zIndex: 13, paddingHorizontal: 12 }}>
          <MapSearchOverlay
            visible
            query={exploration.query}
            beacons={searchActivityResults}
            people={searchPeopleResults}
            places={searchPlaceResults}
            recentQueries={recentQueries}
            onSelectBeacon={(activity) => {
              rememberSearch(exploration.query);
              exploration.setQuery("");
              setPlaceSearchOpen(false);
              chooseBeacon(activity.id, "search");
            }}
            onSelectPerson={(profile) => {
              rememberSearch(exploration.query);
              exploration.setQuery("");
              setPlaceSearchOpen(false);
              if (userId && selectFreshVisiblePersonLocation(data, profile.id, userId, now)) choosePerson(profile.id);
              else setPersonPreviewId(profile.id);
            }}
            onSelectPlace={(place) => {
              rememberSearch(exploration.query);
              exploreSavedPlace(place);
            }}
            onSelectRecent={chooseRecent}
            onChoosePlaceForNewBeacon={chooseKnownPlace}
            onStartPickingLocation={startPickingLocation}
          />
        </View>
      ) : null}

      {demo && mapIsFocused && !panel && !pickMode && !pickedMapPoint && !placeSearchOpen ? (
      <View pointerEvents="none" style={{ position: "absolute", top: headerTop + headerHeight + tokens.space.xl, left: tokens.space.md, right: tokens.space.md, alignItems: "flex-start", zIndex: 8 }}>
          <DemoChip />
        </View>
      ) : null}

      {createdNotice ? (
        <View accessibilityLiveRegion="polite" style={{ position: "absolute", top: headerTop + headerHeight + 8, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: colors.ink, zIndex: 20 }}>
          <Text style={{ color: colors.white, fontWeight: "700" }}>Beacon created</Text>
        </View>
      ) : null}

      {!pickMode && !pickedMapPoint ? (
        <View pointerEvents="box-none" style={{ position: "absolute", top: headerTop + headerHeight + 10, bottom: mapBottomClearance, right: 12, justifyContent: "center", gap: 12, zIndex: 8 }}>
          <MapControl label="Layers" onPress={() => setMapStyle((style) => style === "standard" ? "satellite" : "standard")}><Layers3 size={19} color={colors.green} /></MapControl>
          <MapControl label="Locate" onPress={() => setCompassSheetOpen(true)}><LocateFixed size={19} color={colors.green} /></MapControl>
          <MapControl label="Fit results" onPress={() => setControlCommand((previous) => ({ kind: "fit", revision: (previous?.revision ?? 0) + 1 }))}><Maximize2 size={18} color={colors.green} /></MapControl>
        </View>
      ) : null}

      {pickMode || pickedMapPoint ? (
        <View style={{ position: "absolute", bottom: insets.bottom + tokens.layout.tabBarHeight + 18, left: 14, right: 14, padding: 12, gap: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white + "F5", boxShadow: "0 8px 28px #142e3033", zIndex: 9 }}>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>{pickedMapPoint ? pickedMapPoint.label : "Tap the map to drop a pin"}</Text>
              <Text style={styles.muted}>{pickedMapPoint ? "Create a Beacon at this location." : "Choose a physical meeting point."}</Text>
            </View>
            <IconButton label="Cancel location selection" onPress={() => { setPickedMapPoint(null); setPickMode(false); }}><Text style={{ color: colors.green, fontSize: 19 }}>×</Text></IconButton>
          </View>
          {pickedMapPoint ? <Button title="Create Beacon here" onPress={createBeaconHere} /> : null}
        </View>
      ) : null}

      {person && !selected ? (
        <View testID="map-tooltip" style={{ position: "absolute", width: Math.min(width - 40, 350), left: Math.max(12, (width - Math.min(width - 40, 350)) / 2), top: Math.max(headerTop + headerHeight + 10, Math.min(height - 320, height * 0.34)), zIndex: 9 }}>
          <MapTooltip beaconId={null} personId={person} pinned={!!selectedPersonLocation} onDetails={() => router.push({ pathname: "/person/[id]", params: { id: person } })} onMessage={() => router.push({ pathname: "/messages/[id]", params: { id: person } })} onClose={() => { clearRouteSelection(); setPerson(null); }} />
        </View>
      ) : null}

      <MapResultsSheet
        ref={mapResultsRef}
        visibleActivities={synchronizedActivities}
        selectedId={selected}
        viewerCoordinate={viewerCoordinate}
        planCount={synchronizedPlanCount}
        loading={loading}
        offline={offline}
        clusterActivityIds={clusterActivityIds}
        clusterPeople={clusterPersonIds && userId ? data.profiles.filter((profile) => clusterPersonIds.includes(profile.id) && canViewProfile(data, profile, userId)) : []}
        clusterResetKey={resultResetKey}
        onSnapChange={(index) => setFilterSheetSnap(Math.max(0, Math.min(2, index)) as 0 | 1 | 2)}
        onSelect={(id) => chooseBeacon(id, "list")}
        onSelectPerson={choosePerson}
        onOpenDetail={openActivityDetails}
        onDirections={openDirections}
        onDismiss={() => { clearRouteSelection(); setSelected(null); setPerson(null); }}
        onClearFilters={resetFilters}
        onSearchWider={() => { exploration.setArea(null); setSearchAreaVisible(false); setControlCommand((previous) => ({ kind: "fit", revision: (previous?.revision ?? 0) + 1 })); }}
      />

      <MapPreviewCarousel
        visibleActivities={synchronizedActivities}
        selectedId={selected}
        viewerCoordinate={viewerCoordinate}
        onSelect={(id) => chooseBeacon(id, "preview")}
        onOpenDetail={openActivityDetails}
        onDirections={openDirections}
        onDismiss={() => { clearRouteSelection(); setSelected(null); }}
        hidden={filterSheetSnap > 0}
      />

      <AdvancedMapFilters
        visible={advancedFiltersOpen}
        onClose={() => setAdvancedFiltersOpen(false)}
        filters={exploration.filters}
        onChange={exploration.setFilters}
        audiences={mapAudiences}
        planOptions={planFilterOptions}
        resultCount={visibleActivities.length}
        selectedCategories={activeCategories}
        onCategoriesChange={(categories) => {
          setSelectedCategories(categories);
          if (exploration.filters.category !== "All categories") exploration.setFilters({ ...exploration.filters, category: "All categories" });
        }}
      />

      <MapCompassSheet
        visible={compassSheetOpen}
        onClose={() => { setCompassSheetOpen(false); setSearchPlaceOpen(false); }}
        busy={compassBusy}
        message={compassMessage}
        onUseMyLocation={() => void handleUseMyLocation()}
        onOpenSettings={openSettings}
        onReturnOverview={() => { setCompassSheetOpen(false); setControlCommand((previous) => ({ kind: "fit", revision: (previous?.revision ?? 0) + 1 })); setSearchAreaVisible(false); }}
        onExploreEverywhere={() => { exploration.setArea(null); setCompassSheetOpen(false); setControlCommand((previous) => ({ kind: "fit", revision: (previous?.revision ?? 0) + 1 })); setSearchAreaVisible(false); }}
        query={compassSearchQuery}
        onQueryChange={exploration.setQuery}
        onQuerySubmit={searchSubmit}
        searchPlaceOpen={searchPlaceOpen}
        onToggleSearchPlace={() => setSearchPlaceOpen(true)}
        places={searchPlaceResults}
        recentQueries={recentQueries}
        onChoosePlace={exploreSavedPlace}
        onSelectRecent={chooseRecent}
        onChooseWorldPlace={Platform.OS === "android" ? exploreGooglePlace : undefined}
      />

      {personPreviewId ? <PersonProfilePreview personId={personPreviewId} visible onClose={() => setPersonPreviewId(null)} /> : null}
      {squadPreviewId ? <SquadProfilePreview squadId={squadPreviewId} visible onClose={() => setSquadPreviewId(null)} /> : null}
      {organizationPreviewId ? (() => {
        const organization = data.organizations.find((row) => row.id === organizationPreviewId);
        const authorized = !!organization && !!userId && data.viewer_id === userId && !!activeOrganizationRole(organization, data.organization_members, userId) && !data.organization_bans.some((ban) => ban.organization_id === organization.id && ban.user_id === userId) && !data.blocks.some((block) => (block.blocker_id === organization.owner_id && block.blocked_id === userId) || (block.blocker_id === userId && block.blocked_id === organization.owner_id));
        return <Sheet title={authorized ? organization!.name : "Organization unavailable"} visible onClose={() => setOrganizationPreviewId(null)}>{authorized ? <><Text style={styles.h2}>{organization!.name}</Text><Txt muted>{organization!.description || "A shared organization."}</Txt><Button title="View organization" onPress={() => { const id = organization!.id; setOrganizationPreviewId(null); setTimeout(() => router.push({ pathname: "/organization/[id]", params: { id } }), 320); }} /></> : <Txt muted>This organization is unavailable.</Txt>}</Sheet>;
      })() : null}
    </KeyboardAvoidingView>
  );
}
