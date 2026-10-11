import { beaconPreviewWhen } from "./discoveryRanking";
import { MapRelationshipActions } from "./MapRelationshipActions";
import type { MapContextFilter } from "./contextFilters";
import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import {
  ArrowUpRight,
  MapPin,
  MessageCircle,
  Monitor,
  Star,
  X,
} from "lucide-react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, IconButton, Txt, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { crew, canChat } from "@/src/shared/browsing";
import { friendIds } from "@/src/shared/domain";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
import { canUseBeaconModules } from "@/src/features/beacons/beaconModules";
import { physicalDirectionsUrl } from "@/src/features/maps/directions";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { BeaconResponse } from "@/src/features/beacons/BeaconResponse";
import { canReadBeaconMeetingDetails } from "@/src/features/maps/filtering";

export function MapTooltip({
  community,
  beaconId,
  onShowContext,
  personId,
  pinned,
  onPerson,
  onDetails,
  onMessage,
  onClose,
}: {
  onShowContext?: (filter: MapContextFilter) => void;
  beaconId: string | null;
  personId: string | null;
  pinned: boolean;
  community?: { name: string; onPress(): void };
  onPerson?: (id: string) => void;
  onDetails: () => void;
  onMessage: () => void;
  onClose: () => void;
}) {
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const [savingStar, setSavingStar] = useState(false);
  const [starError, setStarError] = useState("");
  const now = useNow();
  const activity = data.activities.find(
    (candidate) => candidate.id === beaconId,
  );
  const candidate = data.profiles.find(
    (profile) => profile.id === (personId ?? activity?.owner_id),
  );
  const person =
    candidate && userId && canViewProfile(data, candidate, userId)
      ? candidate
      : undefined;
  const place =
    activity && userId && canReadBeaconMeetingDetails(data, activity, userId)
      ? data.places.find(
          (candidatePlace) => candidatePlace.activity_id === activity.id,
        )
      : undefined;
  const decisionThread =
    activity && userId && data.viewer_id === userId
      ? data.planning_threads.find(
          (thread) =>
            (thread.kind === "vote" || thread.kind === "draw") &&
            thread.materialized_activity_id === activity.id &&
            canReadPlanningThread(data, thread, userId),
        )
      : undefined;
  const participants = activity
    ? crew(data, activity).filter(
        ({ person: member, status }) =>
          (status === "Going" || status === "Hosting") &&
          !!userId &&
          canViewProfile(data, member, userId),
      )
    : [];
  const saved =
    !!personId &&
    data.favorites.some(
      (favorite) =>
        favorite.owner_id === userId &&
        favorite.kind === "friend" &&
        favorite.target_id === personId,
    );
  const friends = userId ? friendIds(data, userId) : [];
  const canStarPerson = !!personId && friends.includes(personId);
  const canMessagePerson = !!personId && friends.includes(personId);
  async function togglePersonStar() {
    if (!personId || savingStar) return;
    setSavingStar(true);
    setStarError("");
    try {
      await act("favorite", {
        id: personId,
        kind: "friend",
        add: !saved,
      });
    } catch (error) {
      setStarError(
        error instanceof Error
          ? error.message
          : "Could not update Starred Friends.",
      );
    } finally {
      setSavingStar(false);
    }
  }
  const chatAvailable =
    !!activity &&
    !!userId &&
    isBeaconModuleEnabled(activity, "chat") &&
    canUseBeaconModules(data, activity, userId) &&
    canChat(data, activity, userId);
  const directions =
    !place?.online_url && pinned
      ? physicalDirectionsUrl(place?.latitude, place?.longitude)
      : null;

  return (
    <View
      testID="map-tooltip-card"
      style={{
        gap: 6,
        padding: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.white + "F5",
        boxShadow: "0 8px 28px #142e3033",
      }}
    >
      <View style={styles.row}>
        {activity && <ActivityBadge category={activity.category} size={34} />}
        {person && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${person.name}'s profile`}
            onPress={() =>
              onPerson
                ? onPerson(person.id)
                : router.push({
                    pathname: "/person/[id]",
                    params: { id: person.id },
                  })
            }
          >
            <ProfileAvatar profile={person} size={38} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            personId && person
              ? `View ${person.name}'s profile`
              : activity
                ? `Open ${activity.title} Beacon details`
                : "Open map item details"
          }
          onPress={() => {
            if (personId && person) {
              if (onPerson) onPerson(person.id);
              else
                router.push({
                  pathname: "/person/[id]",
                  params: { id: person.id },
                });
            } else onDetails();
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Text style={[styles.label, { textAlign: "left" }]} numberOfLines={1}>
            {person?.name ??
              (activity?.owner_id === userId ? "Your Beacon" : "BEACON")}
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.h2, { fontSize: 16, textAlign: "left" }]}
          >
            {activity?.title ?? person?.name ?? "Beacon unavailable"}
          </Text>
        </Pressable>
        {personId && userId !== personId && canStarPerson && (
          <IconButton
            label={
              saved
                ? `Unstar ${person?.name ?? "friend"}`
                : `Star ${person?.name ?? "friend"}`
            }
            selected={saved}
            disabled={savingStar}
            onPress={() => void togglePersonStar()}
          >
            <Star
              size={18}
              color={colors.green}
              fill={saved ? colors.green : "transparent"}
            />
          </IconButton>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close map preview"
          onPress={onClose}
          style={{ padding: 8 }}
        >
          <X size={18} color={colors.ink} />
        </Pressable>
      </View>
      {activity && (
        <>
          {personId && activity.mode === "solo" && (
            <Text style={[styles.label, { textAlign: "left" }]}>
              {activity.available ? "Available" : "Sharing a status"}
              {activity.description ? ` · ${activity.description}` : ""}
            </Text>
          )}
          <View style={[styles.row, { gap: 6, justifyContent: "flex-start" }]}>
            {place?.online_url ? (
              <Monitor size={15} color={colors.green} />
            ) : (
              <MapPin size={15} color={colors.green} />
            )}
            <Text
              numberOfLines={1}
              style={[styles.muted, { flexShrink: 1, textAlign: "left" }]}
            >
              {place?.online_url
                ? "Virtual"
                : (place?.label ??
                  (pinned ? "Meeting place" : "No location shared"))}
            </Text>
          </View>
          <Text style={[styles.muted, { textAlign: "left" }]}>
            {beaconPreviewWhen(activity, now)}
          </Text>
          <View
            style={[
              styles.row,
              { justifyContent: "flex-start", flexWrap: "wrap" },
            ]}
          >
            <View
              style={[
                styles.row,
                { gap: 6, justifyContent: "flex-start", flexWrap: "wrap" },
              ]}
            >
              {participants.slice(0, 3).map(({ person: member }, index) => (
                <View key={member.id} style={{ marginLeft: index ? -8 : 0 }}>
                  <ProfileAvatar profile={member} size={24} />
                </View>
              ))}
              <Text style={[styles.label, { textAlign: "left" }]}>
                {activity.accepted_seat_count ?? participants.length} going
              </Text>
            </View>
            {activity.target_count != null &&
              activity.target_count >
                (activity.accepted_seat_count ?? participants.length) && (
                <Text style={[styles.label, { textAlign: "left" }]}>
                  Need{" "}
                  {activity.target_count -
                    (activity.accepted_seat_count ?? participants.length)}{" "}
                  more
                </Text>
              )}
          </View>
          {decisionThread && (
            <Text style={[styles.muted, { fontSize: 12 }]}>
              Chosen by {decisionThread.kind === "vote" ? "Vote" : "Draw"}
            </Text>
          )}
        </>
      )}
      {!pinned && !activity && <Txt muted>No meeting pin shared yet.</Txt>}
      {activity && (
        <View style={{ alignSelf: "flex-start" }}>
          <MapRelationshipActions
            beaconId={activity.id}
            onShow={onShowContext}
          />
        </View>
      )}
      {community && (
        <View style={{ alignSelf: "flex-start" }}>
          <Button
            title={`Hosted by ${community.name}`}
            secondary
            compact
            onPress={community.onPress}
          />
        </View>
      )}
      {!!starError && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.muted, { textAlign: "left" }]}
        >
          {starError}
        </Text>
      )}
      <View
        style={[
          styles.row,
          { gap: 6, justifyContent: "flex-start", flexWrap: "wrap" },
        ]}
      >
        {activity && (
          <>
            <BeaconResponse activity={activity} compact joinLabel="Join" />
            <IconButton label="See overview" onPress={onDetails}>
              <ArrowUpRight size={18} color={colors.green} />
            </IconButton>
          </>
        )}

        {directions && (
          <IconButton
            label={`Directions to ${place?.label ?? "Beacon"}`}
            onPress={() => void Linking.openURL(directions)}
          >
            <MapPin size={18} color={colors.green} />
          </IconButton>
        )}
        {chatAvailable && (
          <IconButton label="Open Beacon chat" onPress={onMessage}>
            <MessageCircle size={18} color={colors.green} />
          </IconButton>
        )}
        {canMessagePerson && (
          <IconButton
            label={`Message ${person?.name ?? "friend"}`}
            onPress={() =>
              router.push({
                pathname: "/messages/[id]",
                params: { id: personId! },
              })
            }
          >
            <MessageCircle size={18} color={colors.green} />
          </IconButton>
        )}
      </View>
    </View>
  );
}
