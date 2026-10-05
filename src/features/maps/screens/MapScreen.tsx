import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { LocateFixed, MapPin, X, Layers3 } from "lucide-react-native";
import * as Location from "expo-location";
import BeaconMap from "@/src/features/maps/components/BeaconMap";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { matchesSearch } from "@/src/shared/search";
import { MapTooltip } from "@/src/features/maps/MapTooltip";
import { MapPanel } from "@/src/features/maps/MapPanel";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  Button,
  Chips,
  IconButton,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import { activityWhen, friendIds, locationIsFresh } from "@/src/shared/domain";
import { crew } from "@/src/shared/browsing";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import {
  rankClusterMembers,
  type MapPointGroup,
} from "@/src/features/maps/cluster";
import { deriveMapPointPriorities } from "@/src/features/maps/relevance";
import {
  explorationAreaTarget,
  matchesExplorationArea,
  type MapViewport,
  type ExplorationArea,
  useExploration,
} from "@/src/shared/exploration";
import { WorldwidePlaceSearch } from "@/src/features/maps/WorldwidePlaceSearch";
import type { WorldwidePlace } from "@/src/features/maps/placeSearch";
import { selectFreshVisiblePersonLocation } from "@/src/features/people/previews/personPreview";
import { MapExplorationHeader } from "@/src/features/maps/MapExplorationHeader";
import { AdvancedMapFilters } from "@/src/features/maps/AdvancedMapFilters";
import { matchesBeaconFilters, canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { isValidCoordinate } from "@/src/shared/exploration";
import { PersonProfilePreview } from "@/src/features/people/previews/PersonProfilePreview";
import { SquadProfilePreview } from "@/src/features/people/previews/SquadProfilePreview";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { activeOrganizationRole } from "@/src/features/organizations/domain";
export default function MapScreen() {
  const { colors, styles } = useTheme();

  const { showAvatars } = usePreferences();
  const exploration = useExploration();
  const { data, userId } = useBeacon();
  const params = useLocalSearchParams<{
    beacon?: string;
    person?: string;
    created?: string;
    search?: string;
  }>();
  const insets = useSafeAreaInsets(),
    { height, width } = useWindowDimensions(),
    now = useNow();
  const [details, setDetails] = useState(false),
    [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [panelTab, setPanelTab] = useState<"Overview" | "People" | "Chat">(
    "Overview",
  );
  const [mapOptionsOpen, setMapOptionsOpen] = useState(false),
    [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false),
    [filterTrayOpen, setFilterTrayOpen] = useState(false),
    [personPreviewId, setPersonPreviewId] = useState<string | null>(null),
    [squadPreviewId, setSquadPreviewId] = useState<string | null>(null),
    [organizationPreviewId, setOrganizationPreviewId] = useState<string | null>(null),
    [compassBusy, setCompassBusy] = useState(false),
    [compassMessage, setCompassMessage] = useState(""),
    [compassSheetOpen, setCompassSheetOpen] = useState(false),
    [sharingSheetOpen, setSharingSheetOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [person, setPerson] = useState<string | null>(null),
    [expanded, setExpanded] = useState(false);
  const [cluster, setCluster] = useState<MapPointGroup | null>(null);
  const [clusterAnchor, setClusterAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [createdNotice, setCreatedNotice] = useState(false);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [targetRevision, setTargetRevision] = useState(0);
  const [mapStyle, setMapStyle] = useState<"standard" | "satellite">(
    "standard",
  );
  const [controlCommand, setControlCommand] = useState<
    { kind: "zoom-in" | "zoom-out" | "fit"; revision: number } | undefined
  >();
  const mapCommand = (kind: "zoom-in" | "zoom-out" | "fit") =>
    setControlCommand((previous) => ({
      kind,
      revision: (previous?.revision ?? 0) + 1,
    }));
  const [searchThisArea, setSearchThisArea] = useState(false);
  const previousViewport = useRef<MapViewport | null>(null);
  const [lastNearMeArea, setLastNearMeArea] = useState<ExplorationArea | null>(null);
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
    [baseExplorationTarget, targetRevision, exploration.areaRevision],
  );
  const [pickMode, setPickMode] = useState(false);
  const [pickedMapPoint, setPickedMapPoint] = useState<{
    latitude: number;
    longitude: number;
    label: string;
  } | null>(null);
  const [expandedBeacon, setExpandedBeacon] = useState<string | null>(null);
  const processedRouteSelection = useRef<string | null>(null);
  const snapshotReady = !!userId && data.viewer_id === userId;
  const routeSelectedPersonLocation = params.person
    ? selectFreshVisiblePersonLocation(data, params.person, userId, now)
    : undefined;
  const selectedPersonLocation = person
    ? selectFreshVisiblePersonLocation(data, person, userId, now)
    : undefined;
  useEffect(() => {
    if (params.search !== "yes") return;
    const open = setTimeout(() => {
      setPlaceSearchOpen(true);
      router.setParams({ search: undefined });
    }, 0);
    return () => clearTimeout(open);
  }, [params.search]);
  const searchVisible = placeSearchOpen || params.search === "yes";
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
  useFocusEffect(
    useCallback(() => {
      if (!snapshotReady) return;
      const staleParams: { beacon?: undefined; person?: undefined } = {};
      if (
        person &&
        !selectFreshVisiblePersonLocation(data, person, userId, now)
      ) {
        setPerson(null);
        setDetails(false);
        setPanelTab("Overview");
        if (params.person === person) staleParams.person = undefined;
      }
      if (
        selected &&
        !data.activities.some((activity) => activity.id === selected)
      ) {
        setSelected(null);
        setDetails(false);
        if (params.beacon === selected) staleParams.beacon = undefined;
      }
      if (Object.keys(staleParams).length) router.setParams(staleParams);

      const routeSelection = JSON.stringify([
        userId,
        params.beacon ?? "",
        params.person ?? "",
      ]);
      if (processedRouteSelection.current === routeSelection) return;
      processedRouteSelection.current = routeSelection;
      const hasBeaconParam = params.beacon != null;
      const hasPersonParam = params.person != null;
      if (!hasBeaconParam && !hasPersonParam) return;

      const validBeacon =
        !!params.beacon &&
        data.activities.some((activity) => activity.id === params.beacon && canReadBeaconActivity(data, activity, userId!));
      const validPerson = !!params.person && !!routeSelectedPersonLocation;
      if (validBeacon || validPerson) {
        setCluster(null);
        setExpandedBeacon(null);
        setDetails(false);
        setSelected(validBeacon ? params.beacon! : null);
        setPerson(validPerson ? params.person! : null);
        setExpanded(false);
      } else {
        if (params.beacon && selected === params.beacon) setSelected(null);
        if (params.person && person === params.person) setPerson(null);
      }

      const staleRouteParams: { beacon?: undefined; person?: undefined } = {};
      if (hasBeaconParam && !validBeacon) staleRouteParams.beacon = undefined;
      if (hasPersonParam && !validPerson) staleRouteParams.person = undefined;
      if (Object.keys(staleRouteParams).length)
        router.setParams(staleRouteParams);
    }, [
      data,
      params.beacon,
      params.person,
      person,
      selected,
      snapshotReady,
      userId,
      now,
      routeSelectedPersonLocation,
    ]),
  );
  const friends = friendIds(data, userId!);
  function clearRouteSelection() {
    processedRouteSelection.current = JSON.stringify([
      userId,
      params.beacon ?? "",
      params.person ?? "",
    ]);
    router.setParams({ beacon: undefined, person: undefined });
  }
  const activities = data.activities
    .filter((activity) => canReadBeaconActivity(data, activity, userId!))
    .filter((a) => a.status === "scheduled" && Date.parse(a.ends_at) > now)
    .filter((activity) => {
      const place = canReadBeaconMeetingDetails(data, activity, userId!) ? data.places.find(
        (candidate) => candidate.activity_id === activity.id,
      ) : undefined;
      return (
        place?.online_url != null ||
        matchesExplorationArea(
          exploration.area,
          place?.latitude != null && place.longitude != null
            ? { latitude: place.latitude, longitude: place.longitude }
            : null,
        )
      );
    })
    .filter((activity) => matchesBeaconFilters(data, activity, userId, exploration.filters, now, { query: exploration.query }));
  const safePlaces = data.places.filter((place) => {
    const activity = data.activities.find((candidate) => candidate.id === place.activity_id);
    return !!activity && canReadBeaconActivity(data, activity, userId!) && canReadBeaconMeetingDetails(data, activity, userId!);
  });
  const visiblePlans = userId && data.viewer_id === userId ? data.plans.filter((plan) => {
    if (plan.owner_id === userId && !plan.squad_id) return true;
    if (!plan.squad_id || !canOpenSquadProfile(data, plan.squad_id, userId)) return false;
    return !data.blocks.some((block) => (block.blocker_id === plan.owner_id && block.blocked_id === userId) || (block.blocker_id === userId && block.blocked_id === plan.owner_id));
  }) : [];
  const planFilterOptions = visiblePlans.map((plan) => {
    const sameTitle = visiblePlans.filter((other) => other.title === plan.title);
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
  });
  const knownPlaceResults = safePlaces
    .filter(
      (place) =>
        place.online_url == null &&
        place.latitude != null &&
        place.longitude != null &&
        safePlaces.some((safe) => safe.activity_id === place.activity_id) &&
        activities.some((activity) => activity.id === place.activity_id),
    )
    .filter(
      (place) =>
        !!exploration.query.trim() &&
        matchesSearch(exploration.query, place.label),
    )
    .slice(0, 8);
  const searchActivityResults = exploration.query.trim()
    ? activities.slice(0, 5)
    : [];
  const focusedBeacon = data.activities.find((a) => a.id === selected && canReadBeaconActivity(data, a, userId!));
  const focusedPlace = safePlaces.find(
    (p) => p.activity_id === selected && p.online_url == null,
  );
  const focusedPerson = selectedPersonLocation;
  const point = selected ? focusedPlace : focusedPerson;
  const focused =
    point?.latitude != null && point?.longitude != null
      ? { latitude: point.latitude, longitude: point.longitude }
      : null;
  const panel = !!selected || !!person;
  const panelHeight = Math.min(480, height * 0.53);
  const locations = data.locations
    .filter((l) => {
      const isSelectedAuthorizedPerson = selectedPersonLocation?.id === l.id;
      const audience = exploration.filters.audience;
      return (
        (isSelectedAuthorizedPerson ||
          audience === "Everyone" ||
          (audience === "Friends"
            ? friends.includes(l.owner_id)
            : audience !== "Public" && data.squad_members.some(
                (m) => m.user_id === l.owner_id && m.squad_id === audience,
              ))) &&
        canViewProfile(data, l.owner_id, userId!)
      );
    })
    .filter(
      (location) =>
        selectedPersonLocation?.id === location.id ||
        matchesExplorationArea(
          exploration.area,
          location.latitude != null && location.longitude != null
            ? { latitude: location.latitude, longitude: location.longitude }
            : null,
        ),
    );
  const searchPeopleResults = exploration.query.trim() && snapshotReady
    ? data.profiles
        .filter(
          (profile) =>
            canViewProfile(data, profile, userId!) &&
            matchesSearch(exploration.query, profile.name, profile.username),
        )
        .slice(0, 5)
    : [];
  const clusterPriorities = deriveMapPointPriorities(
    data,
    userId!,
    activities.map((activity) => activity.id),
    showAvatars ? locations.map((location) => location.owner_id) : [],
    now,
  );
  const visibleCluster = cluster
    ? {
        ...cluster,
        members: cluster.members.filter((member) => {
          if (member.kind === "person")
            return (
              showAvatars &&
              locations.some(
                (location) =>
                  location.owner_id === member.id.slice("person:".length) &&
                  locationIsFresh(location, new Date(now)),
              )
            );
          const id = member.id.slice("beacon:".length);
          return (
            activities.some((activity) => activity.id === id) &&
            safePlaces.some(
              (place) =>
                place.activity_id === id &&
                place.online_url == null &&
                place.latitude != null &&
                place.longitude != null,
            )
          );
        }),
      }
    : null;
  const activeCluster =
    visibleCluster && visibleCluster.members.length > 1
      ? {
          ...visibleCluster,
          members: rankClusterMembers(
            visibleCluster.members,
            clusterPriorities,
          ),
        }
      : null;
  function chooseBeacon(id: string) {
    clearRouteSelection();
    setCluster(null);
    setClusterAnchor(null);
    setExpandedBeacon(null);
    setDetails(false);
    setPanelTab("Overview");
    setAnchor(null);
    setSelected(id);
    setPerson(null);
    setExpanded(false);
  }
  function choosePerson(id: string) {
    if (!selectFreshVisiblePersonLocation(data, id, userId!, now)) return;
    clearRouteSelection();
    setCluster(null);
    setClusterAnchor(null);
    setExpandedBeacon(null);
    setDetails(false);
    setPanelTab("Overview");
    setAnchor(null);
    setPerson(id);
    setExpanded(false);
    const beacon = activities.find(
      (activity) =>
        activity.owner_id === id &&
        activity.mode === "solo" &&
        activity.status === "scheduled" &&
        Date.parse(activity.starts_at) <= now &&
        Date.parse(activity.ends_at) > now,
    ) ?? activities.find((activity) => {
      const rsvp = data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === id);
      return !!rsvp && isApprovedGoing(activity, rsvp);
    }) ?? activities.find((activity) => activity.owner_id === id);
    setSelected(beacon?.id ?? null);
  }
  function startPickingLocation() {
    clearRouteSelection();
    setCluster(null);
    setClusterAnchor(null);
    setSelected(null);
    setPerson(null);
    setDetails(false);
    setExpanded(false);
    setPickedMapPoint(null);
    setPickMode(true);
    setPlaceSearchOpen(false);
  }
  function rememberNearMe() {
    if (exploration.area?.kind === "near-me" && exploration.area.coordinate)
      setLastNearMeArea(exploration.area);
  }
  function chooseKnownPlace(place: (typeof data.places)[number]) {
    if (place.latitude == null || place.longitude == null) return;
    clearRouteSelection();
    setCluster(null);
    setClusterAnchor(null);
    setSelected(null);
    setPerson(null);
    setDetails(false);
    setExpanded(false);
    setPickMode(false);
    setPickedMapPoint({
      latitude: place.latitude,
      longitude: place.longitude,
      label: place.label,
    });
    setPlaceSearchOpen(false);
  }
  function exploreSavedPlace(place: (typeof data.places)[number]) {
    if (place.latitude == null || place.longitude == null) return;
    clearRouteSelection();
    setCluster(null);
    setSelected(null);
    setPerson(null);
    setDetails(false);
    setPickedMapPoint(null);
    setPickMode(false);
    rememberNearMe();
    exploration.setQuery("");
    exploration.setArea({
      kind: "place",
      label: place.label,
      coordinate: { latitude: place.latitude, longitude: place.longitude },
      zoom: 15,
      source: "saved",
    });
    setPlaceSearchOpen(false);
  }
  function exploreGooglePlace(place: WorldwidePlace) {
    if (Platform.OS !== "android") return;
    clearRouteSelection();
    setCluster(null);
    setClusterAnchor(null);
    setSelected(null);
    setPerson(null);
    setDetails(false);
    setPickedMapPoint(null);
    setPickMode(false);
    setExpanded(false);
    rememberNearMe();
    exploration.setQuery("");
    exploration.setArea({
      kind: "place",
      label: place.label,
      coordinate: place.coordinate,
      zoom: 13,
      source: "google",
      attributions: place.attributions,
    });
    setPlaceSearchOpen(false);
  }
  function handleViewportChange(next: MapViewport, userMoved = true) {
    setViewport(next);
    setCluster(null);
    setClusterAnchor(null);
    setExpandedBeacon(null);
    const previous = previousViewport.current;
    previousViewport.current = next;
    if (selected || person || pickMode || pickedMapPoint) {
      setSearchThisArea(false);
      return;
    }
    if (!userMoved) return;
    if (previous) {
      const moved =
        Math.abs(next.center.latitude - previous.center.latitude) > 0.025 ||
        Math.abs(
          ((next.center.longitude - previous.center.longitude + 540) % 360) -
            180,
        ) > 0.025 ||
        Math.abs(next.zoom - previous.zoom) > 0.75;
      setSearchThisArea(moved);
    }
  }
  function commitVisibleArea() {
    if (!viewport) return;
    rememberNearMe();
    setSearchThisArea(false);
    setSelected(null);
    setPerson(null);
    setDetails(false);
    exploration.setArea({
      kind: "viewport",
      label: "Selected area",
      coordinate: viewport.center,
      zoom: viewport.zoom,
      bounds: viewport.bounds,
    });
  }
  function createBeaconHere() {
    if (!pickedMapPoint) return;
    setPickedMapPoint(null);
    setPickMode(false);
    router.push({
      pathname: "/create",
      params: {
        latitude: String(pickedMapPoint.latitude),
        longitude: String(pickedMapPoint.longitude),
        placeLabel: pickedMapPoint.label,
      },
    });
  }
  function setNearMe(coordinate: { latitude: number; longitude: number }) {
    if (!isValidCoordinate(coordinate)) return;
    const area: ExplorationArea = { kind: "near-me", label: "Near me", coordinate, zoom: 13 };
    setLastNearMeArea(area);
    exploration.setArea(area);
    setSearchThisArea(false);
    setCompassMessage("");
  }
  async function handleCompass() {
    if (compassBusy) return;
    const shared = data.locations.find((location) => location.owner_id === userId && locationIsFresh(location, new Date(now)) && location.latitude != null && location.longitude != null && isValidCoordinate({ latitude: location.latitude, longitude: location.longitude }));
    if (shared?.latitude != null && shared.longitude != null) {
      setNearMe({ latitude: shared.latitude, longitude: shared.longitude });
      return;
    }
    setCompassBusy(true);
    setCompassMessage("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setCompassMessage("Location permission is off. You can still explore anywhere.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      if (!isValidCoordinate(coordinate)) throw new Error("The device returned an invalid location.");
      setNearMe(coordinate);
    } catch (error) {
      setCompassMessage(error instanceof Error ? error.message : "Could not find your current location.");
    } finally {
      setCompassBusy(false);
    }
  }
  const mapAudiences = userId && data.viewer_id === userId ? [
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
  ] : [];
  const searchSquadResults = exploration.query.trim() && userId && data.viewer_id === userId
    ? data.squads.filter((squad) => canOpenSquadProfile(data, squad.id, userId) && matchesSearch(exploration.query, squad.name, squad.description)).slice(0, 4)
    : [];
  const searchOrganizationResults = exploration.query.trim() && userId && data.viewer_id === userId
    ? data.organizations.filter((organization) => mapAudiences.some((choice) => choice.kind === "Organization" && choice.id === organization.id) && matchesSearch(exploration.query, organization.name, organization.description)).slice(0, 4)
    : [];
  const myBeacon = data.activities.find((activity) => {
    const rsvp = data.rsvps.find((row) => row.activity_id === activity.id && row.user_id === userId);
    return activity.status === "scheduled" && Date.parse(activity.ends_at) > now && canReadBeaconActivity(data, activity, userId!) && (activity.owner_id === userId || (!!rsvp && isApprovedGoing(activity, rsvp)));
  });
  return (
    <KeyboardAvoidingView
      testID="full-map-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <BeaconMap
        fullScreen
        hideControls
        viewportInsets={{ top: insets.top + headerHeight + 14, right: 12, bottom: insets.bottom + 104, left: 12 }}
        controlsTop={insets.top + 76}
        panelHeight={panel && details ? panelHeight : 20}
        onAnchor={setAnchor}
        focused={pickedMapPoint ?? focused}
        activities={
          focusedBeacon && !activities.some((a) => a.id === selected)
            ? [...activities, focusedBeacon]
            : activities
        }
        places={safePlaces}
        locations={locations}
        profiles={data.profiles}
        clusterPriorities={clusterPriorities}
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
        selected={pickedMapPoint}
        onActivity={chooseBeacon}
        onPerson={choosePerson}
        onCluster={(nextCluster, nextAnchor) => {
          clearRouteSelection();
          setDetails(false);
          setExpanded(false);
          setSelected(null);
          setPerson(null);
          setExpandedBeacon(null);
          setCluster(nextCluster);
          setClusterAnchor(nextAnchor ?? null);
        }}
        onMapTap={() => {
          setFilterTrayOpen(false);
          clearRouteSelection();
          setDetails(false);
          setExpanded(false);
          setSelected(null);
          setPerson(null);
          setCluster(null);
          setClusterAnchor(null);
          router.setParams({ beacon: undefined, person: undefined });
        }}
        explorationTarget={explorationTarget}
        controlCommand={controlCommand}
        mapStyle={mapStyle}
        onRecenter={
          explorationTarget ? () => setTargetRevision((n) => n + 1) : undefined
        }
        onViewportChange={handleViewportChange}
      />
      <View style={{ position: "absolute", top: insets.top + 8, left: 0, right: 0, zIndex: 10 }}>
        <MapExplorationHeader
          query={exploration.query}
          onQueryChange={exploration.setQuery}
          areaLabel={exploration.area?.label ?? "Explore map"}
          resultCount={activities.length}
          planCount={planFilterOptions.length}
          filters={exploration.filters}
          onFiltersChange={exploration.setFilters}
          squadAudienceId={mapAudiences.find((choice) => choice.kind === "Squad" && choice.id === exploration.filters.audience)?.id}
          onCompass={() => setCompassSheetOpen(true)}
          onViewBeacons={() => router.push("/activities")}
          onOpenSquads={() => { setFilterTrayOpen(false); setAdvancedFiltersOpen(true); }}
          onMoreFilters={() => { setFilterTrayOpen(false); setAdvancedFiltersOpen(true); }}
          trayOpen={filterTrayOpen}
          onTrayOpenChange={setFilterTrayOpen}
          onSearchFocus={() => setPlaceSearchOpen(true)}
          searchThisArea={searchThisArea && !panel && !pickMode && !pickedMapPoint}
          onSearchThisArea={commitVisibleArea}
          onHeightChange={setHeaderHeight}
        />
      </View>
      {createdNotice && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            top: insets.top + 70,
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
      )}
      {(pickMode || pickedMapPoint) && (
        <View
          style={{
            position: "absolute",
            bottom: 20,
            left: 14,
            right: 14,
            padding: 12,
            gap: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white + "F5",
            boxShadow: "0 8px 28px #142e3033",
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
                setPickedMapPoint(null);
                setPickMode(false);
              }}
            >
              <X size={18} color={colors.green} />
            </IconButton>
          </View>
          {pickedMapPoint ? (
            <Button title="Create Beacon here" onPress={createBeaconHere} />
          ) : null}
        </View>
      )}
      {searchVisible && exploration.query.trim() ? <View style={{ position: "absolute", top: insets.top + headerHeight + 8, left: 12, right: 12, maxHeight: Math.min(height * 0.55, 440), zIndex: 12, padding: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white + "F8", boxShadow: "0 8px 28px #142e3033" }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
        {searchActivityResults.map((activity) => (
          <Pressable
            key={activity.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${activity.title} Beacon`}
            onPress={() => {
              setPlaceSearchOpen(false);
              chooseBeacon(activity.id);
            }}
            style={[styles.row, styles.card, { padding: 10 }]}
          >
            <MapPin size={17} color={colors.green} />
            <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>
              {activity.title}
            </Text>
          </Pressable>
        ))}
        {searchPeopleResults.map((profile) => (
          <Pressable
            key={profile.id}
            accessibilityRole="button"
            accessibilityLabel={`View ${profile.name} on map`}
            onPress={() => {
              setPlaceSearchOpen(false);
              if (selectFreshVisiblePersonLocation(data, profile.id, userId, now)) choosePerson(profile.id);
              else setPersonPreviewId(profile.id);
            }}
            style={[styles.row, styles.card, { padding: 10 }]}
          >
            <ProfileAvatar profile={profile} size={28} />
            <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>
              {profile.name}
            </Text>
          </Pressable>
        ))}
        {searchSquadResults.map((squad) => (
          <Pressable key={squad.id} accessibilityRole="button" accessibilityLabel={`Preview Squad ${squad.name}`} onPress={() => { setPlaceSearchOpen(false); setSquadPreviewId(squad.id); }} style={[styles.row, styles.card, { padding: 10 }]}>
            <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{squad.name}</Text><Text style={styles.muted}>Squad</Text>
          </Pressable>
        ))}
        {searchOrganizationResults.map((organization) => (
          <Pressable key={organization.id} accessibilityRole="button" accessibilityLabel={`Preview Organization ${organization.name}`} onPress={() => { setPlaceSearchOpen(false); setOrganizationPreviewId(organization.id); }} style={[styles.row, styles.card, { padding: 10 }]}>
            <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{organization.name}</Text><Text style={styles.muted}>Organization</Text>
          </Pressable>
        ))}
        {knownPlaceResults.length ? (
          knownPlaceResults.map((place) => (
            <View
              key={`${place.activity_id}:${place.latitude}:${place.longitude}`}
              style={{ gap: 4 }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Explore ${place.label}`}
                onPress={() => exploreSavedPlace(place)}
                style={[styles.row, styles.card, { padding: 10 }]}
              >
                <MapPin size={17} color={colors.green} />
                <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>
                  {place.label}
                </Text>
              </Pressable>
              <Button
                title={`Use ${place.label} for a new Beacon`}
                secondary
                compact
                onPress={() => chooseKnownPlace(place)}
              />
            </View>
          ))
        ) : (
          <Txt muted>
            No saved physical places match yet. Tap the map to choose a new
            spot.
          </Txt>
        )}
        <WorldwidePlaceSearch
          query={exploration.query}
          onChoose={Platform.OS === "android" ? exploreGooglePlace : undefined}
        />
        <Button
          title="Choose a point on the map"
          secondary
          onPress={startPickingLocation}
        />
      </ScrollView>
      </View> : null}
      {panel && !details && (
        <View
          testID="map-tooltip"
          style={{
            position: "absolute",
            width: Math.min(width - 88, 310),
            left: Math.max(
              12,
              Math.min(
                width - Math.min(width - 88, 310) - 70,
                (anchor?.x ?? width / 2) - Math.min(width - 88, 310) / 2,
              ),
            ),
            top: Math.max(
              insets.top + 85,
              Math.min(height - 360, (anchor?.y ?? height * 0.32) + 22),
            ),
          }}
        >
          <MapTooltip
            beaconId={selected}
            personId={person}
            pinned={!!focused}
            onDetails={() => {
              if (selected) {
                router.push({
                  pathname: "/activity/[id]",
                  params: { id: selected },
                });
              } else if (person) {
                router.push({
                  pathname: "/person/[id]",
                  params: { id: person },
                });
              }
            }}
            onMessage={() => {
              setPanelTab("Chat");
              setDetails(true);
              setExpanded(false);
            }}
            onClose={() => {
              clearRouteSelection();
              setSelected(null);
              setPerson(null);
            }}
          />
        </View>
      )}
      {panel && details && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            ...(expanded ? { top: insets.top + 76 } : { height: panelHeight }),
          }}
        >
          <MapPanel
            key={`${selected}:${person}`}
            beaconId={selected}
            personId={person}
            onBeacon={chooseBeacon}
            expanded={expanded}
            onExpand={setExpanded}
            initialTab={panelTab}
            onClose={() => {
              setDetails(false);
              setExpanded(false);
            }}
          />
        </View>
      )}
      {activeCluster && (
        <View
          testID="map-cluster-panel"
          style={{
            position: "absolute",
            width: Math.min(width - 24, 390),
            left: Math.max(
              12,
              Math.min(
                width - Math.min(width - 24, 390) - 12,
                (clusterAnchor?.x ?? width / 2) - Math.min(width - 24, 390) / 2,
              ),
            ),
            top: Math.max(
              insets.top + 76,
              Math.min(
                height - Math.min(height * 0.62, 500) - 16,
                (clusterAnchor?.y ?? height * 0.32) + 18,
              ),
            ),
            maxHeight: Math.min(height * 0.62, 500),
            backgroundColor: colors.white,
            borderColor: colors.line,
            borderWidth: 1,
            borderRadius: 24,
            padding: 14,
            gap: 8,
            boxShadow: "0 8px 28px #142e3033",
          }}
        >
          <View style={styles.between}>
            <View>
              <Text style={styles.label}>NEARBY</Text>
              <Text style={styles.h2}>
                {
                  activeCluster.members.filter(
                    (member) => member.kind === "beacon",
                  ).length
                }{" "}
                Beacons ·{" "}
                {
                  activeCluster.members.filter(
                    (member) => member.kind === "person",
                  ).length
                }{" "}
                People
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close map cluster"
              onPress={() => {
                setCluster(null);
                setClusterAnchor(null);
              }}
              style={{ padding: 8 }}
            >
              <Text style={styles.label}>CLOSE</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {!!activeCluster.members.some(
              (member) => member.kind === "beacon",
            ) && (
              <>
                <Text style={styles.label}>BEACONS</Text>
                {activeCluster.members
                  .filter((member) => member.kind === "beacon")
                  .map((member) => {
                    const activity = data.activities.find(
                      (item) => item.id === member.id.slice("beacon:".length),
                    );
                    if (!activity) return null;
                    const isExpanded = expandedBeacon === activity.id;
                    const visibleGoing = crew(data, activity).filter(
                      ({ person: profile, status }) =>
                        (status === "Going" || status === "Hosting") &&
                        canViewProfile(data, profile, userId!),
                    );
                    return (
                      <View
                        key={member.id}
                        style={[styles.card, { padding: 10, gap: 8 }]}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} ${activity.title} in map cluster`}
                          accessibilityState={{ expanded: isExpanded }}
                          onPress={() =>
                            setExpandedBeacon(isExpanded ? null : activity.id)
                          }
                          style={styles.between}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.body}>{activity.title}</Text>
                            <Text style={styles.muted} numberOfLines={1}>
                              {activityWhen(activity)} ·{" "}
                              {safePlaces.find(
                                (place) => place.activity_id === activity.id,
                              )?.label || "Place to be decided"}
                            </Text>
                          </View>
                          <Text style={styles.label}>
                            {isExpanded ? "HIDE PEOPLE" : "PEOPLE"}
                          </Text>
                        </Pressable>
                        {isExpanded && (
                          <>
                            {visibleGoing.map(({ person: profile, status }) => (
                              <Pressable
                                key={profile.id}
                                accessibilityRole="button"
                                accessibilityLabel={`View ${profile.name} on map`}
                                onPress={() => {
                                  setCluster(null);
                                  choosePerson(profile.id);
                                }}
                                style={styles.row}
                              >
                                <ProfileAvatar profile={profile} size={30} />
                                <Text style={styles.body}>{profile.name}</Text>
                                <Text style={styles.muted}>{status}</Text>
                              </Pressable>
                            ))}
                            {!visibleGoing.length && (
                              <Txt muted>
                                No visible people have joined yet.
                              </Txt>
                            )}
                            <Button
                              title="Open Beacon"
                              secondary
                              onPress={() => {
                                setCluster(null);
                                chooseBeacon(activity.id);
                              }}
                            />
                          </>
                        )}
                      </View>
                    );
                  })}
              </>
            )}
            {!!activeCluster.members.some(
              (member) => member.kind === "person",
            ) && (
              <>
                <Text style={styles.label}>PEOPLE</Text>
                {activeCluster.members
                  .filter((member) => member.kind === "person")
                  .map((member) => {
                    const id = member.id.slice("person:".length);
                    const profile = data.profiles.find(
                      (candidate) => candidate.id === id,
                    );
                    if (!profile || !canViewProfile(data, profile, userId!))
                      return null;
                    const statusBeacon = data.activities.find(
                      (activity) =>
                        activity.owner_id === id &&
                        canReadBeaconActivity(data, activity, userId!) &&
                        activity.status === "scheduled" &&
                        Date.parse(activity.starts_at) <= now &&
                        Date.parse(activity.ends_at) > now,
                    );
                    return (
                      <Pressable
                        key={member.id}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${profile.name} on map`}
                        onPress={() => {
                          setCluster(null);
                          choosePerson(id);
                        }}
                        style={[styles.row, styles.card, { padding: 8 }]}
                      >
                        <ProfileAvatar profile={profile} size={30} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.body}>{profile.name}</Text>
                          <Text style={styles.muted}>
                            {statusBeacon?.title ?? "Sharing location"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
              </>
            )}
          </ScrollView>
        </View>
      )}
      {!panel && !pickMode && !pickedMapPoint ? <View style={{ position: "absolute", right: 14, bottom: insets.bottom + 26 }}><IconButton label="Map options" onPress={() => setMapOptionsOpen(true)}><Layers3 size={20} color={colors.green} /></IconButton></View> : null}
      {!panel && !pickMode && !pickedMapPoint ? <View testID="map-sharing-control" style={{ position: "absolute", left: 14, bottom: insets.bottom + 26 }}><Pressable accessibilityRole="button" accessibilityLabel="Location sharing and My Beacon" onPress={() => setSharingSheetOpen(true)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }}><LocateFixed size={17} color={colors.green} /><Text style={styles.label}>Sharing · My Beacon</Text></Pressable></View> : null}
      {compassMessage ? <View accessibilityLiveRegion="polite" style={{ position: "absolute", top: insets.top + headerHeight + 4, alignSelf: "center", zIndex: 13, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.white }}><Text style={styles.muted}>{compassMessage}</Text></View> : null}
      <Sheet title="Map options" visible={mapOptionsOpen} onClose={() => setMapOptionsOpen(false)}>
        <Text style={styles.h2}>Appearance</Text>
        {Platform.OS !== "web" ? <Chips options={["Standard", "Satellite"]} value={mapStyle === "standard" ? "Standard" : "Satellite"} onChange={(value) => setMapStyle(value === "Satellite" ? "satellite" : "standard")} showSelectedCheckmark={false} /> : <Txt muted>Standard map on this device.</Txt>}
        <Button title="Fit visible results" secondary onPress={() => { mapCommand("fit"); setMapOptionsOpen(false); }} />
        <Button title="Done" onPress={() => setMapOptionsOpen(false)} />
      </Sheet>
      <AdvancedMapFilters visible={advancedFiltersOpen} onClose={() => setAdvancedFiltersOpen(false)} filters={exploration.filters} onChange={exploration.setFilters} audiences={mapAudiences} planOptions={planFilterOptions} resultCount={activities.length} />
      <Sheet title="Location sharing and My Beacon" visible={sharingSheetOpen} onClose={() => setSharingSheetOpen(false)}>
        <Text style={styles.h2}>Your location</Text>
        <Txt muted>{data.locations.some((location) => location.owner_id === userId && locationIsFresh(location, new Date(now))) ? `Sharing a fresh location${(data.location_recipients ?? []).length ? ` with ${(data.location_recipients ?? []).length} people` : ""}.` : "You are not currently sharing a fresh location."}</Txt>
        <Button title="Location sharing settings" secondary onPress={() => { setSharingSheetOpen(false); router.push("/location"); }} />
        {myBeacon ? <Button title="Focus my Beacon" onPress={() => { setSharingSheetOpen(false); chooseBeacon(myBeacon.id); }} /> : <Txt muted>No active Beacon you host or have joined.</Txt>}
      </Sheet>
      <Sheet title="Compass & area" visible={compassSheetOpen} onClose={() => setCompassSheetOpen(false)}>
        <Text style={styles.h2}>{exploration.area?.label ?? "Explore anywhere"}</Text>
        <Txt muted>Choose how to move the map. Your location is only requested when you tap Use my location.</Txt>
        {exploration.area?.kind === "near-me" && exploration.area.coordinate ? <Button title="Return near me" secondary onPress={() => { setTargetRevision((revision) => revision + 1); setCompassSheetOpen(false); setSearchThisArea(false); }} /> : null}
        {lastNearMeArea?.kind === "near-me" && lastNearMeArea.coordinate && exploration.area?.kind !== "near-me" ? <Button title="Back to last near-me area" secondary onPress={() => { exploration.setArea(lastNearMeArea); setCompassSheetOpen(false); }} /> : null}
        <Button title={compassBusy ? "Finding location…" : "Use my location"} disabled={compassBusy} onPress={() => { setCompassSheetOpen(false); void handleCompass(); }} />
        <Button title="Return to overview" secondary onPress={() => { mapCommand("fit"); setSearchThisArea(false); setCompassSheetOpen(false); }} />
        <Button title="Explore everywhere" secondary onPress={() => { exploration.setArea(null); mapCommand("fit"); setCompassSheetOpen(false); }} />
        <Button title="Search another place" secondary onPress={() => { setCompassSheetOpen(false); setPlaceSearchOpen(true); }} />
      </Sheet>
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
