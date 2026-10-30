import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, ChevronDown, Search } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDesignTheme, useReducedMotion } from "@/src/shared/design-system";
import { useBeacon } from "@/src/shared/store";
import { matchesSearch } from "@/src/shared/search";
import { SocialChoiceRow } from "@/src/shared/SocialChoiceRow";
import { CommunityAvatar } from "@/src/features/people/components/CommunityAvatar";
import { PrivateListsSheet } from "@/src/features/people/components/PrivateListsSheet";
import { filteredFriendIds } from "@/src/features/people/friendGroupFilters";
import {
  recipientCategory,
  recipientKey,
  selectableSocialGroups,
  socialCategories,
  type SocialCategory,
} from "@/src/features/people/socialSelection";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { HomeAction } from "../components/HomeAction";
import { useSocialFriendsController } from "../components/feed/SocialFriendsSection";
import { filterSocialFriends } from "../socialFriends";
import { setPlanningSelection } from "../socialPlanningSession";
import {
  friendsScrollOffset,
  rememberFriendsScrollOffset,
  useFriendsBrowseState,
} from "../friendsBrowseSession";
import type { SocialFriend } from "../socialFriends";

export default function FriendsScreen() {
  const { colors, tokens } = useDesignTheme();
  const { data } = useBeacon();
  const insets = useSafeAreaInsets();
  const controller = useSocialFriendsController({
    showSelectedPeople: true,
  });
  const { friends, filtered, available, loading, userId, selectedIds } =
    controller;
  const [browse, updateBrowse] = useFriendsBrowseState(userId);
  const [category, setCategory] = useState<SocialCategory>("All");
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [shownGroups, setShownGroups] = useState(8);
  const [shownMembers, setShownMembers] = useState(8);
  const [listsOpen, setListsOpen] = useState(false);
  const list = useRef<FlatList<SocialFriend>>(null);
  const [initialOffset] = useState(() => friendsScrollOffset(userId));
  const restore = useRef({
    target: initialOffset,
    pending: true,
    content: 0,
    height: 0,
    atEnd: false,
  });
  const restoreScroll = useCallback(() => {
    if (
      !restore.current.pending ||
      !restore.current.content ||
      !restore.current.height
    )
      return;
    const offset = Math.min(
      restore.current.target,
      Math.max(0, restore.current.content - restore.current.height),
    );
    list.current?.scrollToOffset({ offset, animated: false });
    // Initial virtualization may measure only the first batch. Keep restoring
    // as the estimated content grows; only clamp permanently at the real end.
    restore.current.pending =
      offset < restore.current.target && !restore.current.atEnd;
  }, [restore]);
  useFocusEffect(
    useCallback(() => {
      restore.current.target = friendsScrollOffset(userId);
      restore.current.pending = true;
      restore.current.atEnd = false;
      restoreScroll();
    }, [restore, restoreScroll, userId]),
  );
  const previousBrowse = useRef(browse);
  useEffect(() => {
    if (previousBrowse.current !== browse) {
      previousBrowse.current = browse;
      restore.current.pending = false;
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [browse, restore]);
  const inBeacons = friends.filter((friend) => friend.beacon).length;
  const showFriends = category === "All" || category === "Friends";
  const showGroups =
    category !== "Friends" && (category !== "All" || groupsOpen);
  const baseFriends = filterSocialFriends(friends, data, userId, {
    query: "",
    filter: browse.filter,
    listId: browse.listId,
  });
  const groups = selectableSocialGroups(data, userId)
    .filter(
      (group) =>
        category === "All" || recipientCategory[group.kind] === category,
    )
    .map((group) => {
      const eligible = filteredFriendIds(data, userId, { group });
      const members = baseFriends.filter((friend) => eligible.has(friend.id));
      const nameMatches = matchesSearch(browse.query, group.name);
      const matching = nameMatches
        ? members
        : members.filter((friend) =>
            matchesSearch(browse.query, friend.name, friend.note?.title ?? ""),
          );
      return { ...group, members: matching, nameMatches };
    })
    .filter((group) => group.nameMatches || group.members.length > 0);
  const listName = data.lists.find(
    (item) => item.id === browse.listId && item.owner_id === userId,
  )?.name;
  const tab = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      onPress={onPress}
      style={{
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 10,
        justifyContent: "center",
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.accent : "transparent",
      }}
    >
      <Text
        style={{
          color: active ? colors.accent : colors.textSecondary,
          fontSize: 13,
          fontWeight: active ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const friendControls = (
    <View style={{ gap: 2 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 4 }}
      >
        {(["Favorites", "Available", "In a Beacon"] as const).map((value) =>
          tab(value, browse.filter === value, () =>
            updateBrowse({ filter: browse.filter === value ? "All" : value }),
          ),
        )}
        <HomeAction
          title={`Select all shown (${filtered.length})`}
          label={`Select all shown (${filtered.length})`}
          disabled={!filtered.length}
          onPress={() =>
            setPlanningSelection(userId, [
              ...selectedIds,
              ...filtered.map((friend) => friend.id),
            ])
          }
          plain
        />
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <HomeAction
          title={listName ? `Private list · ${listName}` : "Private Lists"}
          label="Manage Private Lists"
          onPress={() => setListsOpen(true)}
          plain
        />
        {browse.listId && (
          <HomeAction
            title="Clear list"
            onPress={() => updateBrowse({ listId: null })}
            plain
          />
        )}
      </View>
    </View>
  );
  const groupRows = showGroups ? (
    <View>
      {groups.slice(0, shownGroups).map((group) => {
        const key = recipientKey(group);
        const expanded = expandedGroup === key;
        return (
          <View
            key={key}
            style={
              expanded
                ? {
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: 12,
                    paddingHorizontal: 6,
                  }
                : undefined
            }
          >
            <SocialChoiceRow
              label={group.name}
              detail={`${group.members.length} eligible friends`}
              icon={<CommunityAvatar type={group.kind} size={32} />}
              accessibilityLabel={`Filter friends in ${group.name}`}
              browse
              expanded={expanded}
              onPress={() => {
                setExpandedGroup(expanded ? null : key);
                setShownMembers(8);
              }}
            />
            {expanded && (
              <View style={{ paddingLeft: 12, paddingBottom: 6 }}>
                {group.members.slice(0, shownMembers).map(controller.row)}
                {group.members.length > shownMembers && (
                  <HomeAction
                    title="Show more friends"
                    onPress={() => setShownMembers((value) => value + 8)}
                  />
                )}
                {!group.members.length && (
                  <Text style={{ color: colors.textSecondary, padding: 10 }}>
                    No eligible friends in this group.
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
      {groups.length > shownGroups && (
        <HomeAction
          title="Show more groups"
          onPress={() => setShownGroups((value) => value + 8)}
        />
      )}
      {!groups.length && (
        <Text style={{ color: colors.textSecondary, paddingVertical: 10 }}>
          No matching groups.
        </Text>
      )}
    </View>
  ) : null;
  return (
    <View
      testID="friends-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={{
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: tokens.layout.contentMaxWidth,
            alignSelf: "center",
            paddingHorizontal: tokens.layout.screenGutter,
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Beacons"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/activities")
            }
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={21} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                lineHeight: 28,
                fontWeight: "500",
              }}
            >
              Friends
            </Text>
            <Text
              testID="friends-summary"
              style={{ color: colors.textSecondary, ...tokens.type.caption }}
            >
              <Text style={{ color: tokens.availability.available.color }}>
                {available} available
              </Text>
              {" · "}
              {inBeacons} in Beacons{" · "}
              {friends.length} friends
            </Text>
          </View>
          <HomeAction
            title="Add Friends"
            onPress={() => router.push("/find-friends")}
          />
        </View>
      </View>
      <ChatKeyboardFrame compact>
        <FlatList<SocialFriend>
          key={userId}
          ref={list}
          testID="friends-list"
          style={{ flex: 1 }}
          contentContainerStyle={{
            width: "100%",
            maxWidth: tokens.layout.contentMaxWidth,
            alignSelf: "center",
            paddingHorizontal: tokens.layout.screenGutter,
            paddingTop: 12,
            paddingBottom: 16 + (selectedIds.length ? 0 : insets.bottom),
          }}
          data={showFriends && friendsOpen ? filtered : []}
          extraData={selectedIds}
          keyExtractor={(friend) => friend.id}
          renderItem={({ item }) => controller.row(item)}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentOffset={{ x: 0, y: initialOffset }}
          onLayout={(event) => {
            restore.current.height = event.nativeEvent.layout.height;
            restoreScroll();
          }}
          onContentSizeChange={(_width, height) => {
            restore.current.content = height;
            restoreScroll();
          }}
          onEndReached={() => {
            restore.current.atEnd = true;
            restoreScroll();
          }}
          onEndReachedThreshold={0.1}
          onScrollBeginDrag={() => {
            restore.current.pending = false;
          }}
          onScroll={(event) => {
            if (!restore.current.pending)
              rememberFriendsScrollOffset(
                userId,
                event.nativeEvent.contentOffset.y,
              );
          }}
          scrollEventThrottle={100}
          ListHeaderComponent={
            <View style={{ gap: 4, paddingBottom: 4 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                }}
              >
                <Search
                  size={17}
                  color={colors.textSecondary}
                  accessible={false}
                />
                <TextInput
                  accessibilityLabel="Search people and groups"
                  placeholder="Search people and groups"
                  placeholderTextColor={colors.textSecondary}
                  value={browse.query}
                  onChangeText={(query) => updateBrowse({ query })}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 44,
                    color: colors.textPrimary,
                    fontSize: 14,
                  }}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 4 }}
              >
                {socialCategories.map((value) =>
                  tab(value, category === value, () => {
                    setCategory(value);
                    setShownGroups(8);
                    if (value === "All")
                      updateBrowse({ filter: "All", listId: null });
                  }),
                )}
              </ScrollView>
              {category === "All" && (
                <FriendsDisclosure
                  title="Groups"
                  count={groups.length}
                  open={groupsOpen}
                  onPress={() => setGroupsOpen(!groupsOpen)}
                />
              )}
              {groupRows}
              {showFriends && (
                <FriendsDisclosure
                  title="Friends"
                  count={filtered.length}
                  open={friendsOpen}
                  onPress={() => setFriendsOpen(!friendsOpen)}
                />
              )}
              {showFriends && friendsOpen && friendControls}
            </View>
          }
          ListEmptyComponent={
            !(showFriends && friendsOpen) ? null : loading ? (
              <Text style={{ color: colors.textSecondary, padding: 24 }}>
                Loading your people…
              </Text>
            ) : (
              <SemanticEmpty
                name={friends.length ? "empty.filtered" : "empty.friends"}
                illustration="noFriends"
                density="section"
                action={
                  friends.length
                    ? undefined
                    : {
                        label: "Find Friends",
                        onPress: () => router.push("/find-friends"),
                      }
                }
              />
            )
          }
        />
        {controller.error || selectedIds.length ? (
          <View
            testID="friends-planning-footer"
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
              paddingBottom: Math.max(8, insets.bottom),
              paddingTop: 4,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: tokens.layout.contentMaxWidth,
                alignSelf: "center",
                paddingHorizontal: tokens.layout.screenGutter,
                gap: 4,
              }}
            >
              {controller.error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.danger }}
                >
                  {controller.error}
                </Text>
              ) : null}
              {controller.action}
            </View>
          </View>
        ) : null}
      </ChatKeyboardFrame>
      <PrivateListsSheet
        visible={listsOpen}
        onClose={() => setListsOpen(false)}
        onSelect={(selection) => {
          updateBrowse({
            listId: selection.startsWith("custom:") ? selection.slice(7) : null,
            filter: selection === "favorites" ? "Favorites" : "All",
          });
        }}
      />
      {controller.detailSheet}
    </View>
  );
}

function FriendsDisclosure({
  title,
  count,
  open,
  onPress,
}: {
  title: string;
  count: number;
  open: boolean;
  onPress: () => void;
}) {
  const { colors } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const [rotation] = useState(() => new Animated.Value(open ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(rotation, {
      toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : 150,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [open, reducedMotion, rotation]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} (${count})`}
      accessibilityState={{ expanded: open }}
      aria-expanded={open}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
      }}
    >
      <Text
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontSize: 15,
          fontWeight: "600",
        }}
      >
        {title}{" "}
        <Text style={{ color: colors.textSecondary, fontWeight: "400" }}>
          {count}
        </Text>
      </Text>
      <Animated.View
        style={{
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ["-90deg", "0deg"],
              }),
            },
          ],
        }}
      >
        <ChevronDown size={18} color={colors.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}
