import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { type Href, router } from "expo-router";
import {
  Bell,
  ChevronRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Layers3,
  MessageCircle,
  UserPlus,
  UsersRound,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { matchesSearch } from "@/src/shared/search";
import { SegmentedControl, Skeleton } from "@/src/shared/design-system";
import { Action, Button, Field, Sheet, Txt, useTheme } from "@/src/shared/ui";
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
import { searchablePeople } from "../communication";
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
import {
  ProfileActions,
  ProfileLink,
  ProfileSection,
} from "../components/ProfilePrimitives";
import { HubConversationRow } from "../components/HubConversationRow";
import { HubDirectory } from "../components/HubDirectory";

export type { ChatFilter } from "../hubState";
type Section = "Chats" | "Communities";
type InitialSection = Section | "Pings" | "Organizations";
type CommunityView = "All" | "Spaces" | "Organizations";
const CHAT_FILTERS = ["All", "Squads", "Friends", "Unread", "Starred"] as const;
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
  | { key: string; type: "community"; community: CommunityItem }
  | { key: string; type: "discovery" | "search" | "empty" | "skeleton" };

export function CommunicationHub({
  openSquad,
  findFriends,
  inviteFriends,
  createSquad,
  conversationFilter,
  onConversationFilterChange,
  initialSection = "Chats",
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
  searchOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
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
  const { colors, styles, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const section: Section =
    initialSection === "Organizations" || initialSection === "Communities"
      ? "Communities"
      : "Chats";
  const [communityView, setCommunityView] = useState<CommunityView>(
    initialSection === "Organizations" ? "Organizations" : "All",
  );
  const [responsesOpen, setResponsesOpen] = useState(
    initialSection === "Pings",
  );
  const [trayOpen, setTrayOpen] = useState(false);
  const setRowGestureActive = useCallback(() => {}, []);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const current = !!userId && data.viewer_id === userId;
  const activeQuery = searchOpen ? query.trim() : "";
  const { cards, invitations, count, summary } = usePlanningResponses(now, () =>
    setResponsesOpen(false),
  );
  const allChats = useMemo(
    () => selectHubConversations(data, userId, now),
    [data, now, userId],
  );
  const chats = filterHubConversations(
    allChats,
    conversationFilter,
    activeQuery,
  );
  const startFriends = selectStartChatFriends(data, userId, activeQuery);
  const people = searchablePeople(data, userId, activeQuery);
  function changeSection(next: Section) {
    onSectionChange?.(next);
    if (next !== section)
      router.push(
        (next === "Chats" ? "/(tabs)/squads" : "/communities") as Href,
      );
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
              !matchesSearch(activeQuery, space.name, space.description)
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
              !matchesSearch(activeQuery, org.name, org.description)
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
          ...(!chats.length ? [{ key: "empty", type: "empty" as const }] : []),
          ...(activeQuery ? [{ key: "search", type: "search" as const }] : []),
        ];
  const communityItems: ListItem[] = communities.map((community) => ({
    key: `${community.type}:${community.id}`,
    type: "community",
    community,
  }));
  communityItems.push({ key: "discover", type: "discovery" });
  const footerPadding =
    tokens.layout.tabBarHeight + insets.bottom + tokens.layout.scrollClearance;
  const allFriends = () =>
    router.push({
      pathname: "/(tabs)/squads",
      params: { tab: "Friends", peopleLists: "yes" },
    });

  function renderItem(item: ListItem) {
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
                    ...(item.chat.pingId ? { ping: item.chat.pingId } : {}),
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
          detail={`${communityTypeLabel(item.community.type)} · ${item.community.memberCount} members`}
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
          <Text style={styles.h2}>Discover</Text>
          <HubDirectory
            query={activeQuery}
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
        </View>
      );
    if (item.type === "search")
      return (
        <View style={{ gap: 12 }}>
          {people.length ? (
            <View style={{ gap: 7 }}>
              <Text style={styles.h2}>People</Text>
              {people.map((person) => (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open profile ${person.name}`}
                  onPress={() =>
                    router.push({
                      pathname: "/person/[id]",
                      params: { id: person.id },
                    })
                  }
                  style={[styles.row, { minHeight: 56 }]}
                >
                  <ProfileAvatar profile={person} size={44} />
                  <Text style={styles.body}>{person.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.h2}>Communities</Text>
          <HubDirectory query={activeQuery} onOpen={openCommunity} />
        </View>
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
              ? "No unread Squad messages."
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
                    setTrayOpen(true);
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

  function chatHeader() {
    return (
      <View style={{ gap: 14, paddingBottom: 12 }}>
        {count > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Responses & Invitations, ${count} pending`}
            onPress={() => setResponsesOpen(true)}
            style={({ pressed }) => ({
              minHeight: 76,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 16,
              backgroundColor: colors.white,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: colors.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={19} color={colors.green} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text style={[styles.body, { fontWeight: "700" }]}>
                Responses & Invitations
              </Text>
              <Text numberOfLines={2} style={styles.muted}>
                {summary}
              </Text>
            </View>
            <View
              style={{
                minWidth: 24,
                minHeight: 24,
                borderRadius: 12,
                paddingHorizontal: 5,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.lime,
              }}
            >
              <Text style={[styles.label, { color: colors.ink }]}>{count}</Text>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Responses & Invitations"
            onPress={() => setResponsesOpen(true)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={styles.muted}>Responses & Invitations</Text>
          </Pressable>
        )}
        {startFriends.length && (trayOpen || !allChats.length || activeQuery) ? (
          <View style={{ gap: 8 }}>
            <View style={styles.between}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  trayOpen ? "Collapse Start a chat" : "Expand Start a chat"
                }
                onPress={() => setTrayOpen((value) => !value)}
                style={[styles.row, { minHeight: 44 }]}
              >
                <Text style={styles.h2}>Start a chat</Text>
                {trayOpen ? (
                  <ChevronUp size={18} color={colors.muted} />
                ) : (
                  <ChevronDown size={18} color={colors.muted} />
                )}
              </Pressable>
              <Button
                compact
                secondary
                title="See all friends"
                onPress={allFriends}
              />
            </View>
            {trayOpen ? (
              <View style={{ gap: 4 }}>
                {startFriends.map((person) => (
                  <Pressable
                    key={person.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${person.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/messages/[id]",
                        params: { id: person.id },
                      })
                    }
                    style={({ pressed }) => ({
                      minHeight: 64,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <ProfileAvatar profile={person} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.body}>{person.name}</Text>
                      <Text style={styles.muted}>@{person.username}</Text>
                    </View>
                    <MessageCircle size={19} color={colors.green} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        {allChats.length ? (
          <Text style={styles.h2}>Your conversations</Text>
        ) : null}
      </View>
    );
  }
  function page(pageName: Section) {
    return (
      <FlashList
        key={pageName}
        data={pageName === "Chats" ? chatItems : communityItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => renderItem(item)}
        getItemType={(item) => item.type}
        ListHeaderComponent={
          pageName === "Chats" ? (
            chatHeader()
          ) : communities.length ? (
            <Text style={[styles.h2, { paddingBottom: 12 }]}>
              Your communities
            </Text>
          ) : null
        }
        ListFooterComponent={
          pageName === "Chats" && communities.length > 0 && !activeQuery ? (
            <View style={{ paddingTop: 20 }}>
              <ProfileSection
                title="Your communities"
                action={
                  <Button
                    compact
                    secondary
                    title="See all communities"
                    onPress={() => router.push("/communities" as Href)}
                  />
                }
              >
                {communities.slice(0, 2).map((community) => (
                  <ProfileLink
                    key={`${community.type}:${community.id}`}
                    title={community.name}
                    detail={communityTypeLabel(community.type)}
                    onPress={() => openCommunity(community.type, community.id)}
                  />
                ))}
              </ProfileSection>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: pageName === "Chats" ? 4 : 16 }} />
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
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        {searchOpen ? (
          <Field
            label="Search chats, people and communities"
            value={query}
            onChangeText={onQueryChange}
            placeholder="Name or message"
          />
        ) : null}
        {section === "Chats" && (searchOpen || conversationFilter !== "All") ? (
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
                accessibilityState={{ selected: conversationFilter === filter }}
                onPress={() => onConversationFilterChange(filter)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 15,
                  borderRadius: 22,
                  justifyContent: "center",
                  backgroundColor:
                    conversationFilter === filter ? colors.ink : colors.white,
                  borderWidth: 1,
                  borderColor: colors.line,
                }}
              >
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        conversationFilter === filter
                          ? colors.white
                          : colors.muted,
                    },
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : section === "Communities" && searchOpen ? (
          <SegmentedControl
            options={(["All", "Spaces", "Organizations"] as const).map(
              (value) => ({
                value,
                label:
                  value === "Spaces"
                    ? "Organizations"
                    : value === "Organizations"
                      ? "Networks"
                      : value,
              }),
            )}
            value={communityView}
            onChange={setCommunityView}
            accessibilityLabel="Community types"
          />
        ) : null}
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
      {page(section)}
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
        title="Start something together"
        visible={newMenuOpen}
        onClose={() => onNewMenuOpenChange(false)}
      >
        <Button
          title="New message"
          onPress={() => {
            onNewMenuOpenChange(false);
            changeSection("Chats");
            onConversationFilterChange("Friends");
            setTrayOpen(true);
            onSearchOpenChange(true);
            onQueryChange("");
          }}
        />
        <Button
          secondary
          title="Create a Squad"
          onPress={() => {
            onNewMenuOpenChange(false);
            createSquad();
          }}
        />
        <Button
          secondary
          title="Add friend"
          onPress={() => {
            onNewMenuOpenChange(false);
            findFriends();
          }}
        />
        <Action
          secondary
          title="New Ping or Vote"
          run={async () => {
            onNewMenuOpenChange(false);
            router.push("/councils");
          }}
        />
        <View style={styles.row}>
          <UsersRound size={18} color={colors.green} />
          <Txt muted>Your groups keep their own membership and privacy.</Txt>
        </View>
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
                title="Create Super-Organization"
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
