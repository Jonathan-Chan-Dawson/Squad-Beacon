import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, View, Pressable, useWindowDimensions } from "react-native";
import { LocateFixed, SlidersHorizontal } from "lucide-react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { friendAvailabilityState, locationIsFresh } from "@/src/shared/domain";
import { isValidCoordinate } from "@/src/shared/exploration";
import { useTheme } from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import { useDesignTheme } from "@/src/theme";
import { googleMapStyles } from "@/src/theme/map";
import { useNow } from "@/src/shared/useNow";
import type { MapProps } from "@/src/features/maps/components/BeaconMap";
import {
  clusterMapPoints,
  rankClusterMembers,
  clusterPreviewOverflow,
  clusterCategoryMix,
  clusterBounds,
  formatLocationAge,
  MAP_MAX_ZOOM,
  MAX_RENDERED_MAP_FEATURES,
} from "@/src/features/maps/cluster";
import type { MapPointGroup } from "@/src/features/maps/cluster";
import {
  BeaconMapPin,
  ClusterMapPin,
  FriendMapPin,
  NowBeaconHalo,
} from "@/src/features/maps/components/BeaconMapMarkers.native";
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
  activities,
  availabilityActivities,
  places,
  locations,
  profiles,
  onActivity,
  onPerson,
  onPick,
  selected,
  fullScreen = false,
  hideControls = false,
  controlsTop = 12,
  panelHeight = 0,
  viewportInsets,
  focused,
  onAnchor,
  onCluster,
  clusterPriorities = {},
  onMapTap,
  onViewportChange,
  explorationTarget,
  onOptions,
  onRecenter,
  controlCommand,
  mapStyle,
  selectedActivityId = null,
}: MapProps) {
  const { colors, resolvedAppearance } = useTheme();
  const { categories, availability } = useDesignTheme();

  const map = useRef<MapView>(null);
  const projectionBusy = useRef(false);
  const gestureActive = useRef(false);
  const [ready, setReady] = useState(false);
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
  const pins = places.filter(
    (p) =>
      p.online_url == null &&
      p.latitude != null &&
      p.longitude != null &&
      isValidCoordinate({ latitude: p.latitude, longitude: p.longitude }) &&
      activities.some((a) => a.id === p.activity_id),
  );
  const freshLocations = showAvatars
    ? locations.filter(
        (location) =>
          locationIsFresh(location, new Date(now)) &&
          formatLocationAge(location.updated_at, now) !== null &&
          location.latitude != null &&
          location.longitude != null &&
          isValidCoordinate({
            latitude: location.latitude,
            longitude: location.longitude,
          }) &&
          profiles.some((profile) => profile.id === location.owner_id),
      )
    : [];
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
  }, [coordinates, ready, mapSize, onPick, explorationTarget]);
  useEffect(() => {
    if (!ready || !hasUsableMapViewport(mapSize) || onPick || !controlCommand)
      return;
    if (appliedControlRevision.current === controlCommand.revision) return;
    const currentMap = map.current;
    if (!currentMap) return;

    if (controlCommand.kind === "fit") {
      const visibleCoordinates = JSON.parse(coordinates);
      if (visibleCoordinates.length)
        currentMap.fitToCoordinates(visibleCoordinates, {
          edgePadding: fitEdgePadding,
          animated: true,
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
  }, [controlCommand, coordinates, onPick, ready, region, mapSize]);
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
          latitude: focusedLat,
          longitude: focusedLng,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        500,
      );
      appliedFocusedTarget.current = focusKey;
    }
  }, [ready, focusedLat, focusedLng, mapSize]);
  function recenter() {
    if (onRecenter) onRecenter();
    else if (points.length && hasUsableMapViewport(mapSize))
      map.current?.fitToCoordinates(points, {
        edgePadding: fitEdgePadding,
        animated: true,
      });
  }
  async function updateAnchor() {
    if (
      !focused ||
      !isValidCoordinate(focused) ||
      !hasUsableMapViewport(mapSize)
    ) {
      onAnchor?.(null);
      return;
    }
    if (projectionBusy.current) return;
    projectionBusy.current = true;
    try {
      const point = await map.current?.pointForCoordinate(focused);
      if (point) onAnchor?.(point);
    } catch {
      onAnchor?.(null);
    } finally {
      projectionBusy.current = false;
    }
  }
  const first = (selected && isValidCoordinate(selected) ? selected : null) ??
    pins[0] ?? { latitude: 41.885, longitude: -87.642 };
  const initialTargetIsValid =
    explorationTarget != null &&
    isValidCoordinate(explorationTarget.center) &&
    isValidMapZoom(explorationTarget.zoom);
  const mapPoints = [
    ...pins.map((place) => ({
      id: `beacon:${place.activity_id}`,
      kind: "beacon" as const,
      latitude: place.latitude!,
      longitude: place.longitude!,
      category: activities.find((activity) => activity.id === place.activity_id)
        ?.category,
    })),
    ...freshLocations.map((location) => ({
      id: `person:${location.owner_id}`,
      kind: "person" as const,
      latitude: location.latitude!,
      longitude: location.longitude!,
    })),
  ];
  const groups = clusterMapPoints(mapPoints, {
    centerLatitude: region.latitude,
    centerLongitude: region.longitude,
    zoom: nativeMapZoom(region.longitudeDelta, mapSize.width),
    width: mapSize.width,
    height: mapSize.height,
  });
  const clusterGroups = groups.filter((group) => group.members.length > 1);
  const renderedSingletonIds = new Set(
    groups
      .filter((group) => group.members.length === 1)
      .map((group) => group.members[0].id),
  );
  const availableHaloSlots = Math.max(
    0,
    MAX_RENDERED_MAP_FEATURES - groups.length,
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
  async function pressCluster(group: MapPointGroup) {
    const currentMap = map.current;
    if (!currentMap) return;
    const zoom = nativeMapZoom(region.longitudeDelta, mapSize.width);
    const expansionZoom =
      group.expansionZoom ?? Math.min(MAP_MAX_ZOOM, Math.floor(zoom) + 1);
    if (zoom < expansionZoom && zoom < MAP_MAX_ZOOM) {
      const bounds = clusterBounds(group.members);
      if (bounds) {
        const latitudeSpan = bounds.north - bounds.south;
        const coordinateList = group.members.map((member) => ({
          latitude: member.latitude,
          longitude: member.longitude,
        }));
        if (
          bounds.east < bounds.west ||
          (latitudeSpan < 0.0001 && bounds.longitudeSpan < 0.0001)
        ) {
          const targetZoom = Math.min(
            MAP_MAX_ZOOM,
            Math.max(zoom + 1, expansionZoom),
          );
          const minimumDelta = 360 / 2 ** targetZoom;
          currentMap.animateToRegion(
            {
              latitude: (bounds.north + bounds.south) / 2,
              longitude: bounds.centerLongitude,
              latitudeDelta: Math.max(minimumDelta, latitudeSpan * 1.35),
              longitudeDelta: Math.max(
                minimumDelta,
                bounds.longitudeSpan * 1.35,
              ),
            },
            420,
          );
        } else {
          currentMap.fitToCoordinates(coordinateList, {
            edgePadding: fitEdgePadding,
            animated: true,
          });
        }
        return;
      }
    }
    try {
      const anchor = await currentMap.pointForCoordinate({
        latitude: group.latitude,
        longitude: group.longitude,
      });
      onCluster?.(group, anchor ?? null);
    } catch {
      onCluster?.(group, null);
    }
  }
  const latestClusterAction = useRef<(group: MapPointGroup) => void>(() => {});
  useEffect(() => {
    latestClusterAction.current = (group) => {
      void pressCluster(group);
    };
  });
  const selectCluster = useCallback(
    (group: MapPointGroup) => latestClusterAction.current(group),
    [],
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
          setRegion(nextRegion);
          if (hasUsableMapViewport(mapSize))
            onViewportChange?.(
              {
                center: {
                  latitude: nextRegion.latitude,
                  longitude: nextRegion.longitude,
                },
                zoom: Math.log2(360 / nextRegion.longitudeDelta),
                bounds: {
                  north: nextRegion.latitude + nextRegion.latitudeDelta / 2,
                  south: nextRegion.latitude - nextRegion.latitudeDelta / 2,
                  east: nextRegion.longitude + nextRegion.longitudeDelta / 2,
                  west: nextRegion.longitude - nextRegion.longitudeDelta / 2,
                },
              },
              details?.isGesture ?? gestureActive.current,
            );
          gestureActive.current = false;
          void updateAnchor();
        }}
        onPanDrag={() => {
          gestureActive.current = true;
        }}
        onRegionChange={updateAnchor}
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
        onPress={
          onPick
            ? (e) =>
                onPick(
                  e.nativeEvent.coordinate.latitude,
                  e.nativeEvent.coordinate.longitude,
                )
            : () => onMapTap?.()
        }
        showsUserLocation={false}
      >
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
        {clusterGroups.map((group) => {
          const beaconCount = group.members.filter(
            (member) => member.kind === "beacon",
          ).length;
          const peopleCount = group.members.length - beaconCount;
          const ranked = rankClusterMembers(group.members, clusterPriorities);
          const previewLabels = ranked
            .slice(0, 3)
            .map((member) =>
              member.kind === "beacon"
                ? activities.find(
                    (activity) => `beacon:${activity.id}` === member.id,
                  )?.title
                : profiles.find(
                    (profile) => `person:${profile.id}` === member.id,
                  )?.name,
            )
            .filter((label): label is string => !!label);
          const categoryMix = clusterCategoryMix(group.members)
            .map((entry) => `${entry.category} ${entry.count}`)
            .join(", ");
          const overflow = clusterPreviewOverflow(group.members.length);
          const accessibilityLabel = `Map cluster: ${beaconCount} beacons, ${peopleCount} people. Preview: ${previewLabels.join(", ")}${overflow ? `, plus ${overflow} more` : ""}. Category mix: ${categoryMix}.`;
          return (
            <ClusterMapPin
              key={group.id}
              group={group}
              categoryColors={categoryColors}
              appearanceKey={appearanceKey}
              accessibilityLabel={accessibilityLabel}
              onPress={selectCluster}
            />
          );
        })}
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
            const streetTime =
              nativeMapZoom(region.longitudeDelta, mapSize.width) >= 16
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
                dimmed={!!selectedActivityId && !selectedPin}
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
                ageLabel={ageLabel}
                appearanceKey={appearanceKey}
                onPress={selectPerson}
              />
            );
          })}
        {selected && isValidCoordinate(selected) && (
          <Marker
            coordinate={selected}
            accessibilityLabel="Selected meeting place"
            tracksViewChanges={false}
          />
        )}
      </MapView>
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
