import { ActivityCard } from "@/src/features/beacons/ActivityCard";
import { CommunityPublicBeacons } from "@/src/features/discovery/CommunityPublicBeacons";
import { CommunityPublicProfile } from "@/src/features/discovery/CommunityPublicProfile";
import { communityProfileMode } from "@/src/features/discovery/communityPublicProfileAccess";
import {
  ProfileActions,
  ProfileLink,
  ProfileSection,
} from "@/src/features/people/components/ProfilePrimitives";
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
import type { SocialMemberRole } from "@/src/features/social/types";
import { ConfirmDialog } from "@/src/shared/Dialogs";
import { activityWhen, friendIds } from "@/src/shared/domain";
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
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import {
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  Layers3,
  MessageCircle,
  Radio,
  Settings2,
  Vote,
} from "lucide-react-native";
import { useEffect, useId, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CommunityAvatar } from "../components/CommunityAvatar";
import { SquadIconPicker } from "../components/SquadIconPicker";
import {
  canOpenSquadProfile,
  squadHistory,
  squadProfilePreviews,
  squadSizeLabel,
  visibleSquadMembers,
  visibleSquadNetworks,
  visibleSquadOrganizations,
} from "../squadProfile";

const tabs = ["Overview", "Members", "Activity", "Settings", "Invite"] as const;
type SquadTab = (typeof tabs)[number];
const settingsCategories = [
  "appearance",
  "details",
  "policy",
  "members",
  "connections",
  "actions",
] as const;
type SettingsCategory = (typeof settingsCategories)[number];
type PendingMemberAction = {
  kind: "approve" | "decline" | "remove" | "leave";
  userId: string;
  name: string;
};

const settingsCategoryLabels: Record<SettingsCategory, string> = {
  appearance: "Appearance",
  details: "Details",
  policy: "Access & membership",
  members: "Members",
  connections: "Connections",
  actions: "Actions",
};

export default function SquadProfileScreen() {
  const pingSeed = useId();
  const { styles, colors } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const {
    id,
    tab: tabParam,
    settings: settingsParam,
    fromChat,
  } = useLocalSearchParams<{
    id?: string;
    tab?: string;
    settings?: string;
    fromChat?: string;
  }>();
  const squadId = Array.isArray(id) ? id[0] : id;
  const requestedTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const requestedSettings = Array.isArray(settingsParam)
    ? settingsParam[0]
    : settingsParam;
  const { data, userId, act } = useBeacon();
  const {
    summary,
    loading: summaryLoading,
    error: summaryError,
    refresh: refreshSummary,
  } = useCommunitySummary("squad", squadId);
  const routeTab = tabs.find(
    (candidate) => candidate.toLowerCase() === requestedTab?.toLowerCase(),
  );
  const tab = routeTab ?? "Overview";
  const settingsCategory = settingsCategories.find(
    (candidate) => candidate === requestedSettings,
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [copyMembers, setCopyMembers] = useState(true);
  const [confirmedCopy, setConfirmedCopy] = useState(false);
  const [renameGeneral, setRenameGeneral] = useState(true);
  const [memberToManage, setMemberToManage] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<SocialMemberRole>("member");
  const [policyDraftState, setPolicyDraftState] = useState<{
    key: string;
    value: SocialPolicyValue;
  } | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [pendingMemberAction, setPendingMemberAction] =
    useState<PendingMemberAction | null>(null);
  const [pendingDestination, setPendingDestination] = useState<{
    tab: SquadTab;
    settings?: SettingsCategory;
  } | null>(null);
  const pendingRemoveAction = useRef<unknown>(null);
  const memberSquad =
    squadId && canOpenSquadProfile(data, squadId, userId)
      ? data.squads.find((item) => item.id === squadId)
      : undefined;
  const profileMode = communityProfileMode(
    summary,
    !!memberSquad,
    summaryLoading,
  );
  const isCurrentMember = profileMode === "member";
  const squad = isCurrentMember ? memberSquad : undefined;
  const viewerRole = data.squad_members.find(
    (member) => member.squad_id === squadId && member.user_id === userId,
  )?.role;
  const isOwner = viewerRole === "owner";
  const isAdmin =
    !!viewerRole && SOCIAL_ROLE_RANK[viewerRole] >= SOCIAL_ROLE_RANK.admin;
  const canInviteMembers =
    !!squad && canInviteWithPolicy(viewerRole ?? null, squad.invite_policy);
  const canReviewRequests =
    !!viewerRole && SOCIAL_ROLE_RANK[viewerRole] >= SOCIAL_ROLE_RANK.admin;
  const joinRequests = squad
    ? data.squad_join_requests.filter(
        (request) => request.squad_id === squad.id,
      )
    : [];
  const members =
    squad && userId ? visibleSquadMembers(data, squad.id, userId) : [];
  const selectedRoleMember = members.find(
    ({ member }) => member.user_id === memberToManage,
  )?.member;
  const assignableRoles =
    selectedRoleMember && viewerRole
      ? (["coowner", "admin", "elder", "member"] as const).filter(
          (candidate) =>
            SOCIAL_ROLE_RANK[viewerRole] >
              SOCIAL_ROLE_RANK[selectedRoleMember.role] &&
            SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[candidate],
        )
      : [];
  const eligibleSpaceMembers =
    squad && userId
      ? data.squad_members.filter(
          (member) =>
            member.squad_id === squad.id &&
            member.user_id !== squad.owner_id &&
            !data.blocks.some(
              (block) =>
                (block.blocker_id === userId &&
                  block.blocked_id === member.user_id) ||
                (block.blocked_id === userId &&
                  block.blocker_id === member.user_id),
            ) &&
            !data.squad_bans.some(
              (ban) =>
                ban.squad_id === squad.id && ban.user_id === member.user_id,
            ),
        )
      : [];
  const activities =
    squad && userId ? squadHistory(data, squad.id, userId) : [];
  const memberUserIds = new Set(
    data.squad_members
      .filter((member) => member.squad_id === squad?.id)
      .map((member) => member.user_id),
  );
  const acceptedFriends = userId ? friendIds(data, userId) : [];
  const policyInitial: SocialPolicyValue = {
    discoverability: memberSquad?.discoverability ?? "private",
    join_mode: memberSquad?.join_mode ?? "invite",
    invite_policy: memberSquad?.invite_policy ?? "admins",
  };
  const policyEditorKey =
    isCurrentMember &&
    tab === "Settings" &&
    settingsCategory === "policy" &&
    squadId
      ? squadId
      : null;
  const policyDraft = policyEditorKey
    ? policyDraftState && policyDraftState.key === policyEditorKey
      ? policyDraftState.value
      : policyInitial
    : null;
  const policyDirty =
    !!policyEditorKey &&
    !!policyDraft &&
    (policyDraft.discoverability !== policyInitial.discoverability ||
      policyDraft.join_mode !== policyInitial.join_mode ||
      policyDraft.invite_policy !== policyInitial.invite_policy);

  function changePolicyDraft(value: SocialPolicyValue) {
    if (policyEditorKey) setPolicyDraftState({ key: policyEditorKey, value });
  }

  usePreventRemove(policyDirty, ({ data: { action } }) => {
    pendingRemoveAction.current = action;
    setPendingDestination(null);
    setDiscardOpen(true);
  });

  const confirmedMembershipLoss =
    !memberSquad ||
    (!summaryLoading &&
      !summaryError &&
      summary?.membership_status !== "active");
  useEffect(() => {
    if (!confirmedMembershipLoss || !policyDraftState) return;
    // A settled authorization loss ends the draft session; loading/errors do not.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPolicyDraftState(null);
  }, [confirmedMembershipLoss, policyDraftState]);

  const navigateTo = (destination: {
    tab: SquadTab;
    settings?: SettingsCategory;
  }) => {
    if (!squadId) return;
    const params = {
      id: squadId,
      tab: destination.tab,
      settings: destination.settings ?? "",
      ...(fromChat ? { fromChat } : {}),
    };
    if (tab === "Overview" && destination.tab !== "Overview") {
      router.push({ pathname: "/squad/[id]", params });
      return;
    }
    router.setParams({
      tab: destination.tab,
      settings: destination.settings ?? "",
      ...(fromChat ? { fromChat } : {}),
    });
  };
  const requestNavigation = (destination: {
    tab: SquadTab;
    settings?: SettingsCategory;
  }) => {
    if (policyDirty) {
      setPendingDestination(destination);
      setDiscardOpen(true);
      return;
    }
    navigateTo(destination);
  };
  const selectTab = (value: SquadTab) => requestNavigation({ tab: value });
  const openSettingsCategory = (category: SettingsCategory) =>
    requestNavigation({ tab: "Settings", settings: category });
  const backToSettings = () => requestNavigation({ tab: "Settings" });

  const confirmDiscard = () => {
    setDiscardOpen(false);
    setPolicyDraftState(null);
    if (pendingDestination) {
      const destination = pendingDestination;
      setPendingDestination(null);
      navigateTo(destination);
      return;
    }
    const action = pendingRemoveAction.current;
    pendingRemoveAction.current = null;
    if (action) navigation.dispatch(action as never);
  };

  const inviteCandidates = data.profiles
    .filter(
      (profile) =>
        acceptedFriends.includes(profile.id) &&
        !memberUserIds.has(profile.id) &&
        !data.blocks.some(
          (block) =>
            (block.blocker_id === userId && block.blocked_id === profile.id) ||
            (block.blocked_id === userId && block.blocker_id === profile.id),
        ),
    )
    .filter((profile) => {
      if (!inviteSearch.trim()) return true;
      const visible = !!userId && canViewProfile(data, profile, userId);
      return visible
        ? matchesSearch(inviteSearch, profile.name, profile.username)
        : false;
    })
    .sort((first, second) => first.name.localeCompare(second.name));

  if (!userId || !squadId) {
    return (
      <Screen
        title="Squad unavailable"
        eyebrow="SQUAD PROFILE"
        compactHeader
        create={false}
      >
        <Empty
          title="This Squad profile is unavailable."
          body="This Squad profile is unavailable or your access has changed."
        />
        <Button
          title="Back to Squads"
          onPress={() => router.replace("/(tabs)/squads")}
        />
      </Screen>
    );
  }
  if (profileMode === "loading") {
    return (
      <Screen
        title="Squad profile"
        eyebrow="SQUAD PROFILE"
        compactHeader
        create={false}
      >
        <Txt muted>Loading Squad profile…</Txt>
      </Screen>
    );
  }
  if (profileMode === "unavailable" || !summary) {
    return (
      <Screen
        title="Squad unavailable"
        eyebrow="SQUAD PROFILE"
        compactHeader
        create={false}
      >
        <Empty
          title="This Squad profile is unavailable."
          body="This Squad profile is unavailable or your access has changed."
        />
        <Button
          title="Back to Squads"
          onPress={() => router.replace("/(tabs)/squads")}
        />
      </Screen>
    );
  }
  if (profileMode === "summary" && summary) {
    return (
      <Screen
        title={communityTypeLabel("squad")}
        eyebrow="SQUAD PROFILE"
        compactHeader
        showDemoNotice={false}
        create={false}
      >
        <CommunityPublicProfile
          summary={summary}
          onSummaryChanged={refreshSummary}
        />
      </Screen>
    );
  }
  if (!squad) return null;
  const activeSquadId = squad.id;
  const overviewPreviews = squadProfilePreviews(data, activeSquadId, userId);
  const associatedOrganizations = visibleSquadOrganizations(
    data,
    activeSquadId,
    userId,
  );
  const associatedNetworks = visibleSquadNetworks(data, activeSquadId, userId);
  const relationshipRows = [
    ...associatedOrganizations,
    ...associatedNetworks,
  ].sort((first, second) => first.name.localeCompare(second.name));

  const starred = data.favorites.some(
    (favorite) =>
      favorite.owner_id === userId &&
      favorite.kind === "squad" &&
      favorite.target_id === squad.id,
  );

  function openChat() {
    router.push({
      pathname: "/squad-chat/[id]",
      params: { id: activeSquadId },
    });
  }

  function openPing() {
    router.push({
      pathname: "/councils",
      params: {
        squadId: activeSquadId,
        newPing: "yes",
        pingSeed,
      },
    });
  }

  function openBeaconCreate() {
    router.push({
      pathname: "/create",
      params: { kind: "squad", squadId: activeSquadId },
    });
  }

  function openPlans() {
    router.push({ pathname: "/plans", params: { squadId: activeSquadId } });
  }

  function relationshipSection(title = "Connections") {
    return relationshipRows.length ? (
      <RelationshipDisclosure
        contexts={relationshipRows.map((relation) => ({
          parentType:
            relation.type === "organization"
              ? ("space" as const)
              : ("organization" as const),
          parentId: relation.id,
        }))}
        current={{ type: "squad", id: activeSquadId }}
        maxItems={3}
        entityType="squad"
        title={title}
        onOpen={(related) => {
          if (related.entity_type === "squad")
            router.push({
              pathname: "/squad/[id]",
              params: { id: related.entity_id },
            });
          else if (related.entity_type === "space")
            router.push({
              pathname: "/space/[id]",
              params: { id: related.entity_id },
            });
          else
            router.push({
              pathname: "/organization/[id]",
              params: { id: related.entity_id },
            });
        }}
      />
    ) : null;
  }

  function previewRow(preview: (typeof overviewPreviews)[number]) {
    const isDecision = preview.kind === "decision";
    const isBeacon = preview.kind === "beacon";
    const title = isDecision
      ? preview.decision.title
      : isBeacon
        ? preview.activity.title
        : preview.plan.title;
    const detail = isDecision
      ? `${preview.decision.kind === "ping" ? "Ping" : "Vote"} · Action needed`
      : isBeacon
        ? `${preview.timing === "current" ? "Current Beacon" : "Upcoming Beacon"} · ${activityWhen(preview.activity)}`
        : preview.routine
          ? `Plan routine · next ${preview.routine.next_occurrence_on ?? "date to be set"}`
          : `Plan · starts ${preview.plan.start_date}`;
    const Icon = isDecision
      ? preview.decision.kind === "ping"
        ? CircleHelp
        : Vote
      : isBeacon
        ? CalendarClock
        : Layers3;
    const onPress = () => {
      if (isDecision)
        router.push({
          pathname: "/council/[id]",
          params: { id: preview.decision.id },
        });
      else if (isBeacon)
        router.push({
          pathname: "/activity/[id]",
          params: { id: preview.activity.id },
        });
      else
        router.push({
          pathname: "/plan/[id]",
          params: { id: preview.plan.id },
        });
    };
    return (
      <Pressable
        key={`${preview.kind}:${isDecision ? preview.decision.id : isBeacon ? preview.activity.id : preview.plan.id}`}
        testID="squad-activity-preview"
        accessibilityRole="button"
        accessibilityLabel={`Open ${detail}: ${title}`}
        onPress={onPress}
        style={[styles.card, styles.row, { minHeight: 60, paddingVertical: 8 }]}
      >
        <Icon size={19} color={colors.green} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.body} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <Text style={[styles.body, { color: colors.green }]}>Open</Text>
      </Pressable>
    );
  }

  function openOrganizeSpace() {
    setSpaceName(`${squad?.name ?? ""} Organization`.trim());
    setSpaceDescription(squad?.description ?? "");
    setCopyMembers(true);
    setConfirmedCopy(false);
    setRenameGeneral(false);
    setOrganizeOpen(true);
  }

  async function createSpaceFromSquad() {
    if (!squad || !isOwner) return;
    const result = await act("organize_squad_into_space", {
      squad_id: squad.id,
      name: spaceName.trim(),
      description: spaceDescription.trim(),
      copy_members: copyMembers,
      confirm_member_copy: copyMembers && confirmedCopy,
      expected_member_count: eligibleSpaceMembers.length,
      rename_general: renameGeneral,
    });
    setOrganizeOpen(false);
    const id =
      typeof result.space_id === "string"
        ? result.space_id
        : typeof result.id === "string"
          ? result.id
          : "";
    if (id) router.push({ pathname: "/space/[id]", params: { id } });
  }

  return (
    <Screen
      scroll={tab !== "Members"}
      compactHeader
      title={
        tab === "Overview"
          ? "Squad"
          : tab === "Activity"
            ? "Beacons & Plans"
            : tab === "Members"
              ? "Squad members"
              : tab === "Invite"
                ? "Invite friends"
                : settingsCategory
                  ? settingsCategoryLabels[settingsCategory]
                  : "Squad settings"
      }
      eyebrow={tab === "Overview" ? "SQUAD PROFILE" : squad.name}
      showDemoNotice={false}
      create={false}
      headerAction={
        <IconButton
          label={
            tab === "Settings" && settingsCategory
              ? "Back to Squad settings"
              : "Squad settings"
          }
          onPress={() =>
            tab === "Settings" && settingsCategory
              ? backToSettings()
              : selectTab(tab === "Settings" ? "Overview" : "Settings")
          }
        >
          {tab === "Settings" && settingsCategory ? (
            <ChevronRight size={19} color={colors.green} />
          ) : (
            <Settings2 size={19} color={colors.green} />
          )}
        </IconButton>
      }
    >
      {tab === "Overview" ? (
        <>
          <View style={{ gap: 10, paddingVertical: 8 }}>
            <View style={[styles.row, { gap: 11 }]}>
              <CommunityAvatar iconKey={squad.icon_key} size={44} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={styles.h2} numberOfLines={1}>
                  {squad.name}
                </Text>
                <Txt muted>
                  {members.length} {members.length === 1 ? "member" : "members"}{" "}
                  ·{" "}
                  {squad.discoverability === "public"
                    ? "Public"
                    : squad.discoverability === "community"
                      ? "Community"
                      : "Private"}{" "}
                  Squad
                </Txt>
              </View>
            </View>
            <ProfileActions>
              <Button
                compact
                title="Chat"
                onPress={openChat}
                icon={<MessageCircle size={17} color={colors.ink} />}
              />
              <Button
                compact
                secondary
                title="Ping"
                onPress={openPing}
                icon={<Radio size={17} color={colors.green} />}
              />
              <Button
                compact
                secondary
                title="Beacon"
                onPress={openBeaconCreate}
              />
            </ProfileActions>
          </View>

          {overviewPreviews.length ? (
            <ProfileSection
              title="What's happening"
              action={
                <Button
                  compact
                  secondary
                  title="See all"
                  onPress={() => selectTab("Activity")}
                />
              }
            >
              {overviewPreviews.map((preview) => previewRow(preview))}
            </ProfileSection>
          ) : activities.length ? (
            <ProfileLink
              title="Activity history"
              detail="View past Squad Beacons"
              onPress={() => selectTab("Activity")}
            />
          ) : null}

          <CommunityPublicBeacons
            type="squad"
            entityId={activeSquadId}
            excludeActivityIds={overviewPreviews.flatMap((preview) =>
              preview.kind === "beacon" ? [preview.activity.id] : [],
            )}
          />

          <ProfileSection
            title={`Members · ${members.length}`}
            action={
              <Button
                compact
                secondary
                title="View members"
                onPress={() => selectTab("Members")}
              />
            }
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: "row",
                gap: 14,
                paddingVertical: 4,
              }}
            >
              {members.slice(0, 6).map(({ member, profile }) => (
                <Pressable
                  key={member.user_id}
                  accessibilityRole={profile ? "button" : undefined}
                  accessibilityLabel={
                    profile ? `View ${profile.name}'s profile` : "Squad member"
                  }
                  onPress={
                    profile
                      ? () =>
                          router.push({
                            pathname: "/person/[id]",
                            params: { id: member.user_id },
                          })
                      : undefined
                  }
                  style={{ width: 62, alignItems: "center", gap: 5 }}
                >
                  <ProfileAvatar profile={profile} size={42} />
                  <Text style={styles.muted} numberOfLines={1}>
                    {member.user_id === userId
                      ? "You"
                      : (profile?.name ?? "Member")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </ProfileSection>
          {relationshipSection()}
          {squad.description ? (
            <ProfileSection title="About">
              <Txt>{squad.description}</Txt>
            </ProfileSection>
          ) : null}
        </>
      ) : null}

      {tab === "Members" ? (
        <FlashList
          style={{ flex: 1, minHeight: 0 }}
          data={members.filter(
            ({ profile }) =>
              !memberSearch.trim() ||
              (!!profile &&
                matchesSearch(memberSearch, profile.name, profile.username)),
          )}
          keyExtractor={({ member }) => member.user_id}
          getItemType={() => "member"}
          extraData={`${userId}:${viewerRole ?? ""}:${memberToManage ?? ""}`}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <View style={{ gap: 8, paddingBottom: 8 }}>
              <View style={styles.card}>
                <Text style={styles.h2}>Squad members</Text>
                <Txt muted>
                  {members.length}{" "}
                  {members.length === 1 ? "current member" : "current members"}.
                  Names and photos follow each person’s profile privacy.
                </Txt>
              </View>
              {canInviteMembers ? (
                <View style={{ alignSelf: "flex-start" }}>
                  <Button
                    compact
                    secondary
                    title="Invite people"
                    onPress={() => selectTab("Invite")}
                  />
                </View>
              ) : null}
              {canReviewRequests && joinRequests.length ? (
                <View style={[styles.card, { gap: 9 }]}>
                  <Text style={styles.h2}>Join requests</Text>
                  {joinRequests.map((request) => {
                    const profile = data.profiles.find(
                      (item) => item.id === request.user_id,
                    );
                    const visible = !!(
                      profile && canViewProfile(data, profile, userId)
                    );
                    const name =
                      visible && profile ? profile.name : "Community member";
                    return (
                      <View
                        key={request.user_id}
                        style={[
                          styles.row,
                          { flexWrap: "wrap", justifyContent: "space-between" },
                        ]}
                      >
                        <Text style={[styles.body, { flex: 1 }]}>{name}</Text>
                        <Button
                          compact
                          title="Approve"
                          onPress={() =>
                            setPendingMemberAction({
                              kind: "approve",
                              userId: request.user_id,
                              name,
                            })
                          }
                        />
                        <Button
                          compact
                          secondary
                          title="Decline"
                          onPress={() =>
                            setPendingMemberAction({
                              kind: "decline",
                              userId: request.user_id,
                              name,
                            })
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {members.length > 8 ? (
                <Field
                  label="Search Squad members"
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Name or username"
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <Empty
              title="No members match"
              body="Try another name or username."
            />
          }
          renderItem={({ item: { member, profile } }) => {
            const isSelf = member.user_id === userId;
            const memberName = isSelf
              ? "You"
              : (profile?.name ?? "Squad member");
            const canRemove =
              member.role !== "owner" &&
              (isSelf ||
                isOwner ||
                (viewerRole === "admin" && member.role === "member"));
            const canManageRole =
              isAdmin &&
              member.role !== "owner" &&
              !!viewerRole &&
              SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[member.role] &&
              ["coowner", "admin", "elder", "member"].some(
                (candidate) =>
                  SOCIAL_ROLE_RANK[viewerRole] >
                  SOCIAL_ROLE_RANK[candidate as SocialMemberRole],
              );
            return (
              <View style={[styles.card, { gap: 9 }]}>
                <View style={styles.row}>
                  <ProfileAvatar profile={profile} size={42} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.body} numberOfLines={1}>
                      {memberName}
                    </Text>
                    <Text style={styles.muted}>
                      {member.role === "owner"
                        ? "Owner"
                        : member.role === "admin"
                          ? "Admin"
                          : "Member"}
                    </Text>
                  </View>
                  {profile && !isSelf ? (
                    <Button
                      compact
                      secondary
                      title="Profile"
                      onPress={() =>
                        router.push({
                          pathname: "/person/[id]",
                          params: { id: member.user_id },
                        })
                      }
                    />
                  ) : null}
                </View>
                {canManageRole ? (
                  <Button
                    compact
                    secondary
                    title="Manage role"
                    onPress={() => {
                      setMemberToManage(member.user_id);
                      setMemberRole(member.role as SocialMemberRole);
                    }}
                  />
                ) : null}
                {canRemove ? (
                  <Button
                    compact
                    secondary
                    title={isSelf ? "Leave" : "Remove"}
                    onPress={() =>
                      setPendingMemberAction({
                        kind: isSelf ? "leave" : "remove",
                        userId: member.user_id,
                        name: memberName,
                      })
                    }
                  />
                ) : null}
              </View>
            );
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      ) : null}

      {tab === "Invite" && canInviteMembers ? (
        <View style={[styles.card, { gap: 10 }]}>
          <Text style={styles.h2}>Invite an accepted friend</Text>
          <Txt muted>Invitations follow this Squad’s invite policy.</Txt>
          <Field
            label="Search friends"
            value={inviteSearch}
            onChangeText={(value) => {
              setInviteSearch(value);
              setInviteError("");
            }}
            placeholder="Name"
          />
          {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
          {!inviteCandidates.length ? (
            <Txt muted>No accepted friends available to invite.</Txt>
          ) : (
            inviteCandidates.map((profile) => {
              const visible = canViewProfile(data, profile, userId);
              return (
                <View
                  key={profile.id}
                  style={[styles.row, { justifyContent: "space-between" }]}
                >
                  <View style={[styles.row, { flex: 1 }]}>
                    <ProfileAvatar
                      profile={visible ? profile : undefined}
                      size={34}
                    />
                    <Text style={styles.body}>
                      {visible ? profile.name : "Friend"}
                    </Text>
                  </View>
                  <Action
                    compact
                    secondary
                    title={`Invite ${visible ? profile.name : "friend"}`}
                    run={async () => {
                      try {
                        await act("invite_squad", {
                          id: squad.id,
                          user_id: profile.id,
                        });
                      } catch (error) {
                        setInviteError(
                          error instanceof Error
                            ? error.message
                            : "Could not send invitation.",
                        );
                        throw error;
                      }
                    }}
                  />
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {tab === "Activity" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Activity history</Text>
            <Txt muted>
              Only Beacons this Squad can currently read appear here.
            </Txt>
          </View>
          {!activities.length ? (
            <Empty
              title="No visible Beacon history yet"
              body="Squad Beacons appear here when they are created and shared."
            />
          ) : (
            activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))
          )}
          <ProfileLink title="Beacon Plans" onPress={openPlans} />
          <Button
            compact
            secondary
            title="Create a Beacon"
            onPress={openBeaconCreate}
          />
        </>
      ) : null}

      {tab === "Settings" && !settingsCategory ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Squad settings</Text>
            <Txt muted>
              Your role: {isOwner ? "Owner" : (viewerRole ?? "Member")}
            </Txt>
          </View>
          {settingsCategories.map((category) => (
            <ProfileLink
              key={category}
              title={settingsCategoryLabels[category]}
              detail={
                category === "appearance"
                  ? "Squad icon"
                  : category === "details"
                    ? "Name and description"
                    : category === "policy"
                      ? "Discovery, joining, and invitations"
                      : category === "members"
                        ? `${members.length} current members`
                        : category === "connections"
                          ? `${relationshipRows.length} direct associations`
                          : "Favorites and membership actions"
              }
              onPress={() => openSettingsCategory(category)}
            />
          ))}
        </>
      ) : null}

      {tab === "Settings" && settingsCategory === "appearance" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Appearance</Text>
            <Txt muted>Choose the icon shown for this Squad.</Txt>
          </View>
          {isAdmin ? (
            <SquadIconPicker
              key={`${squad.id}:${squad.icon_key}`}
              squad={squad}
              onSave={(icon_key) =>
                act("update_squad_icon", { squad_id: squad.id, icon_key })
              }
            />
          ) : (
            <View style={[styles.card, styles.row]}>
              <CommunityAvatar iconKey={squad.icon_key} size={40} />
              <Txt muted>Only Squad admins can change its icon.</Txt>
            </View>
          )}
          <Button secondary title="Back to settings" onPress={backToSettings} />
        </>
      ) : null}

      {tab === "Settings" && settingsCategory === "details" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Squad details</Text>
            <Text style={styles.label}>NAME</Text>
            <Txt>{squad.name}</Txt>
            <Text style={styles.label}>DESCRIPTION</Text>
            <Txt>{squad.description || "No description set."}</Txt>
          </View>
          <Button secondary title="Back to settings" onPress={backToSettings} />
        </>
      ) : null}

      {tab === "Settings" && settingsCategory === "policy" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Access & membership</Text>
            <Txt muted>
              Your role: {isOwner ? "Owner" : (viewerRole ?? "Member")}
            </Txt>
          </View>
          {isAdmin && policyDraft ? (
            <View style={[styles.card, { gap: 12 }]}>
              <SocialPolicyFields
                value={policyDraft}
                onChange={changePolicyDraft}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Action
                  title="Save"
                  disabled={!policyDirty}
                  run={async () => {
                    await act("set_social_policy", {
                      entity_type: "squad",
                      entity_id: squad.id,
                      ...policyDraft,
                    });
                    setPolicyDraftState(null);
                  }}
                />
                <Button secondary title="Cancel" onPress={backToSettings} />
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Txt muted>
                {squad.discoverability === "public"
                  ? "Public"
                  : squad.discoverability === "community"
                    ? "Community"
                    : "Private"}{" "}
                discovery ·{" "}
                {squad.join_mode === "open"
                  ? "Anyone can join"
                  : squad.join_mode === "request"
                    ? "Request to join"
                    : "Invite only"}
              </Txt>
              <Txt muted>Only Squad admins can change access settings.</Txt>
            </View>
          )}
        </>
      ) : null}

      {tab === "Settings" && settingsCategory === "members" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Members</Text>
            <Txt muted>
              Current Squad membership is managed separately from Network and
              Organization connections.
            </Txt>
          </View>
          <ProfileLink
            title="View members"
            detail={`${members.length} current members`}
            onPress={() => selectTab("Members")}
          />
          {canInviteMembers ? (
            <ProfileLink
              title="Invite people"
              onPress={() => selectTab("Invite")}
            />
          ) : null}
        </>
      ) : null}

      {tab === "Settings" && settingsCategory === "connections" ? (
        <>
          {relationshipRows.length ? (
            relationshipSection("Direct associations")
          ) : (
            <Txt muted>No visible direct connections.</Txt>
          )}
          {isOwner && members.length >= 31 ? (
            <View style={{ gap: 8 }}>
              <Txt muted>
                {members.length} members · {squadSizeLabel(members.length)}.
                Group related Squads in an Organization.
              </Txt>
              <Button
                title="Organize as an Organization"
                onPress={openOrganizeSpace}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {tab === "Settings" && settingsCategory === "actions" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Actions</Text>
            <Txt muted>Favorite this Squad or manage your membership.</Txt>
          </View>
          <Button
            secondary
            title={starred ? "Remove Squad favorite" : "Favorite Squad"}
            onPress={() =>
              void act("favorite", {
                id: squad.id,
                kind: "squad",
                add: !starred,
              })
            }
          />
          {!isOwner ? (
            <Button
              secondary
              title="Leave Squad"
              onPress={() => setLeaveConfirmOpen(true)}
            />
          ) : (
            <View style={styles.card}>
              <Txt muted>The owner role stays with the Squad owner.</Txt>
            </View>
          )}
        </>
      ) : null}

      <ConfirmDialog
        title="Discard access changes?"
        visible={discardOpen}
        onClose={() => {
          setDiscardOpen(false);
          setPendingDestination(null);
          pendingRemoveAction.current = null;
        }}
        onConfirm={confirmDiscard}
        confirmLabel={"Discard changes"}
        cancelLabel={"Keep editing"}
        closeOnConfirm={false}
        destructive
      >
        <View style={{ gap: 10 }}>
          <Txt>Your access policy changes have not been saved.</Txt>
        </View>
      </ConfirmDialog>
      <ConfirmDialog
        title="Leave this Squad?"
        visible={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={async () => {
          await act("remove_member", { id: squad.id, user_id: userId });
          setLeaveConfirmOpen(false);
          router.replace("/(tabs)/squads");
        }}
        confirmLabel={"Leave Squad"}
        cancelLabel={"Cancel"}
        closeOnConfirm={false}
        destructive
      >
        <View style={{ gap: 10 }}>
          <Txt>
            You will lose access to this Squad’s chat, roster, and shared
            activity.
          </Txt>
        </View>
      </ConfirmDialog>
      <ConfirmDialog
        title={
          pendingMemberAction?.kind === "approve"
            ? "Approve join request?"
            : pendingMemberAction?.kind === "decline"
              ? "Decline join request?"
              : pendingMemberAction?.kind === "leave"
                ? "Leave this Squad?"
                : "Remove member?"
        }
        visible={!!pendingMemberAction}
        onClose={() => setPendingMemberAction(null)}
        onConfirm={async () => {
          const pending = pendingMemberAction;
          if (!pending) return;
          if (pending.kind === "approve")
            await act("approve_squad_join_request", {
              squad_id: squad.id,
              user_id: pending.userId,
            });
          else if (pending.kind === "decline")
            await act("deny_squad_join_request", {
              squad_id: squad.id,
              user_id: pending.userId,
            });
          else
            await act("remove_member", {
              id: squad.id,
              user_id: pending.userId,
            });
          setPendingMemberAction(null);
          if (pending.kind === "leave") router.replace("/(tabs)/squads");
        }}
        confirmLabel={
          pendingMemberAction?.kind === "approve"
            ? "Approve"
            : pendingMemberAction?.kind === "decline"
              ? "Decline"
              : pendingMemberAction?.kind === "leave"
                ? "Leave Squad"
                : "Remove member"
        }
        cancelLabel={"Cancel"}
        closeOnConfirm={false}
        destructive={pendingMemberAction?.kind !== "approve"}
      >
        {pendingMemberAction ? (
          <View style={{ gap: 10 }}>
            <Txt>
              {pendingMemberAction.kind === "approve"
                ? `${pendingMemberAction.name} will become a Squad member.`
                : pendingMemberAction?.kind === "decline"
                  ? `The join request from ${pendingMemberAction.name} will be declined.`
                  : pendingMemberAction?.kind === "leave"
                    ? "You will lose access to this Squad."
                    : `${pendingMemberAction.name} will lose access to this Squad.`}
            </Txt>
          </View>
        ) : null}
      </ConfirmDialog>

      <Sheet
        title="Organize this Squad as an Organization"
        visible={organizeOpen}
        onClose={() => setOrganizeOpen(false)}
      >
        <View style={{ gap: 12 }}>
          <Txt muted>
            This creates an Organization and links your existing Squad. Its
            chat, roster, and Beacon history stay with the Squad.
          </Txt>
          <Field
            label="Organization name"
            value={spaceName}
            onChangeText={setSpaceName}
            maxLength={60}
            placeholder="A shared home for your Squads"
          />
          <Field
            label="Description (optional)"
            value={spaceDescription}
            onChangeText={setSpaceDescription}
            maxLength={500}
            multiline
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Copy eligible Squad members into the Organization"
            accessibilityState={{ checked: copyMembers }}
            onPress={() => {
              setCopyMembers((value) => !value);
              setConfirmedCopy(false);
            }}
            style={[
              styles.row,
              {
                minHeight: 48,
                padding: 9,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 14,
              },
            ]}
          >
            <Check
              size={18}
              color={copyMembers ? colors.green : colors.muted}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.body}>
                Copy eligible members to the Organization
              </Text>
              <Text style={styles.muted}>
                {eligibleSpaceMembers.length} eligible current{" "}
                {eligibleSpaceMembers.length === 1 ? "member" : "members"}{" "}
                become active Organization members; this does not change Squad
                membership.
              </Text>
            </View>
          </Pressable>
          {copyMembers ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Confirm member copy"
              accessibilityState={{ checked: confirmedCopy }}
              onPress={() => setConfirmedCopy((value) => !value)}
              style={[
                styles.row,
                {
                  minHeight: 48,
                  padding: 9,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 14,
                },
              ]}
            >
              <Check
                size={18}
                color={confirmedCopy ? colors.green : colors.muted}
              />
              <Text style={[styles.body, { flex: 1 }]}>
                I confirm these members will also join the Organization.
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Rename the source Squad to General"
            accessibilityState={{ checked: renameGeneral }}
            onPress={() => setRenameGeneral((value) => !value)}
            style={[
              styles.row,
              {
                minHeight: 48,
                padding: 9,
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: 14,
              },
            ]}
          >
            <Check
              size={18}
              color={renameGeneral ? colors.green : colors.muted}
            />
            <Text style={[styles.body, { flex: 1 }]}>
              Rename this Squad “General” (optional)
            </Text>
          </Pressable>
          <Action
            title="Create Organization"
            disabled={!spaceName.trim() || (copyMembers && !confirmedCopy)}
            run={createSpaceFromSquad}
          />
        </View>
      </Sheet>
      <Sheet
        title="Manage Squad role"
        visible={!!memberToManage && assignableRoles.length > 0 && isAdmin}
        onClose={() => setMemberToManage(null)}
      >
        <Txt muted>
          Choose a role below your own. The owner role cannot be reassigned
          here.
        </Txt>
        <Chips
          options={assignableRoles}
          value={
            assignableRoles.includes(
              memberRole as (typeof assignableRoles)[number],
            )
              ? (memberRole as (typeof assignableRoles)[number])
              : assignableRoles[0]
          }
          onChange={setMemberRole}
          accessibilityPrefix="Squad member role"
        />
        <Action
          title="Save role"
          run={async () => {
            if (
              !memberToManage ||
              !selectedRoleMember ||
              !assignableRoles.includes(
                memberRole as (typeof assignableRoles)[number],
              )
            )
              throw new Error("That member role is no longer available.");
            await act("set_squad_member_role", {
              squad_id: squad.id,
              user_id: memberToManage,
              role: memberRole,
            });
            setMemberToManage(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}
