import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  CalendarDays,
  ChevronRight,
  Compass,
  House,
  Layers3,
  MoreHorizontal,
  Plus,
  Users,
  UserPlus,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { friendIds } from "@/src/shared/domain";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { matchesSearch } from "@/src/shared/search";
import { canViewProfile } from "@/src/features/profile/privacy";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { SquadProfilePreview } from "@/src/features/people/previews/SquadProfilePreview";
import { PersonProfilePreview } from "@/src/features/people/previews/PersonProfilePreview";
import { OrganizationProfilePreview } from "@/src/features/organizations/OrganizationProfilePreview";
import { SpaceProfilePreview } from "./SpaceProfilePreview";
import { SocialDirectoryResults } from "@/src/features/people/SocialDirectoryResults";
import { activeSquadMembership } from "@/src/features/people/squadProfile";
import { canInviteWithPolicy, SOCIAL_ROLE_RANK } from "@/src/features/social/domain";
import { SocialPolicySettings } from "@/src/features/social/SocialPolicyControls";
import { MotionPressable } from "@/src/shared/MotionPressable";
import {
  Action,
  Avatar,
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
  activeSpaceRole,
  canInviteSpaceMember,
  canManageSpace,
  canManageSpaceMember,
  canReadSpace,
  visibleSpaceSquads,
} from "./domain";
import type { SpaceMemberRole } from "./types";

export default function SpaceScreen() {
  const params = useLocalSearchParams<{ id?: string; tab?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, userId, act } = useBeacon();
  const { styles, colors } = useTheme();
  const [menu, setMenu] = useState<"invite" | "squads" | "settings" | null>(
    null,
  );
  const [tab, setTab] = useState<"overview" | "squads" | "activity" | "members">(
    params.tab === "squads" || params.tab === "activity" || params.tab === "members"
      ? params.tab
      : "overview",
  );
  const [personId, setPersonId] = useState<string | null>(null);
  const [squadId, setSquadId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [otherSpaceId, setOtherSpaceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [squadSearch, setSquadSearch] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberRole, setEditingMemberRole] = useState<SpaceMemberRole>("member");
  const space =
    id && canReadSpace(data, id, userId)
      ? data.spaces.find(
          (row) =>
            row.id === id &&
            !!userId &&
            !!activeSpaceRole(row, data.space_members, userId),
        )
      : undefined;
  if (!space || !id)
    return (
      <Screen title="Space unavailable" eyebrow="">
        <Empty
          title="This Space isn’t available"
          body="Only current members can open a Space. Check Communities for invitations."
        />
      </Screen>
    );
  const manageable = canManageSpace(data, id, userId);
  const viewerRole = activeSpaceRole(space, data.space_members, userId!);
  const mayInvite = canInviteWithPolicy(viewerRole, space.invite_policy);
  const members = data.space_members.filter(
    (member) => member.space_id === id && member.status === "active",
  );
  const joinRequests = data.space_members.filter(
    (member) => member.space_id === id && member.status === "requested",
  );
  const invitees = data.profiles.filter(
    (profile) =>
      friendIds(data, userId!).includes(profile.id) &&
      canInviteSpaceMember(data, id, userId, profile.id) &&
      canViewProfile(data, profile, userId!) &&
      !data.space_members.some(
        (member) => member.space_id === id && member.user_id === profile.id,
      ),
  );
  const squads = visibleSpaceSquads(data, id, userId);
  const visibleSquads = squads.filter((squad) =>
    matchesSearch(squadSearch, squad.name, squad.description),
  );
  const searchedMembers = members.flatMap((member) => {
    const profile = data.profiles.find((row) => row.id === member.user_id);
    return profile && userId && canViewProfile(data, profile, userId) &&
      matchesSearch(squadSearch, profile.name, profile.username)
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
  const openSettings = () => {
    setEditName(space.name);
    setEditDescription(space.description);
    setMenu("settings");
  };
  const selectTab = (next: "overview" | "squads" | "activity" | "members") => {
    setTab(next);
    router.setParams({ tab: next === "overview" ? undefined : next });
  };
  const primaryTabs = [
    { id: "overview", title: "Overview", Icon: House },
    { id: "squads", title: "Squads", Icon: Layers3 },
    { id: "activity", title: "Activity", Icon: Compass },
  ] as const;
  const tabBar = (
    <View
      style={{
        flexDirection: "row",
        padding: 4,
        gap: 3,
        backgroundColor: colors.line + "88",
        borderRadius: 17,
      }}
    >
      {primaryTabs.map(({ id: item, title, Icon }) => {
        const selected = tab === item;
        return (
          <MotionPressable
            key={item}
            accessibilityRole="button"
            accessibilityLabel={title}
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
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: selected ? colors.white : colors.muted }}>{title}</Text>
          </MotionPressable>
        );
      })}
    </View>
  );
  return (
    <Screen
      title={space.name}
      eyebrow="Space"
      showDemoNotice={false}
      headerAction={
        <View style={{ flexDirection: "row" }}>
          <IconButton label="Space members" onPress={() => selectTab("members")}>
            <Users size={19} color={colors.green} />
          </IconButton>
          <IconButton label="Space options" onPress={openSettings}>
            <MoreHorizontal size={20} color={colors.green} />
          </IconButton>
        </View>
      }
    >
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
        <View style={{ flex: 1, gap: 4 }}>
          <Txt>
            {space.description ||
              "A shared home for Squads and the people in them."}
          </Txt>
          <Txt muted>
            {space.space_type
              ? `${space.space_type.replaceAll("_", " ")} · `
              : "Space · "}
            {members.length} {members.length === 1 ? "member" : "members"}
          </Txt>
        </View>
      </View>
      {tabBar}
      {tab !== "activity" && tab !== "members" && <View style={styles.between}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.h2}>{tab === "overview" ? "Your Squads" : "Squads"}</Text>
          {tab === "overview" && <Text style={styles.muted}>{squads.length} Squads you can access</Text>}
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
        {manageable && (
          <Button
            compact
            secondary
            title="Manage Space"
            onPress={openSettings}
          />
        )}
        {manageable && (
          <Button
            compact
            secondary
            title="Connect Squad"
            onPress={() => setMenu("squads")}
            icon={<Plus size={15} color={colors.green} />}
          />
        )}
      </View>}
      {tab === "squads" && (
        <Field
          label={`Search ${space.name}`}
          placeholder="Squads, communities, Beacons, or members"
          value={squadSearch}
          onChangeText={setSquadSearch}
        />
      )}
      {tab !== "activity" && tab !== "members" && (
        <>
          <Txt muted>
            Squads keep their own members and chats. Connecting one never makes its
            private conversations public.
          </Txt>
          {(tab === "overview" ? squads.slice(0, 3) : visibleSquads).map((squad) => (
        <View
          key={squad.id}
          style={[
            styles.card,
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 10,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Preview Squad ${squad.name}`}
            onPress={() => setSquadId(squad.id)}
            style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
          >
            <Avatar name={squad.name} size={42} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Message ${squad.name}`}
            onPress={() =>
              router.push({
                pathname: "/squad-chat/[id]",
                params: { id: squad.id },
              })
            }
            style={{ flex: 1, minHeight: 48, justifyContent: "center", gap: 3 }}
          >
            <Text style={[styles.body, { fontWeight: "700" }]}>
              {squad.name}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {squad.description || "Open Squad chat"}
            </Text>
          </Pressable>
          <ChevronRight size={17} color={colors.muted} />
        </View>
          ))}
          {!squads.length && (
            <Empty
              title="Room for your Squads"
              body={
                manageable
                  ? "Connect a Squad you manage. Members only see Squads they can already open."
                  : "Your Squads will appear here when they’re connected. Other Squads stay private."
              }
            />
          )}
          {tab === "squads" && squads.length > 0 && !visibleSquads.length && (
            <Empty title="No matching Squads" body="Try another Squad name or description." />
          )}
          {tab === "overview" && squads.length > 3 && (
            <Button compact secondary title="See all Squads" onPress={() => selectTab("squads")} />
          )}
        </>
      )}
      {tab === "squads" && squadSearch.trim().length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 7 }}>
            <Text style={styles.label}>LINKED COMMUNITIES</Text>
            <SocialDirectoryResults
              query={squadSearch}
              parentType="space"
              parentId={id}
              onOpenSquad={setSquadId}
              onOpenSpace={setOtherSpaceId}
              onOpenOrganization={setOrganizationId}
            />
          </View>
          {searchedMembers.length ? (
            <View style={{ gap: 5 }}>
              <Text style={styles.label}>VISIBLE MEMBERS</Text>
              {searchedMembers.map(({ member, profile }) => (
                <MotionPressable
                  key={member.user_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview member ${profile.name}`}
                  onPress={() => setPersonId(profile.id)}
                  style={[styles.row, { minHeight: 48 }]}
                >
                  <ProfileAvatar profile={profile} size={34} />
                  <Text style={[styles.body, { flex: 1 }]}>{profile.name}</Text>
                </MotionPressable>
              ))}
            </View>
          ) : null}
          {spaceActivities.filter((activity) =>
            matchesSearch(squadSearch, activity.title, activity.description, activity.category),
          ).length ? (
            <View style={{ gap: 5 }}>
              <Text style={styles.label}>AUTHORIZED BEACONS</Text>
              {spaceActivities.filter((activity) =>
                matchesSearch(squadSearch, activity.title, activity.description, activity.category),
              ).map((activity) => (
                <MotionPressable
                  key={activity.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Beacon ${activity.title}`}
                  onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
                  style={[styles.row, { minHeight: 48 }]}
                >
                  <CalendarDays size={17} color={colors.green} />
                  <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>{activity.title}</Text>
                  <ChevronRight size={16} color={colors.muted} />
                </MotionPressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
      {tab === "overview" && (
        <View style={{ gap: 8 }}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h2}>Activity</Text>
              <Text style={styles.muted}>{spaceActivities.length} shared Beacons visible</Text>
            </View>
            <Button compact secondary title="See all" onPress={() => selectTab("activity")} />
          </View>
          {spaceActivities.slice(0, 2).map((activity) => (
            <Pressable
              key={activity.id}
              accessibilityRole="button"
              accessibilityLabel={`Open Beacon ${activity.title}`}
              onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
              style={styles.card}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <CalendarDays size={18} color={colors.green} />
                <Text style={[styles.body, { flex: 1 }]}>{activity.title}</Text>
              </View>
            </Pressable>
          ))}
          {!spaceActivities.length && <Empty title="No shared Beacons yet" body="Beacons associated with this Space appear here when you can access them." />}
        </View>
      )}
      {tab === "activity" && (
        <View style={{ gap: 10 }}>
          <View style={styles.between}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.h2}>Space activity</Text>
              <Txt muted>Only Beacons you are authorized to view appear here.</Txt>
            </View>
            <Button compact title="+ Beacon" onPress={() => router.push({ pathname: "/create", params: { spaceId: id } })} />
          </View>
          {spaceActivities.map((activity) => (
            <Pressable
              key={activity.id}
              accessibilityRole="button"
              accessibilityLabel={`Open Beacon ${activity.title}`}
              onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
              style={styles.card}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <CalendarDays size={18} color={colors.green} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.body}>{activity.title}</Text>
                  <Text style={styles.muted}>{activity.category} · {new Date(activity.starts_at).toLocaleString()}</Text>
                </View>
              </View>
            </Pressable>
          ))}
          {!spaceActivities.length && <Empty title="No shared Beacons yet" body="Use the audience picker or associate an accessible Beacon with this Space." />}
        </View>
      )}
      {tab === "members" && (
        <>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h2}>Members</Text>
              <Text style={styles.muted}>{members.length} active members</Text>
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
                const profile = data.profiles.find((row) => row.id === request.user_id);
                const visible = !!(profile && userId && canViewProfile(data, profile, userId));
                return (
                  <View key={request.user_id} style={[styles.row, { flexWrap: "wrap", justifyContent: "space-between" }]}>
                    <Text style={[styles.body, { flex: 1 }]}>{visible && profile ? profile.name : "Community member"}</Text>
                    <Action compact title="Approve" run={() => act("approve_space_join_request", { space_id: id, user_id: request.user_id })} />
                    <Action compact secondary title="Decline" run={() => act("deny_space_join_request", { space_id: id, user_id: request.user_id })} />
                  </View>
                );
              })}
            </View>
          ) : null}
          {members.map((member) => {
            const profile = data.profiles.find((row) => row.id === member.user_id);
            if (!profile || !canViewProfile(data, profile, userId!)) return null;
            return (
              <Pressable
                key={member.user_id}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${profile.name}`}
                onPress={() => setPersonId(profile.id)}
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
            );
          })}
        </>
      )}
      <Sheet
        title="Invite to this Space"
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
        title="Space options"
        visible={menu === "settings"}
        onClose={() => setMenu(null)}
      >
        {manageable && (
          <>
            <Text style={styles.h2}>Access & membership</Text>
            <SocialPolicySettings
              key={`${id}:${space.discoverability ?? "private"}:${space.join_mode ?? "invite"}:${space.invite_policy ?? "admins"}`}
              entityType="space"
              initial={{
                discoverability: space.discoverability ?? "private",
                join_mode: space.join_mode ?? "invite",
                invite_policy: space.invite_policy ?? "admins",
              }}
              onSave={(policy) => act("set_social_policy", { entity_type: "space", entity_id: id, ...policy })}
            />
            <Field
              label="Space name"
              value={editName}
              onChangeText={setEditName}
              maxLength={60}
            />
            <Field
              label="Description"
              value={editDescription}
              onChangeText={setEditDescription}
              maxLength={500}
              multiline
            />
            <Action
              title="Save Space"
              run={async () => {
                if (!editName.trim())
                  throw new Error("Give your Space a name.");
                await act("update_space", {
                  space_id: id,
                  name: editName.trim(),
                  description: editDescription.trim(),
                });
                setMenu(null);
              }}
            />
            {squads.map((squad) => (
              <Action
                key={squad.id}
                secondary
                title={`Disconnect ${squad.name}`}
                run={() =>
                  act("detach_space_squad", {
                    space_id: id,
                    squad_id: squad.id,
                  })
                }
              />
            ))}
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
                        SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[member.role] &&
                        SOCIAL_ROLE_RANK[viewerRole] > SOCIAL_ROLE_RANK[candidate],
                    )
                  : [];
                const editing = editingMemberId === member.user_id;
                return (
                  <View key={member.user_id} style={[styles.card, { gap: 8 }]}>
                    <Text style={styles.body}>
                      {profile && canViewProfile(data, profile, userId!) ? profile.name : "Member"} · {member.role}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                      {allowedRoles.length ? (
                        <Button
                          compact
                          secondary
                          title={editing ? "Close role edit" : "Change role"}
                          onPress={() => {
                            setEditingMemberId(editing ? null : member.user_id);
                            setEditingMemberRole(member.role as SpaceMemberRole);
                          }}
                        />
                      ) : null}
                      <Action
                        compact
                        secondary
                        title={`Remove ${profile && canViewProfile(data, profile, userId!) ? profile.name : "member"} from Space`}
                        run={() => act("remove_space_member", { space_id: id, user_id: member.user_id })}
                      />
                    </View>
                    {editing && allowedRoles.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        <Chips
                          options={allowedRoles}
                          value={allowedRoles.includes(editingMemberRole as (typeof allowedRoles)[number]) ? editingMemberRole as (typeof allowedRoles)[number] : allowedRoles[0]}
                          onChange={setEditingMemberRole}
                          accessibilityPrefix="Space member role"
                        />
                        <Action
                          compact
                          title="Save role"
                          run={async () => {
                            await act("set_space_member_role", { space_id: id, user_id: member.user_id, role: editingMemberRole });
                            setEditingMemberId(null);
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
          </>
        )}
        {space.owner_id !== userId && (
          <Action
            secondary
            title="Leave Space"
            run={async () => {
              await act("leave_space", { space_id: id });
              setMenu(null);
              router.back();
            }}
          />
        )}
        <Button secondary title="Done" onPress={() => setMenu(null)} />
      </Sheet>
      {personId && (
        <PersonProfilePreview
          personId={personId}
          visible
          onClose={() => setPersonId(null)}
        />
      )}
      {squadId && (
        <SquadProfilePreview
          squadId={squadId}
          visible
          onClose={() => setSquadId(null)}
        />
      )}
      {organizationId && (
        <OrganizationProfilePreview
          organizationId={organizationId}
          visible
          onClose={() => setOrganizationId(null)}
        />
      )}
      {otherSpaceId && (
        <SpaceProfilePreview
          spaceId={otherSpaceId}
          visible
          onClose={() => setOtherSpaceId(null)}
        />
      )}
    </Screen>
  );
}
