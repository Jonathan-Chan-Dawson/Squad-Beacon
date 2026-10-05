import React, { useState } from "react";
import { Building2, ChevronRight, Layers3, UsersRound } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import {
  activeOrganizationRole,
  canReadOrganization,
  canReadOrganizationMembers,
} from "@/src/features/organizations/domain";
import { activeSpaceRole, canReadSpace, visibleSpaceSquads } from "@/src/features/spaces/domain";
import {
  canOpenSquadProfile,
  squadCurrentAndNextActivities,
  visibleSquadOrganization,
} from "@/src/features/people/squadProfile";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { Avatar, Button, Empty, Txt, useTheme } from "@/src/shared/ui";
import type { SocialEntityType } from "@/src/features/social/types";

type Child = { type: SocialEntityType; id: string };

/** A nested entity preview rendered inside the existing preview Sheet, never as a second modal. */
export function SocialCommunityInlinePreview({
  entityType,
  entityId,
  onBack,
  backLabel = "Back to preview",
  onOpenBeacon,
  onOpenFullProfile,
}: {
  entityType: SocialEntityType;
  entityId: string;
  onBack: () => void;
  backLabel?: string;
  onOpenBeacon: (id: string) => void;
  onOpenFullProfile: (type: SocialEntityType, id: string, tab?: "squads" | "activity" | "chat") => void;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const now = useNow();
  const [child, setChild] = useState<Child | null>(null);
  const organization = entityType === "organization"
    ? data.organizations.find((row) => row.id === entityId)
    : undefined;
  const space = entityType === "space"
    ? data.spaces.find((row) => row.id === entityId)
    : undefined;
  const squad = entityType === "squad"
    ? data.squads.find((row) => row.id === entityId)
    : undefined;
  const orgRole = organization && userId && canReadOrganization(data, entityId, userId)
    ? activeOrganizationRole(organization, data.organization_members, userId)
    : null;
  const spaceRole = space && userId && canReadSpace(data, entityId, userId)
    ? activeSpaceRole(space, data.space_members, userId)
    : null;
  const squadReadable = !!(squad && canOpenSquadProfile(data, entityId, userId));
  const authorized = entityType === "organization"
    ? !!orgRole
    : entityType === "space"
      ? !!spaceRole
      : squadReadable;

  if (child) {
    return (
      <SocialCommunityInlinePreview
        key={`${child.type}:${child.id}`}
        entityType={child.type}
        entityId={child.id}
        onBack={() => setChild(null)}
        backLabel="Back to preview"
        onOpenBeacon={onOpenBeacon}
        onOpenFullProfile={onOpenFullProfile}
      />
    );
  }

  if (!authorized || (!organization && !space && !squad) || !userId) {
    return (
      <View style={{ gap: 12 }}>
        <Empty title="Community preview unavailable" body="This community is no longer available to your account." />
        <Button secondary title="Back" onPress={onBack} />
      </View>
    );
  }

  const members = entityType === "organization"
    ? data.organization_members.filter((row) => row.organization_id === entityId && row.status === "active")
    : entityType === "space"
      ? data.space_members.filter((row) => row.space_id === entityId && row.status === "active")
      : data.squad_members.filter((row) => row.squad_id === entityId);
  const memberCount = entityType === "organization"
    ? organization?.member_count ?? Math.max(1, members.length)
    : members.length;
  const linkedSpaces = entityType === "organization" && canReadOrganizationMembers(data, entityId, userId)
    ? data.organization_spaces
        .filter((link) => link.organization_id === entityId)
        .flatMap((link) => {
          const linked = data.spaces.find((row) => row.id === link.space_id);
          return linked && canReadSpace(data, linked.id, userId) && activeSpaceRole(linked, data.space_members, userId)
            ? [linked]
            : [];
        })
    : [];
  const linkedSquads = entityType === "organization"
    ? data.organization_squads
        .filter((link) => link.organization_id === entityId)
        .filter((link) => canOpenSquadProfile(data, link.squad_id, userId))
        .flatMap((link) => data.squads.filter((row) => row.id === link.squad_id))
    : entityType === "space"
      ? visibleSpaceSquads(data, entityId, userId)
      : [];
  const parentOrganization = entityType === "space"
    ? data.organization_spaces
        .filter((link) => link.space_id === entityId)
        .map((link) => data.organizations.find((row) => row.id === link.organization_id))
        .find((row) => !!row && canReadOrganization(data, row.id, userId) && activeOrganizationRole(row, data.organization_members, userId))
    : entityType === "squad"
      ? visibleSquadOrganization(data, entityId, userId)
      : undefined;
  const parentSpace = entityType === "squad"
    ? data.space_squads
        .filter((link) => link.squad_id === entityId)
        .map((link) => data.spaces.find((row) => row.id === link.space_id))
        .find((row) => !!row && canReadSpace(data, row.id, userId) && activeSpaceRole(row, data.space_members, userId))
    : undefined;
  const squadActivities = entityType === "squad"
    ? squadCurrentAndNextActivities(data, entityId, userId, now)
    : { current: undefined, next: undefined };
  const activities = entityType === "squad"
    ? [squadActivities.current, squadActivities.next].filter(
        (activity, index, all): activity is NonNullable<typeof activity> =>
          !!activity && all.findIndex((item) => item?.id === activity.id) === index,
      )
    : data.activities
        .filter(
          (activity) =>
            ((entityType === "organization" && activity.audience === "organization" && activity.audience_id === entityId) ||
              data.activity_social_links.some(
                (link) => link.activity_id === activity.id && link.entity_type === entityType && link.entity_id === entityId,
              )) &&
            activity.status === "scheduled" &&
            Date.parse(activity.ends_at) > now &&
            canReadBeaconActivity(data, activity, userId),
        )
        .sort((first, second) => first.starts_at.localeCompare(second.starts_at))
        .slice(0, 2);
  const name = organization?.name ?? space?.name ?? squad?.name ?? "Community";
  const description = organization?.description ?? space?.description ?? squad?.description ?? "";
  const type = organization ? "Organization" : space ? "Space" : "Squad";
  const Icon = organization ? Building2 : space ? Layers3 : UsersRound;
  const linkedCount = linkedSpaces.length + linkedSquads.length;

  const openParent = (parent: { id: string; type: "organization" | "space" }) =>
    setChild({ type: parent.type, id: parent.id });

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {squad ? <Avatar name={squad.name} size={44} /> : (
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" }}>
            <Icon size={21} color={colors.green} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.h2} numberOfLines={1}>{name}</Text>
          <Text style={styles.muted}>
            {type} · {memberCount.toLocaleString()} {memberCount === 1 ? "member" : "members"}
            {type !== "Squad" ? ` · ${linkedCount} connected ${linkedCount === 1 ? "community" : "communities"}` : ""}
          </Text>
        </View>
      </View>
      {!!description && <Txt>{description}</Txt>}
      {parentOrganization || parentSpace ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Preview ${parentOrganization ? "Organization" : "Space"} ${parentOrganization?.name ?? parentSpace?.name}`}
          onPress={() => parentOrganization
            ? openParent({ id: parentOrganization.id, type: "organization" })
            : parentSpace && openParent({ id: parentSpace.id, type: "space" })}
          style={[styles.row, { minHeight: 46, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.line }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>PARENT COMMUNITY</Text>
            <Text style={styles.body}>{parentOrganization?.name ?? parentSpace?.name}</Text>
          </View>
          <ChevronRight size={17} color={colors.muted} />
        </Pressable>
      ) : null}
      {linkedSpaces.length + linkedSquads.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.label}>{organization ? "SPACES AND SQUADS YOU CAN ACCESS" : "FEATURED SQUADS"}</Text>
          {linkedSpaces.slice(0, 3).map((row) => (
            <Pressable
              key={`space:${row.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Preview Space ${row.name}`}
              onPress={() => setChild({ type: "space", id: row.id })}
              style={[styles.row, { minHeight: 46, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.line }]}
            >
              <Layers3 size={17} color={colors.green} />
              <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{row.name}</Text>
              <ChevronRight size={17} color={colors.muted} />
            </Pressable>
          ))}
          {linkedSquads.slice(0, Math.max(0, 4 - linkedSpaces.length)).map((row) => (
            <Pressable
              key={`squad:${row.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Preview Squad ${row.name}`}
              onPress={() => setChild({ type: "squad", id: row.id })}
              style={[styles.row, { minHeight: 46, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.line }]}
            >
              <UsersRound size={17} color={colors.green} />
              <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{row.name}</Text>
              <ChevronRight size={17} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {activities.length ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.label}>UPCOMING BEACONS</Text>
          {activities.map((activity) => (
            <Pressable
              key={activity.id}
              accessibilityRole="button"
              accessibilityLabel={`Preview Beacon ${activity.title}`}
              onPress={() => onOpenBeacon(activity.id)}
              style={[styles.row, { minHeight: 46, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.line }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.body} numberOfLines={1}>{activity.title}</Text>
                <Text style={styles.muted}>{new Date(activity.starts_at).toLocaleString()}</Text>
              </View>
              <ChevronRight size={17} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {entityType === "squad" ? (
          <Button compact secondary title="Open Squad chat" onPress={() => onOpenFullProfile("squad", entityId, "chat")} />
        ) : (
          <>
            <Button compact secondary title={entityType === "space" ? "View Squads" : "Explore communities"} onPress={() => onOpenFullProfile(entityType, entityId, "squads")} />
            <Button compact secondary title="View activity" onPress={() => onOpenFullProfile(entityType, entityId, "activity")} />
          </>
        )}
      </View>
      <Button
        title={`View full ${type.toLowerCase()} profile`}
        onPress={() => onOpenFullProfile(entityType, entityId)}
      />
      <Button secondary title={backLabel} onPress={onBack} />
    </View>
  );
}
