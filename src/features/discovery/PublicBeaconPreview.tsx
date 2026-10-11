import React, { useState } from "react";
import { Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, Button, useTheme } from "@/src/shared/ui";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { beaconPreviewWhen } from "@/src/features/maps/discoveryRanking";
import type { PublicBeaconSummary } from "./types";

export function PublicBeaconPreview({
  summary,
  onClose,
  onJoined,
}: {
  summary: PublicBeaconSummary;
  onClose(): void;
  onJoined(id: string): void;
}) {
  const { styles } = useTheme();
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const [requested, setRequested] = useState(false);
  const pending =
    requested ||
    summary.viewer_response === "requested" ||
    data.rsvps.some(
      (row) =>
        row.activity_id === summary.activity_id &&
        row.user_id === userId &&
        row.status === "requested",
    );
  return (
    <View
      testID="map-public-preview"
      style={[styles.card, { padding: 16, gap: 8 }]}
    >
      <View style={styles.row}>
        <ActivityBadge category={summary.category} size={34} />
        <Text style={[styles.h2, { flex: 1 }]}>{summary.title}</Text>
      </View>
      <Text style={styles.muted}>
        {beaconPreviewWhen({ ...summary, timezone: "" }, now)}
      </Text>
      <Text style={styles.body}>{summary.area_label}</Text>
      <Text style={styles.muted}>Public Beacon · Approximate area</Text>
      <Text style={styles.label}>{summary.accepted_seat_count} going</Text>
      <Action
        title={
          pending
            ? "Request sent"
            : summary.viewer_response === "going"
              ? "Open Beacon"
              : summary.closed
                ? "Closed"
                : summary.requires_approval
                  ? "Request to Join"
                  : "Join"
        }
        disabled={
          pending ||
          (summary.closed && summary.viewer_response !== "going") ||
          Date.parse(summary.ends_at) <= now
        }
        run={async () => {
          if (summary.viewer_response === "going") {
            onJoined(summary.activity_id);
            return;
          }
          const result = await act("join_public_beacon", {
            activity_id: summary.activity_id,
          });
          if (result.status === "requested") setRequested(true);
          else onJoined(summary.activity_id);
        }}
      />
      <Text style={styles.muted}>
        {pending
          ? "The host will review your request."
          : "Join to see the meeting details and meet the people going."}
      </Text>
      <Button title="Close preview" secondary compact onPress={onClose} />
    </View>
  );
}
