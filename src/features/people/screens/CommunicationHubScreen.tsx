import { NavigationFilterChip } from "@/src/shared/NavigationTabs";
import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import { OrganizationDirectory } from "@/src/features/organizations/OrganizationDirectory";
import {
  activeOrganizationRole,
  canReadOrganization,
  canReadOrganizationMembers,
} from "@/src/features/organizations/domain";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { canViewProfile } from "@/src/features/profile/privacy";
import { communityTypePlural } from "@/src/features/social/communityPresentation";
import type { SocialEntityType, SocialRole } from "@/src/features/social/types";
import { SpacesDirectory } from "@/src/features/spaces/SpacesDirectory";
import {
  activeSpaceRole,
  canReadSpace,
  visibleSpaceSquads,
} from "@/src/features/spaces/domain";
import { QuickChoiceDialog } from "@/src/shared/Dialogs";
import { Skeleton } from "@/src/shared/design-system";
import { matchesSearch } from "@/src/shared/search";
import { useBeacon } from "@/src/shared/store";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import type { SquadIconKey } from "@/src/shared/types";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { router } from "expo-router";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  MessageCircle,
  Search,
  SquarePen,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CommunityArtwork,
  CommunityCardDetails,
  CommunitySectionHeading,
  communityDirectoryTypes,
  communityRoleLabel,
} from "../components/CommunityCard";
import { HubConversationRow } from "../components/HubConversationRow";
import { HubDirectory } from "../components/HubDirectory";
import { ProfileActions } from "../components/ProfilePrimitives";
import { ResponsesSheet } from "../components/ResponsesSheet";
import {
  filterHubConversations,
  selectHubConversations,
  selectStartChatFriends,
  type ChatFilter,
  type HubConversation,
} from "../hubState";
import { selectListPeople, type PeopleListSelection } from "../privateLists";
import { activeSquadMembership, canOpenSquadProfile } from "../squadProfile";
import { usePlanningResponses } from "../usePlanningResponses";

export type { ChatFilter } from "../hubState";
type Section = "Chats" | "Communities";
type InitialSection = Section | "Pings" | "Organizations";
const CHAT_FILTERS = ["All", "Squads", "Friends", "Unread"] as const;
const joinedPreviewSize = (type: SocialEntityType) =>
  type === "organization" ? 1 : 2;
type CommunityItem = {
  id: string;
  type: SocialEntityType;
  name: string;
  description: string;
  memberCount: number;
  role: SocialRole;
  memberIds: string[];
  context?: string;
  iconKey?: SquadIconKey;
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
      type: "community-heading";
      entityType: SocialEntityType;
      count: number;
    }
  | {
      key: string;
      type: "search" | "empty" | "skeleton" | "friends-divider";
    };

export function CommunicationHub({
  focusedType,
  discoverOnly = false,
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
  focusedType?: SocialEntityType;
  discoverOnly?: boolean;
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
  const { colors, styles, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const section: Section =
    controlledSection ??
    (initialSection === "Organizations" || initialSection === "Communities"
      ? "Communities"
      : "Chats");
  const networkOnly = initialSection === "Organizations";
  const directoryTypes = focusedType
    ? [focusedType]
    : networkOnly
      ? communityDirectoryTypes.slice(0, 1)
      : communityDirectoryTypes;
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
          ...(!networkOnly
            ? data.spaces.flatMap((space) => {
                const role = activeSpaceRole(space, data.space_members, userId);
                if (
                  !role ||
                  !canReadSpace(data, space.id, userId) ||
                  !matchesSearch(communityQuery, space.name, space.description)
                )
                  return [];
                const memberIds = [
                  ...new Set([
                    space.owner_id,
                    ...data.space_members
                      .filter(
                        (row) =>
                          row.space_id === space.id && row.status === "active",
                      )
                      .map((row) => row.user_id),
                  ]),
                ];
                const squads = visibleSpaceSquads(data, space.id, userId);
                return [
                  {
                    id: space.id,
                    type: "space" as const,
                    name: space.name,
                    description: space.description,
                    role,
                    memberCount: memberIds.length,
                    memberIds,
                    context: squads.length
                      ? `Squads · ${squads.map((squad) => squad.name).join(", ")}`
                      : undefined,
                  },
                ];
              })
            : []),
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
            const spaceLinks = data.organization_spaces.filter(
              (link) => link.organization_id === org.id,
            );
            for (const spaceLink of spaceLinks)
              for (const squad of visibleSpaceSquads(
                data,
                spaceLink.space_id,
                userId,
              ))
                ids.add(squad.id);
            const memberIds = canReadOrganizationMembers(data, org.id, userId)
              ? [
                  ...new Set([
                    org.owner_id,
                    ...data.organization_members
                      .filter(
                        (row) =>
                          row.organization_id === org.id &&
                          row.status === "active",
                      )
                      .map((row) => row.user_id),
                  ]),
                ]
              : [];
            const linkedSpaces = data.spaces.filter(
              (space) =>
                spaceLinks.some((link) => link.space_id === space.id) &&
                canReadSpace(data, space.id, userId),
            );
            const squads = data.squads.filter(
              (squad) =>
                ids.has(squad.id) &&
                canOpenSquadProfile(data, squad.id, userId),
            );
            return [
              {
                id: org.id,
                type: "organization" as const,
                name: org.name,
                description: org.description,
                role,
                memberCount: org.member_count ?? memberIds.length,
                memberIds,
                context: linkedSpaces.length
                  ? `Organizations · ${linkedSpaces.map((space) => space.name).join(", ")}`
                  : squads.length
                    ? `Squads · ${squads.map((squad) => squad.name).join(", ")}`
                    : undefined,
              },
            ];
          }),
          ...(!networkOnly
            ? data.squads.flatMap((squad) => {
                const membership = activeSquadMembership(
                  data,
                  squad.id,
                  userId,
                );
                if (
                  !membership ||
                  !matchesSearch(communityQuery, squad.name, squad.description)
                )
                  return [];
                const memberIds = data.squad_members
                  .filter((row) => row.squad_id === squad.id)
                  .map((row) => row.user_id);
                return [
                  {
                    id: squad.id,
                    type: "squad" as const,
                    name: squad.name,
                    description: squad.description,
                    role: membership.role,
                    memberCount: memberIds.length,
                    memberIds,
                    iconKey: squad.icon_key,
                  },
                ];
              })
            : []),
        ];

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
  const communityItems: ListItem[] = discoverOnly
    ? []
    : directoryTypes.flatMap((type): ListItem[] => {
        const rows = communities.filter((community) => community.type === type);
        if (!rows.length) return [];
        const visible =
          communityQuery || focusedType
            ? rows
            : rows.slice(0, joinedPreviewSize(type));
        return [
          ...(!focusedType
            ? [
                {
                  key: `heading:${type}`,
                  type: "community-heading" as const,
                  entityType: type,
                  count: rows.length,
                },
              ]
            : []),
          ...visible.map((community) => ({
            key: `${type}:${community.id}`,
            type: "community" as const,
            community,
          })),
        ];
      });
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
    if (item.type === "community-heading") {
      const type = item.entityType;
      return (
        <CommunitySectionHeading
          type={type}
          title={communityTypePlural(type)}
          onToggle={
            !communityQuery && item.count > joinedPreviewSize(type)
              ? () =>
                  router.push({
                    pathname: "/community-directory",
                    params: { type },
                  })
              : undefined
          }
        />
      );
    }
    if (item.type === "community") {
      const { community } = item;
      const members = data.profiles
        .filter(
          (profile) =>
            profile.id !== userId &&
            community.memberIds.includes(profile.id) &&
            canViewProfile(data, profile, userId),
        )
        .slice(0, 3);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={community.name}
          accessibilityHint={[
            community.description,
            `${community.memberCount} members`,
            members.map((profile) => profile.name).join(", "),
          ]
            .filter(Boolean)
            .join(". ")}
          onPress={() => openCommunity(community.type, community.id)}
          style={({ pressed }) => [
            styles.card,
            { padding: 14, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <CommunityCardDetails
            {...community}
            badge={communityRoleLabel(community.role)}
            members={members}
          />
        </Pressable>
      );
    }
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
      <View style={{ gap: 8, paddingVertical: 8 }}>
        <SemanticEmpty
          name={
            activeQuery
              ? "empty.search"
              : conversationFilter === "Unread"
                ? "empty.responses"
                : isNew
                  ? "empty.chats"
                  : conversationFilter === "Squads"
                    ? "empty.squads"
                    : "empty.chats"
          }
          illustration={
            conversationFilter === "Unread" ? "complete" : "noFriends"
          }
          density="section"
        />
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

  function renderDiscovery() {
    if (focusedType) {
      if (!discoverOnly)
        return communityItems.length ? null : (
          <Txt muted>
            {communityQuery
              ? "No communities match your search."
              : "No joined communities here yet."}
          </Txt>
        );
      return communityQuery.length !== 1 ? (
        <HubDirectory
          entityType={focusedType}
          query={communityQuery}
          explore
          fullList
          onOpen={openCommunity}
        />
      ) : (
        <Txt muted>Type at least 2 characters to search.</Txt>
      );
    }
    return (
      <View style={{ gap: 14, paddingTop: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Explore Communities"
          accessibilityState={{ expanded: exploreOpen || !!communityQuery }}
          disabled={!!communityQuery}
          onPress={() => setExploreOpen((value) => !value)}
          style={[
            styles.card,
            styles.row,
            { backgroundColor: colors.lime, padding: 14, gap: 12 },
          ]}
        >
          <Compass size={25} color={colors.green} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={styles.h2}>Explore Communities</Text>
            <Text style={styles.muted}>
              Find Networks, Organizations, and Squads to join.
            </Text>
          </View>
          {exploreOpen || communityQuery ? (
            <ChevronUp size={20} color={colors.green} />
          ) : (
            <ChevronDown size={20} color={colors.green} />
          )}
        </Pressable>
        {communityQuery.length === 1 ? (
          <Txt muted>Type at least 2 characters to explore communities.</Txt>
        ) : exploreOpen || communityQuery ? (
          directoryTypes.map((type) => (
            <HubDirectory
              key={type}
              query={communityQuery}
              explore
              entityType={type}
              onOpen={openCommunity}
            />
          ))
        ) : null}
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
            gap: 8,
          }}
        >
          <Search size={17} color={colors.muted} accessible={false} />
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
                <NavigationFilterChip
                  key={filter}
                  label={filter}
                  testID={`chat-filter-visual-${filter}`}
                  selected={conversationFilter === filter}
                  onPress={() => onConversationFilterChange(filter)}
                />
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
            <View
              testID="chat-list-divider"
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{ height: 1, backgroundColor: colors.line, marginTop: 4 }}
            />
            <View
              testID="conversations-heading"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 44,
                gap: 8,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}
              >
                Conversations
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New conversation"
                onPress={() => onNewMenuOpenChange(true)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  gap: 6,
                  paddingHorizontal: 2,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <SquarePen size={16} color={colors.green} />
                <Text
                  style={{
                    color: colors.green,
                    fontSize: 12,
                    fontWeight: "500",
                  }}
                >
                  New chat
                </Text>
              </Pressable>
            </View>
          </>
        ) : !focusedType ? (
          <View
            style={{
              position: "relative",
              overflow: "hidden",
              gap: 6,
              padding: 17,
              borderRadius: 18,
              backgroundColor: tokens.categories.Social.tint,
            }}
          >
            <CommunityArtwork type="organization" />
            <Text
              style={[
                styles.label,
                { color: tokens.categories.Social.color, letterSpacing: 0.9 },
              ]}
            >
              PEOPLE & GROUPS
            </Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, { fontSize: 26, lineHeight: 33 }]}
            >
              Your Communities
            </Text>
            <Txt muted>
              {communities.length
                ? "The groups you belong to and the people you share them with."
                : communityQuery
                  ? "No joined communities match your search."
                  : "Communities you join will appear here."}
            </Txt>
          </View>
        ) : null}
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
        ListFooterComponent={
          pageName === "Communities" ? renderDiscovery() : undefined
        }
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
      {(focusedType
        ? (["Communities"] as const)
        : (["Chats", "Communities"] as const)
      ).map((destination) => (
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
      <QuickChoiceDialog
        title={section === "Chats" ? "New conversation" : "Create community"}
        visible={newMenuOpen}
        onClose={() => onNewMenuOpenChange(false)}
        items={[
          ...(section === "Chats"
            ? [
                {
                  label: "New message",
                  onPress: () => {
                    changeSection("Chats");
                    onClearList?.();
                    onConversationFilterChange("Friends");
                    onSearchOpenChange(true);
                    onQueryChange("", "Chats");
                  },
                },
              ]
            : []),
          { label: "Create a Squad", onPress: createSquad },
          ...(section === "Chats"
            ? [{ label: "Add friend", onPress: findFriends }]
            : []),
          ...(section === "Communities"
            ? [
                {
                  label: "Create Organization",
                  onPress: () => onCreateSpaceOpenChange(true),
                },
                {
                  label: "Create Network",
                  onPress: () => onCreateOrganizationOpenChange(true),
                },
              ]
            : [
                {
                  label: "Invite friends",
                  onPress: () => (inviteFriends ?? findFriends)(),
                },
              ]),
        ]}
      />
    </View>
  );
}
