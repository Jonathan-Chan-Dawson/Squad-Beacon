import { CommunityAvatar } from "../components/CommunityAvatar";
import { SquadIconPicker } from "../components/SquadIconPicker";
import React, { useEffect, useId, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  CalendarClock,
  Check,
  CircleHelp,
  ChevronRight,
  Radio,
  MessageCircle,
  Settings2,
  Vote,
} from "lucide-react-native";
import {
  ProfileActions,
  ProfileLink,
  ProfileSection,
} from "@/src/features/people/components/ProfilePrimitives";
import { ActivityCard } from "@/src/features/beacons/ActivityCard";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { activityWhen, friendIds } from "@/src/shared/domain";
import { matchesSearch } from "@/src/shared/search";
import {
  canInviteWithPolicy,
  SOCIAL_ROLE_RANK,
} from "@/src/features/social/domain";
import { SocialPolicySettings } from "@/src/features/social/SocialPolicyControls";
import type { SocialMemberRole } from "@/src/features/social/types";
import { visibleSquadSpace } from "@/src/features/spaces/domain";
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
import {
  activeSquadDecision,
  canOpenSquadProfile,
  squadCurrentAndNextActivities,
  squadHistory,
  squadPlans,
  squadSizeLabel,
  visibleSquadMembers,
  visibleSquadOrganization,
} from "../squadProfile";

const tabs = ["Overview", "Members", "Activity", "Settings", "Invite"] as const;
type SquadTab = (typeof tabs)[number];

export default function SquadProfileScreen() {
  const pingSeed = useId();
  const { styles, colors } = useTheme();
  const {
    id,
    tab: tabParam,
    fromChat,
  } = useLocalSearchParams<{
    id?: string;
    tab?: string;
    fromChat?: string;
  }>();
  const squadId = Array.isArray(id) ? id[0] : id;
  const requestedTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const { data, userId, act } = useBeacon();
  const routeTab = tabs.find(
    (candidate) => candidate.toLowerCase() === requestedTab?.toLowerCase(),
  );
  const tab = routeTab ?? "Overview";
  const selectTab = (value: SquadTab) =>
    router.push({
      pathname: "/squad/[id]",
      params: { id: squadId!, tab: value, ...(fromChat ? { fromChat } : {}) },
    });
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [copyMembers, setCopyMembers] = useState(true);
  const [confirmedCopy, setConfirmedCopy] = useState(false);
  const [renameGeneral, setRenameGeneral] = useState(true);
  const [growthDismissal, setGrowthDismissal] = useState<{
    key: string;
    dismissed: boolean;
  } | null>(null);
  const [memberToManage, setMemberToManage] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<SocialMemberRole>("member");
  const setSpacePreviewId = (id: string) =>
    router.push({ pathname: "/space/[id]", params: { id } });
  const squad =
    squadId && canOpenSquadProfile(data, squadId, userId)
      ? data.squads.find((item) => item.id === squadId)
      : undefined;
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
  const connectedSpace = squad
    ? visibleSquadSpace(data, squad.id, userId)
    : undefined;
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
  const currentNext =
    squad && userId
      ? squadCurrentAndNextActivities(data, squad.id, userId)
      : { current: undefined, next: undefined };
  const plans = squad && userId ? squadPlans(data, squad.id, userId) : [];
  const decision =
    squad && userId ? activeSquadDecision(data, squad.id, userId) : undefined;
  const organization = squad
    ? visibleSquadOrganization(data, squad.id, userId)
    : undefined;
  const memberUserIds = new Set(
    data.squad_members
      .filter((member) => member.squad_id === squad?.id)
      .map((member) => member.user_id),
  );
  const acceptedFriends = userId ? friendIds(data, userId) : [];
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

  const growthDismissalKey =
    userId && squadId
      ? `beacon.growth.organize-organization.dismissed.${userId}.${squadId}`.replace(
          /[^A-Za-z0-9._-]/g,
          "_",
        )
      : "";
  useEffect(() => {
    if (!growthDismissalKey) return;
    let current = true;
    const read =
      Platform.OS === "web"
        ? Promise.resolve().then(() => localStorage.getItem(growthDismissalKey))
        : SecureStore.getItemAsync(growthDismissalKey);
    void read
      .then((value) => {
        if (current)
          setGrowthDismissal({
            key: growthDismissalKey,
            dismissed: value === "true",
          });
      })
      .catch(() => {
        if (current)
          setGrowthDismissal({ key: growthDismissalKey, dismissed: false });
      });
    return () => {
      current = false;
    };
  }, [growthDismissalKey]);

  if (!squad || !userId || !squadId) {
    return (
      <Screen title="Squad unavailable" eyebrow="SQUAD PROFILE" create={false}>
        <Empty
          title="This Squad profile is unavailable."
          body="Only current members can open it. Membership or access may have changed."
        />
        <Button
          title="Back to Squads"
          onPress={() => router.replace("/(tabs)/squads")}
        />
      </Screen>
    );
  }
  const activeSquadId = squad.id;

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

  async function dismissGrowthSuggestion() {
    if (!growthDismissalKey) return;
    setGrowthDismissal({ key: growthDismissalKey, dismissed: true });
    try {
      if (Platform.OS === "web")
        localStorage.setItem(growthDismissalKey, "true");
      else await SecureStore.setItemAsync(growthDismissalKey, "true");
    } catch {
      // Keep the suggestion dismissed for this session if device storage is unavailable.
    }
  }

  return (
    <Screen
      title={
        tab === "Overview"
          ? squad.name
          : tab === "Activity"
            ? "Beacons & Plans"
            : tab === "Members"
              ? "Squad members"
              : tab === "Invite"
                ? "Invite friends"
                : "Squad settings"
      }
      eyebrow={tab === "Overview" ? "SQUAD INFO" : squad.name}
      showDemoNotice={false}
      create={false}
      headerAction={
        <IconButton
          label="Squad settings"
          onPress={() => selectTab("Settings")}
        >
          <Settings2 size={19} color={colors.green} />
        </IconButton>
      }
    >
      {tab === "Overview" ? (
        <>
          <View style={{ gap: 12 }}>
            <View style={[styles.row, { gap: 12 }]}>
              <CommunityAvatar iconKey={squad.icon_key} size={52} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={styles.h2}>
                  {members.length} {members.length === 1 ? "member" : "members"}
                </Text>
                <Txt muted>
                  {squad.discoverability === "public" ? "Public" : "Private"}{" "}
                  Squad
                </Txt>
              </View>
            </View>
            <ProfileActions>
              {fromChat !== "yes" ? (
                <Button
                  compact
                  title="Chat"
                  onPress={openChat}
                  icon={<MessageCircle size={17} color={colors.ink} />}
                />
              ) : null}
              <Button
                compact
                secondary={fromChat !== "yes"}
                title="Ping"
                onPress={openPing}
                icon={
                  <Radio
                    size={17}
                    color={fromChat === "yes" ? colors.ink : colors.green}
                  />
                }
              />
              <Button
                compact
                secondary
                title="Beacon"
                onPress={openBeaconCreate}
              />
              {canInviteMembers ? (
                <Button
                  compact
                  secondary
                  title="Invite"
                  onPress={() => selectTab("Invite")}
                />
              ) : null}
            </ProfileActions>
          </View>

          {isOwner &&
          members.length >= 31 &&
          growthDismissal?.key === growthDismissalKey &&
          !growthDismissal.dismissed ? (
            <View style={[styles.card, { gap: 9 }]}>
              <Text style={styles.h2}>Your Squad is growing</Text>
              <Txt>
                {members.length} members · {squadSizeLabel(members.length)}. An
                Organization can group related Squads without changing this
                Squad’s history.
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button
                  compact
                  title="Organize as an Organization"
                  onPress={openOrganizeSpace}
                />
                <Button
                  compact
                  secondary
                  title="Not now"
                  onPress={() => void dismissGrowthSuggestion()}
                />
              </View>
            </View>
          ) : null}

          {connectedSpace ? (
            <ProfileLink
              title={connectedSpace.name}
              detail="Organization"
              label={`Open Organization ${connectedSpace.name}`}
              onPress={() => setSpacePreviewId(connectedSpace.id)}
            />
          ) : null}
          {organization ? (
            <ProfileLink
              title={organization.name}
              detail="Super-Organization"
              label={`Open super-organization ${organization.name}`}
              onPress={() =>
                router.push({
                  pathname: "/organization/[id]",
                  params: { id: organization.id },
                })
              }
            />
          ) : null}
          {currentNext.current || currentNext.next ? (
            <ProfileSection
              title={currentNext.current ? "Current Beacon" : "Next Beacon"}
            >
              {[currentNext.current, currentNext.next]
                .filter((activity) => !!activity)
                .map((activity) => (
                  <ProfileLink
                    key={activity.id}
                    title={activity.title}
                    detail={`${activity === currentNext.next && currentNext.current ? "Next · " : ""}${activityWhen(activity)}`}
                    icon={<CalendarClock size={20} color={colors.green} />}
                    label={`${activity === currentNext.current ? "Current" : "Next"} Beacon: ${activity.title}`}
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

          {plans[0] ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Beacon Plan ${plans[0].plan.title}`}
              onPress={() =>
                router.push({
                  pathname: "/plan/[id]",
                  params: { id: plans[0].plan.id },
                })
              }
              style={[styles.card, { gap: 4 }]}
            >
              <Text style={styles.h2}>Beacon Plan</Text>
              <Text style={styles.body}>{plans[0].plan.title}</Text>
              <Txt muted>
                {plans[0].routine
                  ? `Routine · next ${plans[0].routine.next_occurrence_on ?? "date to be set"}`
                  : `Starts ${plans[0].plan.start_date}`}
              </Txt>
              <Text style={[styles.body, { color: colors.green }]}>
                Open plan
              </Text>
            </Pressable>
          ) : null}

          {decision ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${decision.kind}: ${decision.title}`}
              onPress={() =>
                router.push({
                  pathname: "/council/[id]",
                  params: { id: decision.id },
                })
              }
              style={[styles.card, styles.row]}
            >
              {decision.kind === "ping" ? (
                <CircleHelp size={19} color={colors.green} />
              ) : (
                <Vote size={19} color={colors.green} />
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.label}>
                  ACTIVE {decision.kind.toUpperCase()}
                </Text>
                <Text style={styles.body}>{decision.title}</Text>
              </View>
              <Text style={[styles.body, { color: colors.green }]}>Open</Text>
            </Pressable>
          ) : null}
          <ProfileLink
            title="Beacons & Plans"
            detail={
              activities.length
                ? `${activities.length} shared Beacons`
                : "Plan something together"
            }
            onPress={() => selectTab("Activity")}
          />
          <ProfileSection
            title="Members"
            action={
              members.length > 4 || isAdmin || canInviteMembers ? (
                <Button
                  compact
                  secondary
                  title="See all members"
                  onPress={() => selectTab("Members")}
                />
              ) : undefined
            }
          >
            {members.slice(0, 4).map(({ member, profile }) => (
              <Pressable
                key={member.user_id}
                accessibilityRole={profile ? "button" : undefined}
                accessibilityLabel={
                  profile ? `View ${profile.name}'s profile` : undefined
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
                style={[styles.row, { minHeight: 48 }]}
              >
                <ProfileAvatar profile={profile} size={36} />
                <Text style={[styles.body, { flex: 1 }]}>
                  {member.user_id === userId
                    ? "You"
                    : (profile?.name ?? "Squad member")}
                </Text>
                {profile ? (
                  <ChevronRight size={17} color={colors.muted} />
                ) : null}
              </Pressable>
            ))}
          </ProfileSection>
          {squad.description ? (
            <ProfileSection title="About">
              <Txt>{squad.description}</Txt>
            </ProfileSection>
          ) : null}
        </>
      ) : null}

      {tab === "Members" ? (
        <>
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
                return (
                  <View
                    key={request.user_id}
                    style={[
                      styles.row,
                      { flexWrap: "wrap", justifyContent: "space-between" },
                    ]}
                  >
                    <Text style={[styles.body, { flex: 1 }]}>
                      {visible && profile ? profile.name : "Community member"}
                    </Text>
                    <Action
                      compact
                      title="Approve"
                      run={() =>
                        act("approve_squad_join_request", {
                          squad_id: squad.id,
                          user_id: request.user_id,
                        })
                      }
                    />
                    <Action
                      compact
                      secondary
                      title="Decline"
                      run={() =>
                        act("deny_squad_join_request", {
                          squad_id: squad.id,
                          user_id: request.user_id,
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
          {members
            .filter(
              ({ profile }) =>
                !memberSearch.trim() ||
                (!!profile &&
                  matchesSearch(memberSearch, profile.name, profile.username)),
            )
            .map(({ member, profile }) => {
              const isSelf = member.user_id === userId;
              const canRemove =
                member.role !== "owner" &&
                (isSelf ||
                  isOwner ||
                  (viewerRole === "admin" && member.role === "member"));
              return (
                <View key={member.user_id} style={[styles.card, { gap: 9 }]}>
                  <View style={styles.row}>
                    <ProfileAvatar profile={profile} size={42} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.body} numberOfLines={1}>
                        {isSelf ? "You" : (profile?.name ?? "Squad member")}
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
                  {isAdmin &&
                  member.role !== "owner" &&
                  SOCIAL_ROLE_RANK[viewerRole] >
                    SOCIAL_ROLE_RANK[member.role] &&
                  ["coowner", "admin", "elder", "member"].some(
                    (candidate) =>
                      SOCIAL_ROLE_RANK[viewerRole] >
                      SOCIAL_ROLE_RANK[candidate as SocialMemberRole],
                  ) ? (
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
                    <Action
                      compact
                      secondary
                      title={isSelf ? "Leave" : "Remove"}
                      run={() =>
                        act("remove_member", {
                          id: squad.id,
                          user_id: member.user_id,
                        })
                      }
                    />
                  ) : null}
                </View>
              );
            })}
        </>
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

      {tab === "Settings" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Squad settings</Text>
            <Txt>{squad.description || "No description set."}</Txt>
            <Txt muted>
              Your role: {isOwner ? "Owner" : (viewerRole ?? "Member")}
            </Txt>
            <Txt muted>
              Squad name and description can’t be edited from this app yet.
            </Txt>
          </View>
          {isAdmin && (
            <>
              <SquadIconPicker
                key={`${squad.id}:${squad.icon_key}`}
                squad={squad}
                onSave={(icon_key) =>
                  act("update_squad_icon", { squad_id: squad.id, icon_key })
                }
              />
              <View style={[styles.card, { gap: 10 }]}>
                <Text style={styles.h2}>Access & membership</Text>
                <SocialPolicySettings
                  key={`${squad.id}:${squad.discoverability ?? "private"}:${squad.join_mode ?? "invite"}:${squad.invite_policy ?? "admins"}`}
                  entityType="squad"
                  initial={{
                    discoverability: squad.discoverability ?? "private",
                    join_mode: squad.join_mode ?? "invite",
                    invite_policy: squad.invite_policy ?? "admins",
                  }}
                  onSave={(policy) =>
                    act("set_social_policy", {
                      entity_type: "squad",
                      entity_id: squad.id,
                      ...policy,
                    })
                  }
                />
              </View>
            </>
          )}
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
          {isAdmin ? (
            <Button
              secondary
              title="Manage members and invitations"
              onPress={() => selectTab("Members")}
            />
          ) : null}
          {!isOwner ? (
            <Action
              title="Leave Squad"
              secondary
              run={() =>
                act("remove_member", { id: squad.id, user_id: userId })
              }
            />
          ) : (
            <View style={styles.card}>
              <Txt muted>
                The owner role stays with the Squad owner. Transfer or delete
                controls aren’t available.
              </Txt>
            </View>
          )}
        </>
      ) : null}

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
