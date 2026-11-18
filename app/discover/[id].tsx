import React from "react";
import { Redirect, useLocalSearchParams, type Href } from "expo-router";

export default function PublicBeaconLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Redirect
      href={
        { pathname: "/browse-beacons", params: { publicBeacon: id } } as Href
      }
    />
  );
}
