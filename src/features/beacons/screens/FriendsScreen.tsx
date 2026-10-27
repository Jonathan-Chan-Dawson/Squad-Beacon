import { SemanticEmpty } from "@/src/features/onboarding/OnboardingUI";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, UsersRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDesignTheme } from "@/src/shared/design-system";
import { ChatKeyboardFrame } from "@/src/features/messages/ChatKeyboard";
import { HomeAction } from "../components/HomeAction";
import { useSocialFriendsController } from "../components/feed/SocialFriendsSection";
import {
  friendsScrollOffset,
  rememberFriendsScrollOffset,
  useFriendsBrowseState,
} from "../friendsBrowseSession";
import type { SocialFriend } from "../socialFriends";

export default function FriendsScreen() {
  const { colors, tokens } = useDesignTheme();
  const insets = useSafeAreaInsets();
  const controller = useSocialFriendsController({
    showSelectedPeople: true,
    sharedSelector: true,
  });
  const { friends, filtered, available, loading, userId, selectedIds } =
    controller;
  const [browse] = useFriendsBrowseState(userId);
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
            minHeight: 80,
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
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: tokens.availability.available.tint,
              borderWidth: 1,
              borderColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UsersRound size={22} color={colors.accent} />
            <View
              style={{
                position: "absolute",
                right: -3,
                top: -3,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: colors.accent,
                borderWidth: 2,
                borderColor: colors.bg,
              }}
            />
          </View>
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
              <Text style={{ color: colors.accent }}>
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
            paddingTop: 16,
            paddingBottom: 16 + (selectedIds.length ? 0 : insets.bottom),
          }}
          data={filtered}
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
            <View style={{ gap: 8, paddingBottom: 8 }}>
              {controller.controls}
              <Text
                style={{ color: colors.textSecondary, ...tokens.type.caption }}
              >
                Tap + to select for planning. Invitations wait until you
                publish.
              </Text>
              <Text
                accessibilityLiveRegion="polite"
                style={{ color: colors.textSecondary, ...tokens.type.caption }}
              >
                {filtered.length} {filtered.length === 1 ? "friend" : "friends"}
                {browse.query || browse.filter !== "All" || browse.listId
                  ? " matching"
                  : ""}
              </Text>
            </View>
          }
          ListFooterComponent={
            <View
              style={{
                marginTop: 12,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <HomeAction
                title="Find/Add Friends"
                onPress={() => router.push("/find-friends")}
              />
            </View>
          }
          ListEmptyComponent={
            loading ? (
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
      {controller.detailSheet}
    </View>
  );
}
