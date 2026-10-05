import React, { useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import {
  Building2,
  CalendarClock,
  ChevronRight,
  Layers3,
  MessageCircle,
  Star,
  UserPlus,
  UsersRound,
} from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import { friendIds } from "@/src/shared/domain";
import { useNow } from "@/src/shared/useNow";
import { matchesSearch } from "@/src/shared/search";
import { canViewProfile } from "@/src/features/profile/privacy";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { PersonProfilePreview } from "@/src/features/people/previews/PersonProfilePreview";
import { SpaceProfilePreview } from "@/src/features/spaces/SpaceProfilePreview";
import { OrganizationProfilePreview } from "@/src/features/organizations/OrganizationProfilePreview";
import { SocialDirectoryResults } from "./SocialDirectoryResults";
import { MotionPressable } from "@/src/shared/MotionPressable";
import {
  Action,
  Avatar,
  Button,
  Empty,
  Field,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { PlanningInbox } from "@/src/features/planning/PlanningInbox";
import type { PlanningThread } from "@/src/features/planning/types";
import {
  canOpenSquadPing,
  pendingSocialCount,
  searchablePeople,
  squadChatRowSummary,
} from "./communication";
import { OrganizationDirectory } from "@/src/features/organizations/OrganizationDirectory";
import { SpacesDirectory } from "@/src/features/spaces/SpacesDirectory";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";

type Section = "Chats" | "Communities";
type InitialSection = Section | "Pings" | "Organizations";
type CommunityView = "All" | "Spaces" | "Organizations";
export type ChatFilter = "All" | "Unread" | "Starred" | "Squads" | "Friends";

function MenuRow({
  label,
  description,
  onPress,
  children,
}: {
  label: string;
  description?: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors, styles } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          minHeight: 58,
          paddingHorizontal: 12,
          paddingVertical: 9,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: colors.lime,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[styles.body, { fontWeight: "700" }]}>{label}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      <ChevronRight size={17} color={colors.muted} />
    </MotionPressable>
  );
}

export function CommunicationHub({
  openSquad,
  findFriends,
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
  const { data, userId, act } = useBeacon();
  const { colors, styles } = useTheme();
  const compactFilters = useWindowDimensions().width <= 360;
  const now = useNow();
  const [section, setSection] = useState<Section>(
    initialSection === "Organizations" || initialSection === "Communities" ? "Communities" : "Chats",
  );
  const [communityView, setCommunityView] = useState<CommunityView>(
    initialSection === "Organizations" ? "Organizations" : "All",
  );
  const [previewPersonId, setPreviewPersonId] = useState<string | null>(null);
  const [previewSpaceId, setPreviewSpaceId] = useState<string | null>(null);
  const [previewOrganizationId, setPreviewOrganizationId] = useState<string | null>(null);
  const [responsesOpen, setResponsesOpen] = useState(
    initialSection === "Pings",
  );
  const filter = searchOpen ? conversationFilter : "All";
  const count = pendingSocialCount(data, userId, now);
  const friends = friendIds(data, userId ?? "");
  const currentSnapshot = !!userId && data.viewer_id === userId;
  const activeQuery = searchOpen ? query : "";
  const searchPeopleResults = searchablePeople(data, userId, activeQuery);
  const searchBeaconResults = activeQuery.trim() && currentSnapshot && userId
    ? data.activities
        .filter(
          (activity) =>
            activity.status === "scheduled" &&
            Date.parse(activity.ends_at) > now &&
            matchesSearch(activeQuery, activity.title, activity.description ?? "", activity.category) &&
            canReadBeaconActivity(data, activity, userId),
        )
        .sort((first, second) => first.starts_at.localeCompare(second.starts_at))
        .slice(0, 8)
    : [];
  function changeSection(next: Section) {
    setSection(next);
    onSectionChange?.(next);
  }
  function openPlanningThread(thread: PlanningThread) {
    const squadId = thread.audience_id;
    if (!squadId || !canOpenSquadPing(data, thread, userId)) return false;
    router.push({
      pathname: "/squad-chat/[id]",
      params: { id: squadId, ping: thread.id },
    });
    return true;
  }
  const isStarred = (kind: string, id: string) =>
    data.favorites.some(
      (row) =>
        row.owner_id === userId && row.kind === kind && row.target_id === id,
    );
  const chats = (currentSnapshot ? [
    ...data.squads
      .filter((squad) => canOpenSquadProfile(data, squad.id, userId))
      .map((squad) => {
        const messages = (data.group_messages ?? [])
          .filter(
            (message) =>
              message.scope === "squad" &&
              message.squad_id === squad.id &&
              !data.blocks.some(
                (block) =>
                  (block.blocker_id === userId &&
                    block.blocked_id === message.author_id) ||
                  (block.blocked_id === userId &&
                    block.blocker_id === message.author_id),
              ),
          )
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        const read = (data.group_message_reads ?? []).find(
          (row) =>
            row.scope === "squad" &&
            row.squad_id === squad.id &&
            row.user_id === userId,
        );
        const summary = squadChatRowSummary(
          data,
          squad.id,
          userId,
          messages[0],
          squad.description.trim() || "Plan something together",
          now,
        );
        return {
          id: squad.id,
          kind: "Squads",
          name: squad.name,
          profile: undefined,
          latest: summary.latest,
          preview: summary.preview,
          pingId: summary.pingId,
          needsResponse: summary.needsResponse,
          unread: messages.filter(
            (message) =>
              message.author_id !== userId &&
              (!read || message.created_at > read.last_read_at),
          ).length,
          starred: isStarred("squad", squad.id),
        };
      }),
    ...data.profiles
      .filter((person) => friends.includes(person.id))
      .map((person) => {
        const messages = data.messages
          .filter(
            (message) =>
              !message.activity_id &&
              ((message.author_id === person.id &&
                message.recipient_id === userId) ||
                (message.author_id === userId &&
                  message.recipient_id === person.id)),
          )
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        const visible = canViewProfile(data, person, userId!);
        return {
          id: person.id,
          kind: "Friends",
          name: visible ? person.name : "Friend",
          profile: visible ? person : undefined,
          latest: messages[0]?.created_at ?? "",
          pingId: undefined,
          needsResponse: false,
          preview: messages[0]
            ? `${messages[0].author_id === userId ? "You: " : ""}${messages[0].body}`
            : "Start a conversation",
          unread: 0,
          starred: isStarred("friend", person.id),
        };
      }),
  ] : [])
    .filter(
      (chat) =>
        matchesSearch(activeQuery, chat.name, chat.preview) &&
        (filter === "All" ||
          (filter === "Unread"
            ? chat.unread > 0
            : filter === "Starred"
              ? chat.starred
              : chat.kind === filter)),
    )
    .sort(
      (a, b) =>
        b.latest.localeCompare(a.latest) ||
        Number(b.starred) - Number(a.starred) ||
        a.name.localeCompare(b.name),
    );
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          gap: 3,
          backgroundColor: colors.line + "88",
          borderRadius: 20,
        }}
      >
        {(
          [
            { label: "Chats", Icon: MessageCircle },
            { label: "Communities", Icon: Layers3 },
          ] as const
        ).map(({ label, Icon }) => (
          <MotionPressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: section === label }}
            onPress={() => changeSection(label)}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 54,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              backgroundColor: section === label ? colors.ink : "transparent",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Icon
                size={17}
                color={section === label ? colors.white : colors.muted}
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: section === label ? colors.white : colors.muted,
              }}
            >
              {label}
            </Text>
          </MotionPressable>
        ))}
      </View>
      {searchOpen ? (
        <Field
          label="Search people, Beacons, Squads and communities"
          value={query}
          onChangeText={onQueryChange}
          placeholder="Name or activity"
        />
      ) : null}
      {section === "Chats" ? (
        <>
          {searchOpen ? <View style={{ flexDirection: "row", gap: 4 }}>
            {["All", "Unread", "Starred", "Squads", "Friends"].map((value) => (
              <MotionPressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value}
                accessibilityState={{ selected: filter === value }}
        onPress={() => onConversationFilterChange(value as ChatFilter)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: filter === value ? colors.ink : colors.white,
                  borderWidth: 1,
                  borderColor: filter === value ? colors.ink : colors.line,
                }}
              >
                {value === "Starred" ? (
                  <View
                    style={{
                      flexDirection: compactFilters ? "column" : "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: compactFilters ? 0 : 4,
                    }}
                  >
                    <Star
                      size={14}
                      color={filter === value ? colors.white : colors.muted}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: filter === value ? colors.white : colors.muted,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                ) : (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: filter === value ? colors.white : colors.muted,
                    }}
                  >
                    {value}
                  </Text>
                )}
              </MotionPressable>
            ))}
          </View> : null}
          {currentSnapshot ? (
            <PlanningInbox
              limit={1}
              compact
              seeAllCount={count}
              onSeeAll={() => setResponsesOpen(true)}
              onOpenThread={openPlanningThread}
            />
          ) : null}
          <Text style={styles.h2}>Your conversations</Text>
          {chats.map((chat) => (
            <MotionPressable
              key={`${chat.kind}-${chat.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Message ${chat.name}`}
              onPress={() => {
                if (chat.kind === "Squads") {
                  router.push({
                    pathname: "/squad-chat/[id]",
                    params: { id: chat.id, ...(chat.pingId ? { ping: chat.pingId } : {}) },
                  });
                  return;
                }
                router.push({ pathname: "/messages/[id]", params: { id: chat.id } });
              }}
              style={[
                styles.card,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 8,
                  minHeight: 64,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={chat.kind === "Squads" ? `Open squad profile avatar ${chat.name}` : `Open profile avatar ${chat.name}`}
                onPress={(event) => {
                  event.stopPropagation();
                  if (chat.kind === "Squads") openSquad(chat.id);
                  else setPreviewPersonId(chat.id);
                }}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View style={{ width: 40, height: 40 }}>
                  {chat.kind === "Squads" ? (
                    <Avatar name={chat.name} size={40} />
                  ) : (
                    <ProfileAvatar profile={chat.profile} size={40} />
                  )}
                  {chat.starred ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        right: -2,
                        bottom: -2,
                        width: 17,
                        height: 17,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: colors.white,
                        backgroundColor: colors.lime,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Star
                        size={11}
                        color={colors.green}
                        fill={colors.green}
                      />
                    </View>
                  ) : null}
                </View>
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={chat.kind === "Squads" ? `Open squad profile ${chat.name}` : `Open profile ${chat.name}`}
                    onPress={(event) => {
                      event.stopPropagation();
                      if (chat.kind === "Squads") openSquad(chat.id);
                      else setPreviewPersonId(chat.id);
                    }}
                    style={{ flex: 1, minWidth: 0, minHeight: 32, justifyContent: "center" }}
                  >
                    <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{chat.name}</Text>
                  </Pressable>
                  {chat.latest ? <Text style={styles.label}>{new Date(chat.latest).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text> : null}
                </View>
                <View style={{ minHeight: 25, flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Text numberOfLines={1} style={[styles.muted, { flex: 1 }]}>{chat.preview}</Text>
                  {chat.needsResponse ? (
                    <View accessible accessibilityRole="image" accessibilityLabel="Needs your response">
                      <CalendarClock size={14} color={colors.green} />
                    </View>
                  ) : null}
                  {chat.unread ? <View style={{ minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" }}><Text accessibilityLabel={`${chat.unread} unread messages`} style={styles.label}>{chat.unread}</Text></View> : null}
                </View>
              </View>
            </MotionPressable>
          ))}
          {!chats.length ? (
            <Empty
              title={
                filter === "Unread"
                  ? "All caught up."
                  : "No conversations match this view."
              }
              body={
                filter === "Unread"
                  ? "No unread squad conversations."
                  : "Try another filter or start a new message."
              }
            />
          ) : null}
          {searchOpen && activeQuery.trim() && searchPeopleResults.length ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.h2}>People</Text>
              {searchPeopleResults.map((person) => (
                <MotionPressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open profile ${person.name}`}
                  onPress={() => setPreviewPersonId(person.id)}
                  style={[styles.card, { minHeight: 54, padding: 8, flexDirection: "row", alignItems: "center", gap: 9 }]}
                >
                  <ProfileAvatar profile={person} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{person.name}</Text>
                    <Text numberOfLines={1} style={styles.muted}>@{person.username}</Text>
                  </View>
                </MotionPressable>
              ))}
            </View>
          ) : null}
          {searchOpen && activeQuery.trim() ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.h2}>Communities</Text>
              <SocialDirectoryResults
                query={activeQuery}
                onOpenSquad={openSquad}
                onOpenSpace={setPreviewSpaceId}
                onOpenOrganization={setPreviewOrganizationId}
              />
            </View>
          ) : null}
          {searchOpen && activeQuery.trim() && searchBeaconResults.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.h2}>Beacons</Text>
              {searchBeaconResults.map((activity) => (
                <MotionPressable
                  key={activity.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open Beacon ${activity.title}`}
                  onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
                  style={[styles.card, { minHeight: 58, padding: 10, gap: 3 }]}
                >
                  <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{activity.title}</Text>
                  <Text numberOfLines={1} style={styles.muted}>{activity.category} · {new Date(activity.starts_at).toLocaleString()}</Text>
                </MotionPressable>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {searchOpen && activeQuery.trim() ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.h2}>Search all communities</Text>
              <SocialDirectoryResults
                query={activeQuery}
                onOpenSquad={openSquad}
                onOpenSpace={setPreviewSpaceId}
                onOpenOrganization={setPreviewOrganizationId}
              />
              {searchBeaconResults.length > 0 && (
                <View style={{ gap: 7 }}>
                  <Text style={styles.label}>BEACONS</Text>
                  {searchBeaconResults.map((activity) => (
                    <MotionPressable
                      key={activity.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open Beacon ${activity.title}`}
                      onPress={() => router.push({ pathname: "/activity/[id]", params: { id: activity.id } })}
                      style={[styles.card, { minHeight: 58, padding: 10, gap: 3 }]}
                    >
                      <Text numberOfLines={1} style={[styles.body, { fontWeight: "700" }]}>{activity.title}</Text>
                      <Text numberOfLines={1} style={styles.muted}>{activity.category} · {new Date(activity.starts_at).toLocaleString()}</Text>
                    </MotionPressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
          <>
          <View style={{ flexDirection: "row", gap: 5 }}>
            {(["All", "Spaces", "Organizations"] as const).map((view) => (
              <MotionPressable
                key={view}
                accessibilityRole="button"
                accessibilityLabel={view}
                accessibilityState={{ selected: communityView === view }}
                onPress={() => setCommunityView(view)}
                style={{ flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: communityView === view ? colors.ink : colors.white, borderWidth: 1, borderColor: communityView === view ? colors.ink : colors.line }}
              >
                <Text numberOfLines={1} style={{ color: communityView === view ? colors.white : colors.muted, fontSize: 12, fontWeight: "700" }}>{view}</Text>
              </MotionPressable>
            ))}
          </View>
          {communityView !== "Organizations" ? (
            <View style={{ gap: 8 }}>
              {communityView === "All" ? <Text style={styles.h2}>Spaces</Text> : null}
              <SpacesDirectory query={activeQuery} showHeader={false} createOpen={createSpaceOpen} onCreateOpenChange={onCreateSpaceOpenChange} />
            </View>
          ) : null}
          {communityView !== "Spaces" ? (
            <View style={{ gap: 8 }}>
              {communityView === "All" ? <Text style={styles.h2}>Organizations</Text> : null}
              <OrganizationDirectory query={activeQuery} showSearch={false} showHeader={false} createOpen={createOrganizationOpen} onCreateOpenChange={onCreateOrganizationOpenChange} />
            </View>
          ) : null}
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={styles.h2}>Discover</Text>
            <SocialDirectoryResults
              query=""
              entityType={communityView === "Spaces" ? "space" : communityView === "Organizations" ? "organization" : "all"}
              explore
              onOpenSquad={openSquad}
              onOpenSpace={setPreviewSpaceId}
              onOpenOrganization={setPreviewOrganizationId}
            />
          </View>
          </>
          )}
        </>
      )}
      <Sheet
        title="Responses & invitations"
        visible={responsesOpen}
        onClose={() => setResponsesOpen(false)}
      >
        <>
          <PlanningInbox
            onOpen={() => setResponsesOpen(false)}
            onOpenThread={openPlanningThread}
          />
          {data.friendships
            .filter(
              (row) => row.recipient_id === userId && row.status === "pending",
            )
            .map((row) => (
              <View key={row.id} style={styles.card}>
                <Txt>
                  {data.profiles.find((person) => person.id === row.sender_id)
                    ?.name ?? "Someone"}{" "}
                  wants to connect.
                </Txt>
                <Action
                  title="Accept friend"
                  run={() => act("accept_friend", { id: row.id })}
                />
              </View>
            ))}
          {data.squad_invites
            .filter((row) => row.recipient_id === userId)
            .map((row) => (
              <View key={row.id} style={styles.card}>
                <Txt>
                  Invitation to{" "}
                  {data.squads.find((squad) => squad.id === row.squad_id)
                    ?.name ?? "a squad"}
                </Txt>
                <Action
                  title="Accept squad invitation"
                  run={() => act("accept_squad", { id: row.id })}
                />
              </View>
            ))}
          {(data.organization_members ?? [])
            .filter((row) => row.user_id === userId && row.status === "invited")
            .map((row) => (
              <View key={row.organization_id} style={styles.card}>
                <Txt>
                  Invitation to{" "}
                  {data.organizations.find(
                    (org) => org.id === row.organization_id,
                  )?.name ?? "an organization"}
                </Txt>
                <View style={styles.row}>
                  <Action
                    title="Accept organization"
                    run={() =>
                      act("respond_organization_invite", {
                        organization_id: row.organization_id,
                        accept: true,
                      })
                    }
                  />
                  <Action
                    secondary
                    title="Decline"
                    run={() =>
                      act("respond_organization_invite", {
                        organization_id: row.organization_id,
                        accept: false,
                      })
                    }
                  />
                </View>
              </View>
            ))}
          {data.rsvps
            .filter((row) => {
              const beacon = data.activities.find(
                (item) => item.id === row.activity_id,
              );
              return (
                beacon?.status === "scheduled" &&
                Date.parse(beacon.ends_at) > now &&
                ((row.user_id === userId && row.status === "invited") ||
                  (beacon.owner_id === userId && row.status === "requested"))
              );
            })
            .map((row) => (
              <Button
                key={`${row.activity_id}-${row.user_id}`}
                secondary
                title={`${row.status === "requested" ? "Review request" : "Beacon invitation"}: ${data.activities.find((beacon) => beacon.id === row.activity_id)?.title ?? "Beacon"}`}
                onPress={() =>
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: row.activity_id },
                  })
                }
              />
            ))}
          {!count ? (
            <Empty
              title="You're all caught up."
              body="Pings, invitations, and decisions appear here when they need you."
            />
          ) : null}
          <Button
            compact
            secondary
            title="New Ping or Vote"
            onPress={() => router.push("/councils")}
          />
        </>
      </Sheet>
      <PersonProfilePreview
        key={previewPersonId ?? "no-person-preview"}
        personId={previewPersonId ?? ""}
        visible={!!previewPersonId}
        onClose={() => setPreviewPersonId(null)}
      />
      {previewSpaceId && (
        <SpaceProfilePreview
          spaceId={previewSpaceId}
          visible
          onClose={() => setPreviewSpaceId(null)}
        />
      )}
      {previewOrganizationId && (
        <OrganizationProfilePreview
          organizationId={previewOrganizationId}
          visible
          onClose={() => setPreviewOrganizationId(null)}
        />
      )}
      <Sheet
        title="Start something together"
        visible={newMenuOpen}
        onClose={() => onNewMenuOpenChange(false)}
      >
        <MenuRow
          label="New message"
          description="Choose a friend to open a conversation."
          onPress={() => {
            onNewMenuOpenChange(false);
            changeSection("Chats");
            onConversationFilterChange("Friends");
            onQueryChange("");
            onSearchOpenChange(true);
          }}
        >
          <MessageCircle size={19} color={colors.green} />
        </MenuRow>
        <MenuRow
          label="Create a Squad"
          description="Bring a usual crew together."
          onPress={() => {
            onNewMenuOpenChange(false);
            createSquad();
          }}
        >
          <UsersRound size={19} color={colors.green} />
        </MenuRow>
        <MenuRow
          label="Add friend"
          description="Find someone and send a friend request."
          onPress={() => {
            onNewMenuOpenChange(false);
            findFriends();
          }}
        >
          <UserPlus size={19} color={colors.green} />
        </MenuRow>
        {section === "Communities" ? (
          <>
            <MenuRow
              label="Create Space"
              description="A lightweight home for Squads."
              onPress={() => {
                onNewMenuOpenChange(false);
                setCommunityView("Spaces");
                onCreateSpaceOpenChange(true);
              }}
            >
              <Layers3 size={19} color={colors.green} />
            </MenuRow>
            <MenuRow
              label="Create Organization"
              description="Connect several Squads."
              onPress={() => {
                onNewMenuOpenChange(false);
                setCommunityView("Organizations");
                onCreateOrganizationOpenChange(true);
              }}
            >
              <Building2 size={19} color={colors.green} />
            </MenuRow>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
