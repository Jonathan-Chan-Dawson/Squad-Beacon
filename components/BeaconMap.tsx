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
        height: 220,
        backgroundColor: "#E6ECDD",
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 28,
      }}
    >
      <MapPin color={colors.green} size={38} />
      <Text style={styles.h2}>Plans worth getting out for.</Text>
      <Text style={[styles.muted, { textAlign: "center" }]}>
        The interactive map is available on iOS and Android. Browse every shared
        activity in the list below.
      </Text>
    </View>
  );
}
