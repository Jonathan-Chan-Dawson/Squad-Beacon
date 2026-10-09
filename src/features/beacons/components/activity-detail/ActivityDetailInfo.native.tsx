import React from "react";
import MapView, { Marker } from "react-native-maps";
import {
  ActivityDetailInfoContent,
  type ActivityDetailInfoProps,
} from "./ActivityDetailInfo.shared";
import { useDesignTheme } from "@/src/shared/design-system";
import { radius } from "@/src/theme/data";

export type { ActivityDetailInfoProps } from "./ActivityDetailInfo.shared";

export function ActivityDetailInfo(props: ActivityDetailInfoProps) {
  const { colors } = useDesignTheme();
  const place = props.canReadLocation ? props.place : undefined;
  const hasCoordinates =
    place?.latitude != null &&
    place.longitude != null &&
    !place.onlineUrl &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    place.latitude >= -90 &&
    place.latitude <= 90 &&
    place.longitude >= -180 &&
    place.longitude <= 180;
  const mapPreview = hasCoordinates ? (
    <MapView
      accessible
      accessibilityLabel={`Map preview for ${place.label || "activity location"}`}
      pointerEvents="none"
      region={{
        latitude: place.latitude!,
        longitude: place.longitude!,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }}
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
      style={{ height: 72, width: "100%", borderRadius: radius.md, backgroundColor: colors.surfaceRaised }}
    >
      <Marker
        coordinate={{ latitude: place.latitude!, longitude: place.longitude! }}
        accessibilityLabel="Activity destination"
        tracksViewChanges={false}
        anchor={{ x: 0.5, y: 1 }}
      />
    </MapView>
  ) : null;
  return <ActivityDetailInfoContent {...props} mapPreview={mapPreview} />;
}

export default ActivityDetailInfo;
