import React, { useEffect, useId, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  CalendarClock,
  Check,
  CircleHelp,
  History,
  Info,
  MessageCircle,
  Settings2,
  UsersRound,
  Vote,
} from "lucide-react-native";
import { ActivityCard } from "@/src/features/beacons/ActivityCard";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { friendIds } from "@/src/shared/domain";
import { matchesSearch } from "@/src/shared/search";
import { canInviteWithPolicy, SOCIAL_ROLE_RANK } from "@/src/features/social/domain";
import { SocialPolicySettings } from "@/src/features/social/SocialPolicyControls";
import type { SocialMemberRole } from "@/src/features/social/types";
import { SpaceProfilePreview } from "@/src/features/spaces/SpaceProfilePreview";
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

const tabs = ["Overview", "Members", "Activity", "Settings"] as const;
type SquadTab = (typeof tabs)[number];
const tabIcons = {
  Overview: Info,
  Members: UsersRound,
  Activity: History,
  Settings: Settings2,
} satisfies Record<SquadTab, typeof Info>;

export default function SquadProfileScreen() {
  const pingSeed = useId();
  const { styles, colors } = useTheme();
  const { id, tab: tabParam } = useLocalSearchParams<{
    id?: string;
    tab?: string;
  }>();
  const squadId = Array.isArray(id) ? id[0] : id;
  const requestedTab = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  const { data, userId, act } = useBeacon();
  const routeTab = tabs.find(
    (candidate) => candidate.toLowerCase() === requestedTab?.toLowerCase(),
  );
  const [tabChoice, setTabChoice] = useState<{
    route: string | undefined;
    value: SquadTab;
  }>({ route: requestedTab, value: routeTab ?? "Overview" });
  const tab = tabChoice.route === requestedTab
    ? tabChoice.value
    : routeTab ?? "Overview";
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
  const [spacePreviewId, setSpacePreviewId] = useState<string | null>(null);
  const squad = squadId && canOpenSquadProfile(data, squadId, userId)
    ? data.squads.find((item) => item.id === squadId)
    : undefined;
  const viewerRole = data.squad_members.find(
    (member) => member.squad_id === squadId && member.user_id === userId,
  )?.role;
  const isOwner = viewerRole === "owner";
  const isAdmin = !!viewerRole && SOCIAL_ROLE_RANK[viewerRole] >= SOCIAL_ROLE_RANK.admin;
  const canInviteMembers = !!squad && canInviteWithPolicy(viewerRole ?? null, squad.invite_policy);
  const canReviewRequests = !!viewerRole && SOCIAL_ROLE_RANK[viewerRole] >= SOCIAL_ROLE_RANK.admin;
  const joinRequests = squad
    ? data.squad_join_requests.filter((request) => request.squad_id === squad.id)
    : [];
  const members = squad && userId
    ? visibleSquadMembers(data, squad.id, userId)
    : [];
  const selectedRoleMember = members.find(({ member }) => member.user_id === memberToManage)?.member;
  const connectedSpace = squad ? visibleSquadSpace(data, squad.id, userId) : undefined;
  const assignableRoles = selectedRoleMember && viewerRole
    ? (["coowner", "admin", "elder", "member"] as const).filter(
        (candidate) =>
          SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[selectedRoleMember.role] &&
          SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[candidate],
      )
    : [];
  const eligibleSpaceMembers = squad && userId
    ? data.squad_members.filter((member) =>
        member.squad_id === squad.id &&
        member.user_id !== squad.owner_id &&
        !data.blocks.some(
          (block) =>
            (block.blocker_id === userId && block.blocked_id === member.user_id) ||
            (block.blocked_id === userId && block.blocker_id === member.user_id),
        ) &&
        !data.squad_bans.some(
          (ban) => ban.squad_id === squad.id && ban.user_id === member.user_id,
        ),
      )
    : [];
  const activities = squad && userId
    ? squadHistory(data, squad.id, userId)
    : [];
  const currentNext = squad && userId
    ? squadCurrentAndNextActivities(data, squad.id, userId)
    : { current: undefined, next: undefined };
  const plans = squad && userId ? squadPlans(data, squad.id, userId) : [];
  const decision = squad && userId
    ? activeSquadDecision(data, squad.id, userId)
    : undefined;
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

  const growthDismissalKey = userId && squadId
    ? `beacon.growth.organize-space.dismissed.${userId}.${squadId}`.replace(/[^A-Za-z0-9._-]/g, "_")
    : "";
  useEffect(() => {
    if (!growthDismissalKey) return;
    let current = true;
    const read = Platform.OS === "web"
      ? Promise.resolve().then(() => localStorage.getItem(growthDismissalKey))
      : SecureStore.getItemAsync(growthDismissalKey);
    void read.then((value) => {
      if (current) setGrowthDismissal({ key: growthDismissalKey, dismissed: value === "true" });
    }).catch(() => {
      if (current) setGrowthDismissal({ key: growthDismissalKey, dismissed: false });
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
        <Button title="Back to Squads" onPress={() => router.replace("/(tabs)/squads")} />
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
    router.push({ pathname: "/squad-chat/[id]", params: { id: activeSquadId } });
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
    setSpaceName(`${squad?.name ?? ""} Space`.trim());
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
    const id = typeof result.space_id === "string"
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
      if (Platform.OS === "web") localStorage.setItem(growthDismissalKey, "true");
      else await SecureStore.setItemAsync(growthDismissalKey, "true");
    } catch {
      // Keep the suggestion dismissed for this session if device storage is unavailable.
    }
  }

  return (
    <Screen
      title={squad.name}
      eyebrow="SQUAD PROFILE"
      create={false}
      headerAction={
        <IconButton label="Open Squad chat" onPress={openChat}>
          <MessageCircle size={19} color={colors.green} />
        </IconButton>
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Squads"
        onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/squads")}
        style={styles.row}
      >
        <Text style={[styles.muted, { textDecorationLine: "underline" }]}>Back to Squads</Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {tabs.map((value) => {
          const selected = tab === value;
          const Icon = tabIcons[value];
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={value}
              accessibilityState={{ selected }}
              onPress={() => setTabChoice({ route: requestedTab, value })}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 50,
                borderRadius: 15,
                borderWidth: 1,
                borderColor: selected ? colors.ink : colors.line,
                backgroundColor: selected ? colors.ink : colors.white,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <Icon size={16} color={selected ? colors.white : colors.green} />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: selected ? colors.white : colors.muted,
                }}
              >
                {value}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "Overview" ? (
        <>
          <View style={[styles.card, { gap: 10 }]}>
            <Text style={styles.h2}>{squad.name}</Text>
            <Txt>{squad.description || "A place for making plans together."}</Txt>
            <Txt muted>
              {members.length} {members.length === 1 ? "member" : "members"} · {squadSizeLabel(members.length)} · {squad.discoverability ?? "private"} · {squad.join_mode ?? "invite"} to join
            </Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button compact title="Squad chat" onPress={openChat} />
              <Button compact secondary title="Create Beacon" onPress={openBeaconCreate} />
              <Button compact secondary title="Beacon Plans" onPress={openPlans} />
              <Button compact secondary title="Ping" onPress={openPing} />
            </View>
          </View>

          {isOwner && members.length >= 31 &&
          growthDismissal?.key === growthDismissalKey && !growthDismissal.dismissed ? (
            <View style={[styles.card, { gap: 9 }]}>
              <Text style={styles.h2}>Your Squad is growing</Text>
              <Txt>
                {members.length} members · {squadSizeLabel(members.length)}. A Space can group related Squads without changing this Squad’s history.
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button compact title="Organize as a Space" onPress={openOrganizeSpace} />
                <Button compact secondary title="Not now" onPress={() => void dismissGrowthSuggestion()} />
              </View>
            </View>
          ) : null}

          {organization ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open organization ${organization.name}`}
              onPress={() => router.push({ pathname: "/organization/[id]", params: { id: organization.id } })}
              style={[styles.card, styles.between]}
            >
              <View style={{ gap: 3, flex: 1 }}>
                <Text style={styles.label}>CONNECTED ORGANIZATION</Text>
                <Text style={styles.body}>{organization.name}</Text>
              </View>
              <Text style={[styles.body, { color: colors.green }]}>Open</Text>
            </Pressable>
          ) : null}

          {connectedSpace ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Preview Space ${connectedSpace.name}`}
              onPress={() => setSpacePreviewId(connectedSpace.id)}
              style={[styles.card, styles.between]}
            >
              <View style={{ gap: 3, flex: 1 }}>
                <Text style={styles.label}>CONNECTED SPACE</Text>
                <Text style={styles.body}>{connectedSpace.name}</Text>
              </View>
              <Text style={[styles.body, { color: colors.green }]}>Preview</Text>
            </Pressable>
          ) : null}

          {currentNext.current || currentNext.next ? (
            <View style={[styles.card, { gap: 8 }]}>
              <Text style={styles.h2}>Current and next Beacon</Text>
              {(
                [
                  ["Current Beacon", currentNext.current],
                  ["Next Beacon", currentNext.next],
                ] as const
              ).map(([label, activity]) =>
                activity ? (
                  <Pressable
                    key={activity.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}: ${activity.title}`}
                    onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
                    style={{ gap: 4 }}
                  >
                    <Text style={styles.label}>{label.toUpperCase()}</Text>
                    <Text style={styles.body}>{activity.title}</Text>
                    <View style={styles.row}>
                      <CalendarClock size={15} color={colors.green} />
                      <Text style={styles.muted}>{new Date(activity.starts_at).toLocaleString()}</Text>
                    </View>
                  </Pressable>
                ) : null,
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.h2}>No upcoming Beacon</Text>
              <Txt muted>Start a new shared plan when the Squad is ready.</Txt>
            </View>
          )}

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
              <Text style={[styles.body, { color: colors.green }]}>Open plan</Text>
            </Pressable>
          ) : null}

          {decision ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${decision.kind}: ${decision.title}`}
              onPress={() => router.push({ pathname: "/council/[id]", params: { id: decision.id } })}
              style={[styles.card, styles.row]}
            >
              {decision.kind === "ping" ? <CircleHelp size={19} color={colors.green} /> : <Vote size={19} color={colors.green} />}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.label}>ACTIVE {decision.kind.toUpperCase()}</Text>
                <Text style={styles.body}>{decision.title}</Text>
              </View>
              <Text style={[styles.body, { color: colors.green }]}>Open</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {tab === "Members" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Squad members</Text>
            <Txt muted>
              {members.length} {members.length === 1 ? "current member" : "current members"}. Names and photos follow each person’s profile privacy.
            </Txt>
          </View>
          {canReviewRequests && joinRequests.length ? (
            <View style={[styles.card, { gap: 9 }]}>
              <Text style={styles.h2}>Join requests</Text>
              {joinRequests.map((request) => {
                const profile = data.profiles.find((item) => item.id === request.user_id);
                const visible = !!(profile && canViewProfile(data, profile, userId));
                return (
                  <View key={request.user_id} style={[styles.row, { flexWrap: "wrap", justifyContent: "space-between" }]}>
                    <Text style={[styles.body, { flex: 1 }]}>{visible && profile ? profile.name : "Community member"}</Text>
                    <Action compact title="Approve" run={() => act("approve_squad_join_request", { squad_id: squad.id, user_id: request.user_id })} />
                    <Action compact secondary title="Decline" run={() => act("deny_squad_join_request", { squad_id: squad.id, user_id: request.user_id })} />
                  </View>
                );
              })}
            </View>
          ) : null}
          {members.map(({ member, profile }) => {
            const isSelf = member.user_id === userId;
            const canRemove =
              member.role !== "owner" &&
              (isSelf || isOwner || (viewerRole === "admin" && member.role === "member"));
            return (
              <View key={member.user_id} style={[styles.card, { gap: 9 }]}>
                <View style={styles.row}>
                  <ProfileAvatar profile={profile} size={42} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={styles.body} numberOfLines={1}>
                      {isSelf ? "You" : profile?.name ?? "Squad member"}
                    </Text>
                    <Text style={styles.muted}>{member.role === "owner" ? "Owner" : member.role === "admin" ? "Admin" : "Member"}</Text>
                  </View>
                  {profile && !isSelf ? (
                    <Button compact secondary title="Profile" onPress={() => router.push({ pathname: "/person/[id]", params: { id: member.user_id } })} />
                  ) : null}
                </View>
                {isAdmin && member.role !== "owner" &&
                SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[member.role] &&
                ["coowner", "admin", "elder", "member"].some((candidate) =>
                  SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[candidate as SocialMemberRole],
                ) ? (
                  <Button compact secondary title="Manage role" onPress={() => {
                    setMemberToManage(member.user_id);
                    setMemberRole(member.role as SocialMemberRole);
                  }} />
                ) : null}
                {canRemove ? (
                  <Action
                    compact
                    secondary
                    title={isSelf ? "Leave" : "Remove"}
                    run={() => act("remove_member", { id: squad.id, user_id: member.user_id })}
                  />
                ) : null}
              </View>
            );
          })}
          {canInviteMembers ? (
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
              ) : inviteCandidates.map((profile) => {
                const visible = canViewProfile(data, profile, userId);
                return (
                  <View key={profile.id} style={[styles.row, { justifyContent: "space-between" }]}>
                    <View style={[styles.row, { flex: 1 }]}>
                      <ProfileAvatar profile={visible ? profile : undefined} size={34} />
                      <Text style={styles.body}>{visible ? profile.name : "Friend"}</Text>
                    </View>
                    <Action
                      compact
                      secondary
                      title={`Invite ${visible ? profile.name : "friend"}`}
                      run={async () => {
                        try {
                          await act("invite_squad", { id: squad.id, user_id: profile.id });
                        } catch (error) {
                          setInviteError(error instanceof Error ? error.message : "Could not send invitation.");
                          throw error;
                        }
                      }}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}

      {tab === "Activity" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Activity history</Text>
            <Txt muted>Only Beacons this Squad can currently read appear here.</Txt>
          </View>
          {!activities.length ? (
            <Empty title="No visible Beacon history yet" body="Squad Beacons appear here when they are created and shared." />
          ) : activities.map((activity) => <ActivityCard key={activity.id} activity={activity} />)}
          <Button secondary title="Create a Beacon" onPress={openBeaconCreate} />
        </>
      ) : null}

      {tab === "Settings" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.h2}>Squad settings</Text>
            <Txt>{squad.description || "No description set."}</Txt>
            <Txt muted>Your role: {isOwner ? "Owner" : viewerRole ?? "Member"}</Txt>
            <Txt muted>Squad name and description can’t be edited from this app yet.</Txt>
          </View>
          {isAdmin && (
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
                onSave={(policy) => act("set_social_policy", { entity_type: "squad", entity_id: squad.id, ...policy })}
              />
            </View>
          )}
          <Button
            secondary
            title={starred ? "Remove Squad favorite" : "Favorite Squad"}
            onPress={() => void act("favorite", { id: squad.id, kind: "squad", add: !starred })}
          />
          {isAdmin ? (
            <Button secondary title="Manage members and invitations" onPress={() => setTabChoice({ route: requestedTab, value: "Members" })} />
          ) : null}
          {!isOwner ? (
            <Action
              title="Leave Squad"
              secondary
              run={() => act("remove_member", { id: squad.id, user_id: userId })}
            />
          ) : (
            <View style={styles.card}>
              <Txt muted>The owner role stays with the Squad owner. Transfer or delete controls aren’t available.</Txt>
            </View>
          )}
        </>
      ) : null}

      <Sheet
        title="Organize this Squad as a Space"
        visible={organizeOpen}
        onClose={() => setOrganizeOpen(false)}
      >
        <View style={{ gap: 12 }}>
          <Txt muted>
            This creates a Space and links your existing Squad. Its chat, roster, and Beacon history stay with the Squad.
          </Txt>
          <Field
            label="Space name"
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
            accessibilityLabel="Copy eligible Squad members into the Space"
            accessibilityState={{ checked: copyMembers }}
            onPress={() => {
              setCopyMembers((value) => !value);
              setConfirmedCopy(false);
            }}
            style={[styles.row, { minHeight: 48, padding: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }]}
          >
            <Check size={18} color={copyMembers ? colors.green : colors.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.body}>Copy eligible members to the Space</Text>
              <Text style={styles.muted}>
                {eligibleSpaceMembers.length} eligible current {eligibleSpaceMembers.length === 1 ? "member" : "members"} become active Space members; this does not change Squad membership.
              </Text>
            </View>
          </Pressable>
          {copyMembers ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Confirm member copy"
              accessibilityState={{ checked: confirmedCopy }}
              onPress={() => setConfirmedCopy((value) => !value)}
              style={[styles.row, { minHeight: 48, padding: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }]}
            >
              <Check size={18} color={confirmedCopy ? colors.green : colors.muted} />
              <Text style={[styles.body, { flex: 1 }]}>I confirm these members will also join the Space.</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Rename the source Squad to General"
            accessibilityState={{ checked: renameGeneral }}
            onPress={() => setRenameGeneral((value) => !value)}
            style={[styles.row, { minHeight: 48, padding: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }]}
          >
            <Check size={18} color={renameGeneral ? colors.green : colors.muted} />
            <Text style={[styles.body, { flex: 1 }]}>Rename this Squad “General” (optional)</Text>
          </Pressable>
          <Action
            title="Create Space"
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
        <Txt muted>Choose a role below your own. The owner role cannot be reassigned here.</Txt>
        <Chips
          options={assignableRoles}
          value={assignableRoles.includes(memberRole as (typeof assignableRoles)[number]) ? memberRole as (typeof assignableRoles)[number] : assignableRoles[0]}
          onChange={setMemberRole}
          accessibilityPrefix="Squad member role"
        />
        <Action
          title="Save role"
          run={async () => {
            if (!memberToManage || !selectedRoleMember || !assignableRoles.includes(memberRole as (typeof assignableRoles)[number]))
              throw new Error("That member role is no longer available.");
            await act("set_squad_member_role", { squad_id: squad.id, user_id: memberToManage, role: memberRole });
            setMemberToManage(null);
          }}
        />
      </Sheet>
      {spacePreviewId ? (
        <SpaceProfilePreview
          spaceId={spacePreviewId}
          visible
          onClose={() => setSpacePreviewId(null)}
        />
      ) : null}
    </Screen>
  );
}
