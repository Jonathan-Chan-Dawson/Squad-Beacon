import React, { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Button, Sheet, useTheme } from "@/src/shared/ui";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import type { MapStyle } from "./components/BeaconMap";
import { pulseCopy } from "@/src/features/pulse/copy/pulse";
import {
  Flame,
  Timer,
  ParkingCircle,
  TriangleAlert,
  Check,
} from "lucide-react-native";
import { usePulseColors } from "@/src/features/pulse/components/PulseVisuals";

export function MapOptions({
  visible,
  onClose,
  liveUpdates,
  onLiveUpdates,
  style,
  onStyle,
  showFriends,
  friendsApplicable,
  onShowFriends,
  onFit,
  onExplore,
}: {
  visible: boolean;
  onClose(): void;
  liveUpdates: boolean;
  onLiveUpdates(value: boolean): void;
  style: MapStyle;
  onStyle(value: MapStyle): void;
  showFriends: boolean;
  friendsApplicable: boolean;
  onShowFriends(value: boolean): void;
  onFit(): void;
  onExplore(): void;
}) {
  const { colors, styles } = useTheme();
  const [legend, setLegend] = useState(false);
  const levels = usePulseColors();
  return (
    <Sheet title="Map options" visible={visible} onClose={onClose}>
      <View
        style={{
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={styles.body}>{pulseCopy.liveUpdates}</Text>
        <Switch
          accessibilityLabel={pulseCopy.liveUpdates}
          value={liveUpdates}
          onValueChange={onLiveUpdates}
          trackColor={{ true: colors.green }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title="Standard map"
          secondary={style !== "standard"}
          onPress={() => onStyle("standard")}
        />
        <Button
          title="Satellite map"
          secondary={style !== "satellite"}
          onPress={() => onStyle("satellite")}
        />
      </View>
      {friendsApplicable ? (
        <View
          style={{
            minHeight: 52,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.body}>Show friends on map</Text>
          <Switch
            accessibilityLabel="Show friends on map"
            value={showFriends}
            onValueChange={onShowFriends}
            trackColor={{ true: colors.green }}
          />
        </View>
      ) : null}
      <Button title="Fit results" secondary onPress={onFit} />
      <Button title="Explore another area" secondary onPress={onExplore} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Legend"
        accessibilityState={{ expanded: legend }}
        onPress={() => setLegend(!legend)}
        style={{ minHeight: 52, justifyContent: "center" }}
      >
        <Text style={styles.body}>Legend</Text>
      </Pressable>
      {legend ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {(
              [
                "Fitness",
                "Study",
                "Gaming",
                "Creative",
                "Social",
                "Other",
              ] as const
            ).map((category) => (
              <View
                key={category}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <ActivityBadge category={category} size={24} />
                <Text style={styles.muted}>{category}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.body}>{pulseCopy.liveUpdates}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {(
              [
                [pulseCopy.groups.crowd, Flame],
                [pulseCopy.groups.wait, Timer],
                [pulseCopy.groups.parking, ParkingCircle],
                [pulseCopy.groups.condition, TriangleAlert],
                [pulseCopy.groups.availability, Check],
              ] as const
            ).map(([label, Icon]) => (
              <View
                key={label}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <Icon size={18} color={colors.ink} />
                <Text style={styles.muted}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {pulseCopy.crowd.map((label, index) => (
              <View
                key={label}
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                {[0, 1, 2, 3].map((segment) => (
                  <View
                    key={segment}
                    style={{
                      width: 6,
                      height: 7 + segment * 3,
                      borderRadius: 2,
                      backgroundColor:
                        segment <= index ? levels[index] : colors.line,
                    }}
                  />
                ))}
                <Text style={styles.muted}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}
