import React from "react";
import { Pressable, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useDesignTheme } from "@/src/shared/design-system";
import { isValidCoordinate } from "@/src/shared/exploration";

export type BeaconLocationPreviewProps = {
  latitude: number;
  longitude: number;
  label: string;
  compact?: boolean;
  onPress?: () => void;
};
export function BeaconLocationPreview({
  latitude,
  longitude,
  label,
  compact = false,
  onPress,
}: BeaconLocationPreviewProps) {
  const { colors, resolvedAppearance } = useDesignTheme();
  if (!isValidCoordinate({ latitude, longitude })) return null;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "image"}
      accessibilityLabel={`Show ${label || "Beacon location"} on Map`}
      onPress={onPress}
      disabled={!onPress}
      style={{
        height: 72,
        width: compact ? 72 : "100%",
        borderRadius: 16,
        backgroundColor: colors.surfaceRaised,
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flex: 1 }}
      >
        <MapView
          region={{
            latitude,
            longitude,
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
          }}
          userInterfaceStyle={resolvedAppearance}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsTraffic={false}
          loadingEnabled
          style={{ flex: 1 }}
        >
          <Marker
            coordinate={{ latitude, longitude }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 1 }}
          />
        </MapView>
      </View>
    </Pressable>
  );
}
