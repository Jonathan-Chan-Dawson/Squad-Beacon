import React from "react";
import { router } from "expo-router";
import type { Activity } from "@/src/shared/types";
import { BeaconParticipation } from "@/src/features/beacons/useBeaconParticipation";
/** Same viewer-specific state and single-flight mutations as cards and Overview. */
export function MapBeaconRsvp({ activity }: { activity: Activity }) {
  return (
    <BeaconParticipation
      activityId={activity.id}
      stretch
      onOpen={() =>
        router.push({ pathname: "/activity/[id]", params: { id: activity.id } })
      }
    />
  );
}
