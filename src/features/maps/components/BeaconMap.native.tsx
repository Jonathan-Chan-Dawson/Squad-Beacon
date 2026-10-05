import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { LocateFixed, SlidersHorizontal } from "lucide-react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { locationIsFresh } from "@/src/shared/domain";
import { isValidCoordinate } from "@/src/shared/exploration";
import { useTheme } from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import type { MapProps } from "@/src/features/maps/components/BeaconMap";
import {
  clusterMapPoints,
  markerVisualSize,
  rankClusterMembers,
  clusterPreviewOverflow,
} from "@/src/features/maps/cluster";
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
  return Number.isFinite(zoom) && zoom >= 0 && zoom <= 22;
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
export default function BeaconMap({
  activities,
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
}: MapProps) {
  const { colors, resolvedAppearance } = useTheme();

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
          locationIsFresh(location) &&
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
    if (
      !ready ||
      !hasUsableMapViewport(mapSize) ||
      onPick ||
      !controlCommand
    )
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
  }, [
    controlCommand,
    coordinates,
    onPick,
    ready,
    region,
    mapSize,
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
    if (!focused || !isValidCoordinate(focused) || !hasUsableMapViewport(mapSize)) {
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
  const first =
    (selected && isValidCoordinate(selected) ? selected : null) ??
    pins[0] ??
    { latitude: 41.885, longitude: -87.642 };
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
    zoom: Math.log2(
      (360 * Math.max(1, mapSize.width)) / (256 * region.longitudeDelta),
    ),
    width: mapSize.width,
    height: mapSize.height,
  });
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
          if (hasUsableMapViewport(mapSize)) onViewportChange?.({
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
          }, details?.isGesture ?? gestureActive.current);
          gestureActive.current = false;
          void updateAnchor();
        }}
        onPanDrag={() => {
          gestureActive.current = true;
        }}
        onRegionChange={updateAnchor}
        userInterfaceStyle={resolvedAppearance}
        customMapStyle={[
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          { elementType: "geometry", stylers: [{ color: colors.bg }] },
          {
            elementType: "labels.text.fill",
            stylers: [{ color: colors.muted }],
          },
          {
            elementType: "labels.text.stroke",
            stylers: [{ color: colors.bg }],
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: colors.white }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [
              { color: resolvedAppearance === "dark" ? "#253C59" : "#C7E4E9" },
            ],
          },
          {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: colors.lime }],
          },
        ]}
        mapType={mapStyle ?? "standard"}
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
        {groups
          .filter((group) => group.members.length > 1)
          .map((group) => {
            const beacons = group.members.filter(
              (member) => member.kind === "beacon",
            ).length;
            const people = group.members.length - beacons;
            const ranked = rankClusterMembers(group.members, clusterPriorities);
            const previewLabels = ranked
              .slice(0, 3)
              .map((member) =>
                member.kind === "beacon"
                  ? activities.find(
                      (candidate) => `beacon:${candidate.id}` === member.id,
                    )?.title
                  : profiles.find(
                      (candidate) => `person:${candidate.id}` === member.id,
                    )?.name,
              )
              .filter((label): label is string => !!label);
            return (
              <Marker
                key={group.id}
                anchor={{ x: 0.5, y: 0.5 }}
                coordinate={{
                  latitude: group.latitude,
                  longitude: group.longitude,
                }}
                accessibilityLabel={`Map cluster: ${beacons} beacons, ${people} people. Preview: ${previewLabels.join(", ")}${clusterPreviewOverflow(group.members.length) ? `, plus ${clusterPreviewOverflow(group.members.length)} more` : ""}`}
                onPress={(event) => {
                  event.stopPropagation();
                  void map.current
                    ?.pointForCoordinate({
                      latitude: group.latitude,
                      longitude: group.longitude,
                    })
                    .then((point) => onCluster?.(group, point ?? null))
                    .catch(() => onCluster?.(group, null));
                }}
              >
                <View
                  style={{
                    minWidth: 58,
                    height: 52,
                    paddingHorizontal: 7,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    borderRadius: 26,
                    backgroundColor: colors.white,
                    borderWidth: 2,
                    borderColor: colors.lime,
                    elevation: 4,
                  }}
                >
                  {ranked.slice(0, 3).map((member, index) => {
                    const activity =
                      member.kind === "beacon"
                        ? activities.find(
                            (candidate) =>
                              `beacon:${candidate.id}` === member.id,
                          )
                        : undefined;
                    const profile =
                      member.kind === "person"
                        ? profiles.find(
                            (candidate) =>
                              `person:${candidate.id}` === member.id,
                          )
                        : undefined;
                    return (
                      <View
                        key={member.id}
                        style={{
                          width: 30,
                          height: 30,
                          marginLeft: index ? -5 : 0,
                          borderRadius: 16,
                          overflow: "hidden",
                          borderWidth: 2,
                          borderColor: colors.white,
                          zIndex: 4 - index,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.lime,
                        }}
                      >
                        {activity ? (
                          <ActivityBadge
                            category={activity.category}
                            size={26}
                          />
                        ) : profile ? (
                          <ProfileAvatar profile={profile} size={26} />
                        ) : null}
                      </View>
                    );
                  })}
                  {clusterPreviewOverflow(group.members.length) > 0 && (
                    <Text
                      style={{
                        marginLeft: 2,
                        color: colors.ink,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      +{clusterPreviewOverflow(group.members.length)}
                    </Text>
                  )}
                </View>
              </Marker>
            );
          })}
        {pins
          .filter((p) =>
            groups.every(
              (group) =>
                group.members.length === 1 ||
                !group.members.some(
                  (member) => member.id === `beacon:${p.activity_id}`,
                ),
            ),
          )
          .map((p) => (
            <Marker
              key={p.activity_id}
              anchor={{ x: 0.5, y: 1 }}
              coordinate={{ latitude: p.latitude!, longitude: p.longitude! }}
              accessibilityLabel={
                activities.find((a) => a.id === p.activity_id)?.title
              }
              description={"Meeting place · " + p.label}
              tracksViewChanges
              pinColor={colors.green}
              onPress={(event) => {
                event.stopPropagation();
                if (!onPick) onActivity(p.activity_id);
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 52,
                  alignItems: "center",
                  justifyContent: "flex-start",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    bottom: 3,
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    backgroundColor: colors.green,
                    transform: [{ rotate: "45deg" }],
                  }}
                />
                <View
                  style={{
                    width: markerVisualSize(
                      "beacon",
                      Math.log2(
                        (360 * Math.max(1, mapSize.width)) /
                          (256 * region.longitudeDelta),
                      ),
                    ),
                    height: markerVisualSize(
                      "beacon",
                      Math.log2(
                        (360 * Math.max(1, mapSize.width)) /
                          (256 * region.longitudeDelta),
                      ),
                    ),
                    borderRadius:
                      markerVisualSize(
                        "beacon",
                        Math.log2(
                          (360 * Math.max(1, mapSize.width)) /
                            (256 * region.longitudeDelta),
                        ),
                      ) / 2,
                    backgroundColor: colors.white,
                    borderWidth: 2,
                    borderColor: colors.green,
                    alignItems: "center",
                    justifyContent: "center",
                    elevation: 4,
                  }}
                >
                  <ActivityBadge
                    category={
                      activities.find((a) => a.id === p.activity_id)!.category
                    }
                    size={markerVisualSize(
                      "beacon",
                      Math.log2(
                        (360 * Math.max(1, mapSize.width)) /
                          (256 * region.longitudeDelta),
                      ) - 1,
                    )}
                  />
                </View>
              </View>
            </Marker>
          ))}
        {freshLocations
          .filter((l) =>
            groups.every(
              (group) =>
                group.members.length === 1 ||
                !group.members.some(
                  (member) => member.id === `person:${l.owner_id}`,
                ),
            ),
          )
          .map((l) => (
            <Marker
              key={l.id}
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={{ latitude: l.latitude!, longitude: l.longitude! }}
              onPress={(event) => {
                event.stopPropagation();
                onPerson(l.owner_id);
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    width: markerVisualSize(
                      "person",
                      Math.log2(
                        (360 * Math.max(1, mapSize.width)) /
                          (256 * region.longitudeDelta),
                      ),
                    ),
                    height: markerVisualSize(
                      "person",
                      Math.log2(
                        (360 * Math.max(1, mapSize.width)) /
                          (256 * region.longitudeDelta),
                      ),
                    ),
                    borderRadius: 18,
                    backgroundColor: colors.lime,
                    borderColor: colors.green,
                    borderWidth: 2,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {showAvatars ? (
                    <ProfileAvatar
                      profile={profiles.find((p) => p.id === l.owner_id)}
                      size={markerVisualSize(
                        "person",
                        Math.log2(
                          (360 * Math.max(1, mapSize.width)) /
                            (256 * region.longitudeDelta),
                        ) - 1,
                      )}
                    />
                  ) : (
                    <Text style={{ fontWeight: "700" }}>●</Text>
                  )}
                </View>
              </View>
            </Marker>
          ))}
        {selected && isValidCoordinate(selected) && (
          <Marker coordinate={selected} title="Selected meeting place" />
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
