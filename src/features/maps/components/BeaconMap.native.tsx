import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { Compass, Layers, LocateFixed, Plus, Minus } from "lucide-react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { locationIsFresh } from "@/src/shared/domain";
import { useTheme } from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import type { MapProps } from "@/src/features/maps/components/BeaconMap";
import {
  clusterMapPoints,
  markerVisualSize,
} from "@/src/features/maps/cluster";
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
  controlsTop = 12,
  panelHeight = 0,
  focused,
  onAnchor,
  onCluster,
  onMapTap,
  onViewportChange,
}: MapProps) {
  const { colors } = useTheme();

  const map = useRef<MapView>(null);
  const projectionBusy = useRef(false);
  const [ready, setReady] = useState(false);
  const [region, setRegion] = useState({
    latitude: 41.885,
    longitude: -87.642,
    latitudeDelta: 0.045,
    longitudeDelta: 0.045,
  });
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const didInitialFit = useRef(false);
  const [satellite, setSatellite] = useState(false);
  const { height } = useWindowDimensions();
  const { showAvatars } = usePreferences();
  const pins = places.filter(
    (p) =>
      p.latitude != null &&
      p.longitude != null &&
      activities.some((a) => a.id === p.activity_id),
  );
  const points = pins.map((p) => ({
    latitude: p.latitude!,
    longitude: p.longitude!,
  }));
  const coordinates = JSON.stringify(points);
  useEffect(() => {
    if (!ready || onPick || didInitialFit.current) return;
    const next = JSON.parse(coordinates);
    if (next.length) {
      didInitialFit.current = true;
      map.current?.fitToCoordinates(next, {
        edgePadding: { top: 70, left: 50, bottom: 70, right: 50 },
        animated: true,
      });
    }
  }, [coordinates, ready, onPick]);
  const focusedLat = focused?.latitude,
    focusedLng = focused?.longitude;
  useEffect(() => {
    if (ready && focusedLat != null && focusedLng != null)
      map.current?.animateToRegion(
        {
          latitude: focusedLat,
          longitude: focusedLng,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        500,
      );
  }, [ready, focusedLat, focusedLng]);
  async function zoom(delta: number) {
    const camera = await map.current?.getCamera();
    if (camera)
      map.current?.animateCamera(
        { zoom: Math.max(2, Math.min(20, (camera.zoom ?? 14) + delta)) },
        { duration: 250 },
      );
  }
  async function updateAnchor() {
    if (!focused) {
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
  const first = selected ?? pins[0] ?? { latitude: 41.885, longitude: -87.642 };
  const mapPoints = [
    ...pins.map((place) => ({
      id: `beacon:${place.activity_id}`,
      kind: "beacon" as const,
      latitude: place.latitude!,
      longitude: place.longitude!,
    })),
    ...(showAvatars
      ? locations
          .filter(
            (location) =>
              locationIsFresh(location) &&
              location.latitude != null &&
              location.longitude != null,
          )
          .map((location) => ({
            id: `person:${location.owner_id}`,
            kind: "person" as const,
            latitude: location.latitude!,
            longitude: location.longitude!,
          }))
      : []),
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
      <MapView
        ref={map}
        onMapReady={() => setReady(true)}
        onRegionChangeComplete={(nextRegion) => {
          setRegion(nextRegion);
          onViewportChange?.();
          void updateAnchor();
        }}
        onRegionChange={updateAnchor}
        userInterfaceStyle={colors.bg === "#151C30" ? "dark" : "light"}
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
              { color: colors.bg === "#151C30" ? "#253C59" : "#C7E4E9" },
            ],
          },
          {
            featureType: "poi.park",
            elementType: "geometry",
            stylers: [{ color: colors.lime }],
          },
        ]}
        mapType={satellite ? "hybrid" : "standard"}
        mapPadding={{
          top: fullScreen ? controlsTop : 10,
          right: 10,
          bottom: panelHeight,
          left: 10,
        }}
        showsScale
        rotateEnabled
        pitchEnabled
        toolbarEnabled={false}
        showsCompass
        accessibilityLabel={
          onPick
            ? "Tap the map to select a meeting place"
            : "Shared activity places and temporary friend locations"
        }
        style={{ flex: 1 }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: first.latitude!,
          longitude: first.longitude!,
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
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
            return (
              <Marker
                key={group.id}
                anchor={{ x: 0.5, y: 0.5 }}
                coordinate={{
                  latitude: group.latitude,
                  longitude: group.longitude,
                }}
                accessibilityLabel={`Map cluster: ${beacons} beacons, ${people} people`}
                onPress={(event) => {
                  event.stopPropagation();
                  onCluster?.(group);
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      minWidth: 38,
                      height: 38,
                      paddingHorizontal: 8,
                      borderRadius: 20,
                      backgroundColor: colors.ink,
                      borderWidth: 3,
                      borderColor: colors.lime,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.white,
                        fontWeight: "800",
                        fontSize: 14,
                      }}
                    >
                      {group.members.length}
                    </Text>
                  </View>
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
              anchor={{ x: 0.5, y: 0.5 }}
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
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
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
        {locations
          .filter((l) => locationIsFresh(l))
          .filter((l) => l.latitude != null && l.longitude != null)
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
        {selected && (
          <Marker coordinate={selected} title="Selected meeting place" />
        )}
      </MapView>
      {!onPick && (
        <View
          style={{ position: "absolute", top: controlsTop, right: 16, gap: 8 }}
        >
          {[
            { label: "Toggle satellite map", Icon: Layers },
            { label: "Point north", Icon: Compass },
            { label: "Fit all beacons", Icon: LocateFixed },
            { label: "Zoom in", Icon: Plus },
            { label: "Zoom out", Icon: Minus },
          ].map(({ label, Icon }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                if (label === "Toggle satellite map") setSatellite(!satellite);
                else if (label === "Point north")
                  map.current?.animateCamera(
                    { heading: 0, pitch: 0 },
                    { duration: 300 },
                  );
                else if (label === "Fit all beacons" && points.length)
                  map.current?.fitToCoordinates(points, {
                    edgePadding: {
                      top: 110,
                      left: 50,
                      bottom: panelHeight + 50,
                      right: 65,
                    },
                    animated: true,
                  });
                else if (label === "Zoom in") void zoom(1);
                else if (label === "Zoom out") void zoom(-1);
              }}
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
              <Icon size={20} color={colors.ink} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
