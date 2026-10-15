import React, { useRef, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowUpRight, Building2, Settings2 } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import { canManageSpace, canReadSpace } from "@/src/features/spaces/domain";
import { VirtualizedCommunityDirectory } from "@/src/features/people/VirtualizedCommunityDirectory";
import { OrganizationRelatedPreview } from "./OrganizationRelatedPreview";
import {
  ProfileActions,
  ProfileLink,
  ProfileSection,
} from "@/src/features/people/components/ProfilePrimitives";
import {
  normalizePlanningData,
  pendingPlanningThreads,
} from "@/src/features/planning/domain";
import { useNow } from "@/src/shared/useNow";
import { matchesSearch } from "@/src/shared/search";
import { canViewProfile } from "@/src/features/profile/privacy";
import { SOCIAL_ROLE_RANK } from "@/src/features/social/domain";
import {
  SocialPolicyFields,
  type SocialPolicyValue,
} from "@/src/features/social/SocialPolicyControls";
import { useCommunitySummary } from "@/src/features/social/CommunityProfileAccess";
import {
  BackButton,
  IconButton,
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
import type { Organization, OrganizationMemberRole } from "./types";

const tabs = ["overview", "squads", "activity"] as const;
type OrganizationTab = (typeof tabs)[number] | "members" | "chat" | "manage" | "directSquads";
const tabTitle: Record<OrganizationTab, string> = {
  overview: "Overview",
  members: "Members",
  squads: "Organizations",
  activity: "Activity",
  chat: "Chat",
  manage: "Settings",
  directSquads: "Direct Squads",
};
const roleOptions: OrganizationMemberRole[] = [
  "coowner",
  "admin",
  "elder",
  "member",
];
const settingsSections = [
  "details",
  "access",
  "members",
  "connections",
  "actions",
] as const;
type OrganizationSettingsSection = (typeof settingsSections)[number];
const settingsSectionTitles: Record<OrganizationSettingsSection, string> = {
  details: "Network details",
  access: "Privacy & access",
  connections: "Connections",
  members: "Members & roles",
  actions: "Actions",
};
const shortTime = (value: string) =>
  new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function OrganizationScreen() {
  const { styles, colors } = useTheme();
  const navigation = useNavigation();
  const { id, tab: queryTab, view: queryView, section: sectionParam } = useLocalSearchParams<{
    id: string;
    tab?: string;
    view?: string;
    section?: string;
  }>();
  const { data, userId, act } = useBeacon();
  const { summary: safeSummary, loading: summaryLoading } =
    useCommunitySummary("organization", id);
  const now = useNow();
  const organization = (data.organizations.find((item) => item.id === id)) ??
    (safeSummary
      ?
      ({
        id: safeSummary.entity_id,
        owner_id: "",
        name: safeSummary.name,
        description: safeSummary.description,
        created_at: "",
        member_count: safeSummary.member_count,
        discoverability: safeSummary.discoverability,
        join_mode: safeSummary.join_mode,
      } satisfies Organization)
      : undefined);
  const legacyTab = queryTab ?? queryView;
  const tab: OrganizationTab =
    legacyTab === "manage" || legacyTab === "members" || legacyTab === "chat" || legacyTab === "directSquads" || legacyTab === "direct-squads"
      ? legacyTab === "direct-squads" ? "directSquads" : legacyTab
      : legacyTab === "home"
        ? "overview"
        : legacyTab === "beacons"
          ? "activity"
          : tabs.includes(legacyTab as (typeof tabs)[number])
            ? (legacyTab as (typeof tabs)[number])
            : "overview";
  const requestedSection = Array.isArray(sectionParam)
    ? sectionParam[0]
    : sectionParam;
  const settingsSection = settingsSections.find(
    (item) => item === requestedSection,
  );
  const [sheet, setSheet] = useState<
    "invite" | "attach" | "attachSpace" | "member" | null
  >(null);
  const [invitee, setInvitee] = useState("");
  const [inviteRole, setInviteRole] =
    useState<OrganizationMemberRole>("member");
  const [memberRole, setMemberRole] =
    useState<OrganizationMemberRole>("member");
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedSquad, setSelectedSquad] = useState("");
  const [selectedSpace, setSelectedSpace] = useState("");
  const setPreviewSquadId = (id: string) =>
    router.push({ pathname: "/squad/[id]", params: { id } });
  const setPreviewSpaceId = (id: string) =>
    router.push({ pathname: "/space/[id]", params: { id } });
  const [squadSearch, setSquadSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [detailsDraft, setDetailsDraft] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [policyDraft, setPolicyDraft] = useState<SocialPolicyValue | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<
    OrganizationSettingsSection | null | undefined
  >(undefined);
  const pendingRemoveAction = useRef<NavigationAction | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const members = data.organization_members.filter(
    (member) => member.organization_id === organization?.id,
  );
  const currentMemberAccess = summaryLoading || safeSummary?.membership_status === "active";
  const role =
    organization && userId && currentMemberAccess && canReadOrganization(data, organization.id, userId)
      ? activeOrganizationRole(
          organization,
          data.organization_members,
          userId ?? "",
        )
      : null;
  const count = organization
    ? (safeSummary?.member_count ?? organization.member_count ??
      organizationActiveMemberCount(
        organization.id,
        organization.owner_id,
        members,
      ))
    : 0;
  const linkedSquadIds = data.organization_squads
    .filter((link) => link.organization_id === organization?.id)
    .filter((link) => canOpenSquadProfile(data, link.squad_id, userId))
    .map((link) => link.squad_id);
  const directSquadIds = [...new Set(data.organization_squads
    .filter((link) => link.organization_id === organization?.id)
    .map((link) => link.squad_id))];
  const linkedSquads = data.squads.filter((squad) =>
    linkedSquadIds.includes(squad.id),
  );
  const linkedSpaceIds = data.organization_spaces
    .filter((link) => link.organization_id === organization?.id)
    .filter((link) => {
      const space = data.spaces.find((item) => item.id === link.space_id);
      return !!(
        space &&
        userId &&
        canReadSpace(data, space.id, userId) &&
        canReadSpace(data, space.id, userId)
      );
    })
    .map((link) => link.space_id);
  const linkedSpaces = data.spaces.filter((space) =>
    linkedSpaceIds.includes(space.id),
  );
  const organizationActivities = organization
    ? data.activities
        .filter(
          (activity) =>
            userId &&
            ((activity.audience === "organization" &&
              activity.audience_id === organization.id) ||
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
        .sort((first, second) =>
          first.starts_at.localeCompare(second.starts_at),
        )
    : [];
  const planning = normalizePlanningData(data);
  const orgThreads = userId && role
    ? pendingPlanningThreads(data, planning, userId, now).filter(
        (thread) =>
          thread.audience === "organization" &&
          thread.audience_id === organization?.id,
      )
    : [];
  const visibleMemberRows = members
    .filter((member) => member.status === "active")
    .filter((member) => {
      if (!memberSearch.trim()) return true;
      const profile = data.profiles.find((item) => item.id === member.user_id);
      return !!(
        profile &&
        userId &&
        canViewProfile(data, profile, userId) &&
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
      squadName ?? "Network",
    );
  });
  const visibleThreads = orgThreads.filter((thread) =>
    matchesSearch(activitySearch, thread.title, thread.body, thread.kind),
  );

  const policyInitial: SocialPolicyValue = {
    discoverability: organization?.discoverability ?? "private",
    join_mode: organization?.join_mode ?? "invite",
    invite_policy: organization?.invite_policy ?? "admins",
  };
  const detailValues = detailsDraft ?? {
    name: organization?.name ?? "",
    description: organization?.description ?? "",
  };
  const detailsDirty = !!detailsDraft && (
    detailsDraft.name !== (organization?.name ?? "") ||
    detailsDraft.description !== (organization?.description ?? "")
  );
  const policyValues = policyDraft ?? policyInitial;
  const policyDirty = !!policyDraft && (
    policyDraft.discoverability !== policyInitial.discoverability ||
    policyDraft.join_mode !== policyInitial.join_mode ||
    policyDraft.invite_policy !== policyInitial.invite_policy
  );
  const settingsDirty = tab === "manage" && (detailsDirty || policyDirty);

  const canManageCurrentNetworkSettings =
    role === "owner" || role === "coowner" || role === "admin";
  usePreventRemove(settingsDirty && canManageCurrentNetworkSettings, ({ data: { action } }) => {
    pendingRemoveAction.current = action;
    setPendingDestination(undefined);
    setDiscardOpen(true);
  });

  if (summaryLoading && !organization)
    return (
      <Screen title="Loading Network" eyebrow="">
        <Txt muted>Loading the safe Network profile.</Txt>
      </Screen>
    );

  const profileSummary = safeSummary ?? (
    organization && userId && canReadOrganization(data, organization.id, userId) && summaryLoading
      ? {
          description: organization.description,
          member_count: organization.member_count ?? organizationActiveMemberCount(
            organization.id,
            organization.owner_id,
            members,
          ),
        }
      : null
  );
  if (!organization || !profileSummary) {
    return (
      <Screen
        title="Network unavailable"
        eyebrow="NETWORKS"
        create={false}
      >
        <Txt>
          This Network is no longer available to your account.
        </Txt>
        <Button
          title="Back to Networks"
          onPress={() => router.replace("/organizations")}
        />
      </Screen>
    );
  }

  const canManage = !!role && canManageOrganization(organization, members, userId ?? "");
  const canManageSquads = !!role && canManageOrganizationSquads(
    organization,
    members,
    userId ?? "",
  );
  const canReadMembers = !!currentMemberAccess &&
    canReadOrganizationMembers(data, organization.id, userId);
  const canLeaveNetwork = !!currentMemberAccess &&
    canLeaveOrganization(organization, members, userId ?? "");
  const canAccessManagement =
    canManage ||
    canManageSquads ||
    canLeaveNetwork;
  const inviteRoles = role
    ? roleOptions.filter((candidate) =>
        canInviteOrganizationRole(organization, members, userId ?? "", candidate),
      )
    : [];
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
    ...activeMembers.filter(
      (member) => member.user_id !== organization.owner_id,
    ),
  ];
  const invitedMembers = members.filter(
    (member) => member.status === "invited",
  );
  const requestedMembers = members.filter(
    (member) => member.status === "requested",
  );
  const attachableSquads = data.squads.filter(
    (squad) =>
      !linkedSquadIds.includes(squad.id) &&
      canOpenSquadProfile(data, squad.id, userId) &&
      SOCIAL_ROLE_RANK[
        data.squad_members.find(
          (member) => member.squad_id === squad.id && member.user_id === userId,
        )?.role ?? "member"
      ] >= SOCIAL_ROLE_RANK.admin,
  );
  const attachableSpaces = data.spaces.filter(
    (space) =>
      !data.organization_spaces.some(
        (link) =>
          link.organization_id === organization.id &&
          link.space_id === space.id,
      ) &&
      canManageSpace(data, space.id, userId) &&
      !!role && canManageOrganization(organization, members, userId ?? ""),
  );
  const canManageLinkedSquad = (squadId: string) =>
    !!role && canManageOrganizationSquads(organization, members, userId ?? "") &&
    !!data.squad_members.find(
      (member) =>
        member.squad_id === squadId &&
        member.user_id === userId &&
        (member.role === "owner" || member.role === "admin"),
    );

  function selectTab(nextTab: OrganizationTab) {
    router.push({
      pathname: "/organization/[id]",
      params: { id, ...(nextTab === "overview" ? {} : { tab: nextTab }) },
    });
  }
  function navigateSettings(section?: OrganizationSettingsSection) {
    router.setParams({ id, tab: "manage", section: section ?? "" });
  }
  function requestSettings(section?: OrganizationSettingsSection) {
    if (settingsDirty) {
      setPendingDestination(section ?? null);
      setDiscardOpen(true);
      return;
    }
    navigateSettings(section);
  }
  function confirmDiscardSettings() {
    const destination = pendingDestination;
    const action = pendingRemoveAction.current;
    setDiscardOpen(false);
    setDetailsDraft(null);
    setPolicyDraft(null);
    setPendingDestination(undefined);
    pendingRemoveAction.current = null;
    setTimeout(() => {
      if (destination !== undefined) navigateSettings(destination ?? undefined);
      else if (action) navigation.dispatch(action);
    }, 0);
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
  function viewPerson(personId: string) {
    const profile = data.profiles.find((row) => row.id === personId);
    if (profile && userId && canViewProfile(data, profile, userId))
      router.push({ pathname: "/person/[id]", params: { id: personId } });
  }
  const memberName = (personId: string) => {
    const profile = data.profiles.find((item) => item.id === personId);
    return profile && userId && canViewProfile(data, profile, userId)
      ? profile.name
      : "Member";
  };
  const selectionButton = (
    title: string,
    selected: boolean,
    onPress: () => void,
  ) => (
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
      <Text style={[styles.buttonText, !selected && { color: colors.ink }]}>
        {title}
      </Text>
    </Pressable>
  );

  const peopleRows = (rows: typeof activeMembers) =>
    rows.map((member) => {
      const profile = data.profiles.find((item) => item.id === member.user_id);
      const profileVisible = !!(
        profile &&
        userId &&
        canViewProfile(data, profile, userId)
      );
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
          accessibilityLabel={
            canManage
              ? `Manage ${memberName(member.user_id)}`
              : `Network member ${memberName(member.user_id)}`
          }
          onPress={() => {
            if (canManage) openMember(member.user_id);
            else if (profileVisible) viewPerson(member.user_id);
          }}
          style={({ pressed }) => [
            styles.card,
            {
              padding: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.h2}>{memberName(member.user_id)}</Text>
            <Text style={styles.muted}>
              {member.user_id === organization.owner_id ? "Owner" : member.role}
            </Text>
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
        (ban) =>
          ban.organization_id === organization.id && ban.user_id === profile.id,
      ),
  );
  const nextRoleOptions = role ? roleOptions.filter((candidate) =>
    canChangeOrganizationMemberRole(
      organization,
      members,
      userId ?? "",
      selectedMember,
      candidate,
    ),
  ) : [];
  const manageableMember = members.find(
    (member) => member.user_id === selectedMember,
  );
  const canUnban = (banUserId: string) => {
    const ban = data.organization_bans.find(
      (item) =>
        item.organization_id === organization.id && item.user_id === banUserId,
    );
    if (!ban) return false;
    const actorRank = role
      ? ({ owner: 5, coowner: 4, admin: 3, elder: 2, member: 1 } as const)[role]
      : 0;
    const bannedRank = ({ coowner: 4, admin: 3, elder: 2, member: 1 } as const)[
      ban.former_role
    ];
    return actorRank > bannedRank;
  };

  const managementSheets = (
    <>
      <Sheet
        title="Discard settings changes?"
        visible={discardOpen}
        onClose={() => {
          setDiscardOpen(false);
          setPendingDestination(undefined);
          pendingRemoveAction.current = null;
        }}
      >
        <View style={{ gap: 10 }}>
          <Txt>Your Network settings have unsaved changes.</Txt>
          <Button secondary title="Keep editing" onPress={() => setDiscardOpen(false)} />
          <Button title="Discard changes" onPress={confirmDiscardSettings} />
        </View>
      </Sheet>
      <Sheet
        title="Leave this Network?"
        visible={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
      >
        <View style={{ gap: 10 }}>
          <Txt>You will lose access to member-only settings and private activity.</Txt>
          <Button secondary title="Cancel" onPress={() => setLeaveConfirmOpen(false)} />
          <Action
            title="Leave Network"
            run={async () => {
              await act("leave_organization", { organization_id: organization.id });
              setLeaveConfirmOpen(false);
              router.replace("/organizations");
            }}
          />
        </View>
      </Sheet>
      <Sheet
        title="Invite someone"
        visible={sheet === "invite" && inviteRoles.length > 0}
        onClose={() => setSheet(null)}
      >
        {!inviteRoles.length ? (
          <Txt muted>
            Your current role cannot invite Network members.
          </Txt>
        ) : (
          <>
            <Txt muted>
              Choose a person who can already be discovered by your account,
              then give them an appropriate role.
            </Txt>
            {inviteCandidates.length ? (
              <View style={{ gap: 8 }}>
                {inviteCandidates.map((profile) => (
                  <View key={profile.id}>
                    {selectionButton(profile.name, invitee === profile.id, () =>
                      setInvitee(profile.id),
                    )}
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
      <Sheet
        title="Link a Squad"
        visible={sheet === "attach" && canManageSquads}
        onClose={() => setSheet(null)}
      >
        <Txt muted>
          Only Squads you own or administer can be linked. Their roster and
          private chat stay separate.
        </Txt>
        {attachableSquads.length ? (
          <View style={{ gap: 8 }}>
            {attachableSquads.map((squad) => (
              <View key={squad.id}>
                {selectionButton(squad.name, selectedSquad === squad.id, () =>
                  setSelectedSquad(squad.id),
                )}
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
      <Sheet
        title="Link an Organization"
        visible={sheet === "attachSpace" && canManage}
        onClose={() => setSheet(null)}
      >
        <Txt muted>
          Linking groups two communities without copying members or granting
          access to private content. You need admin authority in both.
        </Txt>
        {attachableSpaces.length ? (
          <View style={{ gap: 8 }}>
            {attachableSpaces.map((space) => (
              <View key={space.id}>
                {selectionButton(space.name, selectedSpace === space.id, () =>
                  setSelectedSpace(space.id),
                )}
              </View>
            ))}
          </View>
        ) : (
          <Txt muted>
            No unlinked Organizations you administer are available.
          </Txt>
        )}
        <Action
          title="Link Organization"
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
      <Sheet
        title={`Manage ${memberName(selectedMember)}`}
        visible={sheet === "member" && !!role && canManageOrganizationMember(organization, members, userId ?? "", selectedMember)}
        onClose={() => setSheet(null)}
      >
        {manageableMember && nextRoleOptions.length > 0 && (
          <>
            <Txt muted>
              Set a role below your own. The Network owner cannot be
              changed.
            </Txt>
            <Chips
              options={nextRoleOptions}
              value={
                nextRoleOptions.includes(memberRole)
                  ? memberRole
                  : nextRoleOptions[0]
              }
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
              title="Remove from Network"
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
              title="Ban from Network"
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
      {tab === "overview" && (
        <View style={{ gap: 18 }}>
          <View style={{ gap: 12 }}>
            <View style={[styles.row, { gap: 12 }]}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: colors.lime,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Building2 size={25} color={colors.green} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={styles.h2} numberOfLines={2}>{organization.name}</Text>
                <Text style={styles.body}>{profileSummary.member_count.toLocaleString()} members</Text>
                <Txt muted>
                  {role
                    ? `Joined · ${role === "coowner" ? "Co-owner" : role[0].toUpperCase() + role.slice(1)}`
                    : "Network profile"}
                </Txt>
              </View>
            </View>
            {profileSummary.description.trim() ? (
              <Text style={styles.muted} numberOfLines={2}>{profileSummary.description}</Text>
            ) : null}
            <ProfileActions>
              <Button
                compact
                title="Browse Organizations"
                onPress={() => selectTab("squads")}
              />
              {role ? (
                <Button
                  compact
                  secondary
                  title="Chat"
                  onPress={() => selectTab("chat")}
                />
              ) : null}
            </ProfileActions>
          </View>
          <ProfileSection title="Organizations in this Network">
            <OrganizationRelatedPreview
              organizationId={organization.id}
              entityType="space"
            />
            <ProfileLink
              title="View All Organizations"
              detail="Open the full linked Organization directory"
              onPress={() => selectTab("squads")}
            />
          </ProfileSection>
          {(directSquadIds.length > 0 || canManageSquads) ? (
            <ProfileSection title="Squads directly linked to this Network">
              <Txt muted>Direct links create association only. Squad membership and chat remain separate.</Txt>
              <OrganizationRelatedPreview
                organizationId={organization.id}
                entityType="squad"
              />
              {directSquadIds.length ? (
                <ProfileLink
                  title="View direct Squads"
                  detail="Open the full linked Squad directory"
                  onPress={() => selectTab("directSquads")}
                />
              ) : null}
            </ProfileSection>
          ) : null}
          {organizationActivities.some(
            (activity) =>
              activity.status === "scheduled" &&
              Date.parse(activity.ends_at) > now,
          ) ? (
            <ProfileSection
              title="Upcoming Beacons"
              action={
                organizationActivities.length > 2 ? (
                  <Button
                    compact
                    secondary
                    title="All Beacons"
                    onPress={() => selectTab("activity")}
                  />
                ) : undefined
              }
            >
              {organizationActivities
                .filter(
                  (activity) =>
                    activity.status === "scheduled" &&
                    Date.parse(activity.ends_at) > now,
                )
                .slice(0, 2)
                .map((activity) => (
                  <ProfileLink
                    key={activity.id}
                    title={activity.title}
                    detail={shortTime(activity.starts_at)}
                    onPress={() =>
                      router.push({
                        pathname: "/activity/[id]",
                        params: { id: activity.id },
                      })
                    }
                  />
                ))}
            </ProfileSection>
          ) : null}
          {orgThreads[0] ? (
            <ProfileLink
              title={orgThreads[0].title}
              detail="Open Ping or decision"
              onPress={() =>
                router.push({
                  pathname: "/council/[id]",
                  params: { id: orgThreads[0].id },
                })
              }
            />
          ) : null}
          <ProfileLink
            title="Beacons & Pings"
            onPress={() => selectTab("activity")}
          />
          <ProfileLink
            title="Members"
            detail={`${count.toLocaleString()} members`}
            onPress={() => selectTab("members")}
          />
          {profileSummary.description.trim() ? (
            <ProfileSection title="About">
              <Txt>{profileSummary.description}</Txt>
            </ProfileSection>
          ) : null}
        </View>
      )}

      {tab === "members" && !canReadMembers ? (
        <Empty
          title="Members are private"
          body="Join this Network to view its member directory."
        />
      ) : tab === "members" && (
        <FlashList
          style={{ flex: 1, minHeight: 0 }}
          data={memberSearch.trim() ? visibleMemberRows : directoryMembers}
          keyExtractor={(member) => member.user_id}
          ListHeaderComponent={
            <View style={{ gap: 10, paddingBottom: 10 }}>
              <View style={styles.between}>
                <View>
                  <Text style={styles.h2}>{count.toLocaleString()} members</Text>
                  <Text style={styles.muted}>Active members</Text>
                </View>
                {inviteRoles.length > 0 && (
                  <Button compact title="+ Invite" onPress={openInvite} />
                )}
              </View>
              <Field
                label="Search visible member names"
                placeholder="Name"
                value={memberSearch}
                onChangeText={setMemberSearch}
              />
            </View>
          }
          renderItem={({ item }) => peopleRows([item])[0]}
          ListEmptyComponent={
            <Empty
              title={memberSearch.trim() ? "No matching members" : "No visible members"}
              body="Member profiles are shown here when they are visible to you."
            />
          }
          ListFooterComponent={
            <View style={{ gap: 10, paddingTop: 10 }}>
          {invitedMembers.length > 0 && (
            <>
              <Text style={styles.label}>INVITATIONS</Text>
              {invitedMembers.map((member) => (
                <View
                  key={member.user_id}
                  style={[styles.card, { padding: 12 }]}
                >
                  <View style={styles.between}>
                    <Text style={styles.h2}>{memberName(member.user_id)}</Text>
                    <Text style={styles.muted}>{member.role} · invited</Text>
                  </View>
                  {canManageOrganizationMember(
                    organization,
                    members,
                    userId ?? "",
                    member.user_id,
                  ) && (
                    <Action
                      compact
                      secondary
                      title="Cancel invitation"
                      run={() =>
                        act("remove_organization_member", {
                          organization_id: organization.id,
                          user_id: member.user_id,
                        })
                      }
                    />
                  )}
                </View>
              ))}
            </>
          )}
          {canManage && requestedMembers.length > 0 && (
            <View style={[styles.card, { gap: 8 }]}>
              <Text style={styles.h2}>Join requests</Text>
              {requestedMembers.map((member) => (
                <View
                  key={member.user_id}
                  style={[
                    styles.row,
                    { flexWrap: "wrap", justifyContent: "space-between" },
                  ]}
                >
                  <Text style={[styles.body, { flex: 1 }]}>
                    {memberName(member.user_id)}
                  </Text>
                  <Action
                    compact
                    title="Approve"
                    run={() =>
                      act("approve_organization_join_request", {
                        organization_id: organization.id,
                        user_id: member.user_id,
                      })
                    }
                  />
                  <Action
                    compact
                    secondary
                    title="Decline"
                    run={() =>
                      act("deny_organization_join_request", {
                        organization_id: organization.id,
                        user_id: member.user_id,
                      })
                    }
                  />
                </View>
              ))}
            </View>
          )}
          {canManage &&
            data.organization_bans.some(
              (ban) => ban.organization_id === organization.id,
            ) && (
              <>
                <Text style={styles.label}>BANNED</Text>
                {data.organization_bans
                  .filter(
                    (ban) =>
                      ban.organization_id === organization.id &&
                      canUnban(ban.user_id),
                  )
                  .map((ban) => (
                    <View
                      key={ban.user_id}
                      style={[styles.card, { padding: 12 }]}
                    >
                      <View style={styles.between}>
                        <Text style={styles.h2}>{memberName(ban.user_id)}</Text>
                        <Action
                          compact
                          secondary
                          title="Unban"
                          run={() =>
                            act("unban_organization_member", {
                              organization_id: organization.id,
                              user_id: ban.user_id,
                            })
                          }
                        />
                      </View>
                      {!!ban.reason && <Txt muted>{ban.reason}</Txt>}
                    </View>
                  ))}
              </>
            )}
            </View>
          }
        />
      )}

      {(tab === "squads" || tab === "directSquads") && (
        <View style={{ flex: 1, minHeight: 0, gap: 8 }}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h2}>
                {tab === "squads" ? "Organizations in this Network" : "Squads directly linked to this Network"}
              </Text>
              <Txt muted>
                {tab === "squads"
                  ? "Their members and activity remain independent."
                  : "These associations do not grant Squad membership or access to private content."}
              </Txt>
            </View>
            {tab === "squads" && canManage ? (
              <Button compact secondary title="+ Organization" onPress={() => { setSelectedSpace(""); setSheet("attachSpace"); }} />
            ) : tab === "directSquads" && canManageSquads ? (
              <Button compact title="+ Squad" onPress={() => { setSelectedSquad(""); setSheet("attach"); }} />
            ) : null}
          </View>
          <Field
            label={tab === "squads" ? "Search Organizations" : "Search direct Squads"}
            placeholder={tab === "squads" ? "Organization name or description" : "Squad name or description"}
            value={squadSearch}
            onChangeText={setSquadSearch}
          />
          <VirtualizedCommunityDirectory
            query={squadSearch}
            queryLabel={tab === "squads" ? "Organizations linked directly to this Network" : "Network-linked Squads are a separate association"}
            entityType={tab === "squads" ? "space" : "squad"}
            parentType="organization"
            parentId={organization.id}
            allowedEntityIds={tab === "directSquads" ? directSquadIds : undefined}
            onOpen={(summary) => {
              if (summary.entity_type === "space") setPreviewSpaceId(summary.entity_id);
              else if (summary.entity_type === "squad") setPreviewSquadId(summary.entity_id);
            }}
          />
        </View>
      )}

      {tab === "activity" && (
        <View style={{ gap: 10 }}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.h2}>Network activity</Text>
              <Txt muted>
                Network Beacons and Pings live here. Squad activity
                stays in each Squad.
              </Txt>
            </View>
            {role ? (
              <Button
                compact
                title="+ Beacon"
                onPress={() =>
                  router.push({
                    pathname: "/create",
                    params: { organizationId: organization.id },
                  })
                }
              />
            ) : null}
          </View>
          {role ? (
            <Button
              compact
              secondary
              title="+ Ping"
              onPress={() =>
                router.push({
                  pathname: "/councils",
                  params: { organizationId: organization.id },
                })
              }
            />
          ) : null}
          <Field
            label="Search activity"
            placeholder="Beacon, Ping, category, or Squad"
            value={activitySearch}
            onChangeText={setActivitySearch}
          />
          {visibleThreads.map((thread) => (
            <Pressable
              key={thread.id}
              onPress={() =>
                router.push({
                  pathname: "/council/[id]",
                  params: { id: thread.id },
                })
              }
              style={styles.card}
            >
              <Text style={styles.label}>OPEN {thread.kind.toUpperCase()}</Text>
              <Text style={styles.h2}>{thread.title}</Text>
              {!!thread.body && <Txt muted>{thread.body}</Txt>}
            </Pressable>
          ))}
          {visibleActivities.map((activity) => (
            <Pressable
              key={activity.id}
              onPress={() =>
                router.push({
                  pathname: "/activity/[id]",
                  params: { id: activity.id },
                })
              }
              style={styles.card}
            >
              <View style={styles.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.h2}>{activity.title}</Text>
                  <Text style={styles.muted}>
                    Network Beacon · {shortTime(activity.starts_at)}
                  </Text>
                </View>
                <ArrowUpRight size={18} color={colors.green} />
              </View>
              {!!activity.description && (
                <Txt muted>{activity.description}</Txt>
              )}
            </Pressable>
          ))}
          {!organizationActivities.length && !orgThreads.length ? (
            <Empty
              title="Nothing planned yet"
              body="Use the audience picker when creating a Beacon or Ping to share it with this Network."
            />
          ) : visibleActivities.length === 0 && visibleThreads.length === 0 ? (
            <Empty
              title="No matching activity"
              body="Try another title, category, or Squad name."
            />
          ) : null}
        </View>
      )}

      {tab === "manage" && (
        settingsSection === "details" ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.h2}>Network details</Text>
            {canManage ? (
              <>
                <Field label="Name" value={detailValues.name} maxLength={60} onChangeText={(value) => setDetailsDraft({ ...detailValues, name: value })} />
                <Field label="Description" value={detailValues.description} maxLength={500} multiline onChangeText={(value) => setDetailsDraft({ ...detailValues, description: value })} />
                <Action
                  title="Save details"
                  disabled={!detailsDirty || !detailValues.name.trim()}
                  run={async () => {
                    if (!detailValues.name.trim()) throw new Error("Give this Network a name.");
                    await act("update_organization", {
                      organization_id: organization.id,
                      name: detailValues.name.trim(),
                      description: detailValues.description.trim(),
                    });
                    setDetailsDraft(null);
                    navigateSettings();
                  }}
                />
              </>
            ) : <Txt muted>Only Network owners, co-owners, and admins can edit these details.</Txt>}
            <Button secondary title="Cancel" onPress={() => { setDetailsDraft(null); navigateSettings(); }} />
          </View>
        ) : settingsSection === "access" ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.h2}>Access & membership</Text>
            {canManage ? (
              <>
                <SocialPolicyFields value={policyValues} onChange={setPolicyDraft} />
                <Action
                  title="Save access settings"
                  disabled={!policyDirty}
                  run={async () => {
                    await act("set_social_policy", {
                      entity_type: "organization",
                      entity_id: organization.id,
                      ...policyValues,
                    });
                    setPolicyDraft(null);
                    navigateSettings();
                  }}
                />
              </>
            ) : <Txt muted>Only Network owners, co-owners, and admins can edit access settings.</Txt>}
            <Button secondary title="Cancel" onPress={() => { setPolicyDraft(null); navigateSettings(); }} />
          </View>
        ) : settingsSection === "connections" ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.h2}>Connections</Text>
            <Txt muted>Linked Organizations and direct Squad associations remain separate from membership and ownership.</Txt>
            {canManageSquads ? <Button secondary title="Link a Squad" onPress={() => { setSelectedSquad(""); setSheet("attach"); }} /> : null}
            {canManage ? <Button secondary title="Link an Organization" onPress={() => { setSelectedSpace(""); setSheet("attachSpace"); }} /> : null}
            {linkedSquads.map((squad) => (
              <View key={`squad:${squad.id}`} style={styles.card}>
                <ProfileLink title={squad.name} detail="Direct Squad association" onPress={() => setPreviewSquadId(squad.id)} />
                {canManageLinkedSquad(squad.id) ? (
                  <Action compact secondary title={`Unlink ${squad.name}`} run={() => act("detach_organization_squad", { organization_id: organization.id, squad_id: squad.id })} />
                ) : null}
              </View>
            ))}
            {linkedSpaces.map((space) => (
              <View key={`space:${space.id}`} style={styles.card}>
                <ProfileLink title={space.name} detail="Linked Organization" onPress={() => setPreviewSpaceId(space.id)} />
                {canManage ? (
                  <Action compact secondary title={`Unlink ${space.name}`} run={() => act("detach_organization_space", { organization_id: organization.id, space_id: space.id })} />
                ) : null}
              </View>
            ))}
            <Button secondary title="Browse Organizations and direct Squads" onPress={() => selectTab("squads")} />
          </View>
        ) : settingsSection === "members" ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.h2}>Members & invitations</Text>
            {canReadMembers ? <Button title="Manage members, requests & bans" onPress={() => selectTab("members")} /> : null}
            {inviteRoles.length ? <Button secondary title="Invite a member" onPress={openInvite} /> : null}
            {!canReadMembers && !inviteRoles.length ? <Txt muted>Member administration is only visible to eligible Network members.</Txt> : null}
          </View>
        ) : settingsSection === "actions" ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.h2}>Actions</Text>
            {canLeaveNetwork ? (
              <Button secondary title="Leave Network" onPress={() => setLeaveConfirmOpen(true)} />
            ) : <Txt muted>{role === "owner" ? "The owner role stays with the Network owner." : "There is no membership action available for this account."}</Txt>}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={styles.card}>
              <Text style={styles.h2}>Network settings</Text>
              <Txt muted>{role ? `Your role: ${role === "coowner" ? "Co-owner" : role}` : "Public profile settings"}</Txt>
            </View>
            {settingsSections.filter((section) =>
                    section === "details" || section === "access" ? canManage :
                section === "connections" ? canManage || canManageSquads :
                  section === "members" ? canReadMembers || inviteRoles.length > 0 :
                    canLeaveNetwork,
            ).map((section) => (
              <ProfileLink key={section} title={settingsSectionTitles[section]} onPress={() => requestSettings(section)} />
            ))}
          </View>
        )
      )}
    </>
  );

  if (tab === "chat") {
    if (!role) {
      return (
        <Screen title="Chat unavailable" eyebrow={organization.name} create={false}>
          <Empty
            title="Network chat is for active members"
            body="This profile only shows chat access to current Network members."
          />
        </Screen>
      );
    }
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={[styles.content, { flex: 1, paddingBottom: 12 }]}>
            <View style={styles.between}>
              <BackButton />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.label}>NETWORK CHAT</Text>
                <Text style={styles.h2}>{organization.name}</Text>
              </View>
              {canAccessManagement && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More Network options"
                  onPress={() => selectTab("manage")}
                  style={{ padding: 10 }}
                >
                  <Settings2 size={20} color={colors.green} />
                </Pressable>
              )}
            </View>
            <GroupChatThread
              scope="organization"
              organizationId={organization.id}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Screen
        title={
          tab === "manage"
            ? settingsSection
              ? settingsSectionTitles[settingsSection]
              : "Settings"
            : tab === "overview"
              ? "Network"
              : tabTitle[tab]
        }
        eyebrow={tab === "overview" ? "" : organization.name}
        showDemoNotice={false}
        create={false}
        scroll={tab !== "members" && tab !== "squads" && tab !== "directSquads"}
        compactHeader={
          tab === "members" || tab === "squads" || tab === "directSquads" ||
          (tab === "manage" && !!settingsSection)
        }
        headerAction={
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {canAccessManagement && tab === "manage" && settingsSection ? (
              <IconButton
                label="Back to Network settings"
                onPress={() => requestSettings(undefined)}
              >
                <Settings2 size={20} color={colors.green} />
              </IconButton>
            ) : canAccessManagement ? (
              <IconButton
                label="Network settings"
                onPress={() => selectTab("manage")}
              >
                <Settings2 size={20} color={colors.green} />
              </IconButton>
            ) : null}
          </View>
        }
      >
        {sharedContent}
      </Screen>
      {managementSheets}
    </>
  );
}
