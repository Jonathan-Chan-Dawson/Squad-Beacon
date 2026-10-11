import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle, UserRound, X } from "lucide-react-native";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, Button, IconButton, useTheme } from "@/src/shared/ui";
import { showBeaconOnMap } from "./mapDiscovery";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { personDiscoveryReason } from "./discoveryRanking";
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
  const { data, userId, act } = useBeacon();
  const { styles, tokens, colors } = useTheme();
  const now = useNow();
  const [expanded, setExpanded] = useState(false);
  const selection = selectPersonPreview(data, personId, userId, now);
  if (!selection.canViewFullProfile || !selection.profile || !userId)
    return null;
  const profile = selection.profile;
  const request = data.friendships.find(
    (row) =>
      row.status === "pending" &&
      ((row.sender_id === userId && row.recipient_id === personId) ||
        (row.sender_id === personId && row.recipient_id === userId)),
  );
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
      style={[styles.card, { padding: 12, gap: 6 }]}
    >
      <View style={styles.row}>
        <ProfileAvatar
          profile={profile}
          size={36}
          status={selection.availability}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={[styles.h2, { fontSize: 16, textAlign: "left" }]}
          >
            {profile.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.muted, { fontSize: 12, textAlign: "left" }]}
          >
            @{profile.username}
          </Text>
        </View>
        <IconButton label="Close person preview" onPress={onClose}>
          <X size={20} color={colors.ink} />
        </IconButton>
      </View>
      <Text style={[styles.muted, { textAlign: "left" }]}>
        {personDiscoveryReason(data, profile, userId)}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <View>
          <Button
            title="View Profile"
            compact
            icon={<UserRound size={16} color={colors.bg} />}
            onPress={() =>
              router.push({
                pathname: "/person/[id]",
                params: { id: personId },
              })
            }
          />
        </View>
        {!selection.canMessage && personId !== userId && (
          <View>
            <Action
              title={
                request
                  ? request.sender_id === userId
                    ? "Requested"
                    : "Accept Friend"
                  : "Add Friend"
              }
              disabled={request?.sender_id === userId}
              compact
              run={() =>
                request
                  ? act("accept_friend", { id: request.id })
                  : act("friend_request", { username: profile.username })
              }
            />
          </View>
        )}
        {selection.canMessage && (
          <IconButton
            label={`Message ${profile.name}`}
            onPress={() =>
              router.push({
                pathname: "/messages/[id]",
                params: { id: personId },
              })
            }
          >
            <MessageCircle size={18} color={colors.green} />
          </IconButton>
        )}
      </View>
      {!!profile.bio && (
        <Text
          numberOfLines={1}
          style={[styles.body, { fontSize: 13, textAlign: "left" }]}
        >
          {profile.bio}
        </Text>
      )}
      {selection.canMessage && (
        <Text style={[styles.muted, { textAlign: "left" }]}>
          {selection.availability === "available"
            ? "Free to hang"
            : selection.availability === "unavailable"
              ? "Busy"
              : selection.availability === "ending-soon"
                ? "Free to hang, ending soon"
                : "Availability is not shared"}
        </Text>
      )}
      {!!beacons.length && (
        <Text style={[styles.label, { textAlign: "left" }]}>Beacons</Text>
      )}
      {(expanded ? beacons : beacons.slice(0, 2)).map((activity) => (
        <Pressable
          key={activity.id}
          accessibilityRole="button"
          accessibilityLabel={`Select ${activity.title} Beacon`}
          onPress={() => onBeacon(activity.id)}
          style={{
            minHeight: tokens.layout.minTapTarget,
            paddingVertical: 4,
            gap: 0,
          }}
        >
          <Text
            numberOfLines={1}
            style={[styles.body, { fontSize: 13, textAlign: "left" }]}
          >
            {activity.title}
          </Text>
          <Text style={[styles.muted, { fontSize: 12, textAlign: "left" }]}>
            {activityWhen(activity, new Date(now))}
          </Text>
        </Pressable>
      ))}
      {beacons.length > 2 && (
        <View style={{ alignSelf: "flex-start" }}>
          <Button
            compact
            secondary
            title={
              expanded ? "Show fewer Beacons" : `+${beacons.length - 2} Beacons`
            }
            onPress={() => setExpanded(!expanded)}
          />
        </View>
      )}
    </View>
  );
}
