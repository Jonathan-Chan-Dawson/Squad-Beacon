import React, { useState } from "react";
import { router } from "expo-router";
import { Building2, ChevronRight, Layers3, UsersRound } from "lucide-react-native";
import { Text, View } from "react-native";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import {
  BeaconProfilePreview,
  ProfilePreviewFrame,
} from "@/src/features/people/previews/ProfilePreviewFrame";
import { activeSpaceRole, canReadSpace } from "@/src/features/spaces/domain";
import { useBeacon } from "@/src/shared/store";
import { Button, Empty, Txt, useTheme } from "@/src/shared/ui";
import {
  activeOrganizationRole,
  canReadOrganization,
  organizationActiveMemberCount,
} from "./domain";
import { useNow } from "@/src/shared/useNow";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { SocialCommunityInlinePreview } from "@/src/features/people/previews/SocialCommunityInlinePreview";
import type { SocialEntityType } from "@/src/features/social/types";

/** Compact, membership-gated entry point into an Organization profile. */
export function OrganizationProfilePreview({
  organizationId,
  visible,
  onClose,
}: {
  organizationId: string;
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
  const organization = data.organizations.find((row) => row.id === organizationId);
  const canRead = !!(organization && userId && canReadOrganization(data, organization.id, userId));
  const role = organization && userId && canRead
    ? activeOrganizationRole(organization, data.organization_members, userId)
    : null;
  const authorized = !!(organization && userId && canRead && role);
  const members = authorized
    ? data.organization_members.filter(
        (member) =>
          member.organization_id === organizationId && member.status === "active",
      )
    : [];
  const memberCount = authorized && organization
    ? organization.member_count ??
      organizationActiveMemberCount(organizationId, organization.owner_id, members)
    : 0;
  const linkedSquadIds = authorized
    ? data.organization_squads
        .filter((link) => link.organization_id === organizationId)
        .filter((link) =>
          canOpenSquadProfile(data, link.squad_id, userId),
        )
        .map((link) => link.squad_id)
    : [];
  const linkedSquads = data.squads.filter((squad) => linkedSquadIds.includes(squad.id));
  const linkedSpaceIds = authorized
    ? data.organization_spaces
        .filter((link) => link.organization_id === organizationId)
        .filter((link) => {
          const space = data.spaces.find((row) => row.id === link.space_id);
          return !!(
            space && userId && canReadSpace(data, space.id, userId) &&
            activeSpaceRole(space, data.space_members, userId)
          );
        })
        .map((link) => link.space_id)
    : [];
  const linkedSpaces = data.spaces.filter((space) => linkedSpaceIds.includes(space.id));
  const activities = authorized
    ? data.activities
        .filter(
          (activity) =>
            userId &&
            (activity.audience === "organization" && activity.audience_id === organizationId ||
              data.activity_social_links.some(
                (link) =>
                  link.activity_id === activity.id &&
                  link.entity_type === "organization" &&
                  link.entity_id === organizationId,
              )) &&
            activity.status === "scheduled" &&
            Date.parse(activity.ends_at) > now &&
            canReadBeaconActivity(data, activity, userId),
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .slice(0, 2)
    : [];

  function openFullProfile(type: SocialEntityType, id: string, tab?: "squads" | "activity" | "chat") {
    closePreview();
    setTimeout(() => {
      if (type === "squad" && tab === "chat") {
        router.push({ pathname: "/squad-chat/[id]", params: { id } });
      } else if (type === "squad") {
        router.push({ pathname: "/squad/[id]", params: { id, ...(tab === "activity" ? { tab: "Activity" } : {}) } });
      } else if (type === "space") {
        router.push({ pathname: "/space/[id]", params: { id, ...(tab ? { tab } : {}) } });
      } else {
        router.push({ pathname: "/organization/[id]", params: { id, ...(tab === "activity" ? { tab: "activity" } : tab === "squads" ? { tab: "squads" } : {}) } });
      }
    }, 300);
  }

  return (
    <ProfilePreviewFrame
      key={`${organizationId}:${authorized ? "active" : "unavailable"}:${visible ? "open" : "closed"}`}
      visible={visible}
      onClose={closePreview}
      title={authorized ? "About this Organization" : "Organization preview"}
      renderBeaconPreview={(beaconId, onBack) => (
        <BeaconProfilePreview
          beaconId={beaconId}
          onBack={onBack}
          backLabel={selectedCommunity ? "Back to preview" : "Back to organization"}
          onOpenFullBeacon={(id) => {
            closePreview();
            setTimeout(() => router.push({ pathname: "/activity/[id]", params: { id } }), 300);
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
            backLabel="Back to organization"
            onOpenBeacon={openBeacon}
            onOpenFullProfile={openFullProfile}
          />
        ) : !authorized || !organization ? (
          <Empty
            title="Organization preview unavailable"
            body="This organization is no longer available to your account."
          />
        ) : (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
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
                <Building2 size={22} color={colors.green} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.h2}>{organization.name}</Text>
                <Text style={styles.muted}>
                  {memberCount.toLocaleString()} {memberCount === 1 ? "member" : "members"} · Organization
                </Text>
              </View>
            </View>
            {!!organization.description && <Txt>{organization.description}</Txt>}
            <View style={styles.card}>
              <Text style={styles.label}>COMMUNITIES YOU CAN ACCESS</Text>
              <Text style={styles.muted}>
                {linkedSpaces.length} {linkedSpaces.length === 1 ? "Space" : "Spaces"} · {linkedSquads.length} {linkedSquads.length === 1 ? "Squad" : "Squads"}
              </Text>
              {linkedSpaces.length || linkedSquads.length ? (
                <View style={{ gap: 4 }}>
                  {linkedSpaces.slice(0, 2).map((space) => (
                    <MotionPressable
                      key={space.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview Space ${space.name}`}
                      onPress={() => setSelectedCommunity({ type: "space", id: space.id })}
                      style={[styles.row, { minHeight: 44, paddingHorizontal: 5, borderBottomWidth: 1, borderColor: colors.line }]}
                    >
                      <Layers3 size={17} color={colors.green} />
                      <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{space.name}</Text>
                      <ChevronRight size={17} color={colors.muted} />
                    </MotionPressable>
                  ))}
                  {linkedSquads.slice(0, Math.max(0, 3 - Math.min(2, linkedSpaces.length))).map((squad) => (
                    <MotionPressable
                      key={squad.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview Squad ${squad.name}`}
                      onPress={() => setSelectedCommunity({ type: "squad", id: squad.id })}
                      style={[styles.row, { minHeight: 44, paddingHorizontal: 5, borderBottomWidth: 1, borderColor: colors.line }]}
                    >
                      <UsersRound size={17} color={colors.green} />
                      <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{squad.name}</Text>
                      <ChevronRight size={17} color={colors.muted} />
                    </MotionPressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>No linked communities are visible to you.</Text>
              )}
              <Text style={styles.muted}>
                Linked Spaces and Squads keep separate membership and privacy.
              </Text>
            </View>
            {activities.length > 0 && (
              <View style={{ gap: 7 }}>
                <Text style={styles.label}>FEATURED BEACONS</Text>
                {activities.map((activity) => (
                  <MotionPressable
                    key={activity.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview Beacon ${activity.title}`}
                    onPress={() => openBeacon(activity.id)}
                    style={[styles.row, { minHeight: 44, paddingHorizontal: 7, borderBottomWidth: 1, borderColor: colors.line }]}
                  >
                    <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{activity.title}</Text>
                    <ChevronRight size={17} color={colors.muted} />
                  </MotionPressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                compact
                secondary
                title="View communities"
                onPress={() => openFullProfile("organization", organizationId, "squads")}
              />
              <Button
                compact
                secondary
                title="View activity"
                onPress={() => openFullProfile("organization", organizationId, "activity")}
              />
            </View>
            <Button
              title="View full organization profile"
              onPress={() => openFullProfile("organization", organizationId)}
            />
          </View>
        )
      }
    </ProfilePreviewFrame>
  );
}
