import React from "react";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { View, Text, Pressable } from "react-native";
import { MapPin } from "lucide-react-native";
import { useTheme } from "@/src/shared/ui";
import type {
  Activity,
  ActivityPlace,
  LocationSession,
  Profile,
} from "@/src/shared/types";
import type { MapPointGroup } from "@/src/features/maps/cluster";
export interface MapProps {
  onAnchor?: (point: { x: number; y: number } | null) => void;
  fullScreen?: boolean;
  controlsTop?: number;
  panelHeight?: number;
  focused?: { latitude: number; longitude: number } | null;
  activities: Activity[];
  places: ActivityPlace[];
  locations: LocationSession[];
  profiles: Profile[];
  onActivity: (id: string) => void;
  onPerson: (id: string) => void;
  onCluster?: (cluster: MapPointGroup) => void;
  onMapTap?: () => void;
  onViewportChange?: () => void;
  onPick?: (latitude: number, longitude: number) => void;
  selected?: { latitude: number; longitude: number } | null;
}
export default function BeaconMap({
  activities,
  places,
  onActivity,
  onPick,
  selected,
}: MapProps) {
  const { styles, colors } = useTheme();

  const pins = places.filter(
    (p) =>
      p.latitude != null &&
      p.longitude != null &&
      activities.some((a) => a.id === p.activity_id),
  );
  if (onPick)
    return (
      <View style={[styles.card, { backgroundColor: "#E6ECDD" }]}>
        <Text style={styles.h2}>Choose a meeting pin on your phone</Text>
        <Text style={styles.muted}>
          For now, a place name is all you need.
          {selected ? " Your selected pin is saved." : ""}
        </Text>
      </View>
    );
  const latitudes = pins.map((p) => p.latitude!),
    longitudes = pins.map((p) => p.longitude!);
  const minLat = Math.min(...latitudes),
    maxLat = Math.max(...latitudes),
    minLng = Math.min(...longitudes),
    maxLng = Math.max(...longitudes);
  return (
    <View
      style={{
        height: 300,
        backgroundColor: "#E6ECDD",
        borderRadius: 24,
        overflow: "hidden",
        padding: 18,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0 }}
        viewBox="0 0 400 300"
        preserveAspectRatio="none"
      >
        <Path
          d="M-30 210 Q100 110 180 180 T440 65"
          fill="none"
          stroke="#C5DDD6"
          strokeWidth="34"
        />
        {[65, 130, 195, 260].map((y) => (
          <Line
            key={y}
            x1="0"
            y1={y}
            x2="400"
            y2={y - 35}
            stroke="#F8FAEF"
            strokeWidth="8"
          />
        ))}
        {[60, 150, 250, 340].map((x) => (
          <Line
            key={x}
            x1={x}
            y1="0"
            x2={x - 50}
            y2="300"
            stroke="#F8FAEF"
            strokeWidth="8"
          />
        ))}
        <Circle
          cx="200"
          cy="150"
          r="100"
          stroke="#B5C8AF"
          fill="none"
          strokeDasharray="4 8"
        />
      </Svg>
      <Text style={styles.label}>BEACON RADAR · APPROXIMATE POSITIONS</Text>
      {!pins.length && (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MapPin color={colors.green} size={32} />
          <Text style={styles.h2}>Room for a little adventure</Text>
          <Text style={styles.muted}>
            Beacons with meeting pins appear here.
          </Text>
        </View>
      )}
      {pins.map((p, i) => (
        <Pressable
          key={p.activity_id}
          accessibilityRole="button"
          accessibilityLabel={
            "Map: " + activities.find((a) => a.id === p.activity_id)?.title
          }
          onPress={() => onActivity(p.activity_id)}
          style={{
            position: "absolute",
            left: `${12 + (maxLng === minLng ? 0.5 : (p.longitude! - minLng) / (maxLng - minLng)) * 62}%`,
            top:
              65 +
              (maxLat === minLat
                ? 0.5
                : (maxLat - p.latitude!) / (maxLat - minLat)) *
                140,
            backgroundColor: colors.ink,
            padding: 10,
            borderRadius: 20,
            borderWidth: 4,
            borderColor: colors.lime,
          }}
        >
          <Text style={{ color: colors.white, fontWeight: "700" }}>
            {i + 1}
            {" \u00b7 "}
            {activities.find((a) => a.id === p.activity_id)?.category}
          </Text>
        </Pressable>
      ))}
      <Text
        style={[styles.muted, { position: "absolute", bottom: 12, left: 18 }]}
      >
        Tap a beacon to join · Full street map on your phone
      </Text>
    </View>
  );
}
