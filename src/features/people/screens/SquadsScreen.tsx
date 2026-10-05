import { inviteContact } from "@/src/platform/contacts";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import React, { useCallback, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowUpRight, MessageCircle, Plus, Search, X } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { friendIds } from "@/src/shared/domain";
import { InviteQR } from "@/src/features/people/InviteQR";
import { CommunicationHub, type ChatFilter } from "@/src/features/people/CommunicationHub";
import { squadCurrentAndNextActivities } from "@/src/features/people/squadProfile";
import { SquadProfilePreview } from "@/src/features/people/previews/SquadProfilePreview";
import {
  DirectoryActions,
  DirectoryControls,
  type DirectoryFilter,
} from "@/src/features/people/DirectoryControls";
import {
  Action,
  Avatar,
  Button,
  Empty,
  Field,
  IconButton,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

export default function SquadsScreen() {
  const { styles, colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: string; peopleLists?: string }>();
  const { data, userId, act, demo } = useBeacon();
  const [filter, setFilter] = useState<DirectoryFilter>(
    params.tab === "Friends" ? "Friends" : "All",
  );
  const [modal, setModal] = useState<"squad" | "list" | "friend" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [previewSquadId, setPreviewSquadId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [directoryState, setDirectoryState] = useState<{
    route: string | undefined;
    open: boolean;
  }>(() => ({ route: params.peopleLists, open: params.peopleLists === "yes" }));
  const directory = directoryState.route === params.peopleLists
    ? directoryState.open
    : params.peopleLists === "yes";
  const [newChat, setNewChat] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationFilter, setConversationFilter] = useState<ChatFilter>(
    params.tab === "Friends" ? "Friends" : "All",
  );
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);

  function setDirectory(open: boolean) {
    setDirectoryState({ route: params.peopleLists, open });
    if (!open && params.peopleLists) router.setParams({ peopleLists: undefined });
  }

  useFocusEffect(
    useCallback(() => {
      if (params.tab === "Friends") {
        setConversationFilter("Friends");
        setSelected(null);
      }
    }, [params.tab]),
  );

  const friends = friendIds(data, userId!);
  const friendProfiles = data.profiles
    .filter((profile) => friends.includes(profile.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const mySquads = data.squads.filter((squad) =>
    data.squad_members.some(
      (member) => member.squad_id === squad.id && member.user_id === userId,
    ),
  );
  const squadInvites = data.squad_invites.filter(
    (invite) => invite.recipient_id === userId,
  );
  const friendRequests = data.friendships.filter(
    (friendship) =>
      friendship.recipient_id === userId && friendship.status === "pending",
  );
  const list = data.lists.find((item) => item.id === selected);
  const me = data.profiles.find((profile) => profile.id === userId);
  const showSquads = filter === "All" || filter === "Squads";
  const showFriends = filter === "All" || filter === "Friends";
  const showLists = filter === "All" || filter === "Private lists";

  function open(kind: typeof modal) {
    setName("");
    setDescription("");
    setModal(kind);
  }

  function openSquadPreview(squadId: string) {
    setDirectory(false);
    setSelected(null);
    setPreviewSquadId(squadId);
  }

  function updateSearchOpen(open: boolean) {
    setSearchOpen(open);
    if (!open) {
      setSearchQuery("");
      setConversationFilter("All");
    }
  }

  return (
    <Screen
      title="Squads"
      eyebrow=""
      showDemoNotice={false}
      headerAction={
        <View style={{ flexDirection: "row", gap: 4 }}>
          <IconButton
            label={searchOpen ? "Close search" : "Search conversations"}
            onPress={() => {
              updateSearchOpen(!searchOpen);
            }}
          >
            {searchOpen ? <X size={20} color={colors.green} /> : <Search size={20} color={colors.green} />}
          </IconButton>
          <IconButton label="New conversation" onPress={() => setNewChat(true)}>
            <Plus size={20} color={colors.green} />
          </IconButton>
        </View>
      }
    >
      <CommunicationHub
        key={params.tab ?? "Chats"}
        initialSection={
          params.tab === "Pings"
            ? "Pings"
            : params.tab === "Organizations"
              ? "Organizations"
              : "Chats"
        }
        conversationFilter={conversationFilter}
        onConversationFilterChange={setConversationFilter}
        searchOpen={searchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSearchOpenChange={updateSearchOpen}
        newMenuOpen={newChat}
        onNewMenuOpenChange={setNewChat}
        createSpaceOpen={createSpaceOpen}
        onCreateSpaceOpenChange={setCreateSpaceOpen}
        createOrganizationOpen={createOrganizationOpen}
        onCreateOrganizationOpenChange={setCreateOrganizationOpen}
        openSquad={openSquadPreview}
        findFriends={() => router.push("/find-friends")}
        createSquad={() => open("squad")}
      />
      <Sheet
        title="Your people & lists"
        visible={directory}
        onClose={() => setDirectory(false)}
      >
        <DirectoryControls
          value={filter}
          onChange={(nextFilter) => {
            setFilter(nextFilter);
            setSelected(null);
          }}
        />
        <DirectoryActions
          onFindFriends={() => router.push("/find-friends")}
          onInvitePeople={() => setInviteOpen(true)}
        />

        {showSquads && (
          <View style={{ gap: 10 }}>
            {squadInvites.length > 0 && (
              <>
                <View style={styles.between}>
                  <Text style={styles.h2}>Squad invitations</Text>
                  <Text style={styles.label}>
                    {squadInvites.length} waiting
                  </Text>
                </View>
                {squadInvites.map((invite) => (
                  <View key={invite.id} style={[styles.card, { padding: 12 }]}>
                    <Txt>
                      Invitation to{" "}
                      {data.squads.find((item) => item.id === invite.squad_id)
                        ?.name ?? "a squad"}
                    </Txt>
                    <Action
                      title="Accept invitation"
                      run={() => act("accept_squad", { id: invite.id })}
                    />
                  </View>
                ))}
              </>
            )}
            <View style={styles.between}>
              <Text style={styles.h2}>Squads</Text>
              <Button
                compact
                secondary
                title="+ Create a squad"
                onPress={() => open("squad")}
              />
            </View>
            {mySquads.map((item) => {
              const beaconContext = userId
                ? squadCurrentAndNextActivities(data, item.id, userId)
                : { current: undefined, next: undefined };
              const latestBeacon = beaconContext.current ?? beaconContext.next;
              const memberCount = data.squad_members.filter(
                (member) => member.squad_id === item.id,
              ).length;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open squad ${item.name}`}
                  onPress={() => {
                    openSquadPreview(item.id);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      minHeight: 72,
                      padding: 10,
                      borderRadius: 17,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 11,
                      opacity: pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  <Avatar name={item.name} size={44} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.body, { fontWeight: "700" }]}
                    >
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.muted}>
                      {item.description || "Invite-only group"}
                      {latestBeacon ? ` · ${latestBeacon.title}` : ""}
                    </Text>
                    <Text numberOfLines={1} style={styles.label}>
                      {memberCount} {memberCount === 1 ? "member" : "members"} ·{" "}
                      Invite-only
                    </Text>
                  </View>
                  <ArrowUpRight size={18} color={colors.green} />
                </Pressable>
              );
            })}
            {!mySquads.length && (
              <Empty
                title="Good times need good people."
                body="Create a squad for your usual crew, or invite a friend to get started."
              />
            )}
          </View>
        )}

        {showFriends && (
          <View style={{ gap: 10 }}>
            <View style={styles.between}>
              <Text style={styles.h2}>Friends</Text>
            </View>
            {friendRequests.map((request) => (
              <View key={request.id} style={[styles.card, { padding: 12 }]}>
                <Txt>
                  {data.profiles.find(
                    (profile) => profile.id === request.sender_id,
                  )?.name ?? "Someone"}{" "}
                  wants to connect.
                </Txt>
                <Action
                  title="Accept friend"
                  run={() => act("accept_friend", { id: request.id })}
                />
              </View>
            ))}
            {friendProfiles.map((profile) => (
              <View
                key={profile.id}
                style={[
                  styles.card,
                  {
                    minHeight: 64,
                    padding: 8,
                    borderRadius: 17,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open profile ${profile.name}`}
                  onPress={() =>
                    router.push({
                      pathname: "/person/[id]",
                      params: { id: profile.id },
                    })
                  }
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    minHeight: 48,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <ProfileAvatar profile={profile} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.body, { fontWeight: "700" }]}
                    >
                      {profile.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.muted}>
                      @{profile.username}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${profile.name}`}
                  onPress={() =>
                    router.push({
                      pathname: "/messages/[id]",
                      params: { id: profile.id },
                    })
                  }
                  style={({ pressed }) => ({
                    flexShrink: 0,
                    minWidth: 88,
                    minHeight: 44,
                    paddingHorizontal: 8,
                    borderRadius: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    backgroundColor: colors.lime,
                    borderWidth: 1,
                    borderColor: colors.green,
                    opacity: pressed ? 0.78 : 1,
                  })}
                >
                  <MessageCircle size={15} color={colors.ink} />
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Message
                  </Text>
                </Pressable>
              </View>
            ))}
            {!friendProfiles.length && !friendRequests.length && (
              <Empty
                title="Start with someone you know."
                body="Find a person to send a friend request. They’ll need to accept before you’re connected."
              />
            )}
          </View>
        )}

        {showLists && (
          <View style={{ gap: 10 }}>
            <View style={styles.between}>
              <Text style={styles.h2}>Private lists</Text>
              <Button
                compact
                secondary
                title="+ Create a private list"
                onPress={() => open("list")}
              />
            </View>
            <Text style={styles.muted}>
              Only you can see these lists. Use them to choose who can see a
              beacon.
            </Text>
            <View
              style={[
                styles.card,
                {
                  minHeight: 64,
                  padding: 10,
                  borderRadius: 17,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                },
              ]}
            >
              <Avatar name="General" size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, { fontWeight: "700" }]}>
                  General
                </Text>
                <Text style={styles.muted}>
                  {friends.length} accepted{" "}
                  {friends.length === 1 ? "friend" : "friends"}
                </Text>
              </View>
            </View>
            {data.lists.map((item) => {
              const memberCount = data.list_members.filter(
                (member) => member.list_id === item.id,
              ).length;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open private list ${item.name}`}
                  onPress={() => {
                    setDirectory(false);
                    setSelected(item.id);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      minHeight: 64,
                      padding: 10,
                      borderRadius: 17,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 11,
                      opacity: pressed ? 0.78 : 1,
                    },
                  ]}
                >
                  <Avatar name={item.name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={[styles.body, { fontWeight: "700" }]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.muted}>
                      {memberCount} {memberCount === 1 ? "friend" : "friends"}
                    </Text>
                  </View>
                  <ArrowUpRight size={18} color={colors.green} />
                </Pressable>
              );
            })}
            {!data.lists.length && (
              <Text style={styles.muted}>
                Create a private list for a smaller sharing audience.
              </Text>
            )}
          </View>
        )}
      </Sheet>
      <Sheet
        title="Invite friends"
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
      >
        <Txt muted>
          Find people by username, choose a contact, or share your invitation.
        </Txt>
        <Button
          title="Add by exact username"
          secondary
          onPress={() => {
            setInviteOpen(false);
            open("friend");
          }}
        />
        <Action
          title="Connect with a contact"
          secondary
          run={async () => {
            if (demo)
              throw new Error(
                "Sign in on your phone to invite a contact. The demo does not access contacts.",
              );
            await inviteContact(me!.username);
          }}
        />
        <Txt muted>
          Pick a contact and review their invitation. Your address book stays on
          your phone.
        </Txt>
        {me && <InviteQR username={me.username} />}
        <Action
          secondary
          title="Share my invitation link"
          run={() =>
            Share.share({
              message:
                "Find me on Squad Beacon: squadbeacon://invite?username=" +
                me?.username,
            })
          }
        />
      </Sheet>

      <Sheet
        title={
          modal === "friend"
            ? "Find your friend"
            : modal === "squad"
              ? "Create a squad"
              : "Create a private list"
        }
        visible={!!modal}
        onClose={() => setModal(null)}
      >
        <Field
          label={modal === "friend" ? "Exact username" : "Name"}
          value={name}
          onChangeText={setName}
          autoCapitalize={modal === "friend" ? "none" : "sentences"}
        />
        {modal === "squad" && (
          <Field
            label="What brings you together?"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        )}
        <Action
          title={modal === "friend" ? "Send friend request" : "Create"}
          run={async () => {
            if (!name.trim()) throw new Error("Enter a name.");
            await act(
              modal === "friend"
                ? "friend_request"
                : modal === "squad"
                  ? "create_squad"
                  : "create_list",
              modal === "friend"
                ? { username: name.trim().toLowerCase() }
                : { name: name.trim(), description },
            );
            setModal(null);
          }}
        />
      </Sheet>

      <Sheet
        title={list?.name ?? ""}
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        {list && (
          <>
            <Txt muted>
              Choose which accepted friends are in this private list.
            </Txt>
            {data.profiles
              .filter((profile) => friends.includes(profile.id))
              .map((profile) => {
                const added = data.list_members.some(
                  (member) =>
                    member.list_id === selected &&
                    member.user_id === profile.id,
                );
                return (
                  <Action
                    key={profile.id}
                    secondary
                    title={`${added ? "✓ " : "+ "}${profile.name}`}
                    run={() =>
                      act("list_member", {
                        id: selected,
                        user_id: profile.id,
                        add: !added,
                      })
                    }
                  />
                );
              })}
          </>
        )}
      </Sheet>
      <SquadProfilePreview
        key={previewSquadId ?? "no-squad-preview"}
        squadId={previewSquadId ?? ""}
        visible={!!previewSquadId}
        onClose={() => setPreviewSquadId(null)}
      />
    </Screen>
  );
}
