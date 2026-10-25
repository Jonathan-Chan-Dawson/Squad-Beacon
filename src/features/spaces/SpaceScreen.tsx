import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { CommunityPublicBeacons } from "@/src/features/discovery/CommunityPublicBeacons";
import { CommunityPublicProfile } from "@/src/features/discovery/CommunityPublicProfile";
import { communityProfileMode } from "@/src/features/discovery/communityPublicProfileAccess";
import { canReadOrganization } from "@/src/features/organizations/domain";
import {
  ProfileActions,
  ProfileLink,
  ProfileSection,
} from "@/src/features/people/components/ProfilePrimitives";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import { VirtualizedCommunityDirectory } from "@/src/features/people/VirtualizedCommunityDirectory";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { communityTypeLabel } from "@/src/features/social/communityPresentation";
import {
  RelationshipDisclosure,
  useCommunitySummary,
} from "@/src/features/social/CommunityProfileAccess";
import {
  canInviteWithPolicy,
  SOCIAL_ROLE_RANK,
} from "@/src/features/social/domain";
import {
  SocialPolicyFields,
  type SocialPolicyValue,
} from "@/src/features/social/SocialPolicyControls";
import { ConfirmDialog, useConfirmation } from "@/src/shared/Dialogs";
import { friendIds } from "@/src/shared/domain";
import { matchesSearch } from "@/src/shared/search";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Button,
  Chips,
  Empty,
  Field,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import {
  CalendarDays,
  Layers3,
  Settings2,
  UserPlus,
} from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  activeSpaceRole,
  canInviteSpaceMember,
  canManageSpace,
  canManageSpaceMember,
  canReadSpace,
  visibleSpaceSquads,
} from "./domain";
import { SpaceSquadPreview } from "./SpaceSquadPreview";
import type { Space, SpaceMemberRole } from "./types";

const settingsSections = [
  "details",
  "access",
  "members",
  "connections",
  "actions",
] as const;
type SpaceSettingsSection = (typeof settingsSections)[number];
const settingsSectionTitles: Record<SpaceSettingsSection, string> = {
  details: "Organization details",
  access: "Privacy & access",
  members: "Members & roles",
  connections: "Connections",
  actions: "Actions",
};

export default function SpaceScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    id?: string;
    tab?: string;
    view?: string;
    section?: string;
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const legacyView = params.tab ?? params.view;
  const { data, userId, act } = useBeacon();
  const {
    summary: safeSummary,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useCommunitySummary("space", id);
  const now = useNow();
  const { styles, colors } = useTheme();
  const [menu, setMenu] = useState<"invite" | "squads" | "settings" | null>(
    null,
  );
  const tab: "overview" | "squads" | "activity" | "members" | "settings" =
    legacyView === "settings"
      ? "settings"
      : legacyView === "squads" ||
          legacyView === "activity" ||
          legacyView === "members"
        ? legacyView
        : "overview";
  const requestedSection = Array.isArray(params.section)
    ? params.section[0]
    : params.section;
  const settingsSection = settingsSections.find(
    (item) => item === requestedSection,
  );
  const setSquadId = (id: string) =>
    router.push({ pathname: "/squad/[id]", params: { id } });
  const setOrganizationId = (id: string) =>
    router.push({ pathname: "/organization/[id]", params: { id } });
  const setOtherSpaceId = (id: string) =>
    router.push({ pathname: "/space/[id]", params: { id } });
  const [squadSearch, setSquadSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [editingMemberRole, setEditingMemberRole] =
    useState<SpaceMemberRole>("member");
  const [detailsDraft, setDetailsDraft] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [policyDraft, setPolicyDraft] = useState<SocialPolicyValue | null>(
    null,
  );
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pendingDestination, setPendingDestination] = useState<
    SpaceSettingsSection | null | undefined
  >(undefined);
  const pendingRemoveAction = useRef<NavigationAction | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const memberSpaceRecord = id
    ? data.spaces.find((row) => row.id === id)
    : undefined;
  const hasReadableMemberRecord = !!(
    safeSummary?.membership_status === "active" &&
    memberSpaceRecord &&
    userId &&
    canReadSpace(data, memberSpaceRecord.id, userId)
  );
  const profileMode = communityProfileMode(
    safeSummary,
    hasReadableMemberRecord,
    summaryLoading,
  );
  const space =
    profileMode === "member"
      ? memberSpaceRecord
      : safeSummary
        ? ({
            id: safeSummary.entity_id,
            owner_id: "",
            name: safeSummary.name,
            description: safeSummary.description,
            created_at: "",
            discoverability: safeSummary.discoverability,
            join_mode: safeSummary.join_mode,
          } satisfies Space)
        : undefined;
  const policyInitial: SocialPolicyValue = {
    discoverability:
      space?.discoverability ?? safeSummary?.discoverability ?? "private",
    join_mode: space?.join_mode ?? safeSummary?.join_mode ?? "invite",
    invite_policy: space?.invite_policy ?? "admins",
  };
  const detailValues = detailsDraft ?? {
    name: space?.name ?? safeSummary?.name ?? "",
    description: space?.description ?? safeSummary?.description ?? "",
  };
  const detailsDirty =
    !!detailsDraft &&
    (detailsDraft.name !== (space?.name ?? safeSummary?.name ?? "") ||
      detailsDraft.description !==
        (space?.description ?? safeSummary?.description ?? ""));
  const policyValues = policyDraft ?? policyInitial;
  const policyDirty =
    !!policyDraft &&
    (policyDraft.discoverability !== policyInitial.discoverability ||
      policyDraft.join_mode !== policyInitial.join_mode ||
      policyDraft.invite_policy !== policyInitial.invite_policy);
  const settingsDirty = tab === "settings" && (detailsDirty || policyDirty);
  const currentMemberAccess = profileMode === "member";
  const canManageCurrentSpace =
    currentMemberAccess && !!id && !!userId && canManageSpace(data, id, userId);
  usePreventRemove(
    settingsDirty && canManageCurrentSpace,
    ({ data: { action } }) => {
      pendingRemoveAction.current = action;
      setPendingDestination(undefined);
      setDiscardOpen(true);
    },
  );
  if (profileMode === "loading")
    return (
      <Screen title="Loading Organization" eyebrow="">
        <Txt muted>Loading the safe Organization profile.</Txt>
      </Screen>
    );
  const profileSummary = safeSummary;
  if (profileMode === "unavailable" || !space || !id || !profileSummary)
    return (
      <Screen title="Organization unavailable" eyebrow="">
        <Empty
          title="This Organization isn’t available"
          body="This Organization is unavailable to your account. Check Communities for an invitation or an eligible public profile."
        />
      </Screen>
    );
  if (profileMode === "summary")
    return (
      <Screen
        title={communityTypeLabel("space")}
        eyebrow={safeSummary?.name}
        create={false}
        showDemoNotice={false}
      >
        <CommunityPublicProfile
          summary={profileSummary}
          onSummaryChanged={refreshSummary}
        />
      </Screen>
    );
  const viewerRole =
    userId && currentMemberAccess && canReadSpace(data, id, userId)
      ? activeSpaceRole(space, data.space_members, userId)
      : null;
  const manageable = !!viewerRole && canManageSpace(data, id, userId);
  const mayInvite =
    !!viewerRole && canInviteWithPolicy(viewerRole, space.invite_policy);
  const members = viewerRole
    ? data.space_members.filter(
        (member) => member.space_id === id && member.status === "active",
      )
    : [];
  const joinRequests = manageable
    ? data.space_members.filter(
        (member) => member.space_id === id && member.status === "requested",
      )
    : [];
  const invitees = data.profiles.filter(
    (profile) =>
      !!userId &&
      friendIds(data, userId).includes(profile.id) &&
      canInviteSpaceMember(data, id, userId, profile.id) &&
      !!userId &&
      canViewProfile(data, profile, userId) &&
      !data.space_members.some(
        (member) => member.space_id === id && member.user_id === profile.id,
      ),
  );
  const squads = visibleSpaceSquads(data, id, userId).sort((first, second) => {
    const firstJoined = !!activeSquadMembership(data, first.id, userId);
    const secondJoined = !!activeSquadMembership(data, second.id, userId);
    return (
      Number(secondJoined) - Number(firstJoined) ||
      first.name.localeCompare(second.name)
    );
  });
  const searchedMembers = members.flatMap((member) => {
    const profile = data.profiles.find((row) => row.id === member.user_id);
    return profile &&
      userId &&
      canViewProfile(data, profile, userId) &&
      matchesSearch(memberSearch, profile.name, profile.username)
      ? [{ member, profile }]
      : [];
  });
  const spaceActivities = data.activities
    .filter(
      (activity) =>
        !!userId &&
        data.activity_social_links.some(
          (link) =>
            link.activity_id === activity.id &&
            link.entity_type === "space" &&
            link.entity_id === id,
        ) &&
        canReadBeaconActivity(data, activity, userId),
    )
    .sort((first, second) => first.starts_at.localeCompare(second.starts_at));
  const connectable = data.squads.filter((squad) => {
    const membership = activeSquadMembership(data, squad.id, userId);
    return (
      !!membership &&
      SOCIAL_ROLE_RANK[membership.role] >= SOCIAL_ROLE_RANK.admin &&
      !data.space_squads.some(
        (link) => link.space_id === id && link.squad_id === squad.id,
      )
    );
  });
  const parentNetworks = data.organization_spaces
    .filter((link) => link.space_id === id)
    .flatMap((link) => {
      const parent = data.organizations.find(
        (organization) => organization.id === link.organization_id,
      );
      return parent && userId && canReadOrganization(data, parent.id, userId)
        ? [parent]
        : [];
    });
  if (
    safeSummary?.parent_type === "organization" &&
    safeSummary.parent_id &&
    safeSummary.parent_name &&
    !parentNetworks.some((parent) => parent.id === safeSummary.parent_id)
  ) {
    parentNetworks.push({
      id: safeSummary.parent_id,
      name: safeSummary.parent_name,
    } as (typeof parentNetworks)[number]);
  }
  const openSettings = () => {
    setDetailsDraft(null);
    setPolicyDraft(null);
    router.push({ pathname: "/space/[id]", params: { id, tab: "settings" } });
  };
  const selectTab = (
    next: "overview" | "squads" | "activity" | "members" | "settings",
  ) => {
    router.push({
      pathname: "/space/[id]",
      params: { id, ...(next === "overview" ? {} : { tab: next }) },
    });
  };
  function navigateSettings(section?: SpaceSettingsSection) {
    router.setParams({ id, tab: "settings", section: section ?? "" });
  }
  function requestSettings(section?: SpaceSettingsSection) {
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
  return (
    <Screen
      title={
        tab === "settings"
          ? settingsSection
            ? settingsSectionTitles[settingsSection]
            : "Settings"
          : tab === "overview"
            ? "Organization"
            : tab === "activity"
              ? "Beacons"
              : tab === "members"
                ? "Members"
                : "Squads"
      }
      eyebrow={tab === "overview" ? "" : profileSummary.name}
      create={false}
      showDemoNotice={false}
      scroll={tab !== "members" && tab !== "squads"}
      compactHeader={
        tab === "members" ||
        tab === "squads" ||
        (tab === "settings" && !!settingsSection)
      }
      headerAction={
        <IconButton
          label={
            tab === "settings" && settingsSection
              ? "Back to Organization settings"
              : "Organization settings"
          }
          onPress={() => {
            if (tab === "settings" && settingsSection)
              requestSettings(undefined);
            else if (tab === "settings") selectTab("overview");
            else openSettings();
          }}
        >
          <Settings2 size={20} color={colors.green} />
        </IconButton>
      }
    >
      {tab !== "squads" && tab !== "settings" ? (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: colors.lime,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers3 size={23} color={colors.green} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={styles.h2} numberOfLines={2}>
              {profileSummary.name}
            </Text>
            {profileSummary.description.trim() ? (
              <Text style={styles.muted} numberOfLines={2}>
                {profileSummary.description}
              </Text>
            ) : null}
            <Txt muted>
              {space.space_type
                ? `${space.space_type.replaceAll("_", " ")} · `
                : "Organization · "}
              {profileSummary.member_count}{" "}
              {profileSummary.member_count === 1 ? "member" : "members"}
            </Txt>
          </View>
        </View>
      ) : null}
      {tab === "overview" ? (
        <ProfileActions>
          <Button
            compact
            title="Beacons"
            onPress={() => selectTab("activity")}
          />
          {mayInvite ? (
            <Button
              compact
              secondary
              title="Invite"
              onPress={() => setMenu("invite")}
              icon={<UserPlus size={16} color={colors.green} />}
            />
          ) : null}
        </ProfileActions>
      ) : null}
      {tab === "overview" ? (
        <View style={styles.between}>
          <Text style={styles.h2}>Squads you can open</Text>
        </View>
      ) : null}
      {tab === "overview" && (
        <>
          <SpaceSquadPreview spaceId={id} />
          <Button
            compact
            secondary
            title="All Squads"
            onPress={() => selectTab("squads")}
          />
        </>
      )}
      {tab === "squads" && (
        <View style={{ flex: 1, minHeight: 0, gap: 8 }}>
          <View style={styles.between}>
            <Txt muted>Only Squads you can independently open appear here.</Txt>
            {manageable ? (
              <Button
                compact
                secondary
                title="Connect Squad"
                onPress={() => setMenu("squads")}
              />
            ) : null}
          </View>
          <Field
            label={`Search Squads in ${space.name}`}
            placeholder="Squad name or description"
            value={squadSearch}
            onChangeText={setSquadSearch}
          />
          <VirtualizedCommunityDirectory
            query={squadSearch}
            queryLabel="Squads linked directly to this Organization"
            entityType="squad"
            parentType="space"
            parentId={id}
            onOpen={(summary) => setSquadId(summary.entity_id)}
          />
        </View>
      )}
      {tab === "overview" && parentNetworks.length > 0 ? (
        <RelationshipDisclosure
          contexts={parentNetworks.map((parent) => ({
            parentType: "organization" as const,
            parentId: parent.id,
          }))}
          current={{ type: "space", id }}
          title="Networks"
          onOpen={(summary) => {
            if (summary.entity_type === "squad") setSquadId(summary.entity_id);
            else if (summary.entity_type === "space")
              setOtherSpaceId(summary.entity_id);
            else setOrganizationId(summary.entity_id);
          }}
        />
      ) : null}
      {tab === "overview" &&
        spaceActivities.some(
          (activity) =>
            activity.status === "scheduled" &&
            Date.parse(activity.ends_at) > now,
        ) && (
          <View style={{ gap: 8 }}>
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.h2}>Upcoming Beacons</Text>
                <Text style={styles.muted}>
                  {spaceActivities.length} shared Beacons visible
                </Text>
              </View>
              <Button
                compact
                secondary
                title="See all"
                onPress={() => selectTab("activity")}
              />
            </View>
            {spaceActivities
              .filter(
                (activity) =>
                  activity.status === "scheduled" &&
                  Date.parse(activity.ends_at) > now,
              )
              .slice(0, 2)
              .map((activity) => (
                <Pressable
                  key={activity.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Beacon ${activity.title}`}
                  onPress={() =>
                    router.push({
                      pathname: "/activity/[id]",
                      params: { id: activity.id },
                    })
                  }
                  style={styles.card}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 9,
                    }}
                  >
                    <CalendarDays size={18} color={colors.green} />
                    <Text style={[styles.body, { flex: 1 }]}>
                      {activity.title}
                    </Text>
                  </View>
                </Pressable>
              ))}
            {!spaceActivities.length && (
              <Empty
                title="No shared Beacons yet"
                body="Beacons associated with this Organization appear here when you can access them."
              />
            )}
          </View>
        )}
      {tab === "overview" ? (
        <CommunityPublicBeacons
          type="space"
          entityId={id}
          excludeActivityIds={spaceActivities.map((activity) => activity.id)}
        />
      ) : null}
      {tab === "overview" ? (
        <View style={{ gap: 4 }}>
          <ProfileLink
            title="All Beacons"
            onPress={() => selectTab("activity")}
          />
          {viewerRole ? (
            <ProfileLink
              title="Members"
              detail={`${members.length} members`}
              onPress={() => selectTab("members")}
            />
          ) : null}
          {profileSummary.description.trim() ? (
            <ProfileSection title="About">
              <Txt>{profileSummary.description}</Txt>
            </ProfileSection>
          ) : null}
        </View>
      ) : null}
      {tab === "settings" && !settingsSection ? (
        <View style={{ gap: 8 }}>
          <View style={styles.card}>
            <Text style={styles.h2}>Organization settings</Text>
            <Txt muted>
              {viewerRole
                ? `Your role: ${viewerRole}`
                : "Public profile settings"}
            </Txt>
          </View>
          {settingsSections
            .filter((section) =>
              section === "details" || section === "access"
                ? manageable
                : section === "members"
                  ? !!viewerRole || mayInvite
                  : section === "connections"
                    ? manageable
                    : !!viewerRole && space.owner_id !== userId,
            )
            .map((section) => (
              <ProfileLink
                key={section}
                title={settingsSectionTitles[section]}
                onPress={() => requestSettings(section)}
              />
            ))}
          {!manageable && !viewerRole && !mayInvite ? (
            <Txt muted>There are no settings available to this account.</Txt>
          ) : null}
        </View>
      ) : null}
      {tab === "settings" && settingsSection === "details" ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.h2}>Organization details</Text>
          {manageable ? (
            <>
              <Field
                label="Organization name"
                value={detailValues.name}
                maxLength={60}
                onChangeText={(value) =>
                  setDetailsDraft({ ...detailValues, name: value })
                }
              />
              <Field
                label="Description"
                value={detailValues.description}
                maxLength={500}
                multiline
                onChangeText={(value) =>
                  setDetailsDraft({ ...detailValues, description: value })
                }
              />
              <Action
                title="Save Organization"
                disabled={!detailsDirty || !detailValues.name.trim()}
                run={async () => {
                  if (!detailValues.name.trim())
                    throw new Error("Give your Organization a name.");
                  await act("update_space", {
                    space_id: id,
                    name: detailValues.name.trim(),
                    description: detailValues.description.trim(),
                  });
                  setDetailsDraft(null);
                  navigateSettings();
                }}
              />
            </>
          ) : (
            <Txt muted>Only Organization admins can edit these details.</Txt>
          )}
          <Button
            secondary
            title="Cancel"
            onPress={() => {
              setDetailsDraft(null);
              navigateSettings();
            }}
          />
        </View>
      ) : null}
      {tab === "settings" && settingsSection === "access" ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.h2}>Privacy & access</Text>
          {manageable ? (
            <>
              <SocialPolicyFields
                value={policyValues}
                onChange={setPolicyDraft}
              />
              <Action
                title="Save access settings"
                disabled={!policyDirty}
                run={async () => {
                  await act("set_social_policy", {
                    entity_type: "space",
                    entity_id: id,
                    ...policyValues,
                  });
                  setPolicyDraft(null);
                  navigateSettings();
                }}
              />
            </>
          ) : (
            <Txt muted>
              Only Organization admins can edit privacy and access.
            </Txt>
          )}
          <Button
            secondary
            title="Cancel"
            onPress={() => {
              setPolicyDraft(null);
              navigateSettings();
            }}
          />
        </View>
      ) : null}
      {tab === "settings" && settingsSection === "members" ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.h2}>Members & roles</Text>
          {viewerRole ? (
            <Button title="View members" onPress={() => selectTab("members")} />
          ) : null}
          {mayInvite ? (
            <Button
              secondary
              title="Invite people"
              onPress={() => setMenu("invite")}
            />
          ) : null}
          {manageable ? (
            <Button
              secondary
              title="Manage member roles and removals"
              onPress={() => setMenu("settings")}
            />
          ) : null}
          {manageable && joinRequests.length ? (
            <Txt muted>
              {joinRequests.length} join requests await review in the member
              directory.
            </Txt>
          ) : null}
        </View>
      ) : null}
      {tab === "settings" && settingsSection === "connections" ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.h2}>Connections</Text>
          <Txt muted>Linked Squads keep their own membership and privacy.</Txt>
          {manageable ? (
            <Button title="Connect Squad" onPress={() => setMenu("squads")} />
          ) : null}
          {squads.map((squad) => (
            <View key={squad.id} style={[styles.row, styles.card]}>
              <Text style={[styles.body, { flex: 1 }]}>{squad.name}</Text>
              {manageable ? (
                <Action
                  compact
                  secondary
                  title={`Disconnect ${squad.name}`}
                  run={() =>
                    act("detach_space_squad", {
                      space_id: id,
                      squad_id: squad.id,
                    })
                  }
                />
              ) : null}
            </View>
          ))}
          <Button
            secondary
            title="Browse all Squads"
            onPress={() => selectTab("squads")}
          />
        </View>
      ) : null}
      {tab === "settings" && settingsSection === "actions" ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.h2}>Actions</Text>
          {viewerRole && space.owner_id !== userId ? (
            <Button
              secondary
              title="Leave Organization"
              onPress={() => setLeaveConfirmOpen(true)}
            />
          ) : (
            <Txt muted>
              {space.owner_id === userId
                ? "The owner role stays with the Organization owner."
                : "There are no membership actions available."}
            </Txt>
          )}
        </View>
      ) : null}
      {tab === "activity" && (
        <View style={{ gap: 10 }}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h2}>Organization activity</Text>
              <Txt muted>
                Only Beacons you are authorized to view appear here.
              </Txt>
            </View>
            {viewerRole ? (
              <Button
                compact
                title="+ Beacon"
                onPress={() =>
                  router.push({ pathname: "/create", params: { spaceId: id } })
                }
              />
            ) : null}
          </View>
          {spaceActivities.map((activity) => (
            <Pressable
              key={activity.id}
              accessibilityRole="button"
              accessibilityLabel={`Open Beacon ${activity.title}`}
              onPress={() =>
                router.push({
                  pathname: "/activity/[id]",
                  params: { id: activity.id },
                })
              }
              style={styles.card}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <CalendarDays size={18} color={colors.green} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.body}>{activity.title}</Text>
                  <Text style={styles.muted}>
                    {activity.category} ·{" "}
                    {new Date(activity.starts_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
          {!spaceActivities.length && (
            <Empty
              title="No shared Beacons yet"
              body="Use the audience picker or associate an accessible Beacon with this Organization."
            />
          )}
        </View>
      )}
      {tab === "members" && (
        <FlashList
          style={{ flex: 1, minHeight: 0 }}
          data={searchedMembers}
          keyExtractor={({ member }) => member.user_id}
          ListHeaderComponent={
            <View style={{ gap: 10, paddingBottom: 10 }}>
              <View style={styles.between}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.h2}>Members</Text>
                  <Text style={styles.muted}>
                    {profileSummary.member_count} members
                  </Text>
                </View>
                {mayInvite && (
                  <Button
                    compact
                    secondary
                    title="Invite people"
                    onPress={() => setMenu("invite")}
                    icon={<UserPlus size={15} color={colors.green} />}
                  />
                )}
              </View>
              {manageable && joinRequests.length ? (
                <View style={[styles.card, { gap: 8 }]}>
                  <Text style={styles.h2}>Join requests</Text>
                  {joinRequests.map((request) => {
                    const profile = data.profiles.find(
                      (row) => row.id === request.user_id,
                    );
                    const visible = !!(
                      profile &&
                      userId &&
                      canViewProfile(data, profile, userId)
                    );
                    return (
                      <View
                        key={request.user_id}
                        style={[
                          styles.row,
                          { flexWrap: "wrap", justifyContent: "space-between" },
                        ]}
                      >
                        <Text style={[styles.body, { flex: 1 }]}>
                          {visible && profile
                            ? profile.name
                            : "Community member"}
                        </Text>
                        <Action
                          compact
                          title="Approve"
                          run={() =>
                            act("approve_space_join_request", {
                              space_id: id,
                              user_id: request.user_id,
                            })
                          }
                        />
                        <Action
                          compact
                          secondary
                          title="Decline"
                          run={() =>
                            act("deny_space_join_request", {
                              space_id: id,
                              user_id: request.user_id,
                            })
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {members.length > 5 ? (
                <Field
                  label="Search Organization members"
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Name or username"
                />
              ) : null}
            </View>
          }
          renderItem={({ item: { member, profile } }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Preview ${profile.name}`}
              onPress={() =>
                router.push({
                  pathname: "/person/[id]",
                  params: { id: profile.id },
                })
              }
              style={[styles.row, { minHeight: 54 }]}
            >
              <ProfileAvatar profile={profile} size={38} />
              <Text style={[styles.body, { flex: 1 }]}>{profile.name}</Text>
              <Text style={styles.muted}>
                {member.role === "owner"
                  ? "Owner"
                  : member.role === "admin"
                    ? "Admin"
                    : ""}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Empty
              title={
                memberSearch.trim()
                  ? "No matching members"
                  : "No visible members"
              }
              body="Members appear here when their profile is visible to you."
            />
          }
        />
      )}
      <Sheet
        title="Invite to this Organization"
        visible={mayInvite && menu === "invite"}
        onClose={() => setMenu(null)}
      >
        <Txt muted>
          Invite accepted friends. They choose whether to join; this doesn’t add
          them to any Squad.
        </Txt>
        {invitees.map((profile) => (
          <Action
            key={profile.id}
            secondary
            title={`Invite ${profile.name}`}
            run={() =>
              act("invite_space_member", { space_id: id, user_id: profile.id })
            }
          />
        ))}
        {!invitees.length && (
          <Txt muted>
            All your visible friends are already members or invited.
          </Txt>
        )}
      </Sheet>
      <Sheet
        title="Connect a Squad"
        visible={manageable && menu === "squads"}
        onClose={() => setMenu(null)}
      >
        <Txt muted>
          Choose a Squad you own or manage. Its chat and roster keep their
          existing privacy.
        </Txt>
        {connectable.map((squad) => (
          <Action
            key={squad.id}
            secondary
            title={`Connect ${squad.name}`}
            run={async () => {
              await act("attach_space_squad", {
                space_id: id,
                squad_id: squad.id,
              });
              setMenu(null);
            }}
          />
        ))}
        {!connectable.length && (
          <Txt muted>
            No unconnected Squads you manage. You can create one from Squads →
            +.
          </Txt>
        )}
      </Sheet>
      <Sheet
        title="Member roles and removals"
        visible={manageable && menu === "settings"}
        onClose={() => setMenu(null)}
      >
        <Txt muted>Role changes remain below your own authority level.</Txt>
        {manageable && (
          <>
            {members
              .filter((member) =>
                canManageSpaceMember(data, id, userId, member.user_id),
              )
              .map((member) => {
                const profile = data.profiles.find(
                  (row) => row.id === member.user_id,
                );
                const allowedRoles = viewerRole
                  ? (["coowner", "admin", "elder", "member"] as const).filter(
                      (candidate) =>
                        SOCIAL_ROLE_RANK[viewerRole] >
                          SOCIAL_ROLE_RANK[member.role] &&
                        SOCIAL_ROLE_RANK[viewerRole] >
                          SOCIAL_ROLE_RANK[candidate],
                    )
                  : [];
                const editing = editingMemberId === member.user_id;
                return (
                  <View key={member.user_id} style={[styles.card, { gap: 8 }]}>
                    <Text style={styles.body}>
                      {profile && canViewProfile(data, profile, userId!)
                        ? profile.name
                        : "Member"}{" "}
                      · {member.role}
                    </Text>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                    >
                      {allowedRoles.length ? (
                        <Button
                          compact
                          secondary
                          title={editing ? "Close role edit" : "Change role"}
                          onPress={() => {
                            setEditingMemberId(editing ? null : member.user_id);
                            setEditingMemberRole(
                              member.role as SpaceMemberRole,
                            );
                          }}
                        />
                      ) : null}
                      <Button
                        compact
                        secondary
                        title={`Remove ${profile && canViewProfile(data, profile, userId!) ? profile.name : "member"} from Organization`}
                        onPress={() =>
                          requestConfirmation({
                            title: "Remove this member from the Organization?",
                            message:
                              "This removes the membership or invitation and its access to this Organization.",
                            confirmLabel: `Remove ${profile && canViewProfile(data, profile, userId!) ? profile.name : "member"} from Organization`,
                            destructive: true,
                            onConfirm: () =>
                              act("remove_space_member", {
                                space_id: id,
                                user_id: member.user_id,
                              }),
                          })
                        }
                      />
                    </View>
                    {editing && allowedRoles.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        <Chips
                          options={allowedRoles}
                          value={
                            allowedRoles.includes(
                              editingMemberRole as (typeof allowedRoles)[number],
                            )
                              ? (editingMemberRole as (typeof allowedRoles)[number])
                              : allowedRoles[0]
                          }
                          onChange={setEditingMemberRole}
                          accessibilityPrefix="Organization member role"
                        />
                        <Button
                          compact
                          title="Save role"
                          onPress={() =>
                            requestConfirmation({
                              title: "Change this member’s role?",
                              message:
                                "Change this member’s role to " + editingMemberRole + "? This changes their permissions.",
                              confirmLabel: "Save role",
                              destructive: false,
                              onConfirm: async () => {
                                await act("set_space_member_role", {
                                  space_id: id,
                                  user_id: member.user_id,
                                  role: editingMemberRole,
                                });
                                setEditingMemberId(null);
                              },
                            })
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
          </>
        )}
        <Button secondary title="Done" onPress={() => setMenu(null)} />
      </Sheet>
      <ConfirmDialog
        title="Discard settings changes?"
        visible={discardOpen}
        onClose={() => {
          setDiscardOpen(false);
          setPendingDestination(undefined);
          pendingRemoveAction.current = null;
        }}
        onConfirm={confirmDiscardSettings}
        confirmLabel={"Discard changes"}
        cancelLabel={"Keep editing"}
        closeOnConfirm={false}
        destructive
      >
        <View style={{ gap: 10 }}>
          <Txt>Your Organization settings have unsaved changes.</Txt>
        </View>
      </ConfirmDialog>
      <ConfirmDialog
        title="Leave this Organization?"
        visible={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={async () => {
          await act("leave_space", { space_id: id });
          setLeaveConfirmOpen(false);
          router.back();
        }}
        confirmLabel={"Leave Organization"}
        cancelLabel={"Cancel"}
        closeOnConfirm={false}
        destructive
      >
        <View style={{ gap: 10 }}>
          <Txt>
            You will lose access to member-only settings and private activity.
          </Txt>
        </View>
      </ConfirmDialog>
      {confirmationDialog}
    </Screen>
  );
}
