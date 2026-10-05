import React, { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { BeaconResponse } from "@/src/features/beacons/BeaconResponse";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canViewBeaconMeetingDetails } from "@/src/features/people/previews/personPreview";
import { activityWhen } from "@/src/shared/domain";
import type { ID } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Sheet, useTheme } from "@/src/shared/ui";

export function ProfilePreviewFrame({
  visible,
  onClose,
  title,
  children,
  renderBeaconPreview,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: (openBeacon: (id: ID) => void) => ReactNode;
  renderBeaconPreview: (beaconId: ID, onBack: () => void) => ReactNode;
}) {
  const [selectedBeaconId, setSelectedBeaconId] = useState<ID | null>(null);
  const close = () => {
    setSelectedBeaconId(null);
    onClose();
  };
  const backToProfile = () => setSelectedBeaconId(null);

  return (
    <Sheet title={title} visible={visible} onClose={close}>
      <View
        style={{ display: selectedBeaconId ? "none" : "flex" }}
        accessibilityElementsHidden={!!selectedBeaconId}
        importantForAccessibility={selectedBeaconId ? "no-hide-descendants" : "auto"}
      >
        {children(setSelectedBeaconId)}
      </View>
      <View
        style={{ display: selectedBeaconId ? "flex" : "none" }}
        accessibilityElementsHidden={!selectedBeaconId}
        importantForAccessibility={selectedBeaconId ? "auto" : "no-hide-descendants"}
      >
        {selectedBeaconId
          ? renderBeaconPreview(selectedBeaconId, backToProfile)
          : null}
      </View>
    </Sheet>
  );
}

/** Shared Beacon body for Person and Squad previews; rechecks access from the live snapshot. */
export function BeaconProfilePreview({
  beaconId,
  onBack,
  onOpenFullBeacon,
  backLabel = "Back to profile",
}: {
  beaconId: ID;
  onBack: () => void;
  onOpenFullBeacon: (id: ID) => void;
  backLabel?: string;
}) {
  const { data, userId } = useBeacon();
  const { styles } = useTheme();
  const now = useNow();
  const beacon = data.activities.find((item) => item.id === beaconId);
  const readable = !!(
    beacon &&
    userId &&
    canReadBeaconActivity(data, beacon, userId)
  );
  if (!beacon || !readable) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={styles.h2}>Beacon unavailable</Text>
        <Text style={styles.muted}>
          This Beacon is no longer shared with you.
        </Text>
        <Button title={backLabel} secondary onPress={onBack} />
      </View>
    );
  }

  const place = data.places.find((item) => item.activity_id === beacon.id);
  const canSeeMeetingDetails = canViewBeaconMeetingDetails(
    data,
    beacon.id,
    userId,
  );
  const location = canSeeMeetingDetails
    ? place?.online_url
      ? "Virtual"
      : place?.label || "Location details restricted"
    : "Meeting details unlock when you’re going.";

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { gap: 9 }]}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ActivityBadge category={beacon.category} size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={styles.h2}>{beacon.title}</Text>
            <Text style={styles.muted}>
              {beacon.category} · {activityWhen(beacon, new Date(now))}
            </Text>
          </View>
        </View>
        <Text style={styles.muted}>{location}</Text>
        {canSeeMeetingDetails && beacon.description ? (
          <Text style={styles.body}>{beacon.description}</Text>
        ) : null}
        {beacon.mode !== "solo" ? (
          <BeaconResponse activity={beacon} compact />
        ) : null}
      </View>
      <Button title={backLabel} secondary onPress={onBack} />
      <Button
        title="Open full Beacon"
        onPress={() => onOpenFullBeacon(beacon.id)}
      />
    </View>
  );
}
