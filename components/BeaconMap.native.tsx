import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { locationIsFresh } from "@/src/domain";
import { colors } from "@/src/ui";
import { usePreferences } from "@/src/preferences";
import { ProfileAvatar } from "@/src/ProfileAvatar";
import type { MapProps } from "./BeaconMap";
export default function BeaconMap({
  activities,
  places,
  locations,
  profiles,
  onActivity,
  onPerson,
  onPick,
  selected,
}: MapProps) {
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
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
    if (!ready || onPick) return;
    const next = JSON.parse(coordinates);
    if (next.length)
      map.current?.fitToCoordinates(next, {
        edgePadding: { top: 70, left: 50, bottom: 70, right: 50 },
        animated: true,
      });
  }, [coordinates, ready, onPick]);
  const first = selected ?? pins[0] ?? { latitude: 41.885, longitude: -87.642 };
  return (
    <View
      style={{
        height: onPick ? 260 : Math.max(220, Math.min(400, height * 0.44)),
        borderRadius: 24,
        overflow: "hidden",
      }}
    >
      <MapView
        ref={map}
        onMapReady={() => setReady(true)}
        mapType={satellite ? "hybrid" : "standard"}
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
            : undefined
        }
        showsUserLocation={false}
      >
        {pins.map((p) => (
          <Marker
            key={p.activity_id}
            coordinate={{ latitude: p.latitude!, longitude: p.longitude! }}
            title={activities.find((a) => a.id === p.activity_id)?.title}
            description={"Meeting place · " + p.label}
            pinColor={colors.green}
            onPress={() => {
              if (!onPick) onActivity(p.activity_id);
            }}
            onCalloutPress={() => onActivity(p.activity_id)}
          />
        ))}
        {locations
          .filter((l) => locationIsFresh(l))
          .filter((l) => l.latitude != null && l.longitude != null)
          .map((l) => (
            <Marker
              key={l.id}
              coordinate={{ latitude: l.latitude!, longitude: l.longitude! }}
              title={
                profiles.find((p) => p.id === l.owner_id)?.name ?? "Friend"
              }
              description={
                "Live location · updated " +
                new Date(l.updated_at!).toLocaleTimeString()
              }
              onCalloutPress={() => onPerson(l.owner_id)}
            >
              <View
                style={{
                  backgroundColor: colors.lime,
                  borderRadius: 22,
                  borderColor: colors.green,
                  borderWidth: 3,
                  padding: 9,
                }}
              >
                {showAvatars ? (
                  <ProfileAvatar
                    profile={profiles.find((p) => p.id === l.owner_id)}
                    size={32}
                  />
                ) : (
                  <Text style={{ fontWeight: "700" }}>●</Text>
                )}
              </View>
            </Marker>
          ))}
        {selected && (
          <Marker coordinate={selected} title="Selected meeting place" />
        )}
      </MapView>
      {!onPick && (
        <View style={{ position: "absolute", top: 12, right: 12, gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle satellite map"
            onPress={() => setSatellite(!satellite)}
            style={{
              padding: 12,
              backgroundColor: colors.white,
              borderRadius: 18,
            }}
          >
            <Text style={{ color: colors.ink }}>
              {satellite ? "Street" : "Satellite"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fit all beacons"
            onPress={() => {
              if (points.length)
                map.current?.fitToCoordinates(points, {
                  edgePadding: { top: 70, left: 50, bottom: 70, right: 50 },
                  animated: true,
                });
            }}
            style={{
              padding: 12,
              backgroundColor: colors.white,
              borderRadius: 18,
            }}
          >
            <Text style={{ color: colors.ink }}>Recenter</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
