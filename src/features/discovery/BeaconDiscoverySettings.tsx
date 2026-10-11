import React, { useState } from "react";
import { View, Text } from "react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Action, Field, useTheme } from "@/src/shared/ui";
import { usePublicBeacons } from "./usePublicBeacons";

/** An explicit host choice inside existing settings, never automatic publishing. */
export function BeaconDiscoverySettings({ activity }: { activity: Activity }) {
  const { styles } = useTheme();
  const { userId, data, act } = useBeacon();
  const { rows } = usePublicBeacons("");
  const published = rows.some((row) => row.activity_id === activity.id);
  const [area, setArea] = useState("");
  const [message, setMessage] = useState("");
  if (
    activity.owner_id !== userId ||
    activity.mode !== "squad" ||
    activity.audience === "organization"
  )
    return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Public discovery</Text>
      <Text style={styles.muted}>
        Let people discover and join this activity without joining your Squad.
        Only its title, time and general area appear publicly.
      </Text>
      <Field
        label="City or general area"
        placeholder="Chicago"
        value={area}
        onChangeText={setArea}
      />
      <Action
        title="Publish public preview"
        disabled={!area.trim()}
        secondary
        run={async () => {
          const place = data.places.find(
            (row) => row.activity_id === activity.id,
          );
          await act("publish_beacon_discovery", {
            activity_id: activity.id,
            area_label: area.trim(),
            ...(place?.latitude != null && place?.longitude != null
              ? { coarse_lat: place.latitude, coarse_lng: place.longitude }
              : {}),
          });
          setMessage("Public preview published.");
        }}
      />
      <Action
        title="Remove public preview"
        secondary
        compact
        run={async () => {
          await act("unpublish_beacon_discovery", { activity_id: activity.id });
          setMessage("Public preview removed.");
        }}
      />
      {(message || published) && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {message || "This Beacon has a public preview."}
        </Text>
      )}
    </View>
  );
}
