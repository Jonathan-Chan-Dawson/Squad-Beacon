import React from "react";
import { View, Text } from "react-native";
import { MapPin } from "lucide-react-native";
import { colors, styles } from "@/src/ui";
import type {
  Activity,
  ActivityPlace,
  LocationSession,
  Profile,
} from "@/src/types";
export interface MapProps {
  activities: Activity[];
  places: ActivityPlace[];
  locations: LocationSession[];
  profiles: Profile[];
  onActivity: (id: string) => void;
  onPerson: (id: string) => void;
  onPick?: (latitude: number, longitude: number) => void;
  selected?: { latitude: number; longitude: number } | null;
}
export default function BeaconMap(_props: MapProps) {
  return (
    <View
      style={{
        minHeight: 144,
        backgroundColor: "#E6ECDD",
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 18,
      }}
    >
      <MapPin color={colors.green} size={38} />
      <Text style={styles.h2}>Map on your phone</Text>
      <Text style={[styles.muted, { textAlign: "center" }]}>
        Open iOS or Android for the map. Shared activities are listed below.
      </Text>
    </View>
  );
}
