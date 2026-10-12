import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  MinusCircle,
} from "lucide-react-native";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import {
  selectPersonPreview,
  selectFreshVisiblePersonLocation,
} from "@/src/features/people/previews/personPreview";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Action, useTheme } from "@/src/shared/ui";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { beaconPreviewWhen } from "./discoveryRanking";
import {
  MapTooltipShell,
  MapTooltipClose,
  MapTooltipButton,
} from "./MapTooltipShell";
import { mapTooltip } from "./tooltipConstants";
import { visibleSoloActivity, canReactToSoloActivity } from "./soloActivity";

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
  const { styles, colors } = useTheme();
  const now = useNow();
  const [reactionBusy, setReactionBusy] = useState(false);
  const [reactionError, setReactionError] = useState("");
  const selection = selectPersonPreview(data, personId, userId, now);
  // Solo statuses use the existing activity storage, but are not linked Beacon cards.
  const linkedBeacon = selectPersonPreview(
    {
      ...data,
      activities: data.activities.filter(
        (activity) => activity.mode !== "solo",
      ),
    },
    personId,
    userId,
    now,
  ).beacon;
  const solo =
    linkedBeacon && Date.parse(linkedBeacon.starts_at) <= now
      ? undefined
      : visibleSoloActivity(data, personId, userId, now);
  if (!selection.canViewFullProfile || !selection.profile || !userId)
    return null;
  const profile = selection.profile;
  const location = selectFreshVisiblePersonLocation(
    data,
    personId,
    userId,
    now,
  );
  const request = data.friendships.find(
    (row) =>
      row.status === "pending" &&
      ((row.sender_id === userId && row.recipient_id === personId) ||
        (row.sender_id === personId && row.recipient_id === userId)),
  );
  const availability = data.activities.find(
    (row) =>
      row.owner_id === personId &&
      row.mode === "solo" &&
      row.status === "scheduled" &&
      Date.parse(row.starts_at) <= now &&
      Date.parse(row.ends_at) > now &&
      canReadBeaconActivity(data, row, userId),
  );
  const free =
    selection.availability === "available" ||
    selection.availability === "ending-soon";
  const StatusIcon = free
    ? CheckCircle2
    : selection.availability === "unavailable"
      ? MinusCircle
      : CircleHelp;
  const status = free
    ? "Free to hang"
    : selection.availability === "unavailable"
      ? "Busy"
      : "Availability not shared";
  const minutes = availability
    ? Math.max(1, Math.ceil((Date.parse(availability.ends_at) - now) / 60000))
    : null;
  const ago = location?.updated_at
    ? Math.max(0, Math.floor((now - Date.parse(location.updated_at)) / 60000))
    : null;
  return (
    <MapTooltipShell testID="map-person-preview">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            padding: 2,
            borderRadius: 24,
            borderWidth: 1,
            borderColor:
              selection.availability === "unknown" ? colors.line : colors.green,
          }}
        >
          <ProfileAvatar profile={profile} size={mapTooltip.avatarSize} />
          <View
            testID={
              selection.availability !== "unknown"
                ? `avatar-status-${selection.availability}`
                : undefined
            }
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              borderRadius: 8,
              backgroundColor: colors.white,
            }}
          >
            <StatusIcon size={13} color={colors.green} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={solo ? 2 : 1}
            style={[
              styles.h2,
              { fontSize: mapTooltip.titleSize, textAlign: "left" },
            ]}
          >
            {profile.name}
            {solo ? " · Solo Activity" : ""}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text
              numberOfLines={1}
              style={[styles.muted, { flexShrink: 1, fontSize: 12 }]}
            >
              @{profile.username}
            </Text>
            {selection.canMessage && (
              <Text
                style={[
                  styles.label,
                  {
                    fontSize: 10,
                    borderRadius: 7,
                    paddingHorizontal: 5,
                    backgroundColor: colors.line,
                  },
                ]}
              >
                Friend
              </Text>
            )}
          </View>
        </View>
        <MapTooltipClose label="Close person preview" onClose={onClose} />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 5,
          backgroundColor: colors.green + "20",
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          maxWidth: "100%",
        }}
      >
        <StatusIcon size={14} color={colors.green} />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { flexShrink: 1, fontSize: 12, color: colors.green },
          ]}
        >
          {status}
          {minutes
            ? ` \u00b7 ends in ${minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} hrs`}`
            : ""}
        </Text>
      </View>
      {selection.sharedContexts[0] && (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              alignSelf: "flex-start",
              maxWidth: "100%",
              fontSize: 11,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
              backgroundColor: colors.line,
            },
          ]}
        >
          {selection.sharedContexts[0].name}
        </Text>
      )}
      {ago != null && Number.isFinite(ago) && (
        <Text
          numberOfLines={1}
          style={[styles.muted, { fontSize: 11, textAlign: "left" }]}
        >
          Shared {ago < 1 ? "just now" : `${ago}m ago`}
        </Text>
      )}
      {solo && (
        <View testID="map-solo-activity" style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ActivityBadge category={solo.category} size={26} />
            <Text
              numberOfLines={2}
              style={[styles.label, { flex: 1, fontSize: 14 }]}
            >
              {solo.title}
            </Text>
          </View>
          {!!solo.description?.trim() && (
            <Text numberOfLines={3} style={[styles.body, { fontSize: 12 }]}>
              {solo.description}
            </Text>
          )}
          <Text style={[styles.muted, { fontSize: 11 }]}>
            Started{" "}
            {Math.max(
              0,
              Math.floor((now - Date.parse(solo.starts_at)) / 60000),
            ) < 1
              ? "just now"
              : `${Math.floor((now - Date.parse(solo.starts_at)) / 60000)}m ago`}
          </Text>
          {canReactToSoloActivity(data, solo, userId, now) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                data.reactions.some(
                  (row) =>
                    row.activity_id === solo.id && row.user_id === userId,
                )
                  ? "Remove status reaction"
                  : "React to status"
              }
              accessibilityState={{
                selected: data.reactions.some(
                  (row) =>
                    row.activity_id === solo.id && row.user_id === userId,
                ),
                disabled: reactionBusy,
              }}
              disabled={reactionBusy}
              onPress={async () => {
                setReactionBusy(true);
                setReactionError("");
                try {
                  await act("react", {
                    id: solo.id,
                    remove: data.reactions.some(
                      (row) =>
                        row.activity_id === solo.id && row.user_id === userId,
                    ),
                  });
                } catch (error) {
                  setReactionError(
                    error instanceof Error
                      ? error.message
                      : "Could not react. Try again.",
                  );
                } finally {
                  setReactionBusy(false);
                }
              }}
              style={{
                minHeight: 44,
                alignSelf: "flex-start",
                justifyContent: "center",
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: colors.green + "20",
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 12 }}>
                🙌{" "}
                {data.reactions.some(
                  (row) =>
                    row.activity_id === solo.id && row.user_id === userId,
                )
                  ? "Reacted"
                  : "React"}{" "}
                ·{" "}
                {
                  data.reactions.filter((row) => row.activity_id === solo.id)
                    .length
                }
              </Text>
            </Pressable>
          )}
          {!!reactionError && (
            <Text
              accessibilityRole="alert"
              style={[styles.muted, { fontSize: 12 }]}
            >
              {reactionError}
            </Text>
          )}
        </View>
      )}
      {linkedBeacon && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${linkedBeacon.title} Beacon`}
          onPress={() => onBeacon(linkedBeacon.id)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 8,
            minHeight: 48,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.bg,
            borderRadius: 12,
          }}
        >
          <ActivityBadge category={linkedBeacon.category} size={28} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[styles.label, { fontSize: 13, textAlign: "left" }]}
            >
              {linkedBeacon.title}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.muted, { fontSize: 11, textAlign: "left" }]}
            >
              {beaconPreviewWhen(linkedBeacon, now)}
            </Text>
          </View>
          <ChevronRight size={17} color={colors.green} />
        </Pressable>
      )}
      <View style={{ flexDirection: "row", gap: 6 }}>
        {selection.canMessage ? (
          <View style={{ flex: 1 }}>
            <MapTooltipButton
              title="Message"
              accessibilityLabel={`Message ${profile.name}`}
              secondary
              compact
              onPress={() =>
                router.push({
                  pathname: "/messages/[id]",
                  params: { id: personId },
                })
              }
            />
          </View>
        ) : personId !== userId ? (
          <View style={{ flex: 1 }}>
            <Action
              title={
                request
                  ? request.sender_id === userId
                    ? "Requested"
                    : "Accept Friend"
                  : "Add Friend"
              }
              disabled={request?.sender_id === userId}
              secondary
              compact
              run={() =>
                request
                  ? act("accept_friend", { id: request.id })
                  : act("friend_request", { username: profile.username })
              }
            />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <MapTooltipButton
            title="View profile"
            compact
            onPress={() =>
              router.push({
                pathname: "/person/[id]",
                params: { id: personId },
              })
            }
          />
        </View>
      </View>
    </MapTooltipShell>
  );
}
