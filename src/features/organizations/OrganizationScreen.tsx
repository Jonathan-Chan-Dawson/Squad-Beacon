import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowUpRight, History, House, Layers3, MessageCircle, Settings2, Users } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { SquadProfilePreview } from "@/src/features/people/previews/SquadProfilePreview";
import { SpaceProfilePreview } from "@/src/features/spaces/SpaceProfilePreview";
import { activeSpaceRole, canManageSpace, canReadSpace } from "@/src/features/spaces/domain";
import { SocialDirectoryResults } from "@/src/features/people/SocialDirectoryResults";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { normalizePlanningData, pendingPlanningThreads } from "@/src/features/planning/domain";
import { useNow } from "@/src/shared/useNow";
import { matchesSearch } from "@/src/shared/search";
import { canViewProfile } from "@/src/features/profile/privacy";
import { PersonProfilePreview } from "@/src/features/people/previews/PersonProfilePreview";
import { SOCIAL_ROLE_RANK } from "@/src/features/social/domain";
import { SocialPolicySettings } from "@/src/features/social/SocialPolicyControls";
import {
  Action,
  Button,
  Chips,
  Empty,
  Field,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import {
  activeOrganizationRole,
  canReadOrganization,
  canReadOrganizationMembers,
  canChangeOrganizationMemberRole,
  canInviteOrganizationRole,
  canLeaveOrganization,
  canManageOrganization,
  canManageOrganizationMember,
  canManageOrganizationSquads,
  organizationActiveMemberCount,
} from "./domain";
import { GroupChatThread } from "./GroupChatThread";
import type { OrganizationMemberRole } from "./types";

const tabs = ["overview", "squads", "activity"] as const;
type OrganizationTab = (typeof tabs)[number] | "members" | "chat" | "manage";
const tabTitle: Record<OrganizationTab, string> = {
  overview: "Overview",
  members: "Members",
  squads: "Communities",
  activity: "Activity",
  chat: "Chat",
  manage: "Manage",
};
const roleOptions: OrganizationMemberRole[] = ["coowner", "admin", "elder", "member"];
const shortTime = (value: string) =>
  new Date(value).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function OrganizationScreen() {
  const { styles, colors } = useTheme();
  const { id, tab: queryTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { data, userId, act } = useBeacon();
  const now = useNow();
  const organization = data.organizations.find((item) => item.id === id);
  const [tab, setTab] = useState<OrganizationTab>(
    queryTab === "manage" || queryTab === "members" || queryTab === "chat"
      ? queryTab
      : queryTab === "home"
        ? "overview"
        : queryTab === "beacons"
          ? "activity"
          : tabs.includes(queryTab as (typeof tabs)[number])
            ? (queryTab as (typeof tabs)[number])
            : "overview",
  );
  const [sheet, setSheet] = useState<"edit" | "invite" | "attach" | "attachSpace" | "member" | null>(null);
  const [name, setName] = useState(organization?.name ?? "");
  const [description, setDescription] = useState(organization?.description ?? "");
  const [invitee, setInvitee] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationMemberRole>("member");
  const [memberRole, setMemberRole] = useState<OrganizationMemberRole>("member");
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedSquad, setSelectedSquad] = useState("");
  const [selectedSpace, setSelectedSpace] = useState("");
  const [previewSquadId, setPreviewSquadId] = useState<string | null>(null);
  const [previewSpaceId, setPreviewSpaceId] = useState<string | null>(null);
  const [previewPersonId, setPreviewPersonId] = useState<string | null>(null);
  const [squadSearch, setSquadSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");

  const members = data.organization_members.filter(
    (member) => member.organization_id === organization?.id,
  );
  const role = organization && userId && canReadOrganization(data, organization.id, userId)
    ? activeOrganizationRole(organization, data.organization_members, userId ?? "")
    : null;
  const count = organization
    ? organization.member_count ??
      organizationActiveMemberCount(organization.id, organization.owner_id, members)
    : 0;
  const linkedSquadIds = data.organization_squads
    .filter((link) => link.organization_id === organization?.id)
    .filter((link) => canOpenSquadProfile(data, link.squad_id, userId))
    .map((link) => link.squad_id);
  const linkedSquads = data.squads.filter((squad) => linkedSquadIds.includes(squad.id));
  const linkedSpaceIds = data.organization_spaces
    .filter((link) => link.organization_id === organization?.id)
    .filter((link) => {
      const space = data.spaces.find((item) => item.id === link.space_id);
      return !!(
        space && userId && canReadSpace(data, space.id, userId) &&
        activeSpaceRole(space, data.space_members, userId)
      );
    })
    .map((link) => link.space_id);
  const linkedSpaces = data.spaces.filter((space) => linkedSpaceIds.includes(space.id));
  const organizationActivities = organization
    ? data.activities
        .filter(
          (activity) =>
            userId &&
            ((activity.audience === "organization" && activity.audience_id === organization.id) ||
              data.activity_social_links.some(
                (link) =>
                  link.activity_id === activity.id &&
                  link.entity_type === "organization" &&
                  link.entity_id === organization.id,
              )) &&
            activity.status === "scheduled" &&
            Date.parse(activity.ends_at) > now &&
            canReadBeaconActivity(data, activity, userId),
        )
        .sort((first, second) => first.starts_at.localeCompare(second.starts_at))
    : [];
  const planning = normalizePlanningData(data);
  const orgThreads = userId
    ? pendingPlanningThreads(data, planning, userId, now).filter(
        (thread) => thread.audience === "organization" && thread.audience_id === organization?.id,
      )
    : [];
  const visibleMemberRows = members.filter((member) => member.status === "active").filter((member) => {
    if (!memberSearch.trim()) return true;
    const profile = data.profiles.find((item) => item.id === member.user_id);
    return !!(
      profile && userId && canViewProfile(data, profile, userId) &&
      matchesSearch(memberSearch, profile.name, profile.username)
    );
  });
  const visibleActivities = organizationActivities.filter((activity) => {
    const squadName = data.squads.find(
      (squad) => squad.id === activity.audience_id,
    )?.name;
    return matchesSearch(
      activitySearch,
      activity.title,
      activity.description ?? "",
      activity.category,
      squadName ?? "Organization",
    );
  });
  const visibleThreads = orgThreads.filter((thread) =>
    matchesSearch(activitySearch, thread.title, thread.body, thread.kind),
  );

  if (!organization || !role) {
    return (
      <Screen title="Organization unavailable" eyebrow="ORGANIZATIONS" create={false}>
        <Txt>This organization is no longer available to your account.</Txt>
        <Button title="Back to organizations" onPress={() => router.replace("/organizations")} />
      </Screen>
    );
  }

  const canManage = canManageOrganization(organization, members, userId ?? "");
  const canManageSquads = canManageOrganizationSquads(organization, members, userId ?? "");
  const canAccessManagement =
    canManage || canManageSquads || canLeaveOrganization(organization, members, userId ?? "");
  const inviteRoles = roleOptions.filter((candidate) =>
    canInviteOrganizationRole(organization, members, userId ?? "", candidate),
  );
  const activeMembers = members.filter((member) => member.status === "active");
  const directoryMembers = [
    {
      organization_id: organization.id,
      user_id: organization.owner_id,
      role: "member" as const,
      status: "active" as const,
      invited_by: organization.owner_id,
      created_at: organization.created_at,
    },
    ...activeMembers.filter((member) => member.user_id !== organization.owner_id),
  ];
  const invitedMembers = members.filter((member) => member.status === "invited");
  const requestedMembers = members.filter((member) => member.status === "requested");
  const attachableSquads = data.squads.filter(
    (squad) =>
      !linkedSquadIds.includes(squad.id) &&
      canOpenSquadProfile(data, squad.id, userId) &&
      SOCIAL_ROLE_RANK[data.squad_members.find(
        (member) => member.squad_id === squad.id && member.user_id === userId,
      )?.role ?? "member"] >= SOCIAL_ROLE_RANK.admin,
  );
  const attachableSpaces = data.spaces.filter(
    (space) =>
      !data.organization_spaces.some(
        (link) => link.organization_id === organization.id && link.space_id === space.id,
      ) &&
      canManageSpace(data, space.id, userId) &&
      canManageOrganization(organization, members, userId ?? ""),
  );
  const canManageLinkedSquad = (squadId: string) =>
    canManageOrganizationSquads(organization, members, userId ?? "") &&
    !!data.squad_members.find(
      (member) => member.squad_id === squadId && member.user_id === userId &&
        (member.role === "owner" || member.role === "admin"),
    );

  function selectTab(nextTab: OrganizationTab) {
    setTab(nextTab);
    router.setParams({ tab: nextTab === "overview" ? undefined : nextTab });
  }
  function openInvite() {
    setInvitee("");
    setInviteRole(inviteRoles.at(-1) ?? "member");
    setSheet("invite");
  }
  function openMember(memberId: string) {
    const member = members.find((row) => row.user_id === memberId);
    if (!member) return;
    setSelectedMember(memberId);
    setMemberRole(member.role);
    setSheet("member");
  }
  function openEdit() {
    setName(organization?.name ?? "");
    setDescription(organization?.description ?? "");
    setSheet("edit");
  }
  function viewPerson(personId: string) {
    const profile = data.profiles.find((row) => row.id === personId);
    if (profile && userId && canViewProfile(data, profile, userId)) setPreviewPersonId(personId);
  }
  function openSquadChat(squadId: string) {
    router.push({ pathname: "/squad-chat/[id]", params: { id: squadId } });
  }
  const memberName = (personId: string) => {
    const profile = data.profiles.find((item) => item.id === personId);
    return profile && userId && canViewProfile(data, profile, userId)
      ? profile.name
      : "Member";
  };
  const selectionButton = (title: string, selected: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        !selected && {
          backgroundColor: colors.lime,
          borderColor: colors.green,
          elevation: 1,
        },
        pressed && { opacity: 0.82, elevation: 0 },
      ]}
    >
      <Text style={[styles.buttonText, !selected && { color: colors.ink }]}>{title}</Text>
    </Pressable>
  );

  const nav = (
    <View style={{ flexDirection: "row", padding: 4, gap: 4, borderRadius: 17, backgroundColor: colors.line + "88" }}>
      {tabs.map((item) => {
        const selected = tab === item;
        const Icon = item === "overview" ? House : item === "squads" ? Layers3 : History;
        return (
          <MotionPressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={tabTitle[item]}
            accessibilityState={{ selected }}
            onPress={() => selectTab(item)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 48,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 5,
              backgroundColor: selected ? colors.ink : "transparent",
            }}
          >
            <Icon size={15} color={selected ? colors.white : colors.muted} />
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: selected ? colors.white : colors.muted }}>{tabTitle[item]}</Text>
          </MotionPressable>
        );
      })}
    </View>
  );

  const peopleRows = (rows: typeof activeMembers) =>
    rows.map((member) => {
      const profile = data.profiles.find((item) => item.id === member.user_id);
      const profileVisible = !!(profile && userId && canViewProfile(data, profile, userId));
      const canManage = canManageOrganizationMember(
        organization,
        members,
        userId ?? "",
        member.user_id,
      );
      return (
        <Pressable
          key={member.user_id}
          accessibilityRole={canManage || profileVisible ? "button" : undefined}
          accessibilityLabel={canManage ? `Manage ${memberName(member.user_id)}` : `Organization member ${memberName(member.user_id)}`}
          onPress={() => {
            if (canManage) openMember(member.user_id);
            else if (profileVisible) viewPerson(member.user_id);
          }}
          style={({ pressed }) => [
            styles.card,
            { padding: 12, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.h2}>{memberName(member.user_id)}</Text>
                <Text style={styles.muted}>{member.user_id === organization.owner_id ? "Owner" : member.role}</Text>
          </View>
          {canManage ? (
            <Text style={styles.label}>Manage</Text>
          ) : profileVisible ? (
            <Text style={styles.label}>Profile</Text>
          ) : null}
        </Pressable>
      );
    });

  const inviteCandidates = data.profiles.filter(
    (profile) =>
      profile.id !== userId &&
      profile.id !== organization.owner_id &&
      !members.some((member) => member.user_id === profile.id) &&
      !data.organization_bans.some(
        (ban) => ban.organization_id === organization.id && ban.user_id === profile.id,
      ),
  );
  const nextRoleOptions = roleOptions.filter((candidate) =>
    canChangeOrganizationMemberRole(
      organization,
      members,
      userId ?? "",
      selectedMember,
      candidate,
    ),
  );
  const manageableMember = members.find((member) => member.user_id === selectedMember);
  const canUnban = (banUserId: string) => {
    const ban = data.organization_bans.find(
      (item) => item.organization_id === organization.id && item.user_id === banUserId,
    );
    if (!ban) return false;
    const actorRank = role ? ({ owner: 5, coowner: 4, admin: 3, elder: 2, member: 1 } as const)[role] : 0;
    const bannedRank = ({ coowner: 4, admin: 3, elder: 2, member: 1 } as const)[ban.former_role];
    return actorRank > bannedRank;
  };

  const managementSheets = (
    <>
      <Sheet title="Organization details" visible={sheet === "edit"} onClose={() => setSheet(null)}>
        <Field label="Name" value={name} onChangeText={setName} maxLength={60} />
        <Field label="Description" value={description} onChangeText={setDescription} maxLength={500} multiline />
        <Action
          title="Save details"
          run={async () => {
            await act("update_organization", {
              organization_id: organization.id,
              name: name.trim(),
              description: description.trim(),
            });
            setSheet(null);
          }}
        />
      </Sheet>
      <Sheet title="Invite someone" visible={sheet === "invite"} onClose={() => setSheet(null)}>
        {!inviteRoles.length ? (
          <Txt muted>Your current role cannot invite organization members.</Txt>
        ) : (
          <>
            <Txt muted>Choose a person who can already be discovered by your account, then give them an appropriate role.</Txt>
            {inviteCandidates.length ? (
              <View style={{ gap: 8 }}>
                {inviteCandidates.map((profile) => (
                  <View
                    key={profile.id}
                  >
                    {selectionButton(profile.name, invitee === profile.id, () => setInvitee(profile.id))}
                  </View>
                ))}
              </View>
            ) : (
              <Txt muted>There are no eligible people to invite right now.</Txt>
            )}
            <Chips
              options={inviteRoles}
              value={inviteRole}
              onChange={setInviteRole}
              accessibilityPrefix="Invite role"
            />
            <Action
              title="Send invitation"
              disabled={!invitee}
              run={async () => {
                await act("invite_organization_member", {
                  organization_id: organization.id,
                  user_id: invitee,
                  role: inviteRole,
                });
                setSheet(null);
              }}
            />
          </>
        )}
      </Sheet>
      <Sheet title="Link a Squad" visible={sheet === "attach"} onClose={() => setSheet(null)}>
        <Txt muted>Only Squads you own or administer can be linked. Their roster and private chat stay separate.</Txt>
        {attachableSquads.length ? (
          <View style={{ gap: 8 }}>
            {attachableSquads.map((squad) => (
              <View
                key={squad.id}
              >
                {selectionButton(squad.name, selectedSquad === squad.id, () => setSelectedSquad(squad.id))}
              </View>
            ))}
          </View>
        ) : (
          <Txt muted>There are no Squads you can link right now.</Txt>
        )}
        <Action
          title="Link Squad"
          disabled={!selectedSquad}
          run={async () => {
            await act("attach_organization_squad", {
              organization_id: organization.id,
              squad_id: selectedSquad,
            });
            setSheet(null);
          }}
        />
      </Sheet>
      <Sheet title="Link a Space" visible={sheet === "attachSpace"} onClose={() => setSheet(null)}>
        <Txt muted>Linking groups two communities without copying members or granting access to private content. You need admin authority in both.</Txt>
        {attachableSpaces.length ? (
          <View style={{ gap: 8 }}>
            {attachableSpaces.map((space) => (
              <View key={space.id}>
                {selectionButton(space.name, selectedSpace === space.id, () => setSelectedSpace(space.id))}
              </View>
            ))}
          </View>
        ) : (
          <Txt muted>No unlinked Spaces you administer are available.</Txt>
        )}
        <Action
          title="Link Space"
          disabled={!selectedSpace}
          run={async () => {
            await act("attach_organization_space", {
              organization_id: organization.id,
              space_id: selectedSpace,
            });
            setSheet(null);
          }}
        />
      </Sheet>
      <Sheet title={`Manage ${memberName(selectedMember)}`} visible={sheet === "member"} onClose={() => setSheet(null)}>
        {manageableMember && nextRoleOptions.length > 0 && (
          <>
            <Txt muted>Set a role below your own. The organization owner cannot be changed.</Txt>
            <Chips
              options={nextRoleOptions}
              value={nextRoleOptions.includes(memberRole) ? memberRole : nextRoleOptions[0]}
              onChange={setMemberRole}
              accessibilityPrefix="Member role"
            />
            <Action
              title="Save role"
              run={async () => {
                await act("set_organization_member_role", {
                  organization_id: organization.id,
                  user_id: selectedMember,
                  role: memberRole,
                });
                setSheet(null);
              }}
            />
          </>
        )}
        {manageableMember && (
          <>
            <Action
              secondary
              title="Remove from organization"
              run={async () => {
                await act("remove_organization_member", {
                  organization_id: organization.id,
                  user_id: selectedMember,
                });
                setSheet(null);
              }}
            />
            <Action
              secondary
              title="Ban from organization"
              run={async () => {
                await act("ban_organization_member", {
                  organization_id: organization.id,
                  user_id: selectedMember,
                });
                setSheet(null);
              }}
            />
          </>
        )}
      </Sheet>
    </>
  );

  const sharedContent = (
    <>
      {nav}
      {tab === "overview" && (
        <View style={{ gap: 12 }}>
          <View style={styles.hero}>
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.label}>COMMUNITY · {role.toUpperCase()}</Text>
                <Text style={styles.h2}>{count.toLocaleString()} members</Text>
              </View>
              <Users size={23} color={colors.green} />
            </View>
            <Txt>{organization.description || "A place for connected Squads to plan together."}</Txt>
            <Text style={styles.muted}>
              Bring your connected Squads and shared activity together. Squad rosters and private chats stay separate.
            </Text>
          </View>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h2}>Your communities</Text>
              <Text style={styles.muted}>{linkedSpaces.length} Spaces · {linkedSquads.length} Squads you can access</Text>
            </View>
            <Button compact secondary title="See all" onPress={() => selectTab("squads")} />
          </View>
          {linkedSpaces.slice(0, 2).map((space) => (
            <Pressable
              key={space.id}
              accessibilityRole="button"
              accessibilityLabel={`Preview Space ${space.name}`}
              onPress={() => setPreviewSpaceId(space.id)}
              style={styles.card}
            >
              <View style={styles.between}>
                <Text style={styles.h2}>{space.name}</Text>
                <Text style={styles.label}>SPACE</Text>
              </View>
              <Txt muted>{space.description || "Connected Space"}</Txt>
            </Pressable>
          ))}
          {linkedSquads.slice(0, Math.max(0, 2 - linkedSpaces.length)).map((squad) => (
            <View key={squad.id} style={styles.card}>
              <View style={styles.between}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Preview Squad ${squad.name}`}
                  onPress={() => setPreviewSquadId(squad.id)}
                  style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={styles.h2}>{squad.name}</Text>
                </Pressable>
                <Button compact secondary title="Chat" onPress={() => openSquadChat(squad.id)} />
              </View>
              <Txt muted>{squad.description || "Connected Squad"}</Txt>
            </View>
          ))}
          {!linkedSpaces.length && !linkedSquads.length && <Empty title="No connected communities yet" body="Link a Space or Squad you manage. Parent membership does not grant child membership or private-content access." />}
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h2}>Shared activity</Text>
              <Text style={styles.muted}>{organizationActivities.length + orgThreads.length} Organization Beacons and Pings visible to you</Text>
            </View>
            <Button compact secondary title="See all" onPress={() => selectTab("activity")} />
          </View>
          {organizationActivities.slice(0, 3).map((activity) => (
            <Pressable
              key={activity.id}
              onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
              style={styles.card}
            >
              <View style={styles.between}>
                <Text style={styles.h2}>{activity.title}</Text>
                <ArrowUpRight size={18} color={colors.green} />
              </View>
              <Txt muted>Organization Beacon · {shortTime(activity.starts_at)}</Txt>
            </Pressable>
          ))}
          {!organizationActivities.length && !orgThreads.length && <Empty title="No shared activity yet" body="Organization Beacons and Pings will appear here. Squad activity stays in each Squad." />}
          <View style={styles.between}>
            <Text style={styles.h2}>Members</Text>
            <Button compact secondary title="Open directory" onPress={() => selectTab("members")} />
          </View>
          {activeMembers.slice(0, 4).map((member) => (
            <Pressable key={member.user_id} onPress={() => viewPerson(member.user_id)} style={[styles.row, { paddingVertical: 5 }]}>
              <Text style={[styles.body, { flex: 1 }]}>{memberName(member.user_id)}</Text>
              <Text style={styles.muted}>{member.role}</Text>
            </Pressable>
          ))}
          {orgThreads.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${orgThreads[0].kind === "ping" ? "Ping" : "decision"}: ${orgThreads[0].title}`}
              onPress={() => router.push({ pathname: "/council/[id]", params: { id: orgThreads[0].id } })}
              style={styles.card}
            >
              <Text style={styles.label}>OPEN PING</Text>
              <Text style={styles.h2}>{orgThreads[0].title}</Text>
              <Txt muted>{orgThreads[0].body}</Txt>
            </Pressable>
          )}
        </View>
      )}

      {tab === "members" && (
        <View style={{ gap: 10 }}>
          <View style={styles.between}>
            <View>
              <Text style={styles.h2}>{count.toLocaleString()} members</Text>
              <Text style={styles.muted}>Active members</Text>
            </View>
            {inviteRoles.length > 0 && <Button compact title="+ Invite" onPress={openInvite} />}
          </View>
          <Field
            label="Search visible member names"
            placeholder="Name"
            value={memberSearch}
            onChangeText={setMemberSearch}
          />
          {peopleRows(memberSearch.trim() ? visibleMemberRows : directoryMembers)}
          {invitedMembers.length > 0 && (
            <>
              <Text style={styles.label}>INVITATIONS</Text>
              {invitedMembers.map((member) => (
                <View key={member.user_id} style={[styles.card, { padding: 12 }]}>
                  <View style={styles.between}>
                    <Text style={styles.h2}>{memberName(member.user_id)}</Text>
                    <Text style={styles.muted}>{member.role} · invited</Text>
                  </View>
                  {canManageOrganizationMember(organization, members, userId ?? "", member.user_id) && (
                    <Action compact secondary title="Cancel invitation" run={() => act("remove_organization_member", { organization_id: organization.id, user_id: member.user_id })} />
                  )}
                </View>
              ))}
            </>
          )}
          {canManage && requestedMembers.length > 0 && (
            <View style={[styles.card, { gap: 8 }]}>
              <Text style={styles.h2}>Join requests</Text>
              {requestedMembers.map((member) => (
                <View key={member.user_id} style={[styles.row, { flexWrap: "wrap", justifyContent: "space-between" }]}>
                  <Text style={[styles.body, { flex: 1 }]}>{memberName(member.user_id)}</Text>
                  <Action compact title="Approve" run={() => act("approve_organization_join_request", { organization_id: organization.id, user_id: member.user_id })} />
                  <Action compact secondary title="Decline" run={() => act("deny_organization_join_request", { organization_id: organization.id, user_id: member.user_id })} />
                </View>
              ))}
            </View>
          )}
          {canManage && data.organization_bans.some((ban) => ban.organization_id === organization.id) && (
            <>
              <Text style={styles.label}>BANNED</Text>
              {data.organization_bans.filter((ban) => ban.organization_id === organization.id && canUnban(ban.user_id)).map((ban) => (
                <View key={ban.user_id} style={[styles.card, { padding: 12 }]}>
                  <View style={styles.between}>
                    <Text style={styles.h2}>{memberName(ban.user_id)}</Text>
                    <Action compact secondary title="Unban" run={() => act("unban_organization_member", { organization_id: organization.id, user_id: ban.user_id })} />
                  </View>
                  {!!ban.reason && <Txt muted>{ban.reason}</Txt>}
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {tab === "squads" && (
        <View style={{ gap: 10 }}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.h2}>Communities you can access</Text>
                  <Txt muted>Search linked Squads you can access. Linking never grants roster or private-chat access.</Txt>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {canManage && <Button compact secondary title="+ Space" onPress={() => { setSelectedSpace(""); setSheet("attachSpace"); }} />}
              {canManageSquads && <Button compact title="+ Squad" onPress={() => { setSelectedSquad(""); setSheet("attach"); }} />}
            </View>
          </View>
          <Field
            label={`Search ${organization.name}`}
            placeholder="Spaces, Squads, Beacons, or members"
            value={squadSearch}
            onChangeText={(value) => {
              setSquadSearch(value);
              setMemberSearch(value);
            }}
          />
          <SocialDirectoryResults
            query={squadSearch}
            parentType="organization"
            parentId={organization.id}
            onOpenSquad={setPreviewSquadId}
            onOpenSpace={setPreviewSpaceId}
            onOpenOrganization={() => {}}
          />
          {!!squadSearch.trim() && canReadOrganizationMembers(data, organization.id, userId) && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>MEMBERS</Text>
              {visibleMemberRows
                .filter((member) => {
                  const profile = data.profiles.find((row) => row.id === member.user_id);
                  return !!(profile && userId && canViewProfile(data, profile, userId));
                })
                .map((member) => (
                  <Pressable
                    key={member.user_id}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview member ${memberName(member.user_id)}`}
                    onPress={() => viewPerson(member.user_id)}
                    style={[styles.row, { minHeight: 48 }]}
                  >
                    <Text style={[styles.body, { flex: 1 }]}>{memberName(member.user_id)}</Text>
                    <Text style={styles.muted}>{member.user_id === organization.owner_id ? "Owner" : member.role}</Text>
                  </Pressable>
                ))}
            </View>
          )}
          {canManageSquads && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>YOUR CONNECTED COMMUNITIES</Text>
              {linkedSpaces.map((space) => (
                <View key={space.id} style={[styles.card, styles.row]}>
                  <Text style={[styles.body, { flex: 1 }]}>{space.name}</Text>
                  {canManageOrganization(organization, members, userId ?? "") && canManageSpace(data, space.id, userId) && (
                    <Action compact secondary title="Unlink" run={() => act("detach_organization_space", { organization_id: organization.id, space_id: space.id })} />
                  )}
                </View>
              ))}
              {linkedSquads.map((squad) => (
                <View key={squad.id} style={[styles.card, styles.row]}>
                  <Text style={[styles.body, { flex: 1 }]}>{squad.name}</Text>
                  {canManageLinkedSquad(squad.id) && (
                    <Action compact secondary title="Unlink" run={() => act("detach_organization_squad", { organization_id: organization.id, squad_id: squad.id })} />
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {tab === "activity" && (
        <View style={{ gap: 10 }}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.h2}>Organization activity</Text>
              <Txt muted>Organization Beacons and Pings live here. Squad activity stays in each Squad.</Txt>
            </View>
            <Button compact title="+ Beacon" onPress={() => router.push({ pathname: "/create", params: { organizationId: organization.id } })} />
          </View>
          <Button compact secondary title="+ Ping" onPress={() => router.push({ pathname: "/councils", params: { organizationId: organization.id } })} />
          <Field
            label="Search activity"
            placeholder="Beacon, Ping, category, or Squad"
            value={activitySearch}
            onChangeText={setActivitySearch}
          />
          {visibleThreads.map((thread) => (
            <Pressable key={thread.id} onPress={() => router.push({ pathname: "/council/[id]", params: { id: thread.id } })} style={styles.card}>
              <Text style={styles.label}>OPEN {thread.kind.toUpperCase()}</Text>
              <Text style={styles.h2}>{thread.title}</Text>
              {!!thread.body && <Txt muted>{thread.body}</Txt>}
            </Pressable>
          ))}
          {visibleActivities.map((activity) => (
            <Pressable
              key={activity.id}
              onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
              style={styles.card}
            >
              <View style={styles.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.h2}>{activity.title}</Text>
                  <Text style={styles.muted}>Organization Beacon · {shortTime(activity.starts_at)}</Text>
                </View>
                <ArrowUpRight size={18} color={colors.green} />
              </View>
              {!!activity.description && <Txt muted>{activity.description}</Txt>}
            </Pressable>
          ))}
          {!organizationActivities.length && !orgThreads.length ? (
            <Empty title="Nothing planned yet" body="Use the audience picker when creating a Beacon or Ping to share it with this organization." />
          ) : visibleActivities.length === 0 && visibleThreads.length === 0 ? (
            <Empty title="No matching activity" body="Try another title, category, or Squad name." />
          ) : null}
        </View>
      )}

      {tab === "manage" && (
        <View style={{ gap: 10 }}>
          <Text style={styles.h2}>Organization management</Text>
          <Txt muted>Member administration, details, and membership actions live here. Squad rosters stay private to their members.</Txt>
          <Button secondary title="Members, invitations &amp; bans" onPress={() => selectTab("members")} />
          {canManage && <Button title="Edit organization details" onPress={openEdit} />}
          {canManage && (
            <View style={[styles.card, { gap: 10 }]}>
              <Text style={styles.h2}>Access & membership</Text>
              <SocialPolicySettings
                key={`${organization.id}:${organization.discoverability ?? "private"}:${organization.join_mode ?? "invite"}:${organization.invite_policy ?? "admins"}`}
                entityType="organization"
                initial={{
                  discoverability: organization.discoverability ?? "private",
                  join_mode: organization.join_mode ?? "invite",
                  invite_policy: organization.invite_policy ?? "admins",
                }}
                onSave={(policy) => act("set_social_policy", { entity_type: "organization", entity_id: organization.id, ...policy })}
              />
            </View>
          )}
          {inviteRoles.length > 0 && <Button secondary title="Invite a member" onPress={openInvite} />}
          {canManageSquads && <Button secondary title="Link a Squad" onPress={() => { setSelectedSquad(""); setSheet("attach"); }} />}
          {canManage && <Button secondary title="Link a Space" onPress={() => { setSelectedSpace(""); setSheet("attachSpace"); }} />}
          {canLeaveOrganization(organization, members, userId ?? "") && (
            <Action secondary title="Leave organization" run={() => act("leave_organization", { organization_id: organization.id })} />
          )}
          {role === "owner" && <Txt muted>The owner role is permanent. Transfer support is not available.</Txt>}
        </View>
      )}
    </>
  );

  if (tab === "chat") {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={[styles.content, { flex: 1, paddingBottom: 12 }]}>
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.label}>ORGANIZATION CHAT</Text>
                <Text style={styles.h2}>{organization.name}</Text>
              </View>
              {canAccessManagement && (
                <Pressable accessibilityRole="button" accessibilityLabel="More organization options" onPress={() => selectTab("manage")} style={{ padding: 10 }}>
                  <Settings2 size={20} color={colors.green} />
                </Pressable>
              )}
            </View>
            {nav}
            <GroupChatThread scope="organization" organizationId={organization.id} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Screen
        title={organization.name}
        eyebrow={`ORGANIZATION · ${role.toUpperCase()}`}
        create={false}
        headerAction={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open organization chat" onPress={() => selectTab("chat")} style={{ padding: 10 }}>
              <MessageCircle size={21} color={colors.green} />
            </Pressable>
            {canAccessManagement && (
              <Pressable accessibilityRole="button" accessibilityLabel="More organization options" onPress={() => selectTab("manage")} style={{ padding: 10 }}>
                <Settings2 size={20} color={colors.green} />
              </Pressable>
            )}
          </View>
        }
      >
        {sharedContent}
      </Screen>
      {managementSheets}
      {previewSquadId && (
        <SquadProfilePreview
          squadId={previewSquadId}
          visible
          onClose={() => setPreviewSquadId(null)}
        />
      )}
      {previewSpaceId && (
        <SpaceProfilePreview
          spaceId={previewSpaceId}
          visible
          onClose={() => setPreviewSpaceId(null)}
        />
      )}
      {previewPersonId && (
        <PersonProfilePreview
          personId={previewPersonId}
          visible
          onClose={() => setPreviewPersonId(null)}
        />
      )}
    </>
  );
}
