import Svg, { Path as CountPath } from "react-native-svg";
import {
  CLUSTER_COUNT_PATHS,
  clusterCountAccessibilityLabel,
  type ClusterCountPart,
  type ClusterCountAction,
} from "../clusterLayout";
import { ClusterArtworkCache } from "../clusterArtwork";
import { bloomGeometry } from "../clusterBloom";
import {
  categoryMarkerGlyphs,
  visibleFriendLabels,
  ownsMapBeacon,
} from "../markerIdentity";
import {
  nativeMapMode,
  MapPresentationCache,
  presentationOpensExplorer,
  presentationArtworkPoints,
  type NativeMapMode,
  type NativeMapPresentation,
} from "../nativeMapPresentation";
import { ExpandedMapStack, LivingMapPin } from "./LivingMapMarkers.native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { LocateFixed, MapPin, SlidersHorizontal } from "lucide-react-native";
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { friendAvailabilityState, locationIsFresh } from "@/src/shared/domain";
import { isValidCoordinate } from "@/src/shared/exploration";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import { useDesignTheme } from "@/src/theme";
import { googleMapStyles } from "@/src/theme/map";
import { useNow } from "@/src/shared/useNow";
import { useReducedMotion } from "@/src/shared/design-system";
import type { MapProps } from "@/src/features/maps/components/BeaconMap";
import {
  formatLocationAge,
  MAP_MAX_ZOOM,
  MAX_RENDERED_MAP_FEATURES,
} from "@/src/features/maps/cluster";
import type { ClusterPoint, MapPointGroup } from "@/src/features/maps/cluster";
import {
  BeaconMapPin,
  FriendMapPin,
  NowBeaconHalo,
} from "@/src/features/maps/components/BeaconMapMarkers.native";
import { pulseLayerPolicy } from "@/src/features/pulse/pulseLayerPolicy";
import {
  collidePulseBadges,
  pulseHasBeacon,
  type ProjectedPulse,
} from "@/src/features/maps/pulseMapPolicy";
import { providerMapBounds } from "../mapBounds";
import { PulseMapOverlay } from "./PulseMapOverlay";
import type { Category } from "@/src/shared/types";
const fitEdgePadding = { top: 24, right: 24, bottom: 24, left: 24 };
function hasUsableMapViewport(size: { width: number; height: number }) {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

function isValidMapZoom(zoom: number) {
  return Number.isFinite(zoom) && zoom >= 0 && zoom <= MAP_MAX_ZOOM;
}

function isValidMapRegion(region: {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}) {
  return (
    isValidCoordinate(region) &&
    Number.isFinite(region.latitudeDelta) &&
    region.latitudeDelta > 0 &&
    Number.isFinite(region.longitudeDelta) &&
    region.longitudeDelta > 0
  );
}

function nativeMapZoom(longitudeDelta: number, width: number) {
  if (
    !Number.isFinite(longitudeDelta) ||
    longitudeDelta <= 0 ||
    !Number.isFinite(width) ||
    width <= 0
  )
    return 0;
  return Math.max(
    0,
    Math.min(MAP_MAX_ZOOM, Math.log2((width * 360) / (256 * longitudeDelta))),
  );
}

function isNowBeacon(activity: MapProps["activities"][number], now: number) {
  return (
    activity.status === "scheduled" &&
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now
  );
}

function mapTimeChip(activity: MapProps["activities"][number], now: number) {
  const startsAt = Date.parse(activity.starts_at);
  const endsAt = Date.parse(activity.ends_at);
  if (startsAt <= now && endsAt > now)
    return `${Math.max(1, Math.ceil((endsAt - now) / 60_000))}m left`;
  if (!Number.isFinite(startsAt)) return "";
  return new Date(startsAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
export default function BeaconMap({
  contextPoints = [],
  contextPaths = [],
  onContextPoint,
  activities,
  availabilityActivities,
  places,
  locations,
  profiles,
  onActivity,
  onPerson,
  onPick,
  selected,
  selectionIsTemporary = false,
  fullScreen = false,
  hideControls = false,
  controlsTop = 12,
  panelHeight = 0,
  viewportInsets,
  focused,
  anchorCoordinate,
  previewHeight,
  onAnchor,
  onCluster,
  clusterPriorities = {},
  friendsProminent = false,
  onMapTap,
  onViewportChange,
  onBearingChange,
  explorationTarget,
  onOptions,
  onRecenter,
  controlCommand,
  mapStyle,
  selectedActivityId = null,
  onLongPress,
  onPlace,
  onGestureChange,
  pulseSummaries = [],
  pulsePlaces = [],
  pulsePopToken,
  pulsePopPlaceKey,
  calm = false,
}: MapProps) {
  const { data: identityData, userId: identityViewer } = useBeacon();
  const { colors, resolvedAppearance } = useTheme();
  const { categories, availability } = useDesignTheme();

  const map = useRef<MapView>(null);
  const projectionBusy = useRef(false);
  const gestureActive = useRef(false);
  const suppressMapPressUntil = useRef(0);
  const [ready, setReady] = useState(false);
  const [pulsePoints, setPulsePoints] = useState<ProjectedPulse[]>([]);
  const [pulseHalos, setPulseHalos] = useState<ProjectedPulse[]>([]);
  const [region, setRegion] = useState({
    latitude: 41.885,
    longitude: -87.642,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  });
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const didInitialFit = useRef(false);
  const appliedTargetRevision = useRef<number | null>(null);
  const appliedControlRevision = useRef<number | null>(null);
  const appliedFocusedTarget = useRef<string | null>(null);
  const { height } = useWindowDimensions();
  const { showAvatars } = usePreferences();
  const now = useNow();
  const reducedMotion = useReducedMotion();
  const categoryColors = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(categories) as Category[]).map((category) => [
          category,
          categories[category].color,
        ]),
      ) as Record<Category, string>,
    [categories],
  );
  useEffect(() => {
    let active = true;
    if (
      !ready ||
      !map.current ||
      !mapSize.width ||
      !mapSize.height ||
      !pulseSummaries.length
    ) {
      setPulsePoints([]);
      setPulseHalos([]);
      return;
    }
    const bounds = providerMapBounds(
      region.latitude + region.latitudeDelta / 2,
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region.longitude - region.longitudeDelta / 2,
    );
    const policy = pulseLayerPolicy(
      nativeMapZoom(region.longitudeDelta, mapSize.width),
      bounds,
      pulseSummaries,
    );
    const project = async (summaries: typeof policy.badges) =>
      Promise.all(
        summaries.map(async (summary) => {
          const point = await map.current!.pointForCoordinate({
            latitude: summary.lat,
            longitude: summary.lng,
          });
          return {
            summary,
            x: point.x,
            y: point.y,
            satellite: pulseHasBeacon(
              summary,
              places.filter((place) =>
                activities.some(
                  (activity) => activity.id === place.activity_id,
                ),
              ),
            ),
          };
        }),
      );
    void Promise.all([project(policy.badges), project(policy.halos)])
      .then(([badges, halos]) => {
        if (active) {
          setPulsePoints(
            collidePulseBadges(badges, mapSize.width, mapSize.height),
          );
          setPulseHalos(halos);
        }
      })
      .catch(() => {
        if (active) {
          setPulsePoints([]);
          setPulseHalos([]);
        }
      });
    return () => {
      active = false;
    };
  }, [ready, region, mapSize, pulseSummaries, places, activities]);
  const latestSelectionActions = useRef({ onActivity, onPerson });
  useEffect(() => {
    latestSelectionActions.current = { onActivity, onPerson };
  }, [onActivity, onPerson]);
  const selectActivity = useCallback(
    (id: string) => latestSelectionActions.current.onActivity(id),
    [],
  );
  const selectPerson = useCallback(
    (id: string) => latestSelectionActions.current.onPerson(id),
    [],
  );
  const appearanceKey = `${resolvedAppearance}:${colors.bg}:${colors.green}`;
  const mapPadding = {
    top: viewportInsets?.top ?? (fullScreen ? controlsTop : 10),
    right: viewportInsets?.right ?? 10,
    bottom: viewportInsets?.bottom ?? panelHeight,
    left: viewportInsets?.left ?? 10,
  };
  const pins = useMemo(
    () => [
      ...new Map(
        places
          .filter(
            (p) =>
              p.online_url == null &&
              p.latitude != null &&
              p.longitude != null &&
              isValidCoordinate({
                latitude: p.latitude,
                longitude: p.longitude,
              }) &&
              activities.some((a) => a.id === p.activity_id),
          )
          .map((place) => [place.activity_id, place]),
      ).values(),
    ],
    [places, activities],
  );
  const freshLocations = useMemo(
    () =>
      showAvatars
        ? [
            ...new Map(
              locations
                .filter(
                  (location) =>
                    locationIsFresh(location, new Date(now)) &&
                    formatLocationAge(location.updated_at, now) !== null &&
                    location.latitude != null &&
                    location.longitude != null &&
                    isValidCoordinate({
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }) &&
                    profiles.some(
                      (profile) => profile.id === location.owner_id,
                    ),
                )
                .sort(
                  (a, b) =>
                    Date.parse(a.updated_at ?? "") -
                      Date.parse(b.updated_at ?? "") ||
                    a.id.localeCompare(b.id),
                )
                .map((location) => [location.owner_id, location]),
            ).values(),
          ]
        : [],
    [showAvatars, locations, now, profiles],
  );
  const points = [
    ...pins.map((p) => ({
      latitude: p.latitude!,
      longitude: p.longitude!,
    })),
    ...freshLocations.map((location) => ({
      latitude: location.latitude!,
      longitude: location.longitude!,
    })),
  ];
  const coordinates = JSON.stringify(points);
  useEffect(() => {
    if (
      !ready ||
      !hasUsableMapViewport(mapSize) ||
      onPick ||
      explorationTarget ||
      controlCommand?.coordinates?.length ||
      didInitialFit.current
    )
      return;
    const next = JSON.parse(coordinates);
    if (next.length) {
      const currentMap = map.current;
      if (!currentMap) return;
      currentMap.fitToCoordinates(next, {
        edgePadding: fitEdgePadding,
        animated: true,
      });
      didInitialFit.current = true;
    }
  }, [coordinates, ready, mapSize, onPick, explorationTarget, controlCommand]);
  useEffect(() => {
    if (
      !ready ||
      !hasUsableMapViewport(mapSize) ||
      (onPick && controlCommand?.kind !== "focus") ||
      !controlCommand
    )
      return;
    if (appliedControlRevision.current === controlCommand.revision) return;
    const currentMap = map.current;
    if (!currentMap) return;
    if (controlCommand.kind === "north") {
      // A partial camera update preserves center, zoom and pitch.
      currentMap.animateCamera({ heading: 0 }, { duration: 180 });
      appliedControlRevision.current = controlCommand.revision;
      return;
    }

    if (controlCommand.kind === "focus" && controlCommand.coordinates?.[0]) {
      currentMap.animateCamera(
        { center: controlCommand.coordinates[0], zoom: 16 },
        { duration: reducedMotion ? 0 : 180 },
      );
      appliedControlRevision.current = controlCommand.revision;
      return;
    }
    if (controlCommand.kind === "restore" && controlCommand.camera) {
      const { center, bounds } = controlCommand.camera;
      currentMap.animateToRegion(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: bounds.north - bounds.south,
          longitudeDelta: bounds.east - bounds.west,
        },
        180,
      );
      appliedControlRevision.current = controlCommand.revision;
      return;
    }
    if (controlCommand.kind === "fit") {
      didInitialFit.current = true;
      const visibleCoordinates =
        controlCommand.coordinates ?? JSON.parse(coordinates);
      if (visibleCoordinates.length)
        currentMap.fitToCoordinates(visibleCoordinates, {
          edgePadding: {
            top: mapPadding.top + 24,
            right: mapPadding.right + 24,
            bottom: mapPadding.bottom + 24,
            left: mapPadding.left + 24,
          },
          animated: !controlCommand.coordinates?.length,
        });
      appliedControlRevision.current = controlCommand.revision;
      return;
    }
    if (!isValidMapRegion(region)) return;

    const factor = controlCommand.kind === "zoom-in" ? 0.5 : 2;
    currentMap.animateToRegion(
      {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: Math.max(
          0.001,
          Math.min(180, region.latitudeDelta * factor),
        ),
        longitudeDelta: Math.max(
          0.001,
          Math.min(360, region.longitudeDelta * factor),
        ),
      },
      250,
    );
    appliedControlRevision.current = controlCommand.revision;
  }, [
    controlCommand,
    reducedMotion,
    coordinates,
    onPick,
    ready,
    region,
    mapSize,
    mapPadding.top,
    mapPadding.right,
    mapPadding.bottom,
    mapPadding.left,
  ]);
  const focusedLat = focused?.latitude,
    focusedLng = focused?.longitude;
  useEffect(() => {
    if (!explorationTarget) {
      appliedTargetRevision.current = null;
      return;
    }
    if (
      !ready ||
      !hasUsableMapViewport(mapSize) ||
      onPick ||
      !isValidMapZoom(explorationTarget.zoom) ||
      !isValidCoordinate(explorationTarget.center)
    )
      return;
    if (appliedTargetRevision.current === explorationTarget.revision) return;
    const currentMap = map.current;
    if (!currentMap) return;
    currentMap.animateToRegion(
      {
        latitude: explorationTarget.center.latitude,
        longitude: explorationTarget.center.longitude,
        latitudeDelta: 360 / 2 ** explorationTarget.zoom,
        longitudeDelta: 360 / 2 ** explorationTarget.zoom,
      },
      450,
    );
    appliedTargetRevision.current = explorationTarget.revision;
  }, [ready, onPick, explorationTarget, mapSize]);
  useEffect(() => {
    if (onPick) return;
    if (focusedLat == null || focusedLng == null) {
      appliedFocusedTarget.current = null;
      return;
    }
    const focusKey = `${focusedLat},${focusedLng}`;
    if (appliedFocusedTarget.current === focusKey) return;
    if (
      ready &&
      hasUsableMapViewport(mapSize) &&
      isValidCoordinate({ latitude: focusedLat, longitude: focusedLng })
    ) {
      const currentMap = map.current;
      if (!currentMap) return;
      currentMap.animateToRegion(
        {
          latitude:
            focusedLat +
            0.006 *
              (((mapPadding.top - mapPadding.bottom) / 2 +
                (previewHeight
                  ? Math.min(
                      previewHeight / 2,
                      Math.max(
                        0,
                        (mapSize.height - mapPadding.top - mapPadding.bottom) /
                          2 -
                          48,
                      ),
                    )
                  : 0)) /
                mapSize.height),
          longitude:
            focusedLng -
            0.006 * ((mapPadding.left - mapPadding.right) / 2 / mapSize.width),
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        reducedMotion ? 0 : 500,
      );
      appliedFocusedTarget.current = focusKey;
    }
  }, [
    ready,
    focusedLat,
    focusedLng,
    onPick,
    mapSize,
    mapPadding.top,
    mapPadding.bottom,
    mapPadding.left,
    mapPadding.right,
    previewHeight,
    reducedMotion,
  ]);
  function recenter() {
    if (onRecenter) onRecenter();
    else if (points.length && hasUsableMapViewport(mapSize))
      map.current?.fitToCoordinates(points, {
        edgePadding: fitEdgePadding,
        animated: true,
      });
  }
  const anchorLat = anchorCoordinate?.latitude ?? focused?.latitude;
  const anchorLng = anchorCoordinate?.longitude ?? focused?.longitude;
  const updateAnchor = useCallback(async () => {
    if (
      anchorLat == null ||
      anchorLng == null ||
      !hasUsableMapViewport(mapSize)
    ) {
      onAnchor?.(null);
      return;
    }
    if (projectionBusy.current) return;
    projectionBusy.current = true;
    try {
      const point = await map.current?.pointForCoordinate({
        latitude: anchorLat,
        longitude: anchorLng,
      });
      if (point) onAnchor?.(point);
    } catch {
      onAnchor?.(null);
    } finally {
      projectionBusy.current = false;
    }
  }, [anchorLat, anchorLng, mapSize, onAnchor]);
  useEffect(() => {
    if (ready) void updateAnchor();
  }, [ready, updateAnchor]);
  const first = (selected && isValidCoordinate(selected) ? selected : null) ??
    pins[0] ?? { latitude: 41.885, longitude: -87.642 };
  const initialTargetIsValid =
    explorationTarget != null &&
    isValidCoordinate(explorationTarget.center) &&
    isValidMapZoom(explorationTarget.zoom);
  const mapPoints = useMemo(
    () => [
      ...contextPoints
        .filter((point) => point.publicBeaconId)
        .map((point) => ({
          id: `beacon:${point.publicBeaconId}`,
          kind: "beacon" as const,
          latitude: point.latitude,
          longitude: point.longitude,
          category: point.category,
        })),
      ...pins.map((place) => ({
        id: `beacon:${place.activity_id}`,
        kind: "beacon" as const,
        latitude: place.latitude!,
        longitude: place.longitude!,
        category: activities.find(
          (activity) => activity.id === place.activity_id,
        )?.category,
      })),
      ...freshLocations.map((location) => ({
        id: `person:${location.owner_id}`,
        kind: "person" as const,
        latitude: location.latitude!,
        longitude: location.longitude!,
      })),
    ],
    [contextPoints, pins, activities, freshLocations],
  );
  const zoom = nativeMapZoom(region.longitudeDelta, mapSize.width);
  const [presentationMode, setPresentationMode] =
    useState<NativeMapMode>("swarm");
  const ownedIds = useMemo(
    () =>
      new Set(
        activities
          .filter((activity) =>
            ownsMapBeacon(identityData, activity, identityViewer),
          )
          .map((activity) => `beacon:${activity.id}`),
      ),
    [activities, identityData, identityViewer],
  );
  const reservedFeatures =
    contextPaths.length + contextPoints.length + Number(!!selected);
  const [presentationCache] = useState(() => new MapPresentationCache());
  const presentations = useMemo(
    () =>
      presentationCache.select(
        mapPoints,
        {
          centerLatitude: region.latitude,
          centerLongitude: region.longitude,
          zoom,
          width: mapSize.width,
          height: mapSize.height,
        },
        presentationMode,
        clusterPriorities,
        ownedIds,
        Math.max(10, MAX_RENDERED_MAP_FEATURES - reservedFeatures),
        friendsProminent,
      ),
    [
      presentationCache,
      mapPoints,
      region,
      zoom,
      mapSize,
      presentationMode,
      clusterPriorities,
      ownedIds,
      reservedFeatures,
      friendsProminent,
    ],
  );
  const [artworkCache] = useState(() => new ClusterArtworkCache());
  const memberModels = useMemo(
    () =>
      artworkCache.build(
        presentations.flatMap(presentationArtworkPoints),
        activities,
        profiles,
        freshLocations,
        availabilityActivities ?? activities,
        identityData,
        identityViewer,
        now,
      ),
    [
      artworkCache,
      presentations,
      activities,
      profiles,
      freshLocations,
      availabilityActivities,
      identityData,
      identityViewer,
      now,
    ],
  );
  const availabilityColors = useMemo(
    () => ({
      available: availability.available.color,
      unavailable: availability.unavailable.color,
      "ending-soon": availability.endingSoon.color,
      unknown: availability.unknown.color,
    }),
    [availability],
  );
  const clusterAppearanceKey = `${appearanceKey}:${JSON.stringify(categoryColors)}:${JSON.stringify(availabilityColors)}`;
  const modelsFor = (item: NativeMapPresentation) =>
    presentationArtworkPoints(item)
      .map((point) => memberModels.get(point.id))
      .filter((model): model is NonNullable<typeof model> => !!model);
  const nativeFeatureCount = presentations.reduce(
    (sum, item) => sum + item.featureCost,
    0,
  );
  const renderedSingletonIds = new Set(
    presentations
      .filter(
        (item) => item.mode === "stack" && item.group.members.length === 1,
      )
      .map((item) => item.group.members[0].id),
  );
  const [expandedStack, setExpandedStack] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [cameraMoving, setCameraMoving] = useState(false);
  const [countBadges, setCountBadges] = useState<
    {
      item: NativeMapPresentation;
      x: number;
      y: number;
      width: number;
      height: number;
      peopleCount: number;
      beaconTotal: number;
      parts: ClusterCountPart[];
      activation: ClusterCountAction;
      fontSize: number;
    }[]
  >([]);
  useEffect(() => {
    let active = true;
    if (!ready || onPick || cameraMoving) return;
    void Promise.all(
      presentations.map(async (item) => {
        const badge = bloomGeometry(item).countBadge;
        if (!badge) return null;
        try {
          const anchor = await map.current?.pointForCoordinate({
            latitude: item.group.latitude,
            longitude: item.group.longitude,
          });
          return anchor
            ? {
                item,
                x: anchor.x + badge.offset.x,
                y: anchor.y + badge.offset.y,
                width: badge.width,
                height: badge.height,
                peopleCount: badge.peopleCount,
                beaconTotal: badge.beaconTotal,
                parts: badge.parts,
                activation: badge.activation,
                fontSize: badge.fontSize,
              }
            : null;
        } catch {
          return null;
        }
      }),
    ).then((values) => {
      if (active)
        setCountBadges(
          values.filter((value): value is NonNullable<typeof value> => !!value),
        );
    });
    return () => {
      active = false;
    };
  }, [
    ready,
    onPick,
    cameraMoving,
    presentations,
    region,
    mapSize,
    mapPadding.top,
    mapPadding.right,
    mapPadding.bottom,
    mapPadding.left,
  ]);
  const expansionRevision = useRef(0);
  const closeStack = useCallback(() => {
    expansionRevision.current++;
    setExpandedStack(null);
  }, []);
  const expandedPresentation = expandedStack
    ? presentations.find(
        (item) =>
          item.group.id === expandedStack.id &&
          !presentationOpensExplorer(item),
      )
    : undefined;
  function selectStackMember(member: ClusterPoint) {
    closeStack();
    if (onPick) return;
    if (member.kind === "beacon") {
      const context = contextPoints.find(
        (point) => point.publicBeaconId === member.id.slice(7),
      );
      if (
        context &&
        !activities.some((activity) => activity.id === member.id.slice(7))
      )
        onContextPoint?.(context);
      else selectActivity(member.id.slice(7));
    } else selectPerson(member.id.slice(7));
  }
  async function pressPresentation(presentation: NativeMapPresentation) {
    if (onPick) return;
    closeStack();
    if (presentationOpensExplorer(presentation)) {
      void pressCluster(
        presentation.group,
        false,
        presentation.forceExplorer || !presentation.beacons.length
          ? "Friends"
          : undefined,
      );
      return;
    }
    const revision = expansionRevision.current;
    try {
      const point = await map.current?.pointForCoordinate(presentation.group);
      if (point && revision === expansionRevision.current)
        setExpandedStack({ id: presentation.group.id, x: point.x, y: point.y });
    } catch {
      // The native accessibility actions still provide exact-item selection.
    }
  }
  const availableHaloSlots = Math.max(
    0,
    MAX_RENDERED_MAP_FEATURES - nativeFeatureCount - reservedFeatures,
  );
  const nowHaloIds = new Set(
    pins
      .filter((place) =>
        renderedSingletonIds.has(`beacon:${place.activity_id}`),
      )
      .filter((place) => {
        const activity = activities.find(
          (item) => item.id === place.activity_id,
        );
        return !!activity && isNowBeacon(activity, now);
      })
      .slice(0, availableHaloSlots)
      .map((place) => `beacon:${place.activity_id}`),
  );
  async function pressCluster(
    group: MapPointGroup,
    areaSummary = false,
    section?: "Beacons" | "Friends",
  ) {
    const currentMap = map.current;
    if (!currentMap) return;
    const zoom = nativeMapZoom(region.longitudeDelta, mapSize.width);
    const targetZoom = areaSummary
      ? 13
      : Math.min(MAP_MAX_ZOOM, zoom + (zoom < 16 ? 0.5 : 0));
    const scale = 2 ** (zoom - targetZoom);
    currentMap.animateToRegion(
      {
        latitude: group.latitude,
        longitude: group.longitude,
        latitudeDelta: region.latitudeDelta * scale,
        longitudeDelta: region.longitudeDelta * scale,
      },
      reducedMotion ? 0 : 300,
    );
    if (areaSummary) return;
    try {
      const anchor = await currentMap.pointForCoordinate({
        latitude: group.latitude,
        longitude: group.longitude,
      });
      onCluster?.(group, anchor ?? null, section);
    } catch {
      onCluster?.(group, null, section);
    }
  }
  const clusterActions = useRef({ pressPresentation, selectStackMember });
  useEffect(() => {
    clusterActions.current = { pressPresentation, selectStackMember };
  });
  const handlePresentation = useCallback((item: NativeMapPresentation) => {
    void clusterActions.current.pressPresentation(item);
  }, []);
  const handleMember = useCallback(
    (point: ClusterPoint) => clusterActions.current.selectStackMember(point),
    [],
  );
  const friendLabelIds = visibleFriendLabels(
    freshLocations
      .filter((l) => renderedSingletonIds.has(`person:${l.owner_id}`))
      .map((l) => ({
        id: l.owner_id,
        latitude: l.latitude!,
        longitude: l.longitude!,
      })),
    nativeMapZoom(region.longitudeDelta, mapSize.width),
  );
  return (
    <View
      onLayout={(event) =>
        setMapSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
      style={{
        backgroundColor: colors.bg,
        height: fullScreen
          ? "100%"
          : onPick
            ? 260
            : Math.max(220, Math.min(400, height * 0.44)),
        width: "100%",
        borderRadius: fullScreen ? 0 : 24,
        overflow: "hidden",
      }}
    >
      {/* Android Fabric can apply mapPadding before GoogleMap is initialized. */}
      <MapView
        ref={map}
        onMapReady={() => setReady(true)}
        onRegionChangeComplete={(nextRegion, details) => {
          if (!isValidMapRegion(nextRegion)) return;
          setCountBadges([]);
          setCameraMoving(false);
          closeStack();
          setRegion(nextRegion);
          setPresentationMode((previous) =>
            nativeMapMode(
              nativeMapZoom(nextRegion.longitudeDelta, mapSize.width),
              previous,
            ),
          );
          if (onBearingChange)
            void map.current
              ?.getCamera()
              .then((camera) => onBearingChange(camera.heading))
              .catch(() => {});
          if (hasUsableMapViewport(mapSize))
            onViewportChange?.(
              {
                center: {
                  latitude: nextRegion.latitude,
                  longitude: nextRegion.longitude,
                },
                zoom: nativeMapZoom(nextRegion.longitudeDelta, mapSize.width),
                bounds: providerMapBounds(
                  nextRegion.latitude + nextRegion.latitudeDelta / 2,
                  nextRegion.latitude - nextRegion.latitudeDelta / 2,
                  nextRegion.longitude + nextRegion.longitudeDelta / 2,
                  nextRegion.longitude - nextRegion.longitudeDelta / 2,
                ),
              },
              details?.isGesture ?? gestureActive.current,
            );
          gestureActive.current = false;
          onGestureChange?.(false);
          void updateAnchor();
        }}
        onPanDrag={() => {
          closeStack();
          gestureActive.current = true;
          onGestureChange?.(true);
        }}
        onRegionChange={(next, details) => {
          setCameraMoving(true);
          closeStack();
          if (details?.isGesture) {
            gestureActive.current = true;
            onGestureChange?.(true);
          }
          void updateAnchor();
        }}
        userInterfaceStyle={resolvedAppearance}
        customMapStyle={
          Platform.OS === "android" && mapStyle !== "satellite"
            ? googleMapStyles(resolvedAppearance)
            : []
        }
        mapType={
          mapStyle === "satellite"
            ? "satellite"
            : Platform.OS === "ios"
              ? "mutedStandard"
              : "standard"
        }
        maxZoomLevel={MAP_MAX_ZOOM}
        {...(ready ? { mapPadding } : {})}
        showsScale
        rotateEnabled
        pitchEnabled
        toolbarEnabled={false}
        moveOnMarkerPress={!onPick}
        showsCompass={!hideControls}
        accessibilityLabel={
          onPick
            ? "Tap the map to select a meeting place"
            : "Shared activity places and temporary friend locations"
        }
        style={{ flex: 1, backgroundColor: colors.bg }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: initialTargetIsValid
            ? explorationTarget.center.latitude
            : first.latitude!,
          longitude: initialTargetIsValid
            ? explorationTarget.center.longitude
            : first.longitude!,
          latitudeDelta: initialTargetIsValid
            ? 360 / 2 ** explorationTarget.zoom
            : 0.045,
          longitudeDelta: initialTargetIsValid
            ? 360 / 2 ** explorationTarget.zoom
            : 0.045,
        }}
        onTouchStart={() => {
          suppressMapPressUntil.current = 0;
        }}
        onPress={(event) => {
          if (
            (!onPick && event.nativeEvent.action === "marker-press") ||
            Date.now() < suppressMapPressUntil.current
          )
            return;
          if (onPick) {
            onPick(
              event.nativeEvent.coordinate.latitude,
              event.nativeEvent.coordinate.longitude,
            );
          } else {
            closeStack();
            onMapTap?.();
          }
        }}
        onLongPress={(event) => {
          if (!onPick) {
            suppressMapPressUntil.current = Date.now() + 500;
            onLongPress?.({
              coordinate: event.nativeEvent.coordinate,
              point: event.nativeEvent.position,
            });
          }
        }}
        onPoiClick={(event) => {
          if (!onPick) {
            suppressMapPressUntil.current = Date.now() + 250;
            const value = event.nativeEvent;
            onPlace?.(
              {
                placeKey: value.placeId,
                name: value.name,
                lat: value.coordinate.latitude,
                lng: value.coordinate.longitude,
                category: "unknown",
              },
              value.position,
            );
          }
        }}
        showsUserLocation={false}
      >
        {contextPaths.map((coordinates, index) => (
          <Polyline
            key={`context-path:${index}`}
            coordinates={[...coordinates]}
            strokeColor={colors.green + "99"}
            strokeWidth={3}
            lineDashPattern={[6, 5]}
            zIndex={0}
          />
        ))}
        {contextPoints
          .filter(
            (point) =>
              (!point.publicBeaconId ||
                (renderedSingletonIds.has(`beacon:${point.publicBeaconId}`) &&
                  !pins.some(
                    (place) => place.activity_id === point.publicBeaconId,
                  ))) &&
              (!point.activityId ||
                renderedSingletonIds.has(`beacon:${point.activityId}`)),
          )
          .map((point) =>
            point.activityId ? (
              <Circle
                key={`context:${point.id}`}
                center={point}
                radius={16}
                strokeColor={colors.green}
                strokeWidth={2}
                fillColor={colors.green + "18"}
                zIndex={1}
              />
            ) : (
              <Marker
                key={point.id}
                coordinate={point}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={2}
                accessibilityLabel={`${point.publicBeaconId ? "Public Beacon" : "Suggestion"}: ${point.title}`}
                onPress={(event) => {
                  event.stopPropagation();
                  if (!onPick) onContextPoint?.(point);
                }}
              >
                <View
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: point.publicBeaconId ? 16 : 12,
                      borderBottomLeftRadius: point.publicBeaconId ? 5 : 12,
                      minWidth: 46,
                      minHeight: 46,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: point.publicBeaconId ? 3 : 1,
                      borderStyle: point.publicBeaconId ? "solid" : "dashed",
                      borderColor: colors.green,
                      backgroundColor: colors.white,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        maxWidth: 150,
                        color: colors.green,
                        fontSize: point.publicBeaconId ? 25 : 11,
                      }}
                    >
                      {point.publicBeaconId
                        ? categoryMarkerGlyphs[point.category ?? "Other"]
                        : "? Suggestion"}
                    </Text>
                  </View>
                </View>
              </Marker>
            ),
          )}
        {pins
          .filter((place) => nowHaloIds.has(`beacon:${place.activity_id}`))
          .map((place) => {
            const activity = activities.find(
              (item) => item.id === place.activity_id,
            );
            if (!activity || !isNowBeacon(activity, now)) return null;
            return (
              <NowBeaconHalo
                key={`now-halo:${activity.id}`}
                coordinate={{
                  latitude: place.latitude!,
                  longitude: place.longitude!,
                }}
                color={categoryColors[activity.category]}
              />
            );
          })}
        {presentations
          .filter(
            (item) => item.mode !== "stack" || item.group.members.length > 1,
          )
          .map((presentation) =>
            expandedPresentation?.group.id === presentation.group.id ? null : (
              <LivingMapPin
                key={presentation.group.id}
                presentation={presentation}
                members={modelsFor(presentation)}
                categoryColors={categoryColors}
                availabilityColors={availabilityColors}
                appearanceKey={clusterAppearanceKey}
                onPress={handlePresentation}
                onMember={handleMember}
              />
            ),
          )}
        {pins
          .filter((place) =>
            renderedSingletonIds.has(`beacon:${place.activity_id}`),
          )
          .map((place) => {
            const activity = activities.find(
              (item) => item.id === place.activity_id,
            );
            if (!activity) return null;
            const selectedPin = selectedActivityId === activity.id;
            const context = contextPoints.find(
              (point) => point.activityId === activity.id,
            );
            const streetTime = context
              ? context.suggestion
                ? "Suggestion"
                : "In focus"
              : nativeMapZoom(region.longitudeDelta, mapSize.width) >= 15
                ? mapTimeChip(activity, now)
                : undefined;
            return (
              <BeaconMapPin
                key={`beacon:${activity.id}`}
                id={activity.id}
                title={activity.title}
                coordinate={{
                  latitude: place.latitude!,
                  longitude: place.longitude!,
                }}
                category={activity.category}
                categoryColor={categoryColors[activity.category]}
                selected={selectedPin}
                dimmed={
                  (!!selectedActivityId && !selectedPin) ||
                  (contextPoints.some((point) => point.activityId) && !context)
                }
                streetTime={streetTime}
                appearanceKey={appearanceKey}
                disabled={!!onPick}
                onPress={selectActivity}
              />
            );
          })}
        {freshLocations
          .filter((location) =>
            renderedSingletonIds.has(`person:${location.owner_id}`),
          )
          .map((location) => {
            const profile = profiles.find(
              (item) => item.id === location.owner_id,
            );
            if (!profile) return null;
            const ownerAvailability =
              (availabilityActivities ?? activities)
                .filter((activity) => activity.owner_id === location.owner_id)
                .map((activity) => friendAvailabilityState(activity, now))
                .find((state) => state !== "unknown") ?? "unknown";
            const availabilityKey =
              ownerAvailability === "ending-soon"
                ? "endingSoon"
                : ownerAvailability;
            const ageLabel =
              formatLocationAge(location.updated_at, now) ?? "now";
            return (
              <FriendMapPin
                key={`person:${location.owner_id}`}
                location={location}
                profile={profile}
                availabilityColor={availability[availabilityKey].color}
                availabilityLabel={ownerAvailability.replace("-", " ")}
                showLabel={friendLabelIds.has(profile.id)}
                ageLabel={ageLabel}
                appearanceKey={appearanceKey}
                onPress={selectPerson}
              />
            );
          })}
        {selected && isValidCoordinate(selected) && (
          <Marker
            coordinate={selected}
            draggable={!!onPick}
            onDragEnd={
              onPick
                ? (event) =>
                    onPick(
                      event.nativeEvent.coordinate.latitude,
                      event.nativeEvent.coordinate.longitude,
                    )
                : undefined
            }
            accessibilityLabel={
              selectionIsTemporary
                ? "Selected map location"
                : "Selected meeting place"
            }
            anchor={selectionIsTemporary ? { x: 0.5, y: 1 } : undefined}
            onPress={
              selectionIsTemporary
                ? (event) => event.stopPropagation()
                : undefined
            }
            tracksViewChanges={selectionIsTemporary}
          >
            {selectionIsTemporary ? (
              <View
                testID="map-temporary-pin"
                pointerEvents="none"
                style={{ width: 32, height: 34, alignItems: "center" }}
              >
                <MapPin size={30} color={colors.green} fill={colors.white} />
              </View>
            ) : null}
          </Marker>
        )}
      </MapView>
      <PulseMapOverlay
        points={pulsePoints}
        halos={pulseHalos}
        places={pulsePlaces}
        onPlace={onPlace}
        popToken={pulsePopToken}
        popPlaceKey={pulsePopPlaceKey}
        calm={calm}
      />
      {!cameraMoving &&
        !onPick &&
        countBadges
          .filter(
            (badge) =>
              presentations.includes(badge.item) &&
              badge.item.group.id !== expandedPresentation?.group.id,
          )
          .map((badge) => (
            <Pressable
              key={`counts:${badge.item.group.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${clusterCountAccessibilityLabel(badge.peopleCount, badge.beaconTotal)}. Explore cluster; nearby does not mean attending`}
              testID="map-cluster-count"
              onPress={() => {
                closeStack();
                if (badge.activation === "expand")
                  void pressPresentation(badge.item);
                else
                  void pressCluster(
                    badge.item.group,
                    false,
                    badge.activation === "friends" ? "Friends" : undefined,
                  );
              }}
              style={{
                position: "absolute",
                left: badge.x - Math.max(44, badge.width) / 2,
                top: badge.y - 22,
                width: Math.max(44, badge.width),
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  width: badge.width,
                  height: badge.height,
                  flexDirection: "row",
                  gap: 2,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.white,
                }}
              >
                {badge.parts.map((part, index) => (
                  <React.Fragment key={part.kind}>
                    {index > 0 && (
                      <Text
                        accessible={false}
                        style={{ fontSize: badge.fontSize, color: colors.ink }}
                      >
                        {" "}
                        ·{" "}
                      </Text>
                    )}
                    <View
                      accessible={false}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <Svg
                        width={badge.fontSize}
                        height={badge.fontSize}
                        viewBox="0 0 24 24"
                        accessible={false}
                      >
                        <CountPath
                          d={CLUSTER_COUNT_PATHS[part.kind]}
                          fill="none"
                          stroke={colors.ink}
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                      <Text
                        style={{
                          fontSize: badge.fontSize,
                          fontWeight: "700",
                          fontVariant: ["tabular-nums"],
                          color: colors.ink,
                        }}
                      >
                        {part.count}
                      </Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </Pressable>
          ))}
      {expandedStack && expandedPresentation && !onPick && (
        <ExpandedMapStack
          presentation={expandedPresentation}
          anchor={expandedStack}
          size={mapSize}
          onPeople={() => {
            closeStack();
            void pressCluster(expandedPresentation.group, false, "Friends");
          }}
          members={modelsFor(expandedPresentation)}
          availabilityColors={availabilityColors}
          categoryColors={categoryColors}
          onMember={handleMember}
          onClose={closeStack}
        />
      )}
      {!onPick && !hideControls && (
        <View
          style={{ position: "absolute", top: controlsTop, right: 16, gap: 8 }}
        >
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Map options"
              onPress={onOptions}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
                elevation: 3,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <SlidersHorizontal size={20} color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Recenter map"
              onPress={recenter}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
                elevation: 3,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <LocateFixed size={20} color={colors.ink} />
            </Pressable>
          </>
        </View>
      )}
    </View>
  );
}
