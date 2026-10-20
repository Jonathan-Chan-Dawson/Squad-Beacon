import { MyBeaconsSheet } from "../MyBeaconsSheet";
import { selectMyMapBeacons } from "../myBeacons";
import { discoveryActivities } from "@/src/features/beacons/discoverySelectors";
import { mapTooltip } from "../tooltipConstants";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  usePathname,
} from "expo-router";
import * as Location from "expo-location";
import * as Network from "expo-network";
import {
  Compass,
  Navigation,
  Radio,
  Sun,
  Moon,
  Cloud,
  CloudFog,
  CloudRain,
  CloudLightning,
  Snowflake,
  Layers,
  Globe2,
  LocateFixed,
  MapPin,
  Maximize,
  Plus,
  Settings2,
  UserRoundPlus,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BeaconMap, {
  type MapControlCommand,
  type MapStyle,
} from "@/src/features/maps/components/BeaconMap";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { matchesSearch } from "@/src/shared/search";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { creationHandoffParams } from "@/src/features/beacons/createHandoff";
import { Button, IconButton, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import { friendIds, locationIsFresh } from "@/src/shared/domain";
import { canViewProfile } from "@/src/features/profile/privacy";
import { publicMapBeacons } from "../publicMapDiscovery";
import { usePublicBeacons } from "@/src/features/discovery/usePublicBeacons";
import { PublicBeaconPreview } from "@/src/features/discovery/PublicBeaconPreview";
import { rankPublicBeaconSummaries } from "@/src/features/discovery/domain";
import { discoverBeacons, personDiscoveryReason } from "../discoveryRanking";
import type { SocialDirectorySummary } from "@/src/features/social/types";
import { performDirectoryAction } from "@/src/features/social/directoryActions";
import { SocialDirectorySummaryPreview } from "@/src/features/people/components/SocialDirectorySummaryCard";
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
import {
  MapExplorationHeader,
  type ActiveMapFilterChip,
  type MapQuickFilter,
} from "@/src/features/maps/MapExplorationHeader";
import {
  AdvancedMapFilters,
  type MapAudienceChoice,
} from "@/src/features/maps/AdvancedMapFilters";
import {
  matchesBeaconFilters,
  canReadBeaconMeetingDetails,
} from "@/src/features/maps/filtering";
import { MapPersonPreview } from "@/src/features/maps/MapPersonPreview";
import { MapNearbyPanel } from "@/src/features/maps/MapNearbyPanel";
import { MapCallout } from "@/src/features/maps/MapCallout";
import { BeaconOverviewSheet } from "@/src/features/maps/BeaconOverviewSheet";
import {
  beaconHasSquadParticipant,
  clusterPeople,
  showBeaconOnMap,
  withinMapBeaconWindow,
} from "@/src/features/maps/mapDiscovery";
import type { MapBeaconFeature } from "@/src/features/maps/mapBeaconFeatures";
import { SquadProfilePreview } from "@/src/features/people/previews/SquadProfilePreview";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { SpaceProfilePreview } from "@/src/features/spaces/SpaceProfilePreview";
import { activeOrganizationRole } from "@/src/features/organizations/domain";
import { uiHaptics, useReducedMotion } from "@/src/shared/design-system";
import { tokens } from "@/src/theme";
import { MapSearchOverlay } from "@/src/features/maps/MapSearchOverlay";
import { SonarSharingIndicator } from "@/src/features/maps/SonarSharingIndicator";
import {
  activeSonarSession,
  getRecentMapSearchQueries,
  rememberMapSearchQuery,
} from "@/src/features/maps/sessionHelpers";
import {
  mapAdvancedFilterCount,
  matchesSelectedCategories,
} from "@/src/features/maps/mapUIselectors";
import { MapTooltip } from "@/src/features/maps/MapTooltip";
import { physicalDirectionsUrl } from "@/src/features/maps/directions";
import { pulseCopy } from "@/src/features/pulse/copy/pulse";
import { usePulse } from "@/src/features/pulse/usePulse";
import type { PulsePlace, PulseAnswers } from "@/src/features/pulse/types";
import { PulsePlacePreview } from "@/src/features/pulse/components/PulsePlacePreview";
import { AddLiveUpdateSheet } from "@/src/features/pulse/components/AddLiveUpdateSheet";
import {
  areaPulsePlace,
  savedPulsePlace,
  nearPulsePlace,
} from "@/src/features/maps/pulseMapPolicy";
import { classifyPlaceCategory } from "@/src/features/maps/placeCategories";
import { MapControlPopover, MapNavigationRow } from "../MapControlPopover";
import { useMapWeather, weatherCondition } from "../mapWeather";
import { MapOptions, MapStyleControls } from "@/src/features/maps/MapOptions";
import { MapContextMenu } from "@/src/features/maps/MapContextMenu";
import {
  readMapDevicePreferences,
  writeMapDevicePreferences,
  defaultMapDevicePreferences,
} from "@/src/features/maps/mapDevicePreferences";

import {
  canReadMapPlan,
  mapContextKey,
  resolveMapContext,
  type MapContextFilter,
} from "../contextFilters";

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
  hint,
  onPress,
  children,
  expanded,
  selected,
  disabled,
}: {
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  label: string;
  hint?: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{
        ...(expanded === undefined ? {} : { expanded }),
        ...(selected === undefined ? {} : { selected }),
      }}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: selected ? colors.green : colors.line,
        backgroundColor: selected ? colors.lime + "66" : colors.white + "E8",
        boxShadow: "0 3px 12px #132d2926",
        opacity: disabled ? 0.55 : pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

function validPhysicalPlace(
  place: ActivityPlace,
): place is ActivityPlace & { latitude: number; longitude: number } {
  return (
    place.online_url == null &&
    place.latitude != null &&
    place.longitude != null &&
    isValidCoordinate({ latitude: place.latitude, longitude: place.longitude })
  );
}

export default function MapScreen() {
  const mapIsFocused = usePathname() === "/";
  const { colors, styles } = useTheme();
  const { showAvatars } = usePreferences();
  const reducedMotion = useReducedMotion();
  const [mapPreferences, setMapPreferences] = useState(
    defaultMapDevicePreferences,
  );
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [calm, setCalm] = useState(false);
  const [rightOpacity] = useState(() => new Animated.Value(1));
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureInProgress = useRef(false);
  const [pulseSelection, setPulseSelection] = useState<{
    scope: string;
    place: PulsePlace;
  } | null>(null);
  const [contextPoint, setContextPoint] = useState<{
    x: number;
    y: number;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [addUpdate, setAddUpdate] = useState(false);
  const [initialAnswers, setInitialAnswers] = useState<
    PulseAnswers | undefined
  >();
  const [pulsePopToken, setPulsePopToken] = useState(0);
  const [pulsePopPlaceKey, setPulsePopPlaceKey] = useState<
    string | undefined
  >();
  const [mapPreferenceError, setMapPreferenceError] = useState("");
  const [hintIndex, setHintIndex] = useState(3);
  const seenHint = useRef<number | null>(null);
  const [spacePreviewId, setSpacePreviewId] = useState<string | null>(null);

  const exploration = useExploration();
  const [discoveryHintDismissed, setDiscoveryHintDismissed] = useState(false);
  const nearMeArea = useRef<ExplorationArea | null>(null);
  useEffect(() => {
    if (exploration.area?.kind === "near-me" && exploration.area.coordinate)
      nearMeArea.current = exploration.area;
  }, [exploration.area]);
  const { data, userId, demo, loading, act, searchDirectory } = useBeacon();

  const params = useLocalSearchParams<{
    beacon?: string;
    person?: string;
    created?: string;
    search?: string;
    mapDiscovery?: string;
    mapPlan?: string;
    mapThread?: string;
    pickLocation?: string;
    inviteeIds?: string;
    statusSourceId?: string;
    startsAt?: string;
    fromMap?: string;
    latitude?: string;
    longitude?: string;
    placeLabel?: string;
    timezone?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [mapSize, setMapSize] = useState({ width, height });
  const now = useNow();
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [discoveryViewer, setDiscoveryViewer] = useState<string | null>(null);
  const discoveryActive = !!userId && discoveryViewer === userId;
  const discoveryRestore = useRef<{
    viewerId: string;
    camera: MapViewport | null;
    categories: Category[];
    selected: string | null;
    person: string | null;
    squad: string | null;
    detail: MapBeaconFeature | null;
    cameraChanged: boolean;
    categoriesChanged: boolean;
    selectionChanged: boolean;
  } | null>(null);
  const previousContextCamera = useRef<MapViewport | null>(null);
  const [contextState, setContextState] = useState<{
    viewerId: string | null;
    filters: MapContextFilter[];
  }>({ viewerId: userId, filters: [] });
  const contextViews = useMemo(
    () =>
      contextState.viewerId === userId && !discoveryActive
        ? contextState.filters.flatMap((filter) => {
            const view = resolveMapContext(data, userId, filter);
            return view ? [view] : [];
          })
        : [],
    [contextState, data, userId, discoveryActive],
  );
  const contextPoints = useMemo(
    () => [
      ...new Map(
        contextViews
          .flatMap((view) => view.points)
          .map((point) => [point.id, point]),
      ).values(),
    ],
    [contextViews],
  );
  const contextPaths = useMemo(
    () => contextViews.flatMap((view) => view.paths),
    [contextViews],
  );
  const [detailTab, setDetailTab] = useState<MapBeaconFeature | null>(null);
  const [squadPreviewId, setSquadPreviewId] = useState<string | null>(null);
  const [organizationPreviewId, setOrganizationPreviewId] = useState<
    string | null
  >(null);
  const [myBeaconsOpen, setMyBeaconsOpen] = useState(false);
  const myBeacons = selectMyMapBeacons(data, userId, now);
  const [compassBusy, setCompassBusy] = useState(false);
  const [compassMessage, setCompassMessage] = useState("");
  const [compassSheetOpen, setCompassSheetOpen] = useState(false);
  const [mapControlSettingsOpen, setMapControlSettingsOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [weatherButtonWidth, setWeatherButtonWidth] = useState(120);
  const [bearing, setBearing] = useState(0);
  const [sheetMapHeight, setSheetMapHeight] = useState<number | null>(null);

  const closePopovers = useCallback(() => {
    setCompassSheetOpen(false);
    setMapControlSettingsOpen(false);
    setWeatherOpen(false);
  }, []);
  const onSheetMapHeight = useCallback(
    (height: number) => {
      setSheetMapHeight(height);
      closePopovers();
    },
    [closePopovers],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [mapAnchor, setMapAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [clusterCenter, setClusterCenter] = useState<Coordinate | null>(null);
  const [clusterCoordinates, setClusterCoordinates] = useState<Coordinate[]>(
    [],
  );
  const countClusterPeople = useCallback(
    (members: import("@/src/features/maps/cluster").ClusterPoint[]) =>
      clusterPeople(
        data,
        members
          .filter((row) => row.kind === "beacon")
          .map((row) => row.id.slice(7)),
        members
          .filter((row) => row.kind === "person")
          .map((row) => row.id.slice(7)),
        userId,
      ).length,
    [data, userId],
  );
  const [clusterActivityIds, setClusterActivityIds] = useState<string[] | null>(
    null,
  );
  const [clusterPersonIds, setClusterPersonIds] = useState<string[] | null>(
    null,
  );
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const weather = useMapWeather(
    viewport,
    mapPreferences.showWeather && mapIsFocused,
  );
  const condition = weather.value
    ? weatherCondition(weather.value.code, weather.value.isDay)
    : null;
  const WeatherIcon =
    (
      {
        sun: Sun,
        moon: Moon,
        cloud: Cloud,
        fog: CloudFog,
        rain: CloudRain,
        storm: CloudLightning,
        snow: Snowflake,
      } as const
    )[condition?.icon as "sun"] ?? Cloud;

  useEffect(() => {
    // Defer dismissal to the next frame as route selection or map scale settles.
    const frame = requestAnimationFrame(closePopovers);
    return () => cancelAnimationFrame(frame);
  }, [selected, person, detailTab, closePopovers]);
  useEffect(() => {
    if (weather.visible) return;
    const frame = requestAnimationFrame(() => setWeatherOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [weather.visible]);

  const [targetRevision, setTargetRevision] = useState(0);
  const pulse = usePulse({
    enabled: preferencesReady && mapPreferences.liveUpdates && mapIsFocused,
    bounds: viewport?.bounds ?? null,
    zoom: viewport?.zoom ?? 13,
  });
  const pulseScopeKey = pulse.scopeKey;
  const scopedPlace =
    pulseSelection?.scope === pulseScopeKey ? pulseSelection.place : null;
  const pulsePlace =
    scopedPlace?.placeKey.startsWith("saved:") &&
    !data.places.some((place) => {
      const activity = data.activities.find(
        (item) => item.id === place.activity_id,
      );
      return (
        !!userId &&
        data.viewer_id === userId &&
        !!activity &&
        canReadBeaconActivity(data, activity, userId) &&
        canReadBeaconMeetingDetails(data, activity, userId) &&
        savedPulsePlace(place)?.placeKey === scopedPlace.placeKey
      );
    })
      ? null
      : scopedPlace;
  function setPulsePlace(place: PulsePlace | null) {
    setPulseSelection(place ? { scope: pulseScopeKey, place } : null);
  }
  function dismissLocationMenu() {
    setContextPoint(null);
    if (contextPoint) setPulsePlace(null);
  }
  useEffect(() => {
    // Clear stale map anchors after the provider/focus transition settles.
    const frame = requestAnimationFrame(() => {
      if (!pulsePlace) setContextPoint(null);
      else if (!mapIsFocused && contextPoint) {
        setContextPoint(null);
        setPulseSelection(null);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [mapIsFocused, pulsePlace, contextPoint]);

  const knownPulsePlaces = useMemo(
    () => [
      ...(pulse.demoPlaces ?? []),
      ...data.places.flatMap((place) => {
        const activity = data.activities.find(
          (item) => item.id === place.activity_id,
        );
        if (
          !userId ||
          !activity ||
          !canReadBeaconActivity(data, activity, userId) ||
          !canReadBeaconMeetingDetails(data, activity, userId)
        )
          return [];
        const result = savedPulsePlace(place);
        return result ? [result] : [];
      }),
    ],
    [data, userId, pulse.demoPlaces],
  );
  const placeSummary =
    mapPreferences.liveUpdates && pulsePlace
      ? pulse.summaries.find(
          (summary) => summary.placeKey === pulsePlace.placeKey,
        )
      : undefined;

  const [mapStyle, setMapStyle] = useState<MapStyle>("standard");
  const [controlCommand, setControlCommand] = useState<
    MapControlCommand | undefined
  >();
  const [selectedCategories, setCategoriesValue] = useState<Category[]>(() =>
    exploration.filters.category === "All categories"
      ? []
      : [exploration.filters.category],
  );
  const setSelectedCategories = useCallback((categories: Category[]) => {
    if (discoveryRestore.current)
      discoveryRestore.current.categoriesChanged = true;
    setCategoriesValue(categories);
  }, []);
  const [recentSearchState, setRecentSearchState] = useState(() => ({
    viewerId: userId,
    queries: getRecentMapSearchQueries(userId),
  }));
  const [offline, setOffline] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const creationLocationContext = useRef<Record<string, string>>({});
  const [pickedMapPoint, setPickedMapPoint] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const processedRouteSelection = useRef<string | null>(null);
  const clearRouteSelection = useCallback(() => {
    processedRouteSelection.current = JSON.stringify([
      userId,
      params.beacon ?? "",
      params.person ?? "",
    ]);
    router.setParams({ beacon: undefined, person: undefined });
  }, [userId, params.beacon, params.person]);
  useEffect(() => {
    if (
      !preferencesReady ||
      hintIndex >= 3 ||
      pulsePlace ||
      placeSearchOpen ||
      optionsOpen ||
      calm ||
      seenHint.current === hintIndex
    )
      return;
    seenHint.current = hintIndex;
    void writeMapDevicePreferences({ hintsSeen: hintIndex + 1 }).catch(
      () => {},
    );
  }, [
    preferencesReady,
    hintIndex,
    pulsePlace,
    placeSearchOpen,
    optionsOpen,
    calm,
  ]);
  useEffect(() => {
    let active = true;
    void readMapDevicePreferences()
      .then((preferences) => {
        if (!active) return;
        setMapPreferences(preferences);
        setHintIndex(preferences.hintsSeen);
        setMapStyle(preferences.style);
        if (!exploration.area && preferences.camera)
          exploration.setArea({
            kind: "viewport",
            label: "Last map view",
            coordinate: preferences.camera.center,
            zoom: preferences.camera.zoom,
            bounds: preferences.camera.bounds,
          });
        setPreferencesReady(true);
      })
      .catch(() => {
        if (active) {
          setPreferencesReady(true);
          setMapPreferenceError("Map preferences could not be loaded.");
        }
      });
    return () => {
      active = false;
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // Restore once. Later user camera selections always win.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    Animated.timing(rightOpacity, {
      toValue: calm ? 0.4 : 1,
      duration: reducedMotion ? 120 : 180,
      useNativeDriver: true,
    }).start();
  }, [calm, reducedMotion, rightOpacity]);
  function updateMapPreference(patch: Partial<typeof mapPreferences>) {
    setMapPreferences((current) => ({ ...current, ...patch }));
    void writeMapDevicePreferences(patch).catch(() =>
      setMapPreferenceError(
        "This map preference could not be saved. Try again.",
      ),
    );
  }
  function gestureChanged(active: boolean) {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (active) {
      if (gestureInProgress.current) return;
      gestureInProgress.current = true;
      setCalm(true);
      dismissLocationMenu();
    } else
      idleTimer.current = setTimeout(() => {
        setCalm(false);
        gestureInProgress.current = false;
      }, 400);
  }
  function choosePulsePlace(place: PulsePlace) {
    setCompassSheetOpen(false);
    const existing = mapPreferences.liveUpdates
      ? pulse.summaries.find(
          (summary) =>
            summary.placeKey === place.placeKey && summary.recentCount > 0,
        )
      : undefined;
    // Preserve the provider name while using this exact place's canonical
    // identity. Nearby-name matching must never select another update target.
    const canonicalPlace = existing
      ? {
          ...place,
          category: existing.category,
        }
      : place;
    clearRouteSelection();
    setSelected(null);
    setPerson(null);
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setContextPoint(null);
    setPulsePlace(canonicalPlace);
    setAddUpdate(false);
    setInitialAnswers(undefined);
    setPlaceSearchOpen(false);
    setPickMode(false);
    setPickedMapPoint(null);
  }
  function openAddUpdate(answers?: PulseAnswers) {
    if (!mapPreferences.liveUpdates) updateMapPreference({ liveUpdates: true });
    setInitialAnswers(answers);
    setContextPoint(null);
    setAddUpdate(true);
  }
  function createAtPulsePlace() {
    if (!pulsePlace) return;
    dismissLocationMenu();
    router.push({
      pathname: "/create",
      params: {
        latitude: String(pulsePlace.lat),
        longitude: String(pulsePlace.lng),
        placeLabel: pulsePlace.name,
      },
    });
  }
  function directionsAtPulsePlace() {
    if (!pulsePlace) return;
    const url = physicalDirectionsUrl(pulsePlace.lat, pulsePlace.lng);
    dismissLocationMenu();
    if (url) void Linking.openURL(url).catch(() => {});
  }

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
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [params.created]);
  useEffect(() => {
    let mounted = true;
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted)
          setOffline(
            state.isConnected === false || state.isInternetReachable === false,
          );
      } catch {
        if (mounted) setOffline(false);
      }
    };
    void checkNetwork();
    const timer = setInterval(() => void checkNetwork(), 25_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const snapshotReady = !!userId && data.viewer_id === userId;
  const friends = friendIds(data, userId ?? "");
  const selectedPersonLocation =
    person && userId && (person === userId || friends.includes(person))
      ? selectFreshVisiblePersonLocation(data, person, userId, now)
      : undefined;
  const routeSelectedPersonLocation =
    params.person &&
    userId &&
    (params.person === userId || friends.includes(params.person))
      ? selectFreshVisiblePersonLocation(data, params.person, userId, now)
      : undefined;

  const discoveryIds = useMemo(
    () =>
      discoveryActive
        ? new Set(
            (["Active", "Upcoming"] as const)
              .flatMap((period) =>
                discoveryActivities(
                  data,
                  userId,
                  now,
                  period,
                  exploration.query,
                  { ...exploration.filters, categories: selectedCategories },
                  exploration.area,
                ),
              )
              .map((activity) => activity.id),
          )
        : null,
    [
      discoveryActive,
      data,
      userId,
      now,
      exploration.query,
      exploration.filters,
      exploration.area,
      selectedCategories,
    ],
  );

  const safeActivities = useMemo(() => {
    if (!userId || data.viewer_id !== userId) return [];
    const selectedSquad = data.squads.find(
      (row) => row.id === exploration.filters.audience,
    );
    const categories = selectedCategories.length
      ? selectedCategories
      : exploration.filters.category === "All categories"
        ? []
        : [exploration.filters.category];
    return data.activities
      .filter((activity) => canReadBeaconActivity(data, activity, userId))
      .filter((activity) => withinMapBeaconWindow(activity, now))
      .filter((activity) => !discoveryIds || discoveryIds.has(activity.id))
      .filter(
        (activity) =>
          !discoveryActive ||
          (activity.mode !== "solo" &&
            !(
              activity.plan_id &&
              activity.plan_step &&
              activity.plan_started_at == null
            )),
      )
      .filter((activity) =>
        matchesBeaconFilters(
          data,
          activity,
          userId,
          selectedSquad
            ? { ...exploration.filters, audience: "Everyone" }
            : exploration.filters,
          now,
          {
            query: exploration.query,
          },
        ),
      )
      .filter(
        (activity) =>
          !selectedSquad ||
          beaconHasSquadParticipant(data, activity, selectedSquad.id, userId),
      )
      .filter((activity) =>
        matchesSelectedCategories(activity.category, categories),
      );
  }, [
    data,
    exploration.filters,
    exploration.query,
    now,
    selectedCategories,
    userId,
    discoveryActive,
    discoveryIds,
  ]);

  const availabilityActivities = useMemo(
    () =>
      snapshotReady && userId
        ? data.activities.filter((activity) =>
            canReadBeaconActivity(data, activity, userId),
          )
        : [],
    [data, snapshotReady, userId],
  );

  const safePlaces = useMemo(
    () =>
      data.places.filter((place) => {
        const activity = data.activities.find(
          (candidate) => candidate.id === place.activity_id,
        );
        return (
          !!userId &&
          !!activity &&
          canReadBeaconActivity(data, activity, userId) &&
          canReadBeaconMeetingDetails(data, activity, userId)
        );
      }),
    [data, userId],
  );

  const normalActivities = useMemo(
    () =>
      safeActivities.filter(
        (activity) =>
          !!userId &&
          showBeaconOnMap(
            data,
            activity,
            userId,
            {
              personId: discoveryActive ? null : person,
              squadId:
                (discoveryActive ? null : squadPreviewId) ??
                exploration.filters.audience,
            },
            now,
          ),
      ),
    [
      safeActivities,
      discoveryActive,
      userId,
      data,
      person,
      squadPreviewId,
      exploration.filters.audience,
      now,
    ],
  );
  const activities = useMemo(
    () => [
      ...new Map(
        [
          ...normalActivities,
          ...contextViews.flatMap((view) => view.activities),
        ].map((activity) => [activity.id, activity]),
      ).values(),
    ],
    [normalActivities, contextViews],
  );

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
      const place = safePlaces.find(
        (candidate) => candidate.activity_id === activity.id,
      );
      return (
        place?.online_url != null ||
        matchesExplorationArea(
          visibleArea,
          place && validPhysicalPlace(place)
            ? { latitude: place.latitude, longitude: place.longitude }
            : null,
        )
      );
    });
  }, [activities, safePlaces, viewport]);

  const visiblePlans = useMemo(
    () =>
      userId && data.viewer_id === userId
        ? data.plans.filter((plan) => canReadMapPlan(data, plan, userId))
        : [],
    [data, userId],
  );
  const planFilterOptions = useMemo(
    () =>
      visiblePlans.map((plan) => {
        const sameTitle = visiblePlans.filter(
          (other) => other.title === plan.title,
        );
        const sameDate = sameTitle.filter(
          (other) => other.start_date === plan.start_date,
        );
        return {
          id: plan.id,
          label:
            sameTitle.length === 1
              ? plan.title
              : `${plan.title} · ${plan.start_date}${sameDate.length > 1 ? ` · ${plan.id.slice(0, 8)}` : ""}`,
        };
      }),
    [visiblePlans],
  );

  const mapAudiences = useMemo<MapAudienceChoice[]>(
    () =>
      userId && data.viewer_id === userId
        ? [
            ...data.lists
              .filter((list) => {
                const owner = data.profiles.find(
                  (profile) => profile.id === list.owner_id,
                );
                const member =
                  list.owner_id === userId ||
                  data.list_members.some(
                    (row) => row.list_id === list.id && row.user_id === userId,
                  );
                const blocked = data.blocks.some(
                  (row) =>
                    (row.blocker_id === list.owner_id &&
                      row.blocked_id === userId) ||
                    (row.blocker_id === userId &&
                      row.blocked_id === list.owner_id),
                );
                return (
                  member &&
                  !blocked &&
                  (list.owner_id === userId ||
                    (!!owner && canViewProfile(data, owner, userId)))
                );
              })
              .map((list) => ({
                id: list.id,
                label: list.name,
                kind: "List" as const,
              })),
            ...data.squads
              .filter((squad) => canOpenSquadProfile(data, squad.id, userId))
              .map((squad) => ({
                id: squad.id,
                label: squad.name,
                kind: "Squad" as const,
              })),
            ...data.organizations
              .filter((organization) => {
                if (
                  !activeOrganizationRole(
                    organization,
                    data.organization_members,
                    userId,
                  )
                )
                  return false;
                if (
                  data.organization_bans.some(
                    (ban) =>
                      ban.organization_id === organization.id &&
                      ban.user_id === userId,
                  )
                )
                  return false;
                return !data.blocks.some(
                  (block) =>
                    (block.blocker_id === organization.owner_id &&
                      block.blocked_id === userId) ||
                    (block.blocker_id === userId &&
                      block.blocked_id === organization.owner_id),
                );
              })
              .map((organization) => ({
                id: organization.id,
                label: organization.name,
                kind: "Organization" as const,
              })),
          ]
        : [],
    [data, userId],
  );

  const mapLocations = useMemo(
    () =>
      data.locations.filter((location) => {
        if (
          discoveryActive ||
          !snapshotReady ||
          !userId ||
          (location.owner_id !== userId &&
            !friends.includes(location.owner_id)) ||
          !showAvatars ||
          !mapPreferences.showFriends ||
          !locationIsFresh(location, new Date(now))
        )
          return false;
        if (
          location.latitude == null ||
          location.longitude == null ||
          !isValidCoordinate({
            latitude: location.latitude,
            longitude: location.longitude,
          })
        )
          return false;
        const isSelectedPerson = selectedPersonLocation?.id === location.id;
        const audience = exploration.filters.audience;
        const accessibleSquadIds = data.squads
          .filter((squad) => canOpenSquadProfile(data, squad.id, userId))
          .map((squad) => squad.id);
        const audienceMatches =
          isSelectedPerson ||
          audience === "Everyone" ||
          (audience === "Friends"
            ? friends.includes(location.owner_id)
            : audience === "Public"
              ? false
              : audience === "Squads"
                ? data.squad_members.some(
                    (member) =>
                      member.user_id === location.owner_id &&
                      accessibleSquadIds.includes(member.squad_id),
                  )
                : data.squad_members.some(
                    (member) =>
                      member.user_id === location.owner_id &&
                      member.squad_id === audience,
                  ));
        if (
          !audienceMatches ||
          !canViewProfile(data, location.owner_id, userId)
        )
          return false;
        return true;
      }),
    [
      data,
      exploration.filters.audience,
      friends,
      now,
      selectedPersonLocation?.id,
      discoveryActive,
      showAvatars,
      mapPreferences.showFriends,
      snapshotReady,
      userId,
    ],
  );

  const query = exploration.query.trim();
  const publicDiscovery = usePublicBeacons(
    query,
    exploration.area?.coordinate ?? viewport?.center,
  );
  const [publicSelection, setPublicSelection] = useState<string | null>(null);
  const rankedPublic = rankPublicBeaconSummaries(
    publicDiscovery.rows,
    data.profiles.find((row) => row.id === userId)?.interests ?? [],
    exploration.area?.label ?? null,
    now,
  );
  const selectedPublic = publicDiscovery.rows.find(
    (row) => row.activity_id === publicSelection,
  );
  const publicMapRows = publicMapBeacons(
    rankedPublic,
    exploration.filters,
    selectedCategories,
    activities.map((row) => row.id),
    !!contextViews.length,
    viewport,
    now,
  );
  const hasVisibleBeacons = visibleActivities.some((activity) =>
    safePlaces.some(
      (place) => place.activity_id === activity.id && validPhysicalPlace(place),
    ),
  );
  const hasVisiblePeople = mapLocations.some(
    (row) =>
      !viewport ||
      matchesExplorationArea(
        {
          kind: "viewport",
          label: "Visible area",
          coordinate: viewport.center,
          zoom: viewport.zoom,
          bounds: viewport.bounds,
        },
        row.latitude != null && row.longitude != null
          ? { latitude: row.latitude, longitude: row.longitude }
          : null,
      ),
  );
  const publicPoints = publicMapRows.map((row) => ({
    id: `public:${row.activity_id}`,
    publicBeaconId: row.activity_id,
    category: row.category,
    title: row.title,
    latitude: row.coarse_lat!,
    longitude: row.coarse_lng!,
    suggestion: false,
  }));
  function choosePublicBeacon(id: string) {
    if (discoveryRestore.current) {
      discoveryRestore.current.selectionChanged = true;
      discoveryRestore.current.cameraChanged = true;
    }
    setCompassSheetOpen(false);
    setSelected(null);
    setPerson(null);
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setPulsePlace(null);
    setPublicSelection(id);
    setPlaceSearchOpen(false);
    const row = publicDiscovery.rows.find((item) => item.activity_id === id);
    if (row?.coarse_lat != null && row.coarse_lng != null)
      exploration.setArea({
        kind: "place",
        label: row.area_label,
        coordinate: { latitude: row.coarse_lat, longitude: row.coarse_lng },
        zoom: 13,
        source: "saved",
      });
  }

  const searchActivityResults = userId
    ? discoverBeacons(
        data,
        userId,
        query,
        now,
        exploration.area?.coordinate ?? viewport?.center,
      ).slice(0, 5)
    : [];
  const searchPeopleResults: Profile[] =
    snapshotReady && userId
      ? data.profiles
          .filter(
            (profile) =>
              profile.id !== userId &&
              canViewProfile(data, profile, userId) &&
              matchesSearch(
                query,
                profile.name,
                profile.username,
                profile.bio,
                ...(profile.interests ?? []),
              ),
          )
          .sort(
            (a, b) =>
              Number(friends.includes(b.id)) - Number(friends.includes(a.id)) ||
              a.name.localeCompare(b.name),
          )
          .slice(0, query ? 5 : 3)
      : [];
  const [directoryResult, setDirectoryResult] = useState<{
    snapshot: typeof data;
    rows: SocialDirectorySummary[];
    query: string;
    error?: string;
  } | null>(null);
  const [directorySelection, setDirectorySelection] = useState<string | null>(
    null,
  );
  useEffect(() => {
    if (!snapshotReady) return;
    let current = true;
    const timer = setTimeout(() => {
      void searchDirectory({ query, pageSize: 20 })
        .then((rows) => {
          if (current) setDirectoryResult({ snapshot: data, rows, query });
        })
        .catch(() => {
          if (current)
            setDirectoryResult({
              snapshot: data,
              rows: [],
              query,
              error: "Communities could not load. Try again.",
            });
        });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [data, query, searchDirectory, snapshotReady]);
  const directoryRows =
    directoryResult?.snapshot === data && directoryResult.query === query
      ? directoryResult.rows
      : [];
  const selectedDirectory =
    directoryRows.find(
      (row) => `${row.entity_type}:${row.entity_id}` === directorySelection,
    ) ?? null;
  const communityKind = {
    squad: "Squads",
    space: "Spaces",
    organization: "Organizations",
  } as const;
  const searchPlaceResults = safePlaces
    .filter(
      (place) =>
        validPhysicalPlace(place) &&
        safeActivities.some((activity) => activity.id === place.activity_id) &&
        (!query || matchesSearch(query, place.label)),
    )
    .slice(0, 8);

  const visibleActivityIds = activities.map((activity) => activity.id);
  const clusterPriorities = userId
    ? deriveMapPointPriorities(
        data,
        userId,
        visibleActivityIds,
        showAvatars ? mapLocations.map((location) => location.owner_id) : [],
        now,
      )
    : {};
  for (const row of publicMapRows)
    clusterPriorities[`beacon:${row.activity_id}`] = {
      tier:
        Date.parse(row.starts_at) <= now && Date.parse(row.ends_at) > now
          ? 2
          : 6,
    };
  for (const point of contextPoints)
    if (point.activityId)
      clusterPriorities[`beacon:${point.activityId}`] = {
        ...clusterPriorities[`beacon:${point.activityId}`],
        tier: Math.min(
          clusterPriorities[`beacon:${point.activityId}`]?.tier ?? 7,
          (viewport?.zoom ?? 13) >= 16 ? -1 : 1,
        ),
        affinity: 10,
      };
  if (selected)
    clusterPriorities[`beacon:${selected}`] = {
      ...clusterPriorities[`beacon:${selected}`],
      tier: -3,
    };
  if (person)
    clusterPriorities[`person:${person}`] = {
      ...clusterPriorities[`person:${person}`],
      tier: -3,
    };
  const focusedBeacon =
    selected && userId
      ? data.activities.find(
          (activity) =>
            activity.id === selected &&
            canReadBeaconActivity(data, activity, userId),
        )
      : undefined;
  const hostLink = focusedBeacon
    ? data.activity_social_links.find(
        (row) => row.activity_id === focusedBeacon.id,
      )
    : undefined;
  const hostingCommunity = directoryRows.find((row) =>
    hostLink
      ? row.entity_type === hostLink.entity_type &&
        row.entity_id === hostLink.entity_id
      : focusedBeacon?.audience_id === row.entity_id &&
        focusedBeacon.audience === row.entity_type,
  );
  function openCommunity(row: SocialDirectorySummary) {
    setPlaceSearchOpen(false);
    if (row.action !== "joined")
      setDirectorySelection(`${row.entity_type}:${row.entity_id}`);
    else if (row.entity_type === "squad") setSquadPreviewId(row.entity_id);
    else if (row.entity_type === "space") setSpacePreviewId(row.entity_id);
    else setOrganizationPreviewId(row.entity_id);
  }
  const focusedPlace = focusedBeacon
    ? safePlaces.find(
        (place) =>
          place.activity_id === focusedBeacon.id && validPhysicalPlace(place),
      )
    : undefined;
  const focusedCoordinate =
    person &&
    selectedPersonLocation?.latitude != null &&
    selectedPersonLocation.longitude != null
      ? {
          latitude: selectedPersonLocation.latitude,
          longitude: selectedPersonLocation.longitude,
        }
      : focusedPlace
        ? {
            latitude: focusedPlace.latitude!,
            longitude: focusedPlace.longitude!,
          }
        : null;
  const panel = !!selected || !!person;
  const baseExplorationTarget = useMemo(
    () => explorationAreaTarget(exploration.area),
    [exploration.area],
  );
  const explorationTarget = useMemo(
    () =>
      baseExplorationTarget
        ? {
            ...baseExplorationTarget,
            revision: exploration.areaRevision + targetRevision,
          }
        : null,
    [baseExplorationTarget, exploration.areaRevision, targetRevision],
  );
  const activeCategories = useMemo(
    () =>
      selectedCategories.length
        ? selectedCategories
        : exploration.filters.category === "All categories"
          ? []
          : [exploration.filters.category],
    [exploration.filters.category, selectedCategories],
  );
  const activeFilterCount = mapAdvancedFilterCount(
    exploration.filters,
    activeCategories,
  );

  const activeChips = useMemo<ActiveMapFilterChip[]>(() => {
    const chips: ActiveMapFilterChip[] = [];
    const audienceLabel =
      exploration.filters.audience === "Everyone"
        ? ""
        : exploration.filters.audience === "Friends" ||
            exploration.filters.audience === "Public" ||
            exploration.filters.audience === "Squads"
          ? exploration.filters.audience
          : (mapAudiences.find(
              (option) => option.id === exploration.filters.audience,
            )?.label ?? "Group");
    if (audienceLabel) chips.push({ key: "audience", label: audienceLabel });
    if (exploration.filters.time !== "All")
      chips.push({ key: "time", label: exploration.filters.time });
    if (exploration.filters.when && exploration.filters.when !== "Any")
      chips.push({ key: "when", label: exploration.filters.when });
    activeCategories.forEach((category) =>
      chips.push({ key: `category:${category}`, label: category }),
    );
    if (exploration.filters.join && exploration.filters.join !== "Any")
      chips.push({ key: "join", label: exploration.filters.join });
    if (exploration.filters.format && exploration.filters.format !== "Any")
      chips.push({ key: "format", label: exploration.filters.format });
    if (exploration.filters.starredOnly)
      chips.push({ key: "starred", label: "Starred only" });
    if (exploration.filters.planId)
      chips.push({
        key: "plan",
        label:
          planFilterOptions.find(
            (plan) => plan.id === exploration.filters.planId,
          )?.label ?? "Plan",
      });
    chips.push(
      ...contextViews.map((view) => ({ key: view.key, label: view.label })),
    );
    if (discoveryActive) chips.unshift({ key: "discovery", label: "Beacons" });
    return chips;
  }, [
    activeCategories,
    discoveryActive,
    exploration.filters,
    mapAudiences,
    planFilterOptions,
    contextViews,
  ]);

  const selectedQuickFilter: MapQuickFilter | null =
    exploration.filters.audience === "Friends"
      ? "Friends"
      : exploration.filters.audience === "Squads"
        ? "Squads"
        : exploration.filters.audience === "Public"
          ? "Public"
          : "All";

  const activeSonar = activeSonarSession(data.locations, userId, now);
  const recentQueries =
    recentSearchState.viewerId === userId
      ? recentSearchState.queries
      : getRecentMapSearchQueries(userId);

  useEffect(() => {
    if (!userId || data.viewer_id !== userId) return;
    const routeSelection = JSON.stringify([
      userId,
      params.beacon ?? "",
      params.person ?? "",
    ]);
    if (processedRouteSelection.current === routeSelection) return;
    const frame = requestAnimationFrame(() => {
      processedRouteSelection.current = routeSelection;
      const validBeacon =
        !!params.beacon &&
        data.activities.some(
          (activity) =>
            activity.id === params.beacon &&
            canReadBeaconActivity(data, activity, userId),
        );
      const validPerson =
        !!params.person && canViewProfile(data, params.person, userId);
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

  useFocusEffect(
    useCallback(() => {
      if (!snapshotReady || !userId) return;
      if (
        selected &&
        !data.activities.some(
          (activity) =>
            activity.id === selected &&
            canReadBeaconActivity(data, activity, userId),
        )
      ) {
        setSelected(null);
        router.setParams({ beacon: undefined });
      }
      if (person && !canViewProfile(data, person, userId)) {
        setPerson(null);
        router.setParams({ person: undefined });
      }
    }, [data, person, selected, snapshotReady, userId, setSelected, setPerson]),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setClusterActivityIds(null);
      setClusterPersonIds(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [
    exploration.query,
    exploration.filters,
    selectedCategories,
    exploration.areaRevision,
  ]);

  function rememberSearch(value: string) {
    const next = rememberMapSearchQuery(value, userId);
    setRecentSearchState({ viewerId: userId, queries: next });
  }

  function chooseBeacon(id: string) {
    if (discoveryRestore.current) {
      discoveryRestore.current.selectionChanged = true;
      discoveryRestore.current.cameraChanged = true;
    }
    setCompassSheetOpen(false);
    setDetailTab(null);
    if (
      !userId ||
      !data.activities.some(
        (activity) =>
          activity.id === id && canReadBeaconActivity(data, activity, userId),
      )
    )
      return;
    uiHaptics.light();
    setPulsePlace(null);
    setContextPoint(null);
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(id);
    setPerson(null);
    setPlaceSearchOpen(false);
    setPickMode(false);
    setPickedMapPoint(null);
  }

  function choosePerson(id: string) {
    if (discoveryRestore.current) {
      discoveryRestore.current.selectionChanged = true;
      discoveryRestore.current.cameraChanged = true;
    }
    setCompassSheetOpen(false);
    if (
      !userId ||
      data.viewer_id !== userId ||
      !canViewProfile(data, id, userId)
    )
      return;
    uiHaptics.light();
    setDetailTab(null);
    setPulsePlace(null);
    setContextPoint(null);
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setPerson(id);
    setSelected(null);
    setPlaceSearchOpen(false);
  }

  const startPickingLocation = useCallback(() => {
    creationLocationContext.current = {};
    setDetailTab(null);
    setCompassSheetOpen(false);
    setPulseSelection(null);
    setContextPoint(null);
    setPublicSelection(null);
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(null);
    setPerson(null);
    setPickedMapPoint((point) =>
      point && isValidCoordinate(point) ? point : null,
    );
    setPickMode(true);
    setPlaceSearchOpen(false);
  }, [
    clearRouteSelection,
    setDetailTab,
    setCompassSheetOpen,
    setPulseSelection,
    setContextPoint,
    setPublicSelection,
    setClusterActivityIds,
    setClusterPersonIds,
    setSelected,
    setPerson,
    setPickedMapPoint,
    setPickMode,
    setPlaceSearchOpen,
  ]);

  useEffect(() => {
    if (params.pickLocation !== "yes") return;
    const frame = requestAnimationFrame(() => {
      startPickingLocation();
      const context = creationHandoffParams(params);
      creationLocationContext.current = context;
      if (context.latitude && context.longitude)
        setPickedMapPoint({
          latitude: Number(context.latitude),
          longitude: Number(context.longitude),
          label: context.placeLabel || "Pinned map location",
        });
      router.setParams({
        pickLocation: undefined,
        inviteeIds: undefined,
        statusSourceId: undefined,
        startsAt: undefined,
        fromMap: undefined,
        latitude: undefined,
        longitude: undefined,
        placeLabel: undefined,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [params, startPickingLocation]);

  function exploreSavedPlace(place: ActivityPlace) {
    if (discoveryRestore.current) discoveryRestore.current.cameraChanged = true;
    if (!validPhysicalPlace(place)) return;
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(null);
    setPerson(null);
    setPickMode(false);
    setPickedMapPoint(null);
    exploration.setQuery("");
    exploration.setArea({
      kind: "place",
      label: place.label,
      coordinate: { latitude: place.latitude, longitude: place.longitude },
      zoom: 16,
      source: "saved",
    });
    const saved = savedPulsePlace(place);
    if (saved) {
      const summary = pulse.summaries.find(
        (item) => item.placeKey === saved.placeKey,
      );
      choosePulsePlace(
        summary
          ? { ...saved, placeKey: summary.placeKey, category: summary.category }
          : saved,
      );
    }
    setPlaceSearchOpen(false);
    setCompassSheetOpen(false);
  }

  function exploreWorldPlace(place: WorldwidePlace) {
    if (discoveryRestore.current) discoveryRestore.current.cameraChanged = true;
    if (!isValidCoordinate(place.coordinate)) return;
    clearRouteSelection();
    setClusterActivityIds(null);
    setClusterPersonIds(null);
    setSelected(null);
    setPerson(null);
    setPickMode(false);
    setPickedMapPoint(null);
    exploration.setQuery("");
    const isCity = [
      "locality",
      "administrative_area_level_1",
      "administrative_area_level_2",
      "country",
    ].includes(place.primaryType ?? "");
    setPublicSelection(null);
    exploration.setArea({
      kind: "place",
      label: place.label,
      coordinate: place.coordinate,
      zoom: isCity ? 12 : 16,
      source: place.id.startsWith("demo-city:")
        ? "demo"
        : Platform.OS === "android"
          ? "google"
          : "osm",
      attributions: place.attributions,
    });
    if (!isCity)
      choosePulsePlace({
        placeKey: place.id,
        name: place.label,
        lat: place.coordinate.latitude,
        lng: place.coordinate.longitude,
        category: classifyPlaceCategory(
          place.primaryType ? [place.primaryType] : [],
        ),
      });
    setPlaceSearchOpen(false);
    if (isCity) setPulsePlace(null);
    setCompassSheetOpen(false);
  }

  function handleViewportChange(next: MapViewport, userMoved = true) {
    setViewport(next);
    if (discoveryActive && userMoved && discoveryRestore.current)
      discoveryRestore.current.cameraChanged = true;
    if (preferencesReady && (!discoveryActive || userMoved))
      void writeMapDevicePreferences({ camera: next }).catch(() => {});
    if (userMoved) {
      setClusterActivityIds(null);
      setClusterPersonIds(null);
    }
  }

  function resetFilters() {
    exploration.setFilters(defaultFilters);
    setSelectedCategories([]);
  }

  const focusContext = useCallback(
    (filter: MapContextFilter) => {
      const view = resolveMapContext(data, userId, filter);
      if (!view) return;
      if (!contextViews.length) previousContextCamera.current = viewport;
      clearRouteSelection();
      setSelected(null);
      setPerson(null);
      setDetailTab(null);
      setClusterActivityIds(null);
      setClusterPersonIds(null);
      setContextState((current) => ({
        viewerId: userId,
        filters: [
          ...(current.viewerId === userId
            ? current.filters.filter((item) => mapContextKey(item) !== view.key)
            : []),
          filter,
        ],
      }));
      if (view.points.length)
        setControlCommand((previous) => ({
          kind: "fit",
          coordinates: view.points,
          revision: (previous?.revision ?? 0) + 1,
        }));
    },
    [
      data,
      userId,
      contextViews.length,
      viewport,
      clearRouteSelection,
      setSelected,
      setPerson,
      setDetailTab,
      setClusterActivityIds,
      setClusterPersonIds,
      setContextState,
      setControlCommand,
    ],
  );

  useEffect(() => {
    if (!params.mapPlan && !params.mapThread) return;
    if (!snapshotReady) return;
    const frame = requestAnimationFrame(() => {
      if (params.mapPlan) focusContext({ kind: "plan", id: params.mapPlan });
      if (params.mapThread)
        focusContext({ kind: "thread", id: params.mapThread });
      router.setParams({ mapPlan: undefined, mapThread: undefined });
    });
    return () => cancelAnimationFrame(frame);
  }, [params.mapPlan, params.mapThread, snapshotReady, focusContext]);

  useEffect(() => {
    if (discoveryRestore.current?.viewerId !== userId)
      discoveryRestore.current = null;
    if (params.mapDiscovery !== "yes" || !snapshotReady || !userId) return;
    const frame = requestAnimationFrame(() => {
      if (!discoveryRestore.current) {
        discoveryRestore.current = {
          viewerId: userId,
          camera: viewport,
          categories: selectedCategories,
          selected,
          person,
          squad: squadPreviewId,
          detail: detailTab,
          cameraChanged: false,
          categoriesChanged: false,
          selectionChanged: false,
        };
        const categories =
          exploration.filters.categories ??
          (exploration.filters.category === "All categories"
            ? []
            : [exploration.filters.category]);
        setCategoriesValue(categories);
        setSelected(null);
        setPerson(null);
        setSquadPreviewId(null);
        setDetailTab(null);
        setClusterActivityIds(null);
        setClusterPersonIds(null);
        if (!exploration.area) {
          const ids = new Set(
            ["Active", "Upcoming"]
              .flatMap((period) =>
                discoveryActivities(
                  data,
                  userId,
                  now,
                  period as "Active" | "Upcoming",
                  exploration.query,
                  exploration.filters,
                  exploration.area,
                ),
              )
              .map((row) => row.id),
          );
          const coordinates = safePlaces
            .filter(
              (place) =>
                ids.has(place.activity_id) && validPhysicalPlace(place),
            )
            .map((place) => ({
              latitude: place.latitude!,
              longitude: place.longitude!,
            }));
          if (coordinates.length)
            setControlCommand((previous) => ({
              kind: "fit",
              coordinates,
              revision: (previous?.revision ?? 0) + 1,
            }));
        }
      }
      setDiscoveryViewer(userId);
      router.setParams({ mapDiscovery: undefined });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    params.mapDiscovery,
    snapshotReady,
    userId,
    viewport,
    selectedCategories,
    selected,
    person,
    squadPreviewId,
    detailTab,
    exploration.area,
    exploration.filters,
    exploration.query,
    data,
    now,
    safePlaces,
  ]);

  function clearDiscovery() {
    const original = discoveryRestore.current;
    if (original?.viewerId === userId) {
      if (!original.categoriesChanged) setCategoriesValue(original.categories);
      if (!original.selectionChanged) {
        setSelected(original.selected);
        setPerson(original.person);
        setSquadPreviewId(original.squad);
        setDetailTab(original.detail);
      }
      if (original.camera && !original.cameraChanged)
        setControlCommand((previous) => ({
          kind: "restore",
          camera: original.camera!,
          revision: (previous?.revision ?? 0) + 1,
        }));
    }
    discoveryRestore.current = null;
    setDiscoveryViewer(null);
  }

  function clearContexts(key?: string) {
    const remaining = contextViews.filter((view) => key && view.key !== key);
    if (!remaining.length && previousContextCamera.current) {
      const camera = previousContextCamera.current;
      setControlCommand((previous) => ({
        kind: "restore",
        camera,
        revision: (previous?.revision ?? 0) + 1,
      }));
      previousContextCamera.current = null;
    }
    if (
      selected &&
      !normalActivities.some((activity) => activity.id === selected) &&
      !remaining.some((view) =>
        view.activities.some((activity) => activity.id === selected),
      )
    ) {
      setSelected(null);
      setDetailTab(null);
    }
    setContextState((current) => ({
      ...current,
      filters: key
        ? current.filters.filter((filter) => mapContextKey(filter) !== key)
        : [],
    }));
  }

  function removeActiveChip(key: string) {
    if (key === "discovery") {
      clearDiscovery();
      return;
    }
    if (key.startsWith("context:")) {
      clearContexts(key);
      return;
    }
    if (key.startsWith("category:")) {
      const category = key.slice("category:".length) as Category;
      const next = activeCategories.filter((value) => value !== category);
      setSelectedCategories(next);
      if (!next.length)
        exploration.setFilters({
          ...exploration.filters,
          category: "All categories",
        });
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
    exploration.setFilters({
      ...exploration.filters,
      ...changes,
    } as typeof exploration.filters);
  }

  function chooseQuickFilter(filter: MapQuickFilter) {
    closePopovers();
    if (filter === "All") {
      resetFilters();
      return;
    }
    if (filter === "Now") {
      exploration.setFilters({
        ...exploration.filters,
        time: exploration.filters.time === "Now" ? "All" : "Now",
        when: "Any",
      });
      return;
    }
    const audience =
      filter === "Friends"
        ? "Friends"
        : filter === "Public"
          ? "Public"
          : "Squads";
    exploration.setFilters({
      ...exploration.filters,
      audience:
        exploration.filters.audience === audience ? "Everyone" : audience,
      time:
        exploration.filters.time === "Now" ? "All" : exploration.filters.time,
    });
  }

  async function handleUseMyLocation() {
    if (discoveryRestore.current) discoveryRestore.current.cameraChanged = true;
    if (compassBusy) return;
    setCompassBusy(true);
    setCompassMessage("");
    try {
      if (demo) {
        exploration.setArea({
          kind: "near-me",
          label: "Near me",
          coordinate: { latitude: 41.884, longitude: -87.632 },
          zoom: 13,
        });
        setCompassSheetOpen(false);
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setCompassMessage(
          "Location permission is off. You can enable it in Settings, or keep exploring anywhere.",
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      if (!isValidCoordinate(coordinate))
        throw new Error("The device returned an invalid location.");
      exploration.setArea({
        kind: "near-me",
        label: "Near me",
        coordinate,
        zoom: 13,
      });
      setCompassMessage("");
      setCompassSheetOpen(false);
    } catch (failure) {
      setCompassMessage(
        failure instanceof Error
          ? failure.message
          : "Could not find your current location.",
      );
    } finally {
      setCompassBusy(false);
    }
  }

  function openSettings() {
    if (Platform.OS === "web") return;
    void Linking.openSettings().catch(() =>
      setCompassMessage("Open your device Settings to allow location access."),
    );
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
  }

  function openActivityDetails(id: string, tab: MapBeaconFeature = "overview") {
    if (
      !userId ||
      data.viewer_id !== userId ||
      !data.activities.some(
        (activity) =>
          activity.id === id && canReadBeaconActivity(data, activity, userId),
      )
    )
      return;
    setSelected(id);
    setPerson(null);
    if (tab === "overview") {
      setDetailTab(null);
      router.push({ pathname: "/activity/[id]", params: { id, from: "map" } });
      return;
    }
    setDetailTab(tab);
  }

  function createBeaconHere() {
    if (!pickedMapPoint || !isValidCoordinate(pickedMapPoint)) return;
    const context = creationLocationContext.current;
    creationLocationContext.current = {};
    setPickedMapPoint(null);
    setPickMode(false);
    router.push({
      pathname: "/create",
      params: {
        ...context,
        fromMap: "yes",
        latitude: String(pickedMapPoint.latitude),
        longitude: String(pickedMapPoint.longitude),
        placeLabel: pickedMapPoint.label,
      },
    });
  }

  const happeningHereRows = pulsePlace
    ? safePlaces
        .filter(
          (place) =>
            validPhysicalPlace(place) &&
            nearPulsePlace(pulsePlace, {
              lat: place.latitude,
              lng: place.longitude,
            }),
        )
        .flatMap((place) => {
          const activity = safeActivities.find(
            (item) => item.id === place.activity_id,
          );
          return activity
            ? [
                <Pressable
                  key={activity.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${activity.title} Beacon`}
                  onPress={() => chooseBeacon(activity.id)}
                  style={{
                    minHeight: 52,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <Text style={styles.body}>{activity.title}</Text>
                </Pressable>,
              ]
            : [];
        })
    : [];
  const headerTop = insets.top + 7;
  const mapBottomClearance = 24;
  // An expanded sheet leaves only its exposed map available for floating controls.
  const controlsTop = headerTop + headerHeight - 44 + 12;
  const availableControlHeight = Math.max(
    0,
    (detailTab
      ? (sheetMapHeight ?? mapSize.height * 0.3)
      : mapSize.height - insets.bottom - 24) -
      controlsTop -
      8,
  );
  const controlsVisible = availableControlHeight >= 44;
  const displayControlVisible = availableControlHeight >= 98;
  const weatherControlVisible =
    weather.visible && availableControlHeight >= 152;
  const activeAreaTarget = explorationTarget;
  const activeSearchVisible = placeSearchOpen || params.search === "yes";
  const shareIndicator = (
    <View
      pointerEvents="box-none"
      style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
    >
      {!activeSonar && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share location"
          onPress={() => {
            closePopovers();
            router.push("/location");
          }}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <View
            style={{
              minHeight: 32,
              paddingHorizontal: 10,
              borderRadius: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: colors.white + "E8",
            }}
          >
            <Radio size={13} color={colors.green} />
            <Text style={{ color: colors.ink, fontSize: 12 }}>
              Share location
            </Text>
          </View>
        </Pressable>
      )}
      <SonarSharingIndicator
        compact
        session={activeSonar}
        onExtend={() =>
          router.push({ pathname: "/location", params: { extend: "yes" } })
        }
      />
    </View>
  );
  function selectMyBeacon(id: string) {
    const activity = data.activities.find((row) => row.id === id);
    if (!activity || !userId || !canReadBeaconActivity(data, activity, userId))
      return;
    setMyBeaconsOpen(false);
    const place = safePlaces.find(
      (row) => row.activity_id === id && validPhysicalPlace(row),
    );
    if (!place) {
      router.push({ pathname: "/activity/[id]", params: { id } });
      return;
    }
    if (!activities.some((row) => row.id === id))
      focusContext({ kind: "beacon", id });
    chooseBeacon(id);
    setControlCommand((previous) => ({
      kind: "focus",
      coordinates: [{ latitude: place.latitude!, longitude: place.longitude! }],
      revision: (previous?.revision ?? 0) + 1,
    }));
  }
  const renderCompassActions = () => (
    <>
      <MapNavigationRow
        label="My Beacons"
        icon={Radio}
        onPress={() => {
          closePopovers();
          setMyBeaconsOpen(true);
        }}
      />
      <MapNavigationRow
        label="Center on Me"
        icon={LocateFixed}
        disabled={compassBusy}
        onPress={() => void handleUseMyLocation()}
      />
      <MapNavigationRow
        label="Return to Overview"
        icon={Maximize}
        onPress={() => {
          closePopovers();
          if (discoveryRestore.current)
            discoveryRestore.current.cameraChanged = true;
          setControlCommand((previous) => ({
            kind: "fit",
            revision: (previous?.revision ?? 0) + 1,
          }));
        }}
      />
      <MapNavigationRow
        label="Explore Everywhere"
        icon={Globe2}
        onPress={() => {
          exploration.setArea(null);
          closePopovers();
          if (discoveryRestore.current)
            discoveryRestore.current.cameraChanged = true;
          setControlCommand((previous) => ({
            kind: "fit",
            revision: (previous?.revision ?? 0) + 1,
          }));
        }}
      />
      <MapNavigationRow
        label="Pin a Location"
        icon={MapPin}
        onPress={() => {
          closePopovers();
          startPickingLocation();
        }}
      />
      {compassBusy && <ActivityIndicator size="small" color={colors.green} />}
      {compassMessage ? (
        <>
          <Text style={styles.muted}>{compassMessage}</Text>
          <MapNavigationRow
            label="Open Settings"
            icon={Settings2}
            onPress={openSettings}
          />
        </>
      ) : null}
    </>
  );

  return (
    <KeyboardAvoidingView
      testID="full-map-screen"
      onLayout={(event) => {
        const { width: nextWidth, height: nextHeight } =
          event.nativeEvent.layout;
        setMapSize((current) =>
          current.width === nextWidth && current.height === nextHeight
            ? current
            : { width: nextWidth, height: nextHeight },
        );
      }}
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {preferencesReady ? (
        <BeaconMap
          fullScreen
          contextPoints={[...contextPoints, ...publicPoints]}
          contextPaths={contextPaths}
          onContextPoint={(point) => {
            if (point.publicBeaconId) {
              choosePublicBeacon(point.publicBeaconId);
              return;
            }
            if (point.activityId) chooseBeacon(point.activityId);
            else if (point.threadId)
              router.push({
                pathname: "/council/[id]",
                params: { id: point.threadId },
              });
          }}
          calm={calm}
          pulseSummaries={mapPreferences.liveUpdates ? pulse.summaries : []}
          pulsePlaces={knownPulsePlaces}
          pulsePopToken={pulsePopToken}
          pulsePopPlaceKey={pulsePopPlaceKey}
          onPlace={choosePulsePlace}
          onGestureChange={gestureChanged}
          onLongPress={(touch) => {
            if (
              pickMode ||
              !isValidCoordinate(touch.coordinate) ||
              !Number.isFinite(touch.point.x) ||
              !Number.isFinite(touch.point.y)
            )
              return;
            choosePulsePlace(
              areaPulsePlace(
                touch.coordinate.latitude,
                touch.coordinate.longitude,
              ),
            );
            setContextPoint({ ...touch.point, ...touch.coordinate });
            uiHaptics.light();
          }}
          hideControls
          viewportInsets={{
            top: insets.top + headerHeight + 16,
            right: 68,
            bottom: mapBottomClearance,
            left: 12,
          }}
          previewHeight={
            person || (selected && !detailTab)
              ? mapTooltip.maxHeight
              : undefined
          }
          focused={pickedMapPoint ?? focusedCoordinate}
          anchorCoordinate={
            clusterActivityIds ? clusterCenter : focusedCoordinate
          }
          onAnchor={setMapAnchor}
          activities={
            focusedBeacon &&
            !activities.some((activity) => activity.id === selected)
              ? [...activities, focusedBeacon]
              : activities
          }
          availabilityActivities={discoveryActive ? [] : availabilityActivities}
          places={safePlaces}
          locations={mapLocations}
          profiles={data.profiles}
          clusterPriorities={clusterPriorities}
          areaName={
            exploration.area?.kind === "place"
              ? exploration.area.label
              : undefined
          }
          selectedActivityId={selected}
          onPick={
            pickMode
              ? (latitude, longitude) =>
                  setPickedMapPoint({
                    latitude,
                    longitude,
                    label: "Pinned map location",
                  })
              : undefined
          }
          selected={pickedMapPoint ?? contextPoint}
          selectionIsTemporary={!!contextPoint && !pickedMapPoint}
          onActivity={(id) => chooseBeacon(id)}
          onPerson={choosePerson}
          clusterPersonCount={countClusterPeople}
          onCluster={(nextCluster, anchor) => {
            setMapAnchor(anchor ?? null);
            setClusterCenter({
              latitude: nextCluster.latitude,
              longitude: nextCluster.longitude,
            });
            setClusterCoordinates(
              nextCluster.members.map((row) => ({
                latitude: row.latitude,
                longitude: row.longitude,
              })),
            );
            uiHaptics.light();
            clearRouteSelection();
            setDetailTab(null);
            setPulsePlace(null);
            setContextPoint(null);
            setSelected(null);
            setPerson(null);
            const memberIds = nextCluster.members
              .filter((member) => member.kind === "beacon")
              .map((member) => member.id.slice("beacon:".length))
              .filter(
                (id) =>
                  activities.some((activity) => activity.id === id) ||
                  focusedBeacon?.id === id ||
                  publicMapRows.some((row) => row.activity_id === id),
              );
            const peopleIds = nextCluster.members
              .filter((member) => member.kind === "person")
              .map((member) => member.id.slice("person:".length))
              .filter(
                (id) =>
                  mapLocations.some((location) => location.owner_id === id) &&
                  !!data.profiles.find(
                    (profile) =>
                      profile.id === id &&
                      userId &&
                      canViewProfile(data, profile, userId),
                  ),
              );
            if (memberIds.length || peopleIds.length) {
              setClusterActivityIds(memberIds);
              setClusterPersonIds(peopleIds);
            } else {
              setClusterActivityIds(null);
              setClusterPersonIds(null);
            }
          }}
          onMapTap={() => {
            if (contextPoint) {
              dismissLocationMenu();
              return;
            }
            setPublicSelection(null);
            setPulsePlace(null);
            setContextPoint(null);
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
          onRecenter={
            activeAreaTarget
              ? () => setTargetRevision((revision) => revision + 1)
              : undefined
          }
          onBearingChange={setBearing}
          onViewportChange={handleViewportChange}
        />
      ) : null}

      <SocialDirectorySummaryPreview
        summary={selectedDirectory}
        visible={!!selectedDirectory}
        onClose={() => setDirectorySelection(null)}
        onAction={async () => {
          if (!selectedDirectory || !userId) return false;
          await performDirectoryAction(selectedDirectory, data, userId, act);
          setDirectorySelection(null);
        }}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: headerTop,
          left: Math.max(
            0,
            (mapSize.width - tokens.layout.contentMaxWidth) / 2,
          ),
          right: Math.max(
            0,
            (mapSize.width - tokens.layout.contentMaxWidth) / 2,
          ),
          zIndex: 20,
          elevation: 20,
        }}
      >
        <MapExplorationHeader
          areaLabel={
            exploration.area?.kind === "place"
              ? exploration.area.label
              : undefined
          }
          onBackNearMe={() => {
            if (discoveryRestore.current)
              discoveryRestore.current.cameraChanged = true;
            setPublicSelection(null);
            setPulsePlace(null);
            setSelected(null);
            setPerson(null);
            if (nearMeArea.current) {
              exploration.setArea(nearMeArea.current);
              setTargetRevision((value) => value + 1);
            } else {
              setCompassSheetOpen(true);
              void handleUseMyLocation();
            }
          }}
          query={exploration.query}
          onQueryChange={exploration.setQuery}
          onQuerySubmit={searchSubmit}
          calm={calm}
          onQuickFilter={chooseQuickFilter}
          selectedQuickFilter={selectedQuickFilter}
          nowSelected={exploration.filters.time === "Now"}
          onExploreArea={() => {
            closePopovers();
            setPlaceSearchOpen(false);
            setPlaceSearchOpen(true);
          }}
          onOpenFilters={() => {
            closePopovers();
            setAdvancedFiltersOpen(true);
          }}
          activeFilterCount={activeFilterCount}
          activeChips={activeChips}
          onRemoveChip={removeActiveChip}
          onClearContexts={
            contextViews.length >= 3 ? () => clearContexts() : undefined
          }
          onSearchFocus={() => {
            closePopovers();
            setPlaceSearchOpen(true);
          }}
          loading={loading}
          sharingIndicator={shareIndicator}
          onHeightChange={setHeaderHeight}
        />
      </View>

      {activeSearchVisible ? (
        <View
          style={{
            position: "absolute",
            top: headerTop + headerHeight,
            left: Math.max(
              0,
              (mapSize.width - tokens.layout.contentMaxWidth) / 2,
            ),
            right: Math.max(
              0,
              (mapSize.width - tokens.layout.contentMaxWidth) / 2,
            ),
            zIndex: 13,
            paddingHorizontal: tokens.layout.screenGutter,
          }}
        >
          <MapSearchOverlay
            visible
            maxHeight={Math.max(
              120,
              Math.min(
                430,
                mapSize.height -
                  headerTop -
                  headerHeight -
                  mapBottomClearance -
                  16,
              ),
            )}
            query={exploration.query}
            beacons={searchActivityResults}
            publicBeacons={rankedPublic
              .filter(
                (row) =>
                  !searchActivityResults.some(
                    (activity) => activity.id === row.activity_id,
                  ),
              )
              .slice(0, 5)}
            onSelectPublicBeacon={(row) => choosePublicBeacon(row.activity_id)}
            people={discoveryActive ? [] : searchPeopleResults}
            places={searchPlaceResults}
            recentQueries={recentQueries}
            onSelectBeacon={(activity) => {
              rememberSearch(exploration.query);
              exploration.setQuery("");
              setPlaceSearchOpen(false);
              chooseBeacon(activity.id);
            }}
            onSelectPerson={(profile) => {
              rememberSearch(exploration.query);
              exploration.setQuery("");
              setPlaceSearchOpen(false);
              choosePerson(profile.id);
            }}
            onSelectPlace={(place) => {
              rememberSearch(exploration.query);
              exploreSavedPlace(place);
            }}
            onSelectRecent={chooseRecent}
            summaries={mapPreferences.liveUpdates ? pulse.summaries : []}
            pulsePlaces={pulse.demoPlaces
              .filter((place) => !!query && matchesSearch(query, place.name))
              .slice(0, 6)}
            onSelectPulsePlace={(place) => {
              exploration.setQuery("");
              exploration.setArea({
                kind: "place",
                label: place.name,
                coordinate: { latitude: place.lat, longitude: place.lng },
                zoom: 16,
                source: "demo",
              });
              choosePulsePlace(place);
            }}
            communities={directoryRows.map((row) => ({
              id: row.entity_id,
              name: row.name,
              kind: communityKind[row.entity_type],
              description: row.description,
            }))}
            discoveryMessage={
              publicDiscovery.error ??
              (directoryResult?.snapshot === data
                ? directoryResult.error
                : undefined)
            }
            personReason={(profile) =>
              userId ? personDiscoveryReason(data, profile, userId) : ""
            }
            onSelectCommunity={(id, kind) => {
              setPlaceSearchOpen(false);
              const row = directoryRows.find(
                (item) =>
                  item.entity_id === id &&
                  communityKind[item.entity_type] === kind,
              );
              if (!row) return;
              openCommunity(row);
            }}
            onChooseWorldPlace={exploreWorldPlace}
            onStartPickingLocation={startPickingLocation}
          />
        </View>
      ) : null}

      {snapshotReady &&
        (viewport?.zoom ?? 13) < 16 &&
        !loading &&
        !activeSearchVisible &&
        !selected &&
        !person &&
        !selectedPublic &&
        !pulsePlace &&
        !panel &&
        !pickMode &&
        !optionsOpen &&
        !compassSheetOpen &&
        !calm &&
        ((!hasVisibleBeacons &&
          !publicMapRows.length &&
          !hasVisiblePeople &&
          publicDiscovery.ready) ||
          (preferencesReady && hintIndex < 3 && !discoveryHintDismissed)) && (
          <View
            testID="map-discovery-help"
            style={{
              position: "absolute",
              top: headerTop + headerHeight + (demo ? 52 : 12),
              left: 12,
              right: 12,
              padding: 12,
              gap: 8,
              borderRadius: 16,
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.line,
              zIndex: 8,
            }}
          >
            {!hasVisibleBeacons &&
            !publicMapRows.length &&
            !hasVisiblePeople ? (
              <>
                <Text style={styles.h2}>
                  {exploration.filters.audience === "Friends" && !friends.length
                    ? "No friends yet"
                    : "No Beacons here yet"}
                </Text>
                {(publicDiscovery.error || directoryResult?.error) && (
                  <Text style={styles.muted}>
                    {publicDiscovery.error ?? directoryResult?.error}
                  </Text>
                )}
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {exploration.filters.audience === "Friends" &&
                  !friends.length ? (
                    <IconButton
                      label="Add Friends"
                      onPress={() => router.push("/find-friends")}
                    >
                      <UserRoundPlus size={18} color={colors.green} />
                    </IconButton>
                  ) : (
                    <IconButton
                      label="Change Area"
                      onPress={() => setPlaceSearchOpen(true)}
                    >
                      <MapPin size={18} color={colors.green} />
                    </IconButton>
                  )}
                  <Button
                    title={
                      exploration.filters.audience === "Friends"
                        ? "Explore Beacons"
                        : "Explore Nearby"
                    }
                    compact
                    onPress={() => {
                      resetFilters();
                      exploration.setQuery("");
                      setPlaceSearchOpen(true);
                    }}
                  />
                  <IconButton
                    label="Create Beacon"
                    onPress={() => router.push("/create")}
                  >
                    <Plus size={18} color={colors.green} />
                  </IconButton>
                </View>
              </>
            ) : preferencesReady && hintIndex < 3 && !discoveryHintDismissed ? (
              <>
                <Text style={styles.body}>
                  Explore what&apos;s happening nearby
                </Text>
                <Text style={styles.muted}>
                  Search for an activity, a person or another city. Tap a Beacon
                  to preview and join.
                </Text>
                <Button
                  title="Got it"
                  compact
                  secondary
                  onPress={() => {
                    setDiscoveryHintDismissed(true);
                    setHintIndex(3);
                    void writeMapDevicePreferences({ hintsSeen: 3 }).catch(
                      () => {},
                    );
                  }}
                />
              </>
            ) : null}
          </View>
        )}
      {createdNotice ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            top: headerTop + headerHeight + 8,
            alignSelf: "center",
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 18,
            backgroundColor: colors.ink,
            zIndex: 20,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: "700" }}>
            Beacon created
          </Text>
        </View>
      ) : null}

      <MyBeaconsSheet
        visible={myBeaconsOpen}
        onClose={() => setMyBeaconsOpen(false)}
        hosting={myBeacons.hosting}
        joined={myBeacons.joined}
        places={safePlaces}
        now={now}
        onSelect={selectMyBeacon}
      />
      {(compassSheetOpen || mapControlSettingsOpen || weatherOpen) &&
        !pickMode &&
        !pickedMapPoint && (
          <Pressable
            testID="map-toolbar-dismiss-area"
            accessibilityRole="button"
            accessibilityLabel="Dismiss map controls by tapping the map"
            onPress={closePopovers}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: detailTab ? 31 : 20,
            }}
          />
        )}
      {!pickMode &&
      !pickedMapPoint &&
      !activeSearchVisible &&
      controlsVisible ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: controlsTop,
            right: Math.max(insets.right + 12, 16),
            height: availableControlHeight,
            alignItems: "flex-end",
            gap: 10,
            zIndex: detailTab ? 32 : 21,
          }}
        >
          <View style={{ flexDirection: "row", gap: 6 }}>
            {Platform.OS !== "web" &&
              Math.abs(((bearing + 540) % 360) - 180) > 3 && (
                <MapControl
                  label="Reset map north"
                  onPress={() =>
                    setControlCommand((previous) => ({
                      kind: "north",
                      revision: (previous?.revision ?? 0) + 1,
                    }))
                  }
                >
                  <View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
                    <Compass size={17} color={colors.green} />
                  </View>
                </MapControl>
              )}
            <MapControl
              label="Navigation"
              expanded={compassSheetOpen}
              selected={compassSheetOpen}
              onPress={() => {
                const next = !compassSheetOpen;
                closePopovers();
                setCompassSheetOpen(next);
                setPlaceSearchOpen(false);
              }}
            >
              <Navigation size={19} color={colors.green} />
            </MapControl>
          </View>
          {displayControlVisible && (
            <MapControl
              label="Map Display"
              expanded={mapControlSettingsOpen}
              selected={mapControlSettingsOpen}
              onPress={() => {
                const next = !mapControlSettingsOpen;
                closePopovers();
                setMapControlSettingsOpen(next);
              }}
            >
              <Layers size={19} color={colors.green} />
            </MapControl>
          )}
          {weatherControlVisible && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Weather"
              onLayout={(event) =>
                setWeatherButtonWidth(event.nativeEvent.layout.width)
              }
              accessibilityHint={
                weather.value
                  ? `${Math.round(weather.value.temperature)} degrees Fahrenheit, ${condition?.label}`
                  : "Weather for the viewed map area"
              }
              accessibilityState={{ expanded: weatherOpen }}
              aria-expanded={weatherOpen}
              onPress={() => {
                const next = !weatherOpen;
                closePopovers();
                setWeatherOpen(next);
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: 10,
                minWidth: 102,
                borderRadius: 22,
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: weatherOpen ? colors.green : colors.line,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <WeatherIcon size={16} color={colors.green} />
              <Text
                numberOfLines={1}
                style={{ color: colors.ink, fontSize: 12 }}
              >
                {weather.value
                  ? `Weather ${Math.round(weather.value.temperature)}°`
                  : weather.loading
                    ? "Weather…"
                    : "Weather"}
              </Text>
            </Pressable>
          )}
          {(compassSheetOpen || mapControlSettingsOpen || weatherOpen) && (
            <MapControlPopover
              title={
                compassSheetOpen
                  ? "Navigation"
                  : weatherOpen
                    ? "Weather"
                    : "Map Display"
              }
              onClose={closePopovers}
              width={Math.min(
                236,
                mapSize.width -
                  Math.max(insets.right + 12, 16) -
                  (weatherOpen ? weatherButtonWidth + 8 : 52) -
                  insets.left -
                  12,
              )}
              right={weatherOpen ? weatherButtonWidth + 8 : 52}
              top={Math.max(
                0,
                Math.min(
                  compassSheetOpen ? 0 : weatherOpen ? 108 : 54,
                  availableControlHeight - (compassSheetOpen ? 250 : 210),
                ),
              )}
              maxHeight={availableControlHeight}
            >
              {compassSheetOpen ? (
                renderCompassActions()
              ) : weatherOpen ? (
                <>
                  <Text style={styles.label}>Viewed map area</Text>
                  {weather.value ? (
                    <>
                      <Text style={styles.h2}>
                        {Math.round(weather.value.temperature)}°F ·{" "}
                        {condition?.label}
                      </Text>
                      <Text style={styles.body}>
                        Feels like {Math.round(weather.value.feelsLike)}°F
                      </Text>
                      <Text style={styles.muted}>
                        Humidity {Math.round(weather.value.humidity)}% · Wind{" "}
                        {Math.round(weather.value.wind)} mph
                      </Text>
                    </>
                  ) : (
                    <Text accessibilityLiveRegion="polite" style={styles.muted}>
                      {weather.loading
                        ? "Loading current weather…"
                        : "Weather is unavailable. Try again shortly."}
                    </Text>
                  )}
                  {!weather.value && !weather.loading && (
                    <Button
                      title="Retry Weather"
                      compact
                      secondary
                      onPress={weather.retry}
                    />
                  )}
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Weather data by Open-Meteo"
                    onPress={() =>
                      void Linking.openURL("https://open-meteo.com/")
                    }
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Text style={styles.muted}>Weather data by Open-Meteo</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <MapStyleControls
                    style={mapStyle}
                    onStyle={(value) => {
                      setMapStyle(value);
                      updateMapPreference({ style: value });
                    }}
                  />
                  <Button
                    title="More Map Settings"
                    compact
                    secondary
                    onPress={() => {
                      closePopovers();
                      setOptionsOpen(true);
                    }}
                  />
                </>
              )}
            </MapControlPopover>
          )}
          {offline && <Text style={styles.label}>Offline</Text>}
        </View>
      ) : null}

      {pickMode || pickedMapPoint ? (
        <View
          style={{
            position: "absolute",
            bottom: insets.bottom + tokens.layout.tabBarHeight + 18,
            left: Math.max(
              tokens.layout.screenGutter,
              (mapSize.width - tokens.layout.contentMaxWidth) / 2,
            ),
            right: Math.max(
              tokens.layout.screenGutter,
              (mapSize.width - tokens.layout.contentMaxWidth) / 2,
            ),
            padding: tokens.space.md,
            gap: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white + "F5",
            boxShadow: "0 8px 28px #142e3033",
            zIndex: 9,
          }}
        >
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>
                {pickedMapPoint
                  ? pickedMapPoint.label
                  : "Tap the map to drop a pin"}
              </Text>
              <Text style={styles.muted}>
                {pickedMapPoint
                  ? "Create a Beacon at this location."
                  : "Choose a physical meeting point."}
              </Text>
            </View>
            <IconButton
              label="Cancel location selection"
              onPress={() => {
                creationLocationContext.current = {};
                setPickedMapPoint(null);
                setPickMode(false);
              }}
            >
              <Text style={{ color: colors.green, fontSize: 19 }}>×</Text>
            </IconButton>
          </View>
          {pickedMapPoint ? (
            <Button title="Create Beacon here" onPress={createBeaconHere} />
          ) : null}
        </View>
      ) : null}

      {selectedPublic && !person && !selected && (
        <MapCallout
          testID="map-public-callout"
          anchor={null}
          bounds={{
            ...mapSize,
            top: headerTop + headerHeight + 12,
            bottom: 24,
          }}
        >
          <PublicBeaconPreview
            key={selectedPublic.activity_id}
            summary={selectedPublic}
            onClose={() => setPublicSelection(null)}
            onJoined={(id) => {
              setPublicSelection(null);
              router.setParams({ beacon: id });
            }}
          />
        </MapCallout>
      )}
      {person || (selected && !detailTab) ? (
        <MapCallout
          testID="map-tooltip"
          key={person ?? selected}
          compact
          onDismiss={() => {
            clearRouteSelection();
            setPerson(null);
            setSelected(null);
            setDetailTab(null);
          }}
          maxWidth={mapTooltip.width}
          anchor={mapAnchor}
          bounds={{
            ...mapSize,
            top: headerTop + headerHeight + 12,
            bottom: 24,
            exclusionRight: mapTooltip.controlRailWidth,
            exclusionBottom:
              headerTop + headerHeight + mapTooltip.controlRailHeight,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 0 }}
          >
            {person ? (
              <MapPersonPreview
                personId={person}
                onBeacon={chooseBeacon}
                onClose={() => {
                  clearRouteSelection();
                  setPerson(null);
                }}
              />
            ) : (
              <MapTooltip
                community={
                  hostingCommunity
                    ? {
                        name: hostingCommunity.name,
                        onPress: () => openCommunity(hostingCommunity),
                      }
                    : undefined
                }
                onShowContext={focusContext}
                beaconId={selected}
                personId={null}
                pinned={!!focusedPlace}
                onDetails={() => selected && openActivityDetails(selected)}
                onPerson={choosePerson}
                onFeature={(feature) =>
                  selected && openActivityDetails(selected, feature)
                }
                onMessage={() =>
                  selected && openActivityDetails(selected, "chat")
                }
                onClose={() => {
                  clearRouteSelection();
                  setSelected(null);
                  setDetailTab(null);
                }}
              />
            )}
          </ScrollView>
        </MapCallout>
      ) : null}
      {clusterActivityIds && clusterPersonIds ? (
        <MapCallout
          anchor={mapAnchor}
          height={320}
          maxWidth={320}
          bounds={{
            ...mapSize,
            top: headerTop + headerHeight + 12,
            bottom: 24,
          }}
        >
          <MapNearbyPanel
            key={`${clusterActivityIds.join()}:${clusterPersonIds.join()}`}
            beaconIds={clusterActivityIds}
            personIds={clusterPersonIds}
            publicBeacons={publicMapRows.filter((row) =>
              clusterActivityIds.includes(row.activity_id),
            )}
            onPublicBeacon={choosePublicBeacon}
            onBeacon={chooseBeacon}
            onPerson={choosePerson}
            onClose={() => {
              setClusterActivityIds(null);
              setClusterPersonIds(null);
            }}
            onFit={() => {
              if (discoveryRestore.current)
                discoveryRestore.current.cameraChanged = true;
              setControlCommand((previous) => ({
                kind: "fit",
                coordinates: clusterCoordinates,
                revision: (previous?.revision ?? 0) + 1,
              }));
            }}
          />
        </MapCallout>
      ) : null}
      {selected && detailTab ? (
        <BeaconOverviewSheet
          onMapSpaceChange={onSheetMapHeight}
          key={selected}
          onShowContext={focusContext}
          beaconId={selected}
          initialTab={detailTab}
          onBeacon={(id) => openActivityDetails(id)}
          onClose={() => setDetailTab(null)}
        />
      ) : null}

      {pulsePlace && !contextPoint ? (
        <View
          testID="map-place-preview-slot"
          style={{
            position: "absolute",
            left: Math.max(
              tokens.layout.screenGutter,
              (mapSize.width - tokens.layout.contentMaxWidth) / 2,
            ),
            right: Math.max(
              tokens.layout.screenGutter,
              (mapSize.width - tokens.layout.contentMaxWidth) / 2,
            ),
            bottom: mapBottomClearance + 8,
            maxHeight: Math.max(
              120,
              mapSize.height -
                headerTop -
                headerHeight -
                mapBottomClearance -
                24,
            ),
            zIndex: 22,
            elevation: 22,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <PulsePlacePreview
              scopeKey={pulseScopeKey}
              place={pulsePlace}
              summary={placeSummary}
              onClose={() => setPulsePlace(null)}
              onAdd={openAddUpdate}
              onConfirm={pulse.confirm}
              confirmedUntil={pulse.confirmedUntil(pulsePlace.placeKey)}
              lastAnswers={pulse.lastAnswers(pulsePlace.placeKey)}
              onCreateBeacon={createAtPulsePlace}
              onDirections={directionsAtPulsePlace}
              onPing={() =>
                router.push({
                  pathname: "/councils",
                  params: {
                    newPing: "yes",
                    placeLabel: pulsePlace.name,
                    pingSeed: String(Date.now()),
                  },
                })
              }
              onNearby={() => {
                setPulsePlace(null);
                resetFilters();
                exploration.setQuery("");
                setPlaceSearchOpen(true);
              }}
              onReportNote={pulse.reportNote}
              happeningHere={
                happeningHereRows.length ? happeningHereRows : undefined
              }
            />
          </ScrollView>
        </View>
      ) : null}
      {contextPoint && pulsePlace ? (
        <MapContextMenu
          point={contextPoint}
          bounds={{
            ...mapSize,
            top: headerTop + headerHeight + 8,
            bottom: mapBottomClearance + 8,
          }}
          onUpdate={() => openAddUpdate()}
          onCreate={createAtPulsePlace}
          onClose={dismissLocationMenu}
          onDirections={directionsAtPulsePlace}
        />
      ) : null}
      <AddLiveUpdateSheet
        visible={addUpdate && !!pulsePlace}
        place={pulsePlace}
        scopeKey={pulseScopeKey}
        initialAnswers={initialAnswers}
        onClose={() => setAddUpdate(false)}
        onPost={pulse.post}
        onPosted={() => {
          setPulsePopPlaceKey(pulsePlace?.placeKey);
          setPulsePopToken((value) => value + 1);
        }}
      />
      <MapOptions
        visible={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        liveUpdates={mapPreferences.liveUpdates}
        onLiveUpdates={(value) => updateMapPreference({ liveUpdates: value })}
        style={mapStyle}
        onStyle={(value) => {
          setMapStyle(value);
          updateMapPreference({ style: value });
        }}
        showWeather={mapPreferences.showWeather}
        onShowWeather={(value) => updateMapPreference({ showWeather: value })}
        showFriends={mapPreferences.showFriends}
        friendsApplicable={showAvatars && friends.length > 0}
        onShowFriends={(value) => updateMapPreference({ showFriends: value })}
        onFit={() => {
          if (discoveryRestore.current)
            discoveryRestore.current.cameraChanged = true;
          setOptionsOpen(false);
          setControlCommand((previous) => ({
            kind: "fit",
            revision: (previous?.revision ?? 0) + 1,
          }));
        }}
        onExplore={() => {
          setOptionsOpen(false);
          setPlaceSearchOpen(true);
        }}
      />
      {mapPreferences.liveUpdates && pulse.error && pulsePlace ? (
        <View
          accessibilityRole="alert"
          style={{
            position: "absolute",
            top: headerTop + headerHeight + 10,
            left: 12,
            right: 68,
            zIndex: 23,
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.white,
          }}
        >
          <Text style={styles.muted}>{pulseCopy.unavailable}</Text>
          <Button
            title={pulseCopy.retry}
            compact
            secondary
            onPress={pulse.refresh}
          />
        </View>
      ) : null}
      {mapPreferenceError ? (
        <View
          style={{
            position: "absolute",
            top: headerTop + headerHeight + 12,
            left: 12,
            right: 68,
            zIndex: 21,
            padding: 10,
            backgroundColor: colors.white,
            borderRadius: 12,
          }}
        >
          <Text style={styles.muted}>{mapPreferenceError}</Text>
          <Button
            title="Dismiss"
            compact
            secondary
            onPress={() => setMapPreferenceError("")}
          />
        </View>
      ) : null}
      {spacePreviewId ? (
        <SpaceProfilePreview
          spaceId={spacePreviewId}
          visible
          onClose={() => setSpacePreviewId(null)}
        />
      ) : null}
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
          if (exploration.filters.category !== "All categories")
            exploration.setFilters({
              ...exploration.filters,
              category: "All categories",
            });
        }}
      />

      {squadPreviewId ? (
        <SquadProfilePreview
          squadId={squadPreviewId}
          visible
          onClose={() => setSquadPreviewId(null)}
        />
      ) : null}
      {organizationPreviewId
        ? (() => {
            const organization = data.organizations.find(
              (row) => row.id === organizationPreviewId,
            );
            const authorized =
              !!organization &&
              !!userId &&
              data.viewer_id === userId &&
              !!activeOrganizationRole(
                organization,
                data.organization_members,
                userId,
              ) &&
              !data.organization_bans.some(
                (ban) =>
                  ban.organization_id === organization.id &&
                  ban.user_id === userId,
              ) &&
              !data.blocks.some(
                (block) =>
                  (block.blocker_id === organization.owner_id &&
                    block.blocked_id === userId) ||
                  (block.blocker_id === userId &&
                    block.blocked_id === organization.owner_id),
              );
            return (
              <Sheet
                title={
                  authorized ? organization!.name : "Organization unavailable"
                }
                visible
                onClose={() => setOrganizationPreviewId(null)}
              >
                {authorized ? (
                  <>
                    <Text style={styles.h2}>{organization!.name}</Text>
                    <Txt muted>
                      {organization!.description || "A shared organization."}
                    </Txt>
                    <Button
                      title="View organization"
                      onPress={() => {
                        const id = organization!.id;
                        setOrganizationPreviewId(null);
                        setTimeout(
                          () =>
                            router.push({
                              pathname: "/organization/[id]",
                              params: { id },
                            }),
                          320,
                        );
                      }}
                    />
                  </>
                ) : (
                  <Txt muted>This organization is unavailable.</Txt>
                )}
              </Sheet>
            );
          })()
        : null}
    </KeyboardAvoidingView>
  );
}
