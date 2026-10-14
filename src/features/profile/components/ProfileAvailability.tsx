import React from "react";
import { SharedStatusControl } from "@/src/features/beacons/components/feed/SharedStatusControl";

/** Compatibility wrapper for profile surfaces using the shared status editor. */
export function ProfileAvailability() {
  return <SharedStatusControl compact />;
}
