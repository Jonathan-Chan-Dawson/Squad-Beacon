import React, { useState } from "react";
import { router } from "expo-router";
import { ChevronRight, Layers3, UsersRound } from "lucide-react-native";
import { Text, View } from "react-native";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  BeaconProfilePreview,
  ProfilePreviewFrame,
} from "@/src/features/people/previews/ProfilePreviewFrame";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Button, Empty, Txt, useTheme } from "@/src/shared/ui";
import { activeSpaceRole, canReadSpace, visibleSpaceSquads } from "./domain";
import {
  activeOrganizationRole,
  canReadOrganization,
} from "@/src/features/organizations/domain";
import { SocialCommunityInlinePreview } from "@/src/features/people/previews/SocialCommunityInlinePreview";
import { MotionPressable } from "@/src/shared/MotionPressable";
import type { SocialEntityType } from "@/src/features/social/types";
import {
  CommunityCover,
  communityRoleLabel,
} from "@/src/features/people/components/CommunityCard";
import {
  CommunityBreadcrumb,
  CompactBeaconCard,
} from "@/src/features/people/components/CompactCommunityParts";

/** Compact, active-member-only entry point into a Space profile. */
export function SpaceProfilePreview({
  spaceId,
  visible,
  onClose,
}: {
  spaceId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  const [selectedCommunity, setSelectedCommunity] = useState<{
    type: SocialEntityType;
    id: string;
  } | null>(null);
  const closePreview = () => {
    setSelectedCommunity(null);
    onClose();
  };
  const space = data.spaces.find((row) => row.id === spaceId);
  const role =
    space && userId ? activeSpaceRole(space, data.space_members, userId) : null;
  const authorized = !!(
    space &&
    userId &&
    data.viewer_id === userId &&
    canReadSpace(data, spaceId, userId) &&
    role
  );
  const members = authorized
    ? data.space_members.filter(
        (member) => member.space_id === spaceId && member.status === "active",
      )
    : [];
  const parents = authorized
    ? data.organization_spaces
        .filter((link) => link.space_id === spaceId)
        .flatMap((link) => {
          const organization = data.organizations.find(
            (row) => row.id === link.organization_id,
          );
          if (!organization || !userId) return [];
          return canReadOrganization(data, organization.id, userId) &&
            activeOrganizationRole(
              organization,
              data.organization_members,
              userId,
            )
            ? [organization]
            : [];
        })
    : [];

  function openFullProfile(
    type: SocialEntityType,
    id: string,
    tab?: "squads" | "activity" | "chat",
  ) {
    closePreview();
    setTimeout(() => {
      if (type === "squad" && tab === "chat") {
        router.push({ pathname: "/squad-chat/[id]", params: { id } });
      } else if (type === "squad") {
        router.push({
          pathname: "/squad/[id]",
          params: { id, ...(tab === "activity" ? { tab: "Activity" } : {}) },
        });
      } else if (type === "space") {
        router.push({
          pathname: "/space/[id]",
          params: { id, ...(tab ? { tab } : {}) },
        });
      } else {
        router.push({
          pathname: "/organization/[id]",
          params: {
            id,
            ...(tab === "activity"
              ? { tab: "activity" }
              : tab === "squads"
                ? { tab: "squads" }
                : {}),
          },
        });
      }
    }, 300);
  }
  const squads = authorized ? visibleSpaceSquads(data, spaceId, userId) : [];
  const activities = authorized
    ? data.activities
        .filter(
          (activity) =>
            userId &&
            data.activity_social_links.some(
              (link) =>
                link.activity_id === activity.id &&
                link.entity_type === "space" &&
                link.entity_id === spaceId,
            ) &&
            activity.status === "scheduled" &&
            Date.parse(activity.ends_at) > now &&
            canReadBeaconActivity(data, activity, userId),
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .slice(0, 2)
    : [];

  return (
    <ProfilePreviewFrame
      key={`${spaceId}:${authorized ? "active" : "unavailable"}:${visible ? "open" : "closed"}`}
      visible={visible}
      onClose={closePreview}
      title={authorized ? "About this Space" : "Space preview"}
      renderBeaconPreview={(beaconId, onBack) => (
        <BeaconProfilePreview
          beaconId={beaconId}
          onBack={onBack}
          backLabel={selectedCommunity ? "Back to preview" : "Back to Space"}
          onOpenFullBeacon={(id) => {
            closePreview();
            setTimeout(
              () => router.push({ pathname: "/activity/[id]", params: { id } }),
              300,
            );
          }}
        />
      )}
    >
      {(openBeacon) =>
        selectedCommunity ? (
          <SocialCommunityInlinePreview
            key={`${selectedCommunity.type}:${selectedCommunity.id}`}
            entityType={selectedCommunity.type}
            entityId={selectedCommunity.id}
            onBack={() => setSelectedCommunity(null)}
            backLabel="Back to Space"
            onOpenBeacon={openBeacon}
            onOpenFullProfile={openFullProfile}
          />
        ) : !authorized || !space ? (
          <Empty
            title="Space preview unavailable"
            body="This Space is no longer available to your account."
          />
        ) : (
          <View style={{ gap: 14 }}>
            <CommunityCover type="space" compact />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 11 }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 15,
                  backgroundColor: colors.lime,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Layers3 size={22} color={colors.green} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.h2}>{space.name}</Text>
                <Text style={styles.muted}>
                  {members.length} {members.length === 1 ? "member" : "members"}
                  {space.space_type
                    ? ` · ${space.space_type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}`
                    : ""}
                </Text>
                {role ? (
                  <Text style={[styles.label, { color: colors.green }]}>
                    {communityRoleLabel(role)}
                  </Text>
                ) : null}
              </View>
            </View>
            <CommunityBreadcrumb
              items={[
                ...parents.slice(0, 1).map((organization) => ({
                  id: organization.id,
                  label: organization.name,
                  onPress: () =>
                    setSelectedCommunity({
                      type: "organization",
                      id: organization.id,
                    }),
                })),
                {
                  id: space.id,
                  label: space.name,
                  onPress: () => openFullProfile("space", space.id),
                },
              ]}
            />
            {!!space.description && <Txt>{space.description}</Txt>}
            <View style={styles.card}>
              <Text style={styles.label}>SQUADS YOU CAN ACCESS</Text>
              <Text style={styles.muted}>
                {squads.length} {squads.length === 1 ? "Squad" : "Squads"}
              </Text>
              {squads.length ? (
                <View style={{ gap: 2 }}>
                  {squads.slice(0, 3).map((squad) => (
                    <MotionPressable
                      key={squad.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview Squad ${squad.name}`}
                      onPress={() =>
                        setSelectedCommunity({ type: "squad", id: squad.id })
                      }
                      style={[
                        styles.row,
                        {
                          minHeight: 44,
                          paddingHorizontal: 5,
                          borderBottomWidth: 1,
                          borderColor: colors.line,
                        },
                      ]}
                    >
                      <UsersRound size={17} color={colors.green} />
                      <Text
                        style={[styles.body, { flex: 1 }]}
                        numberOfLines={1}
                      >
                        {squad.name}
                      </Text>
                      <ChevronRight size={17} color={colors.muted} />
                    </MotionPressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>
                  No connected Squads are visible to you.
                </Text>
              )}
              <Text style={styles.muted}>
                Each Squad keeps its own roster and private conversations.
              </Text>
            </View>
            {activities.length > 0 && (
              <View style={{ gap: 7 }}>
                <Text style={styles.label}>FEATURED BEACONS</Text>
                {activities.map((activity) => (
                  <CompactBeaconCard
                    key={activity.id}
                    activity={activity}
                    label="Featured Beacon"
                    live={
                      Date.parse(activity.starts_at) <= now &&
                      Date.parse(activity.ends_at) > now
                    }
                    onPress={() => openBeacon(activity.id)}
                  />
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                compact
                secondary
                title="View Squads"
                onPress={() => openFullProfile("space", spaceId, "squads")}
              />
              <Button
                compact
                secondary
                title="View activity"
                onPress={() => openFullProfile("space", spaceId, "activity")}
              />
            </View>
            <Button
              title="View full Space profile"
              onPress={() => openFullProfile("space", spaceId)}
            />
          </View>
        )
      }
    </ProfilePreviewFrame>
  );
}
