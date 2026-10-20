import { SocialSelector } from "@/src/features/people/components/SocialSelector";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, Plus, Radio, Radar, X, UsersRound } from "lucide-react-native";
import { HomeAction } from "../HomeAction";
import { BeaconIcon } from "../BeaconIcon";
import { useDesignTheme } from "@/src/shared/design-system";
import { Button, Field, Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { usePreferences } from "@/src/shared/preferences";
import { useNow } from "@/src/shared/useNow";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { StatusViewer } from "./StatusViewer";
import {
  availabilityLabel,
  filterSocialFriends,
  socialFriends,
  type SocialFriend,
} from "../../socialFriends";
import {
  useFriendsBrowseState,
  type FriendsFilter,
} from "../../friendsBrowseSession";
import { hubInviteeParams } from "../../hubSelectors";
import {
  usePlanningSelection,
  startPlanningDraft,
} from "../../socialPlanningSession";

export function useSocialFriendsController({
  showSelectedPeople = false,
  sharedSelector = false,
} = {}) {
  const { colors, tokens } = useDesignTheme();
  const { data, userId, loading } = useBeacon();
  const now = useNow();
  const friends = useMemo(
    () => socialFriends(data, userId, now),
    [data, userId, now],
  );
  const [selectedIds, setSelectedIds] = usePlanningSelection(userId);
  const [{ query, filter, listId }, updateBrowse] =
    useFriendsBrowseState(userId);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const afterDetail = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      afterDetail.current = null;
    },
    [],
  );
  const navigate = (action: () => void) => {
    if (detailId) {
      afterDetail.current = action;
      setDetailId(null);
    } else action();
  };
  const lists =
    data.viewer_id === userId
      ? data.lists.filter((list) => list.owner_id === userId)
      : [];
  const [visibleFriendIds, setVisibleFriendIds] = useState<string[] | null>(
    null,
  );
  const filtered = sharedSelector
    ? friends.filter(
        (friend) =>
          visibleFriendIds === null || visibleFriendIds.includes(friend.id),
      )
    : filterSocialFriends(friends, data, userId, {
        query,
        filter,
        listId,
      });
  const detail = friends.find((friend) => friend.id === detailId);
  const available = friends.filter((friend) =>
    ["available", "ending-soon"].includes(friend.availability),
  ).length;
  const toggle = (id: string) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    );
    setError("");
  };
  const openProfile = (id: string) => {
    navigate(() => router.push({ pathname: "/person/[id]", params: { id } }));
  };
  const plan = () => {
    try {
      const params = hubInviteeParams(
        selectedIds,
        friends.map((friend) => friend.id),
      );
      const planSession = startPlanningDraft(userId);
      setError("");
      router.push({ pathname: "/create", params: { ...params, planSession } });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Review your selection.",
      );
    }
  };
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <View
      key={label}
      style={{
        borderBottomWidth: selected ? 1 : 0,
        borderBottomColor: colors.accent,
      }}
    >
      <HomeAction title={label} selected={selected} onPress={onPress} plain />
    </View>
  );
  const controls = sharedSelector ? (
    <View style={{ gap: 8 }}>
      <SocialSelector
        friends={filterSocialFriends(friends, data, userId, {
          query: "",
          filter,
          listId,
        })}
        query={query}
        initialCategory={listId || filter === "Favorites" ? "Friends" : "All"}
        list={
          listId
            ? `custom:${listId}`
            : filter === "Favorites"
              ? "favorites"
              : "friends"
        }
        onListChange={(value) =>
          updateBrowse({
            listId: value.startsWith("custom:") ? value.slice(7) : null,
            filter:
              value === "favorites"
                ? "Favorites"
                : filter === "Favorites"
                  ? "All"
                  : filter,
          })
        }
        onQueryChange={(query) => updateBrowse({ query })}
        onCategoryChange={(category) => {
          if (category === "All") updateBrowse({ filter: "All", listId: null });
        }}
        selected={selectedIds.map((id) => ({ kind: "friend", id }))}
        onChange={(rows) =>
          setSelectedIds(
            rows.filter((row) => row.kind === "friend").map((row) => row.id),
          )
        }
        supportedKinds={["friend"]}
        bulk
        renderFriendRows={false}
        onVisibleFriendIdsChange={setVisibleFriendIds}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {(["Available", "In a Beacon"] as FriendsFilter[]).map((value) =>
          chip(value, filter === value, () =>
            updateBrowse({ filter: filter === value ? "All" : value }),
          ),
        )}
      </ScrollView>
    </View>
  ) : (
    <View style={{ gap: 8 }}>
      <Field
        label="Search all friends"
        value={query}
        onChangeText={(query) => updateBrowse({ query })}
        placeholder="Find your people"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 6 }}
      >
        {(
          ["All", "Available", "In a Beacon", "Favorites"] as FriendsFilter[]
        ).map((value) =>
          chip(value, filter === value, () => updateBrowse({ filter: value })),
        )}
      </ScrollView>
      {lists.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {chip("All lists", !listId, () => updateBrowse({ listId: null }))}
          {lists.map((list) =>
            chip(list.name, listId === list.id, () =>
              updateBrowse({ listId: list.id }),
            ),
          )}
        </ScrollView>
      ) : null}
    </View>
  );
  const action = selectedIds.length ? (
    <View style={{ gap: 4 }}>
      {showSelectedPeople ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 6 }}
        >
          {selectedIds.map((id) => (
            <HomeAction
              key={id}
              title={
                friends.find((friend) => friend.id === id)?.name ??
                "Selected friend"
              }
              label={`Remove ${friends.find((friend) => friend.id === id)?.name ?? "friend"} from plan`}
              icon={<X size={13} color={colors.textSecondary} />}
              onPress={() => toggle(id)}
            />
          ))}
        </ScrollView>
      ) : null}
      <View
        testID="social-plan-action"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 8,
          minHeight: 48,
          backgroundColor: tokens.availability.available.tint,
          borderRadius: 12,
        }}
      >
        <Text
          style={{
            flex: 1,
            minWidth: 0,
            color: colors.textPrimary,
            fontSize: 13,
            lineHeight: 18,
            fontWeight: "500",
          }}
        >
          {selectedIds.length} selected
          {showSelectedPeople ? "" : " for planning"}
        </Text>
        <HomeAction
          label="Clear selection"
          onPress={() => {
            setSelectedIds([]);
            setError("");
          }}
          plain
          icon={<X size={16} color={colors.textSecondary} />}
        />
        <HomeAction
          title={`Plan with ${selectedIds.length}`}
          primary
          onPress={plan}
        />
      </View>
    </View>
  ) : null;
  const row = (friend: SocialFriend) => (
    <SocialFriendRow
      key={friend.id}
      friend={friend}
      selected={selectedIds.includes(friend.id)}
      now={now}
      openProfile={openProfile}
      openDetail={setDetailId}
      toggle={toggle}
    />
  );
  const detailSheet = (
    <StatusViewer
      personId={detailId}
      visible={!!detailId}
      onClose={() => setDetailId(null)}
      onDismiss={() => {
        const callback = afterDetail.current;
        afterDetail.current = null;
        callback?.();
      }}
    >
      {detail && (
        <Button
          title={
            selectedIds.includes(detail.id)
              ? "Remove from plan"
              : "Select for planning"
          }
          onPress={() => {
            toggle(detail.id);
            setDetailId(null);
          }}
        />
      )}
    </StatusViewer>
  );
  return {
    friends,
    filtered,
    available,
    loading,
    row,
    controls,
    action,
    detailSheet,
    error,
    userId,
    selectedIds,
  };
}

export function SocialFriendRow({
  friend,
  selected,
  now,
  openProfile,
  openDetail,
  toggle,
}: {
  friend: SocialFriend;
  selected: boolean;
  now: number;
  openProfile: (id: string) => void;
  openDetail: (id: string) => void;
  toggle: (id: string) => void;
}) {
  const { colors, tokens } = useDesignTheme();
  const { showAvatars } = usePreferences();
  const status =
    tokens.availability[
      friend.availability === "ending-soon" ? "endingSoon" : friend.availability
    ];
  const mergedFeaturedCurrent =
    friend.currentBeacon?.activity.id === friend.attachment?.id &&
    friend.attachment?.type === "beacon";
  return (
    <View
      key={friend.id}
      testID={`social-friend-${friend.id}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 64,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {showAvatars ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${friend.name}'s profile`}
          onPress={() => openProfile(friend.id)}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              padding: 1,
              borderRadius: 23,
              borderWidth: 1,
              borderColor: friend.ping ? colors.accent : colors.border,
            }}
          >
            <ProfileAvatar profile={friend.profile} size={38} />
            <View
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: status.color,
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            />
          </View>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${friend.name}'s shared status`}
        onPress={() => openDetail(friend.id)}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                color: colors.textPrimary,
                fontSize: 14,
                lineHeight: 20,
                fontWeight: "500",
              }}
            >
              {friend.name}
            </Text>
            {friend.beacon && !friend.currentBeacon ? (
              <View accessible accessibilityLabel="In a Beacon">
                <Radio size={12} color={colors.accent} />
              </View>
            ) : null}
            {friend.ping && !friend.currentBeacon ? (
              <View accessible accessibilityLabel="Shared Ping">
                <Radar size={12} color={colors.accent} />
              </View>
            ) : null}
          </View>
          <Text
            testID={`availability-badge-${friend.id}`}
            accessibilityLabel={`Availability: ${status.label}`}
            numberOfLines={2}
            style={{
              color: status.color,
              fontSize: 12,
              lineHeight: 16,
              fontWeight: "400",
            }}
          >
            {availabilityLabel(friend, now)}
          </Text>
          {!!friend.statusText && (
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {friend.statusText}
            </Text>
          )}
          {friend.attachment && !mergedFeaturedCurrent ? (
            <Text
              numberOfLines={1}
              style={{ color: colors.accent, fontSize: 11, lineHeight: 16 }}
            >
              {friend.attachment.type === "vote"
                ? "Vote Council"
                : friend.attachment.type[0].toUpperCase() +
                  friend.attachment.type.slice(1)}{" "}
              · {friend.attachment.title}
            </Text>
          ) : null}
          {friend.currentBeacon ? (
            <Text
              numberOfLines={1}
              style={{ color: colors.accent, fontSize: 11, lineHeight: 16 }}
            >
              {mergedFeaturedCurrent
                ? "Featured · Happening now"
                : "Happening now"}{" "}
              · {friend.currentBeacon.activity.title}
            </Text>
          ) : !friend.attachment && !friend.statusText && friend.beacon ? (
            <View
              style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
            >
              <BeaconIcon
                emoji={friend.beacon.emoji}
                category={friend.beacon.category}
                size={16}
                inline
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 18,
                  fontWeight: "400",
                }}
              >
                {friend.beacon.label} · {friend.beacon.title}
              </Text>
              {
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    lineHeight: 16,
                    fontWeight: "400",
                  }}
                >
                  {friend.beacon.goingCount} going
                </Text>
              }
            </View>
          ) : !friend.attachment && !friend.statusText && friend.ping ? (
            <View
              style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
            >
              <Radar size={13} color={colors.accent} />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 18,
                  fontWeight: "400",
                }}
              >
                Ping · {friend.ping.title}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${selected ? "Deselect" : "Select"} ${friend.name} for planning`}

        accessibilityHint="Select for planning. Invitations are sent only when you publish a Beacon."
        accessibilityState={{ selected }}
        onPress={() => toggle(friend.id)}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: selected ? colors.accent : colors.textSecondary,
            backgroundColor: selected ? colors.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? (
            <Check size={13} color={colors.onAccent} />
          ) : (
            <Plus size={15} color={colors.accent} />
          )}
        </View>
      </Pressable>
    </View>
  );
}

export function SocialFriendsSection() {
  const { colors, tokens } = useDesignTheme();
  const { friends, available, loading, row, action, detailSheet, error } =
    useSocialFriendsController();
  return (
    <View
      testID="friends-right-now"
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              lineHeight: 24,
              fontWeight: "500",
              letterSpacing: -0.5,
            }}
          >
            Friends Right Now
          </Text>
          <Text style={{ color: colors.textSecondary, ...tokens.type.caption }}>
            <Text style={{ color: colors.accent, fontWeight: "500" }}>
              {available} available
            </Text>
            {" · "}
            {friends.filter((friend) => friend.beacon).length} in Beacons
          </Text>
        </View>
        <HomeAction
          title="View all →"
          label="View all friends"
          plain
          icon={<UsersRound size={16} color={colors.accent} />}
          onPress={() => router.push("/friends")}
        />
      </View>
      {!available && friends.length ? (
        <Txt muted>
          No shared availability right now. You can still make a plan.
        </Txt>
      ) : null}
      {friends.slice(0, 4).map(row)}
      {!friends.length ? (
        <View style={{ gap: 8 }}>
          <Txt muted>
            {loading
              ? "Loading your people…"
              : "Good plans start with your people."}
          </Txt>
          {!loading ? (
            <HomeAction
              plain
              title="Find friends"
              onPress={() => router.push("/find-friends")}
            />
          ) : null}
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      {action}
      {detailSheet}
    </View>
  );
}
