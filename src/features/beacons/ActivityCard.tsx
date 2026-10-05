import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Clock3,
  MessageCircle,
  MapPin,
  Monitor,
  Star,
} from "lucide-react-native";
import type { Activity } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { activityWhen, friendIds } from "@/src/shared/domain";
import { attendance, crew } from "@/src/shared/browsing";
import { useNow } from "@/src/shared/useNow";
import { Button, IconButton, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import { usePreferences } from "@/src/shared/preferences";
import { ActivityBadge } from "./ActivityBadge";
import { BeaconResponse } from "./BeaconResponse";
import { canUseBeaconModules } from "./beaconModules";

export function ActivityCard({
  activity,
  onOpen,
  highlighted = false,
}: {
  activity: Activity;
  onOpen?: () => void;
  highlighted?: boolean;
}) {
  const { styles, colors } = useTheme();
  const { data, userId, act } = useBeacon();
  const { showAvatars } = usePreferences();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const now = useNow();
  const owner = data.profiles.find(
    (profile) => profile.id === activity.owner_id,
  );
  const place = data.places.find((item) => item.activity_id === activity.id);
  const when = activityWhen(activity, new Date(now));
  const live =
    activity.status === "scheduled" &&
    Date.parse(activity.starts_at) <= now &&
    Date.parse(activity.ends_at) > now;
  const peopleCount =
    activity.accepted_seat_count ?? attendance(data, activity);
  const isVirtual = !!place?.online_url;
  const location = isVirtual
    ? "Virtual"
    : place?.label ||
      (place ? "Place to be decided" : "Meeting details restricted");
  const saved = data.beacon_favorites.some(
    (favorite) =>
      favorite.owner_id === userId && favorite.activity_id === activity.id,
  );
  const savedPeople = (showAvatars ? crew(data, activity) : [])
    .filter(
      ({ person, status }) =>
        (status === "Going" || status === "Hosting") &&
        !!userId &&
        canViewProfile(data, person, userId),
    )
    .slice(0, 3);
  const friends = userId ? friendIds(data, userId) : [];
  const canMessageHost =
    !!userId &&
    activity.owner_id !== userId &&
    friends.includes(activity.owner_id);
  const canOpenChat =
    !!userId &&
    activity.enable_chat !== false &&
    canUseBeaconModules(data, activity, userId);
  const hasPhysicalPin =
    !isVirtual && place?.latitude != null && place.longitude != null;
  const manageBeacon = activity.owner_id === userId;
  async function toggleSaved() {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await act("save_beacon", {
        activity_id: activity.id,
        saved: !saved,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save this Beacon.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          padding: 12,
          gap: 8,
          borderRadius: 18,
          borderLeftWidth: 4,
          borderLeftColor: highlighted
            ? colors.lime
            : live
              ? colors.green
              : colors.line,
        },
      ]}
    >
      <View style={[styles.row, { gap: 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${activity.title} details`}
          onPress={
            onOpen ??
            (() =>
              router.push({
                pathname: "/(tabs)",
                params: { beacon: activity.id },
              }))
          }
          style={({ pressed }) => [
            styles.row,
            {
              flex: 1,
              minWidth: 0,
              gap: 9,
              opacity: pressed ? 0.78 : 1,
            },
          ]}
        >
          <ActivityBadge category={activity.category} size={36} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={2}
              style={[styles.h2, { fontSize: 17, lineHeight: 21 }]}
            >
              {activity.title}
            </Text>
            <Text numberOfLines={1} style={styles.muted}>
              {owner?.name ?? "Squad member"} {"\u00b7"} {activity.category}
            </Text>
          </View>
        </Pressable>
        <View style={{ alignItems: "center", gap: 2 }}>
          <IconButton
            label={saved ? "Remove saved Beacon" : "Save Beacon"}
            selected={saved}
            disabled={saving}
            onPress={() => void toggleSaved()}
          >
            <Star
              size={19}
              color={colors.green}
              fill={saved ? colors.green : "transparent"}
            />
          </IconButton>
        </View>
      </View>

      <View style={styles.between}>
        <View style={[styles.row, { flex: 1, minWidth: 0, gap: 6 }]}>
          {isVirtual ? (
            <Monitor size={15} color={colors.green} />
          ) : (
            <MapPin size={15} color={colors.green} />
          )}
          <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>
            {location}
          </Text>
        </View>
        <View style={[styles.row, { gap: 5 }]}>
          <Clock3 size={15} color={live ? colors.green : colors.muted} />
          <Text
            style={[
              styles.muted,
              live && { color: colors.green, fontWeight: "700" },
            ]}
          >
            {when}
          </Text>
        </View>
      </View>

      <View style={styles.between}>
        <View style={[styles.row, { gap: 7, flex: 1 }]}>
          <View
            style={{
              flexDirection: "row",
              paddingLeft: savedPeople.length ? 3 : 0,
            }}
          >
            {savedPeople.map(({ person }, index) => (
              <View key={person.id} style={{ marginLeft: index ? -7 : 0 }}>
                <ProfileAvatar profile={person} size={24} />
              </View>
            ))}
          </View>
          <Text style={styles.label}>
            {peopleCount} {peopleCount === 1 ? "person" : "people"} going
          </Text>
        </View>
        {activity.target_count != null &&
        activity.target_count > peopleCount ? (
          <Text style={styles.label}>
            Need {activity.target_count - peopleCount} more
          </Text>
        ) : null}
      </View>
      <View style={[styles.row, { gap: 6 }]}>
        <View style={{ flex: 1 }}>
          {manageBeacon ? (
            <Button
              title="Manage"
              compact
              onPress={() =>
                router.push({
                  pathname: "/activity/[id]",
                  params: { id: activity.id },
                })
              }
            />
          ) : (
            <BeaconResponse activity={activity} compact />
          )}
        </View>
        {hasPhysicalPin && (
          <IconButton
            label={`View ${activity.title} on map`}
            onPress={() =>
              router.push({
                pathname: "/(tabs)",
                params: { beacon: activity.id },
              })
            }
          >
            <MapPin size={18} color={colors.green} />
          </IconButton>
        )}
        {(canOpenChat || canMessageHost) && (
          <IconButton
            label={
              canOpenChat
                ? `Open ${activity.title} chat`
                : `Message ${owner?.name ?? "Beacon host"}`
            }
            onPress={() =>
              canOpenChat
                ? router.push({
                    pathname: "/activity/[id]",
                    params: { id: activity.id, tab: "chat" },
                  })
                : router.push({
                    pathname: "/messages/[id]",
                    params: { id: activity.owner_id },
                  })
            }
          >
            <MessageCircle size={18} color={colors.green} />
          </IconButton>
        )}
      </View>
      {!!saveError && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {saveError}
        </Text>
      )}
    </View>
  );
}
