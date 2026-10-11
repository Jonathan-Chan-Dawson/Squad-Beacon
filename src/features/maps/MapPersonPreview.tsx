import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, IconButton, useTheme } from "@/src/shared/ui";
import { showBeaconOnMap } from "./mapDiscovery";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { activityWhen } from "@/src/shared/domain";

export function MapPersonPreview({
  personId,
  onClose,
  onBeacon,
}: {
  personId: string;
  onClose(): void;
  onBeacon(id: string): void;
}) {
  const { data, userId } = useBeacon();
  const { styles, tokens, colors } = useTheme();
  const now = useNow();
  const selection = selectPersonPreview(data, personId, userId, now);
  if (!selection.canViewFullProfile || !selection.profile || !userId)
    return null;
  const profile = selection.profile;
  const beacons = data.activities.filter(
    (activity) =>
      showBeaconOnMap(data, activity, userId, { personId }, now) &&
      (activity.owner_id === personId ||
        data.rsvps.some(
          (row) =>
            row.activity_id === activity.id &&
            row.user_id === personId &&
            isApprovedGoing(activity, row),
        )),
  );
  return (
    <View
      testID="map-person-preview"
      style={[styles.card, { padding: tokens.layout.screenGutter }]}
    >
      <View style={styles.row}>
        <ProfileAvatar profile={profile} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.h2}>{profile.name}</Text>
          <Text style={styles.muted}>@{profile.username}</Text>
        </View>
        <IconButton label="Close person preview" onPress={onClose}>
          <X size={20} color={colors.ink} />
        </IconButton>
      </View>
      {!!profile.bio && <Text style={styles.body}>{profile.bio}</Text>}
      <Text style={styles.muted}>
        {selection.availability === "available"
          ? "Free to hang"
          : selection.availability === "unavailable"
            ? "Busy"
            : selection.availability === "ending-soon"
              ? "Free to hang, ending soon"
              : "Availability is not shared"}
      </Text>
      {selection.canMessage && (
        <Button
          title={`Message ${profile.name}`}
          secondary
          onPress={() =>
            router.push({
              pathname: "/messages/[id]",
              params: { id: personId },
            })
          }
        />
      )}
      {!!beacons.length && <Text style={styles.label}>Beacons</Text>}
      {beacons.map((activity) => (
        <Pressable
          key={activity.id}
          accessibilityRole="button"
          accessibilityLabel={`Select ${activity.title} Beacon`}
          onPress={() => onBeacon(activity.id)}
          style={{
            minHeight: tokens.layout.minTapTarget,
            paddingVertical: tokens.space.sm,
            gap: tokens.space.xs,
          }}
        >
          <Text style={styles.body}>{activity.title}</Text>
          <Text style={styles.muted}>
            {activityWhen(activity, new Date(now))}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
