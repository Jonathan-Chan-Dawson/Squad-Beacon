import React, { useEffect, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, List, Plus } from "lucide-react-native";
import { communityTypePlural } from "@/src/features/social/communityPresentation";
import { useBeacon } from "@/src/shared/store";
import { inviteContact } from "@/src/platform/contacts";
import { InviteQR } from "../InviteQR";
import { CommunicationHub, type ChatFilter } from "../CommunicationHub";
import { PrivateListsSheet } from "../components/PrivateListsSheet";
import type { PeopleListSelection } from "../privateLists";
import { PrimaryTab } from "@/src/shared/NavigationTabs";
import { Action, Button, Field, Sheet, Txt, useTheme } from "@/src/shared/ui";

export default function MessagingHubScreen({
  communities = false,
  directory = false,
}: {
  communities?: boolean;
  directory?: boolean;
}) {
  const { styles, colors, tokens } = useTheme();
  const params = useLocalSearchParams<{
    tab?: string;
    peopleLists?: string;
    section?: string;
    type?: string;
    discover?: string;
  }>();
  const focusedType = directory
    ? params.type === "organization" || params.type === "space"
      ? params.type
      : "squad"
    : undefined;
  const discoverOnly = directory && params.discover === "yes";
  const { data, userId, act, demo } = useBeacon();
  const [section, setSection] = useState<"Chats" | "Communities">(
    directory ||
      communities ||
      params.section === "Communities" ||
      params.tab === "Organizations"
      ? "Communities"
      : "Chats",
  );
  const [filter, setFilter] = useState<ChatFilter>(
    params.tab === "Friends" ? "Friends" : "All",
  );
  const [selection, setSelection] = useState<PeopleListSelection | null>(null);
  const [listsOpen, setListsOpen] = useState(params.peopleLists === "yes");
  const [newChat, setNewChat] = useState(false);
  const [queries, setQueries] = useState({ Chats: "", Communities: "" });
  const [createSpace, setCreateSpace] = useState(false);
  const [createOrganization, setCreateOrganization] = useState(false);
  const [squadOpen, setSquadOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const me = data.profiles.find((profile) => profile.id === userId);
  if (
    selection?.startsWith("custom:") &&
    userId &&
    data.viewer_id === userId &&
    !data.lists.some(
      (list) => list.owner_id === userId && selection === `custom:${list.id}`,
    )
  )
    setSelection(null);
  const routeKey = JSON.stringify([
    params.section,
    params.tab,
    params.peopleLists,
  ]);
  const [lastRoute, setLastRoute] = useState(routeKey);
  if (lastRoute !== routeKey) {
    setLastRoute(routeKey);
    if (params.section === "Communities" || params.tab === "Organizations")
      setSection("Communities");
    if (params.tab === "Friends") {
      setSection("Chats");
      setFilter("Friends");
      setSelection(null);
    }
    if (params.tab === "Chats") setSection("Chats");
    if (params.peopleLists === "yes") setListsOpen(true);
  }
  useEffect(() => {
    if (params.tab === "Pings") {
      router.setParams({ tab: undefined });
      router.push("/responses");
    }
  }, [params.tab]);
  function changeFilter(next: ChatFilter) {
    setFilter(next);
    if (next !== "Friends") setSelection(null);
  }
  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View
        testID="chats-content-column"
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          maxWidth: tokens.layout.contentMaxWidth,
          alignSelf: "center",
        }}
      >
        {focusedType ? (
          <View
            style={[
              styles.row,
              { paddingHorizontal: tokens.layout.screenGutter, gap: 12 },
            ]}
          >
            <HeaderAction
              label="Back"
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/communities");
              }}
            >
              <ArrowLeft size={20} color={colors.ink} />
            </HeaderAction>
            <Text accessibilityRole="header" style={styles.h2}>
              {discoverOnly ? "Discover " : "Your "}
              {communityTypePlural(focusedType)}
            </Text>
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: tokens.layout.screenGutter,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View
              testID="messaging-primary-tabs"
              style={{ flexDirection: "row", flex: 1, minWidth: 0, gap: 8 }}
            >
              {(["Chats", "Communities"] as const).map((destination) => (
                <PrimaryTab
                  key={destination}
                  label={destination}
                  selected={section === destination}
                  onPress={() => {
                    setSection(destination);
                    if (params.section || params.tab)
                      router.setParams({ section: undefined, tab: undefined });
                  }}
                />
              ))}
            </View>
            {section === "Chats" ? (
              <HeaderAction
                label="Private Lists"
                onPress={() => setListsOpen(true)}
              >
                <List size={20} color={colors.muted} />
              </HeaderAction>
            ) : (
              <HeaderAction
                label="Create community"
                onPress={() => setNewChat(true)}
              >
                <Plus size={20} color={colors.muted} />
              </HeaderAction>
            )}
          </View>
        )}
        <CommunicationHub
          focusedType={focusedType}
          discoverOnly={discoverOnly}
          initialSection={section}
          section={section}
          onSectionChange={setSection}
          conversationFilter={filter}
          onConversationFilterChange={changeFilter}
          activeList={selection}
          onClearList={() => setSelection(null)}
          searchOpen
          query={queries[section]}
          onQueryChange={(query, destination = section) =>
            setQueries((previous) => ({ ...previous, [destination]: query }))
          }
          queries={queries}
          onSearchOpenChange={() => {}}
          newMenuOpen={newChat}
          onNewMenuOpenChange={setNewChat}
          createSpaceOpen={createSpace}
          onCreateSpaceOpenChange={setCreateSpace}
          createOrganizationOpen={createOrganization}
          onCreateOrganizationOpenChange={setCreateOrganization}
          openSquad={(id) =>
            router.push({ pathname: "/squad/[id]", params: { id } })
          }
          findFriends={() => router.push("/find-friends")}
          inviteFriends={() => setInviteOpen(true)}
          createSquad={() => {
            setName("");
            setDescription("");
            setSquadOpen(true);
          }}
        />
      </View>
      <PrivateListsSheet
        visible={listsOpen}
        onClose={() => {
          setListsOpen(false);
          if (params.peopleLists) router.setParams({ peopleLists: undefined });
        }}
        onSelect={(next) => {
          setSelection(next);
          setFilter("Friends");
          setSection("Chats");
        }}
      />
      <Sheet
        title="Create a Squad"
        visible={squadOpen}
        onClose={() => setSquadOpen(false)}
      >
        <Field label="Name" value={name} onChangeText={setName} />
        <Field
          label="What brings you together?"
          value={description}
          onChangeText={setDescription}
        />
        <Action
          title="Create"
          run={async () => {
            if (!name.trim()) throw new Error("Enter a name.");
            await act("create_squad", { name: name.trim(), description });
            setSquadOpen(false);
          }}
        />
      </Sheet>
      <Sheet
        title="Invite friends"
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
      >
        <Txt muted>
          Find someone by username, choose a contact, or share your invitation.
        </Txt>
        <Button
          secondary
          title="Find by username"
          onPress={() => {
            setInviteOpen(false);
            router.push("/find-friends");
          }}
        />
        <Action
          secondary
          title="Connect with a contact"
          run={async () => {
            if (demo || !me)
              throw new Error("Sign in on your phone to invite a contact.");
            await inviteContact(me.username);
          }}
        />
        {me ? <InviteQR username={me.username} /> : null}
        <Action
          secondary
          title="Share my invitation link"
          run={() =>
            Share.share({
              message: `Find me on Squad Beacon: squadbeacon://invite?username=${me?.username ?? ""}`,
            })
          }
        />
      </Sheet>
    </SafeAreaView>
  );
}

function HeaderAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minWidth: 44,
        minHeight: 44,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Pressable>
  );
}
