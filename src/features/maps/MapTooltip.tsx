import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  ChevronRight,
  MessageCircle,
  Music,
  Smile,
  Trophy,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { IconButton, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import { crew } from "@/src/shared/browsing";
import { isBeaconModuleEnabled } from "@/src/features/beacons/permissions";
import {
  canReadBeaconActivity,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { MapBeaconRsvp } from "./MapBeaconRsvp";
import { canReadBeaconMeetingDetails } from "./filtering";
import { beaconPreviewWhen } from "./discoveryRanking";
import { MapRelationshipActions } from "./MapRelationshipActions";
import type { MapContextFilter } from "./contextFilters";
import type { MapBeaconFeature } from "./mapBeaconFeatures";
import { MapTooltipShell, MapTooltipClose } from "./MapTooltipShell";
import { mapTooltip } from "./tooltipConstants";

export function MapTooltip({
  community,
  beaconId,
  onShowContext,
  onPerson,
  onDetails,
  onFeature,
  onClose,
}: {
  onShowContext?: (filter: MapContextFilter) => void;
  beaconId: string | null;
  personId: string | null;
  pinned: boolean;
  community?: { name: string; onPress(): void };
  onPerson?: (id: string) => void;
  onDetails(): void;
  onFeature?: (feature: MapBeaconFeature) => void;
  onMessage(): void;
  onClose(): void;
}) {
  const { data, userId } = useBeacon();
  const { colors, styles } = useTheme();
  const now = useNow();
  const activity = data.activities.find((row) => row.id === beaconId);
  if (
    !activity ||
    !userId ||
    data.viewer_id !== userId ||
    !canReadBeaconActivity(data, activity, userId)
  )
    return null;
  const host = data.profiles.find(
    (row) => row.id === activity.owner_id && canViewProfile(data, row, userId),
  );
  const place = canReadBeaconMeetingDetails(data, activity, userId)
    ? data.places.find((row) => row.activity_id === activity.id)
    : undefined;
  const participants = crew(data, activity).filter(
    ({ person, status }) =>
      (status === "Going" || status === "Hosting") &&
      canViewProfile(data, person, userId),
  );
  const going = activity.accepted_seat_count ?? participants.length;
  const needed = Math.max(0, (activity.target_count ?? going) - going);
  const live =
    Date.parse(activity.starts_at) <= now && Date.parse(activity.ends_at) > now;
  const allowed = canUseBeaconModules(data, activity, userId);
  const teams =
    allowed && isBeaconModuleEnabled(activity, "scoreboard")
      ? data.beacon_teams
          .filter((row) => row.activity_id === activity.id)
          .slice(0, 2)
      : [];
  const music =
    allowed && isBeaconModuleEnabled(activity, "music") && !!activity.music_url;
  return (
    <MapTooltipShell testID="map-tooltip-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityBadge
          category={activity.category}
          size={mapTooltip.avatarSize}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[
              styles.h2,
              { fontSize: mapTooltip.titleSize, textAlign: "left" },
            ]}
          >
            {activity.title}
          </Text>
          <Pressable
            disabled={!host || !onPerson}
            accessibilityRole="button"
            accessibilityLabel={`View ${host?.name ?? "host"}'s profile`}
            onPress={() => host && onPerson?.(host.id)}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            {host && <ProfileAvatar profile={host} size={16} />}
            <Text
              numberOfLines={1}
              style={[
                styles.muted,
                { flex: 1, fontSize: mapTooltip.detailSize, textAlign: "left" },
              ]}
            >
              {host?.name ?? "Host"} {"\u00b7"}{" "}
              {place?.online_url
                ? "Virtual"
                : (place?.label ?? "Meeting details private")}
            </Text>
          </Pressable>
        </View>
        <MapTooltipClose label="Close map preview" onClose={onClose} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 5,
          backgroundColor: colors.green + "20",
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 4,
          maxWidth: "100%",
        }}
      >
        {live && (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.green,
            }}
          />
        )}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: colors.green, fontSize: mapTooltip.detailSize },
          ]}
        >
          {beaconPreviewWhen(activity, now)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flexDirection: "row" }}>
          {participants.slice(0, 3).map(({ person }, i) => (
            <View key={person.id} style={{ marginLeft: i ? -7 : 0 }}>
              <ProfileAvatar profile={person} size={22} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <Text numberOfLines={1} style={[styles.label, { fontSize: 12 }]}>
              {going} going
            </Text>
            {needed > 0 && (
              <Text numberOfLines={1} style={[styles.muted, { fontSize: 12 }]}>
                Need {needed} more
              </Text>
            )}
          </View>
          {!!activity.target_count && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Going"
              accessibilityValue={{
                min: 0,
                max: activity.target_count,
                now: Math.min(going, activity.target_count),
              }}
              style={{
                height: 3,
                borderRadius: 2,
                backgroundColor: colors.line,
              }}
            >
              <View
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: colors.green,
                  width: `${Math.min(100, (going / activity.target_count) * 100)}%`,
                }}
              />
            </View>
          )}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <MapBeaconRsvp activity={activity} compact tooltip />
        </View>
        {allowed &&
          onFeature &&
          isBeaconModuleEnabled(activity, "reactions") && (
            <IconButton
              label="React to Beacon"
              onPress={() => onFeature("reactions")}
            >
              <Smile size={17} color={colors.green} />
            </IconButton>
          )}
        {allowed &&
          onFeature &&
          isBeaconModuleEnabled(activity, "comments") && (
            <IconButton
              label="Open Beacon comments"
              onPress={() => onFeature("comments")}
            >
              <MessageCircle size={17} color={colors.green} />
            </IconButton>
          )}
      </View>
      <MapRelationshipActions beaconId={activity.id} onShow={onShowContext} />
      {(teams.length > 0 || music) && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          {teams.length > 0 && (
            <>
              <Trophy size={13} color={colors.muted} />
              <Text numberOfLines={1} style={[styles.muted, { fontSize: 11 }]}>
                {teams.map((team) => team.score).join("\u2013")}
              </Text>
            </>
          )}
          {music && (
            <>
              <Music size={13} color={colors.muted} />
              <Text
                numberOfLines={1}
                style={[styles.muted, { flexShrink: 1, fontSize: 11 }]}
              >
                Music available
              </Text>
            </>
          )}
        </View>
      )}
      {community && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Hosted by ${community.name}`}
          onPress={community.onPress}
        >
          <Text numberOfLines={1} style={[styles.muted, { fontSize: 11 }]}>
            {community.name}
          </Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See overview"
        onPress={onDetails}
        style={{
          borderTopWidth: 1,
          borderColor: colors.line,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={[styles.label, { color: colors.green, fontSize: 13 }]}>
          See overview
        </Text>
        <ChevronRight size={17} color={colors.green} />
      </Pressable>
    </MapTooltipShell>
  );
}
