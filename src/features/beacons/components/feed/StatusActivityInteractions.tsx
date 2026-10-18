import React from "react";
import { View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Txt } from "@/src/shared/ui";
import { BeaconParticipation } from "../../useBeaconParticipation";
import { beaconSeatCount } from "../../permissions";
import { PlanningResponseControls } from "@/src/features/planning/PlanningResponseControls";
import {
  resolveStatusAttachment,
  type StatusAttachment,
} from "../../statusAttachments";

export function StatusActivityInteractions({
  attachment,
  onOpen,
}: {
  attachment: StatusAttachment;
  onOpen(): void;
}) {
  const { data, userId } = useBeacon();
  const now = useNow();
  if (!resolveStatusAttachment(data, attachment, userId, now)) return null;
  if (attachment.type !== "beacon")
    return (
      <PlanningResponseControls
        threadId={attachment.id}
        onOpen={onOpen}
        showDeadline={false}
      />
    );
  const activity = data.activities.find((row) => row.id === attachment.id)!;
  return (
    <View style={{ gap: 8 }}>
      <Txt muted>{beaconSeatCount(data, activity)} going</Txt>
      <BeaconParticipation activityId={activity.id} onOpen={onOpen} />
    </View>
  );
}
