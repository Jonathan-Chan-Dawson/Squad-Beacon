import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Star } from "lucide-react-native";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import {
  BeaconProfilePreview,
  ProfilePreviewFrame,
} from "@/src/features/people/previews/ProfilePreviewFrame";
import { selectPersonPreview } from "@/src/features/people/previews/personPreview";
import { useBeacon } from "@/src/shared/store";
import { activityWhen } from "@/src/shared/domain";
import { useNow } from "@/src/shared/useNow";
import { Button, IconButton, Txt, useTheme } from "@/src/shared/ui";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { SocialCommunityInlinePreview } from "@/src/features/people/previews/SocialCommunityInlinePreview";
import type { SocialEntityType } from "@/src/features/social/types";

function delayNavigation(run: () => void, close: () => void) {
  close();
  setTimeout(run, 320);
}

export function PersonProfilePreview({
  personId,
  visible,
  onClose,
}: {
  personId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  const [savingStar, setSavingStar] = useState(false);
  const [error, setError] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<{
    type: SocialEntityType;
    id: string;
  } | null>(null);
  const closePreview = () => {
    setSelectedCommunity(null);
    onClose();
  };
  const selection = selectPersonPreview(data, personId, userId, now);
  const name = selection.canViewFullProfile
    ? (selection.profile?.name ?? "Friend")
    : "Friend";

  async function toggleStar() {
    if (savingStar || !selection.canMessage || !userId) return;
    setSavingStar(true);
    setError("");
    try {
      await act("favorite", {
        id: personId,
        kind: "friend",
        add: !selection.starred,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not update Starred.",
      );
    } finally {
      setSavingStar(false);
    }
  }

  const openFullProfile = () =>
    delayNavigation(
      () => router.push({ pathname: "/person/[id]", params: { id: personId } }),
      closePreview,
    );
  const openMap = () =>
    delayNavigation(
      () => router.push({ pathname: "/(tabs)", params: { person: personId } }),
      closePreview,
    );
  const openBeacon = (id: string) =>
    delayNavigation(
      () => router.push({ pathname: "/activity/[id]", params: { id } }),
      closePreview,
    );

  return (
    <ProfilePreviewFrame
      key={`${userId ?? "signed-out"}:${personId}:${selection.canViewFullProfile}:${visible ? "open" : "closed"}`}
      visible={visible}
      onClose={closePreview}
      title={name}
      renderBeaconPreview={(beaconId, onBack) => (
        <BeaconProfilePreview
          beaconId={beaconId}
          onBack={onBack}
          onOpenFullBeacon={openBeacon}
        />
      )}
    >
      {(openBeaconPreview) => {
        if (selectedCommunity) {
          return (
            <SocialCommunityInlinePreview
              key={`${selectedCommunity.type}:${selectedCommunity.id}`}
              entityType={selectedCommunity.type}
              entityId={selectedCommunity.id}
              onBack={() => setSelectedCommunity(null)}
          backLabel={selectedCommunity ? "Back to preview" : "Back to profile"}
              onOpenBeacon={openBeaconPreview}
              onOpenFullProfile={(type, id, tab) => {
                closePreview();
                setTimeout(() => {
                  if (type === "organization")
                    router.push({ pathname: "/organization/[id]", params: { id, ...(tab === "activity" ? { tab: "activity" } : {}) } });
                  else if (type === "space")
                    router.push({ pathname: "/space/[id]", params: { id, ...(tab ? { tab } : {}) } });
                  else if (tab === "chat")
                    router.push({ pathname: "/squad-chat/[id]", params: { id } });
                  else
                    router.push({ pathname: "/squad/[id]", params: { id, ...(tab === "activity" ? { tab: "Activity" } : {}) } });
                }, 320);
              }}
            />
          );
        }
        if (!selection.canMessage && !selection.canViewFullProfile) {
          return (
            <View style={{ gap: 12 }}>
              <Text style={styles.h2}>Profile unavailable</Text>
              <Txt muted>This conversation is no longer available.</Txt>
            </View>
          );
        }

        const profile = selection.profile;
        return (
          <View style={{ gap: 14 }}>
            <View
              style={[
                styles.card,
                { flexDirection: "row", alignItems: "center", gap: 13 },
              ]}
            >
              <ProfileAvatar profile={profile} size={68} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.h2}>{name}</Text>
                {profile ? (
                  <Text style={styles.muted}>@{profile.username}</Text>
                ) : null}
                {!profile ? (
                  <Text style={styles.muted}>
                    Profile details aren’t shared right now.
                  </Text>
                ) : null}
              </View>
              {selection.canMessage ? <IconButton
                label={selection.starred ? "Unstar" : "Star"}
                selected={selection.starred}
                disabled={savingStar}
                onPress={() => void toggleStar()}
              >
                <Star
                  size={19}
                  color={colors.green}
                  fill={selection.starred ? colors.green : "transparent"}
                />
              </IconButton> : null}
            </View>

            {profile?.bio ? (
              <Text style={styles.body}>{profile.bio}</Text>
            ) : null}
            {profile && selection.availability !== "unknown" ? (
              <View style={[styles.chip, { alignSelf: "flex-start" }]}>
                <Text style={styles.chipText}>
                  {selection.availability === "available"
                    ? "Available now"
                    : selection.availability === "ending-soon"
                      ? "Wrapping up soon"
                      : "Not available right now"}
                </Text>
              </View>
            ) : null}

            {profile && selection.sharedContexts.length ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.label}>SHARED WITH YOU</Text>
                {selection.sharedContexts.map((context) => (
                  <Button
                    key={`${context.kind}:${context.id}`}
                    title={`${context.kind}: ${context.name}`}
                    compact
                    secondary
                    onPress={() => setSelectedCommunity({
                      type: context.kind === "Organization" ? "organization" : "squad",
                      id: context.id,
                    })}
                  />
                ))}
              </View>
            ) : null}

            {profile && selection.beacon ? (
              <View style={{ gap: 7 }}>
                <Text style={styles.label}>
                  {Date.parse(selection.beacon.starts_at) <= now
                    ? "CURRENT BEACON"
                    : "NEXT BEACON"}
                </Text>
                <View style={styles.card}>
                  <MotionPressable
                    testID="person-preview-current-beacon-row"
                    accessibilityRole="button"
                    accessibilityLabel={`${Date.parse(selection.beacon.starts_at) <= now ? "Current" : "Next"} Beacon: ${selection.beacon.title}`}
                    accessibilityHint="Opens a Beacon preview"
                    onPress={() => openBeaconPreview(selection.beacon!.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      minHeight: 56,
                      opacity: pressed ? 0.78 : 1,
                    })}
                  >
                    <ActivityBadge
                      category={selection.beacon.category}
                      size={38}
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text numberOfLines={1} style={styles.h2}>
                        {selection.beacon.title}
                      </Text>
                      <Text style={styles.muted}>
                        {selection.beacon.category} ·{" "}
                        {activityWhen(selection.beacon, new Date(now))}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.muted} />
                  </MotionPressable>
                </View>
              </View>
            ) : null}

            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {selection.canViewMap ? (
                <Button title="View Map" secondary onPress={openMap} />
              ) : null}
              {selection.canViewFullProfile ? (
                <Button title="View Full Profile" onPress={openFullProfile} />
              ) : null}
            </View>
          </View>
        );
      }}
    </ProfilePreviewFrame>
  );
}
