import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { router } from "expo-router";
import {
  Bell,
  ChevronRight,
  Building2,
  ChevronDown,
  Layers3,
  MessageCircle,
  UserPlus,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { selectListPeople, type PeopleListSelection } from "../privateLists";
import { matchesSearch } from "@/src/shared/search";
import { Skeleton } from "@/src/shared/design-system";
import { Button, Sheet, Txt, useTheme } from "@/src/shared/ui";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { OrganizationDirectory } from "@/src/features/organizations/OrganizationDirectory";
import { SpacesDirectory } from "@/src/features/spaces/SpacesDirectory";
import {
  activeSpaceRole,
  canReadSpace,
  visibleSpaceSquads,
} from "@/src/features/spaces/domain";
import {
  activeOrganizationRole,
  canReadOrganization,
} from "@/src/features/organizations/domain";
import { canOpenSquadProfile } from "../squadProfile";
import { usePlanningResponses } from "../usePlanningResponses";
import {
  filterHubConversations,
  selectHubConversations,
  selectStartChatFriends,
  type ChatFilter,
  type HubConversation,
} from "../hubState";
import type { SocialEntityType } from "@/src/features/social/types";
import { ResponsesSheet } from "../components/ResponsesSheet";
import { communityTypeLabel } from "../components/CommunityCard";
import { ProfileActions, ProfileLink } from "../components/ProfilePrimitives";
import { HubConversationRow } from "../components/HubConversationRow";
import { HubDirectory } from "../components/HubDirectory";

export type { ChatFilter } from "../hubState";
type Section = "Chats" | "Communities";
type InitialSection = Section | "Pings" | "Organizations";
type CommunityView = "All" | "Spaces" | "Organizations";
const CHAT_FILTERS = ["All", "Squads", "Friends", "Unread"] as const;
type CommunityItem = {
  id: string;
  type: "space" | "organization";
  name: string;
  memberCount: number;
  role: NonNullable<ReturnType<typeof activeOrganizationRole>>;
  squads: { id: string; name: string }[];
};
type ListItem =
  | { key: string; type: "chat"; chat: HubConversation }
  | {
      key: string;
      type: "person";
      person: ReturnType<typeof selectStartChatFriends>[number];
    }
  | { key: string; type: "community"; community: CommunityItem }
  | {
      key: string;
      type: "discovery" | "search" | "empty" | "skeleton" | "friends-divider";
    };

export function CommunicationHub({
  openSquad,
  findFriends,
  inviteFriends,
  createSquad,
  conversationFilter,
  onConversationFilterChange,
  initialSection = "Chats",
  section: controlledSection,
  activeList,
  onClearList,
  queries,
  searchOpen,
  query,
  onQueryChange,
  onSearchOpenChange,
  onSectionChange,
  newMenuOpen,
  onNewMenuOpenChange,
  createSpaceOpen,
  onCreateSpaceOpenChange,
  createOrganizationOpen,
  onCreateOrganizationOpenChange,
}: {
  openSquad: (id: string) => void;
  findFriends: () => void;
  inviteFriends?: () => void;
  createSquad: () => void;
  conversationFilter: ChatFilter;
  onConversationFilterChange: (filter: ChatFilter) => void;
  initialSection?: InitialSection;
  section?: Section;
  activeList?: PeopleListSelection | null;
  onClearList?: () => void;
  queries?: Record<Section, string>;
  searchOpen: boolean;
  query: string;
  onQueryChange: (value: string, destination?: Section) => void;
  onSearchOpenChange: (open: boolean) => void;
  onSectionChange?: (section: Section) => void;
  newMenuOpen: boolean;
  onNewMenuOpenChange: (open: boolean) => void;
  createSpaceOpen: boolean;
  onCreateSpaceOpenChange: (open: boolean) => void;
  createOrganizationOpen: boolean;
  onCreateOrganizationOpenChange: (open: boolean) => void;
}) {
  const { data, userId, act, refresh, loading, error } = useBeacon();
  const { colors, semanticColors, styles, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const section: Section =
    controlledSection ??
    (initialSection === "Organizations" || initialSection === "Communities"
      ? "Communities"
      : "Chats");
  const [communityView] = useState<CommunityView>(
    initialSection === "Organizations" ? "Organizations" : "All",
  );
  const [responsesOpen, setResponsesOpen] = useState(
    initialSection === "Pings",
  );
  const [exploreOpen, setExploreOpen] = useState(false);
  const setRowGestureActive = useCallback(() => {}, []);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const current = !!userId && data.viewer_id === userId;
  const activeQuery = (queries?.Chats ?? query).trim();
  const communityQuery = (queries?.Communities ?? query).trim();
  const chatList = useRef<FlashListRef<ListItem>>(null);
  const communityList = useRef<FlashListRef<ListItem>>(null);
  useEffect(() => {
    chatList.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeQuery, conversationFilter, activeList]);
  useEffect(() => {
    communityList.current?.scrollToOffset({ offset: 0, animated: false });
  }, [communityQuery]);
  const listPeople = activeList
    ? selectListPeople(data, userId, activeList)
    : null;
  const listName =
    activeList === "friends"
      ? "Friends"
      : activeList === "favorites"
        ? "Favorites"
        : (data.lists.find(
            (row) =>
              activeList === `custom:${row.id}` && row.owner_id === userId,
          )?.name ?? "Private list");
  const { cards, invitations, count, summary } = usePlanningResponses(now, () =>
    setResponsesOpen(false),
  );
  const allChats = useMemo(
    () => selectHubConversations(data, userId),
    [data, userId],
  );
  const chats = filterHubConversations(
    allChats,
    conversationFilter,
    activeQuery,
  ).filter(
    (row) => !listPeople || (row.kind === "friend" && listPeople.has(row.id)),
  );
  const startFriends = selectStartChatFriends(
    data,
    userId,
    activeQuery,
    allChats,
  ).filter((row) => !listPeople || listPeople.has(row.id));
  function changeSection(next: Section) {
    onSectionChange?.(next);
  }
  function openCommunity(type: SocialEntityType, id: string) {
    if (!userId || data.viewer_id !== userId) return;
    if (type === "squad") {
      if (canOpenSquadProfile(data, id, userId)) openSquad(id);
    } else if (type === "space") {
      const space = data.spaces.find((row) => row.id === id);
      if (
        space &&
        canReadSpace(data, id, userId) &&
        activeSpaceRole(space, data.space_members, userId)
      )
        router.push({ pathname: "/space/[id]", params: { id } });
    } else {
      const org = data.organizations.find((row) => row.id === id);
      if (
        org &&
        canReadOrganization(data, id, userId) &&
        activeOrganizationRole(org, data.organization_members, userId)
      )
        router.push({ pathname: "/organization/[id]", params: { id } });
    }
  }
  const communities: CommunityItem[] =
    !current || !userId
      ? []
      : [
          ...data.spaces.flatMap((space) => {
            const role = activeSpaceRole(space, data.space_members, userId);
            if (
              !role ||
              !canReadSpace(data, space.id, userId) ||
              !matchesSearch(communityQuery, space.name, space.description)
            )
              return [];
            return [
              {
                id: space.id,
                type: "space" as const,
                name: space.name,
                role,
                memberCount: data.space_members.filter(
                  (row) => row.space_id === space.id && row.status === "active",
                ).length,
                squads: visibleSpaceSquads(data, space.id, userId),
              },
            ];
          }),
          ...data.organizations.flatMap((org) => {
            const role = activeOrganizationRole(
              org,
              data.organization_members,
              userId,
            );
            if (
              !role ||
              !canReadOrganization(data, org.id, userId) ||
              !matchesSearch(communityQuery, org.name, org.description)
            )
              return [];
            const ids = new Set(
              data.organization_squads
                .filter((link) => link.organization_id === org.id)
                .map((link) => link.squad_id),
            );
            for (const spaceLink of data.organization_spaces.filter(
              (link) => link.organization_id === org.id,
            ))
              for (const squad of visibleSpaceSquads(
                data,
                spaceLink.space_id,
                userId,
              ))
                ids.add(squad.id);
            return [
              {
                id: org.id,
                type: "organization" as const,
                name: org.name,
                role,
                memberCount:
                  org.member_count ??
                  new Set([
                    org.owner_id,
                    ...data.organization_members
                      .filter(
                        (row) =>
                          row.organization_id === org.id &&
                          row.status === "active",
                      )
                      .map((row) => row.user_id),
                  ]).size,
                squads: data.squads.filter(
                  (squad) =>
                    ids.has(squad.id) &&
                    canOpenSquadProfile(data, squad.id, userId),
                ),
              },
            ];
          }),
        ].filter(
          (row) =>
            communityView === "All" ||
            (communityView === "Spaces"
              ? row.type === "space"
              : row.type === "organization"),
        );

  const refreshList = useCallback(async () => {
    setRefreshing(true);
    setRefreshError("");
    try {
      await refresh();
    } catch (failure) {
      setRefreshError(
        failure instanceof Error
          ? failure.message
          : "Couldn't refresh conversations.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  const showStartFriends =
    activeList ||
    conversationFilter === "Friends" ||
    conversationFilter === "All";
  const chatItems: ListItem[] =
    loading && !current
      ? Array.from({ length: 6 }, (_, index) => ({
          key: `loading:${index}`,
          type: "skeleton",
        }))
      : [
          ...chats.map((chat) => ({
            key: `${chat.kind}:${chat.id}`,
            type: "chat" as const,
            chat,
          })),
          ...(!chats.length && !(startFriends.length && showStartFriends)
            ? [{ key: "empty", type: "empty" as const }]
            : []),
          ...(showStartFriends
            ? [{ key: "friends-divider", type: "friends-divider" as const }]
            : []),
          ...(showStartFriends
            ? startFriends.map((person) => ({
                key: `start:${person.id}`,
                type: "person" as const,
                person,
              }))
            : []),
        ];
  const communityItems: ListItem[] = communities.map((community) => ({
    key: `${community.type}:${community.id}`,
    type: "community",
    community,
  }));
  communityItems.push({ key: "discover", type: "discovery" });
  const footerPadding = tokens.layout.scrollClearance + insets.bottom;

  function renderItem(item: ListItem) {
    if (item.type === "friends-divider")
      return (
        <View
          testID="chat-friends-divider"
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.line,
            marginTop: chats.length ? 12 : 0,
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find/Add Friends"
            onPress={findFriends}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.muted}>Friends · start a chat</Text>
            <Text style={[styles.label, { color: colors.green }]}>
              Add Friends
            </Text>
          </Pressable>
        </View>
      );
    if (item.type === "skeleton") return <Skeleton height={72} />;
    if (item.type === "chat")
      return (
        <HubConversationRow
          chat={item.chat}
          onGestureActive={setRowGestureActive}
          onProfile={() =>
            item.chat.kind === "squad"
              ? openCommunity("squad", item.chat.id)
              : router.push({
                  pathname: "/person/[id]",
                  params: { id: item.chat.id },
                })
          }
          onOpen={() => {
            if (item.chat.kind === "squad") {
              if (canOpenSquadProfile(data, item.chat.id, userId))
                router.push({
                  pathname: "/squad-chat/[id]",
                  params: {
                    id: item.chat.id,
                  },
                });
            } else
              router.push({
                pathname: "/messages/[id]",
                params: { id: item.chat.id },
              });
          }}
          onFavorite={async () => {
            await act("favorite", {
              kind: item.chat.kind,
              id: item.chat.id,
              add: !item.chat.starred,
            });
          }}
        />
      );
    if (item.type === "community")
      return (
        <ProfileLink
          title={item.community.name}
          detail={`${communityTypeLabel(item.community.type)} · ${item.community.memberCount} members${item.community.squads.length ? ` · ${item.community.squads.length} Squads` : ""}`}
          icon={
            item.community.type === "space" ? (
              <Layers3 size={22} color={colors.green} />
            ) : (
              <Building2 size={22} color={colors.green} />
            )
          }
          onPress={() => openCommunity(item.community.type, item.community.id)}
        />
      );
    if (item.type === "discovery")
      return (
        <View style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore Communities"
            accessibilityState={{ expanded: exploreOpen }}
            onPress={() => setExploreOpen((value) => !value)}
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={styles.h2}>Explore Communities</Text>
            <ChevronDown size={20} color={colors.green} />
          </Pressable>
          {communityQuery.length === 1 ? (
            <Txt muted>Type at least 2 characters to explore communities.</Txt>
          ) : exploreOpen || communityQuery ? (
            <HubDirectory
              query={communityQuery}
              explore
              entityType={
                communityView === "Spaces"
                  ? "space"
                  : communityView === "Organizations"
                    ? "organization"
                    : "all"
              }
              onOpen={openCommunity}
            />
          ) : null}
        </View>
      );
    if (item.type === "person")
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Message ${item.person.name}`}
          onPress={() =>
            router.push({
              pathname: "/messages/[id]",
              params: { id: item.person.id },
            })
          }
          style={{
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <ProfileAvatar profile={item.person.profile} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.body}>
              {item.person.name}
            </Text>
            <Text style={styles.muted}>Start Chat</Text>
          </View>
          <MessageCircle size={19} color={colors.green} />
        </Pressable>
      );
    const isNew =
      !allChats.length && !startFriends.length && !communities.length;
    return (
      <View style={{ gap: 12, paddingVertical: 16 }}>
        <MessageCircle size={28} color={colors.green} />
        <Text style={styles.h2}>
          {isNew
            ? "Find your people"
            : conversationFilter === "Unread"
              ? "All caught up"
              : activeQuery
                ? "No matching conversations"
                : "Start a conversation"}
        </Text>
        <Txt muted>
          {isNew
            ? "Meet people through a public Beacon, or say hello to someone you know."
            : conversationFilter === "Unread"
              ? "No unread messages."
              : "Send a hello to a friend or bring your Squad together."}
        </Txt>
        <ProfileActions>
          <Button
            compact
            title={isNew ? "Find people" : "Start a chat"}
            onPress={
              isNew
                ? findFriends
                : () => {
                    onNewMenuOpenChange(true);
                  }
            }
          />
          {isNew ? (
            <Button
              compact
              secondary
              title="Explore Beacons"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/activities",
                  params: { filter: "Upcoming" },
                })
              }
            />
          ) : null}
        </ProfileActions>
      </View>
    );
  }

  function controls(pageName: Section) {
    const value = queries?.[pageName] ?? query;
    return (
      <View style={{ gap: 8, paddingBottom: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            backgroundColor: colors.white,
            paddingHorizontal: 12,
          }}
        >
          <TextInput
            maxLength={pageName === "Communities" ? 80 : undefined}
            accessibilityLabel={
              pageName === "Chats"
                ? "Search conversations"
                : "Search communities"
            }
            placeholder={
              pageName === "Chats"
                ? "Search chats, friends, or squads"
                : "Search organizations, networks, or squads"
            }
            placeholderTextColor={colors.muted}
            value={value}
            onChangeText={(value) => onQueryChange(value, pageName)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              fontSize: 14,
              color: colors.ink,
            }}
          />
          {value ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => onQueryChange("", pageName)}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={styles.body}>×</Text>
            </Pressable>
          ) : null}
        </View>
        {pageName === "Chats" ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {CHAT_FILTERS.map((filter) => (
                <Pressable
                  key={filter}
                  accessibilityRole="button"
                  accessibilityLabel={filter}
                  accessibilityState={{
                    selected: conversationFilter === filter,
                  }}
                  onPress={() => onConversationFilterChange(filter)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                    borderRadius: 22,
                    backgroundColor:
                      conversationFilter === filter
                        ? semanticColors.accent
                        : colors.white,
                  }}
                >
                  <Text
                    style={[
                      styles.label,
                      {
                        color:
                          conversationFilter === filter
                            ? semanticColors.onAccent
                            : colors.muted,
                      },
                    ]}
                  >
                    {filter}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {activeList ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Clear ${listName} filter`}
                onPress={onClearList}
                style={{
                  alignSelf: "flex-start",
                  minHeight: 44,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                  borderRadius: 14,
                  backgroundColor: colors.white,
                }}
              >
                <Text style={styles.body}>{listName} ×</Text>
              </Pressable>
            ) : null}
            {count > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Responses & Invitations, ${count} pending`}
                onPress={() => setResponsesOpen(true)}
                style={{
                  minHeight: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.white,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                }}
              >
                <Bell size={20} color={colors.green} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.body}>
                    Responses & Invitations
                  </Text>
                  <Text numberOfLines={1} style={styles.muted}>
                    {summary}
                  </Text>
                </View>
                <Text style={{ color: colors.green, fontWeight: "700" }}>
                  {count}
                </Text>
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.h2}>Your Communities</Text>
        )}
      </View>
    );
  }
  function page(pageName: Section) {
    return (
      <FlashList
        ref={pageName === "Chats" ? chatList : communityList}
        key={pageName}
        data={pageName === "Chats" ? chatItems : communityItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => renderItem(item)}
        getItemType={(item) => item.type}
        ListHeaderComponent={controls(pageName)}
        ItemSeparatorComponent={() => (
          <View style={{ height: pageName === "Chats" ? 0 : 8 }} />
        )}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: footerPadding,
        }}
        refreshing={refreshing}
        onRefresh={() => {
          onSearchOpenChange(true);
          void refreshList();
        }}
        onScroll={(event) => {
          if (event.nativeEvent.contentOffset.y < -30 && !searchOpen)
            onSearchOpenChange(true);
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    );
  }
  return (
    <View style={{ flex: 1, minHeight: 0, gap: 8 }}>
      <View style={{ paddingHorizontal: 16 }}>
        {error || refreshError ? (
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error ?? refreshError}
            </Text>
            <Button
              secondary
              compact
              title="Try again"
              onPress={() => {
                void refreshList();
              }}
            />
          </View>
        ) : null}
      </View>
      {(["Chats", "Communities"] as const).map((destination) => (
        <View
          key={destination}
          style={{
            flex: 1,
            minHeight: 0,
            display: section === destination ? "flex" : "none",
          }}
        >
          {page(destination)}
        </View>
      ))}
      <ResponsesSheet
        visible={responsesOpen}
        onClose={() => setResponsesOpen(false)}
        pings={cards.filter((item) => item.kind === "ping")}
        votes={cards.filter((item) => item.kind === "vote")}
        draws={cards.filter((item) => item.kind === "draw")}
        invitations={invitations}
        onCreate={() => {
          setResponsesOpen(false);
          router.push("/councils");
        }}
      />
      <View style={{ height: 0, overflow: "hidden" }}>
        <SpacesDirectory
          hideWhenEmpty
          showHeader={false}
          createOpen={createSpaceOpen}
          onCreateOpenChange={onCreateSpaceOpenChange}
        />
        <OrganizationDirectory
          showHeader={false}
          showSearch={false}
          createOpen={createOrganizationOpen}
          onCreateOpenChange={onCreateOrganizationOpenChange}
        />
      </View>
      <Sheet
        title={section === "Chats" ? "New conversation" : "Create community"}
        visible={newMenuOpen}
        onClose={() => onNewMenuOpenChange(false)}
      >
        {section === "Chats" ? (
          <>
            <Button
              title="New message"
              onPress={() => {
                onNewMenuOpenChange(false);
                changeSection("Chats");
                onClearList?.();
                onConversationFilterChange("Friends");
                onSearchOpenChange(true);
                onQueryChange("", "Chats");
              }}
            />
          </>
        ) : null}
        <Button
          secondary
          title="Create a Squad"
          onPress={() => {
            onNewMenuOpenChange(false);
            createSquad();
          }}
        />
        {section === "Chats" ? (
          <>
            <Button
              secondary
              title="Add friend"
              onPress={() => {
                onNewMenuOpenChange(false);
                findFriends();
              }}
            />
          </>
        ) : null}
        {section === "Communities" ? (
          <>
            <View style={styles.row}>
              <Layers3 size={18} color={colors.green} />
              <Button
                secondary
                title="Create Organization"
                onPress={() => {
                  onNewMenuOpenChange(false);
                  onCreateSpaceOpenChange(true);
                }}
              />
            </View>
            <View style={styles.row}>
              <Building2 size={18} color={colors.green} />
              <Button
                secondary
                title="Create Network"
                onPress={() => {
                  onNewMenuOpenChange(false);
                  onCreateOrganizationOpenChange(true);
                }}
              />
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <UserPlus size={18} color={colors.green} />
            <Button
              secondary
              title="Invite friends"
              onPress={() => {
                onNewMenuOpenChange(false);
                (inviteFriends ?? findFriends)();
              }}
            />
          </View>
        )}
      </Sheet>
    </View>
  );
}
