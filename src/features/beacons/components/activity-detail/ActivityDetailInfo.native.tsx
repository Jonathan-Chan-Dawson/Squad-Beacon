import React from "react";
import { BeaconLocationPreview } from "@/src/features/maps/components/BeaconLocationPreview";
import {
  ActivityDetailInfoContent,
  type ActivityDetailInfoProps,
} from "./ActivityDetailInfo.shared";

export type { ActivityDetailInfoProps } from "./ActivityDetailInfo.shared";

export function ActivityDetailInfo(props: ActivityDetailInfoProps) {
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
    <BeaconLocationPreview latitude={place.latitude!} longitude={place.longitude!} label={place.label} onPress={props.onOpenMap} />
  ) : null;
  return <ActivityDetailInfoContent {...props} mapPreview={mapPreview} />;
}

export default ActivityDetailInfo;
