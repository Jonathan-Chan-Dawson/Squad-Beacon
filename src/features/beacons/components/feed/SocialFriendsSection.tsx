import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  Check,
  X,
  UsersRound,
  ArrowRight,
  CircleHelp,
  Radio,
} from "lucide-react-native";
import { HomeAction } from "../HomeAction";
import { useDesignTheme } from "@/src/shared/design-system";
import { Button, Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { usePreferences } from "@/src/shared/preferences";
import { useNow } from "@/src/shared/useNow";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { ActionRow, ContextMenu } from "@/src/shared/ContextMenu";
import { StatusViewer } from "./StatusViewer";
import {
  availabilityLabel,
  filterSocialFriends,
  socialFriends,
  type SocialFriend,
} from "../../socialFriends";
import {
  initializeFriendsScope,
  useFriendsBrowseState,
} from "../../friendsBrowseSession";
import { hubInviteeParams } from "../../hubSelectors";
import {
  eligibleCreationInvitees,
  validateCreationInvitees,
} from "../../createHandoff";
import {
  usePlanningSelection,
  startPlanningDraft,
} from "../../socialPlanningSession";

export function useSocialFriendsController() {
  const { colors, tokens } = useDesignTheme();
  const { data, userId, loading } = useBeacon();
  const now = useNow();
  const friends = useMemo(
    () => socialFriends(data, userId, now),
    [data, userId, now],
  );
  const [selectedIds, setSelectedIds] = usePlanningSelection(userId);
  const [browse] = useFriendsBrowseState(userId);
  const [session, setSession] = useState({
    viewer: userId,
    detailId: null as string | null,
    error: "",
  });
  if (session.viewer !== userId)
    setSession({ viewer: userId, detailId: null, error: "" });
  const { detailId, error } = session;
  const setDetailId = (id: string | null) =>
    setSession((previous) => ({ ...previous, detailId: id }));
  const setError = (message: string) =>
    setSession((previous) => ({ ...previous, error: message }));
  const afterDetail = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!loading && userId && data.viewer_id === userId) {
      initializeFriendsScope(
        userId,
        friends.some((friend) => friend.starred),
        data.lists
          .filter((list) => list.owner_id === userId)
          .map((list) => list.id),
      );
    }
  }, [data, friends, loading, userId]);
  useEffect(() => {
    afterDetail.current = null;
    return () => {
      afterDetail.current = null;
    };
  }, [userId]);
  const scoped = filterSocialFriends(friends, data, userId, {
    query: "",
    filter: "All",
    scope: browse.scope,
  });
  const filtered = filterSocialFriends(friends, data, userId, browse);
  const available = scoped.filter((friend) =>
    ["available", "ending-soon"].includes(friend.availability),
  ).length;
  const inBeacons = scoped.filter(
    (friend) => friend.currentBeacon || friend.beacon,
  ).length;
  const detail = friends.find((friend) => friend.id === detailId);
  const toggle = (id: string) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((value) => value !== id)
        : [...selectedIds, id],
    );
    setError("");
  };
  const openProfile = (id: string) => {
    const action = () =>
      router.push({ pathname: "/person/[id]", params: { id } });
    if (detailId) {
      afterDetail.current = action;
      setDetailId(null);
    } else action();
  };
  const plan = () => {
    try {
      validateCreationInvitees(data, userId, selectedIds);
      const params = hubInviteeParams(
        selectedIds,
        eligibleCreationInvitees(data, userId),
      );
      const planSession = startPlanningDraft(userId);
      setError("");
      router.push({
        pathname: "/create",
        params: { ...params, planSession, kind: "beacon", editor: "yes" },
      });
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Review your selection.",
      );
    }
  };
  const eligible = new Set(eligibleCreationInvitees(data, userId));
  const action = selectedIds.length ? (
    <View testID="social-plan-action" style={{ gap: 8, paddingVertical: 6 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            ...tokens.type.secondary,
          }}
        >
          {selectedIds.length} selected
        </Text>
        <View style={{ flex: 1 }} />
        <HomeAction
          title="Clear"
          label="Clear selection"
          plain
          onPress={() => {
            setSelectedIds([]);
            setError("");
          }}
        />
      </View>
      <ScrollView
        style={{ maxHeight: 88 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {selectedIds.map((id) => {
          const name = eligible.has(id)
            ? friends.find((friend) => friend.id === id)?.name
            : undefined;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={
                "Remove " + (name ?? "unavailable person") + " from plan"
              }
              onPress={() => toggle(id)}
              style={{
                maxWidth: "100%",
                minHeight: 44,
                minWidth: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 22,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flexShrink: 1,
                  color: colors.textSecondary,
                  ...tokens.type.caption,
                }}
              >
                {name ?? "Unavailable person"}
              </Text>
              <X size={13} color={colors.textSecondary} />
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <HomeAction
            title="Ping"
            prominent
            icon={<CircleHelp size={18} color={colors.textSecondary} />}
            stretch
            outlined
            onPress={() =>
              router.push({
                pathname: "/planning/create",
                params: { kind: "ping" },
              })
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <HomeAction
            title="Beacon"
            outlined
            prominent
            icon={
              <Radio size={18} color={tokens.availability.available.color} />
            }
            stretch
            tone={tokens.availability.available}
            onPress={plan}
          />
        </View>
      </View>
      <Text
        testID="ping-audience-explanation"
        style={{ color: colors.textSecondary, ...tokens.type.caption }}
      >
        Ping audience is chosen in its editor. Selected people are kept for a
        Beacon.
      </Text>
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
      personId={detail?.id ?? null}
      visible={!!detail}
      onClose={() => setDetailId(null)}
      onDismiss={() => {
        const action = afterDetail.current;
        afterDetail.current = null;
        action?.();
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
    scoped,
    filtered,
    available,
    inBeacons,
    loading,
    row,
    action,
    detailSheet,
    error,
    userId,
    selectedIds,
    toggle,
    openDetail: setDetailId,
  };
}

/** Each title has one place; shared notes remain independent of activity context. */
function FriendContext({
  friend,
  compact = false,
}: {
  friend: SocialFriend;
  compact?: boolean;
}) {
  const { colors, tokens } = useDesignTheme();
  const beacon = friend.currentBeacon?.activity ?? friend.beacon;
  const activityTitle = beacon?.title ?? friend.currentActivityTitle;
  const differentTitle = activityTitle && activityTitle !== friend.statusText;
  const attachment = friend.attachment;
  return (
    <View style={{ gap: 2, minHeight: compact ? 54 : undefined }}>
      {!!friend.statusText && (
        <Text
          numberOfLines={2}
          style={{ color: colors.textSecondary, ...tokens.type.caption }}
        >
          {friend.statusText}
        </Text>
      )}
      {beacon ? (
        <Text
          numberOfLines={2}
          style={{
            color: colors.accent,
            ...tokens.type.caption,
            ...(compact ? { fontSize: 11, lineHeight: 15 } : {}),
          }}
        >
          In a Beacon{differentTitle ? " · " + activityTitle : ""}
          {compact ? "" : " · Happening now"}
        </Text>
      ) : differentTitle ? (
        <Text
          numberOfLines={2}
          style={{ color: colors.textSecondary, ...tokens.type.caption }}
        >
          Activity · {activityTitle}
        </Text>
      ) : null}
      {!compact &&
      attachment &&
      attachment.id !== beacon?.id &&
      attachment.title !== friend.statusText &&
      attachment.title !== activityTitle ? (
        <Text
          numberOfLines={1}
          style={{ color: colors.accent, ...tokens.type.caption }}
        >
          {attachment.type === "vote" ? "Vote Council" : attachment.type} ·{" "}
          {attachment.title}
        </Text>
      ) : null}
      {!compact &&
      friend.ping &&
      friend.ping.id !== attachment?.id &&
      friend.ping.title !== friend.statusText &&
      friend.ping.title !== activityTitle ? (
        <Text
          numberOfLines={1}
          style={{ color: colors.accent, ...tokens.type.caption }}
        >
          Ping · {friend.ping.title}
        </Text>
      ) : null}
    </View>
  );
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
  return (
    <View
      testID={"social-friend-" + friend.id}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 72,
        paddingVertical: 8,
        paddingHorizontal: 6,
        marginVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected
          ? tokens.availability.available.color
          : "transparent",
        backgroundColor: selected
          ? tokens.availability.available.tint
          : "transparent",
      }}
    >
      {showAvatars && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"View " + friend.name + "'s profile"}
          onPress={() => openProfile(friend.id)}
          style={{
            minWidth: 44,
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ProfileAvatar profile={friend.profile} size={40} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Open " + friend.name + "'s shared status"}
        onPress={() => openDetail(friend.id)}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          gap: 2,
          justifyContent: "center",
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            ...tokens.type.secondary,
            fontWeight: "500",
          }}
        >
          {friend.name}
        </Text>
        <Text
          testID={"availability-badge-" + friend.id}
          accessibilityLabel={"Availability: " + status.label}
          style={{ color: status.color, ...tokens.type.caption }}
        >
          {availabilityLabel(friend, now)}
        </Text>
        <FriendContext friend={friend} />
      </Pressable>
      <HomeAction
        title={selected ? "✓ Added" : "Plan"}
        outlined
        label={
          (selected ? "Deselect " : "Select ") + friend.name + " for planning"
        }
        selected={selected}
        primary={selected}
        tone={{
          color: selected
            ? tokens.availability.available.onColor
            : colors.textSecondary,
          tint: selected ? tokens.availability.available.color : "transparent",
        }}
        onPress={() => toggle(friend.id)}
      />
    </View>
  );
}

function FriendCard({
  friend,
  planning,
  selected,
  onPress,
}: {
  friend: SocialFriend;
  planning: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, tokens } = useDesignTheme();
  const { fontScale } = useWindowDimensions();
  const status =
    tokens.availability[
      friend.availability === "ending-soon" ? "endingSoon" : friend.availability
    ];
  const label =
    friend.availability === "available" || friend.availability === "ending-soon"
      ? "Free"
      : friend.availability === "unavailable"
        ? "Busy"
        : "Not shared";
  return (
    <Pressable
      testID={"social-friend-" + friend.id}
      accessibilityRole="button"
      accessibilityLabel={
        planning
          ? (selected ? "Deselect " : "Select ") + friend.name + " for planning"
          : "Open " + friend.name + "'s shared status"
      }
      accessibilityState={planning ? { selected } : undefined}
      aria-pressed={planning ? selected : undefined}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 108,
        minHeight: 182 * Math.max(1, fontScale),
        padding: 8,
        gap: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected
          ? tokens.availability.available.color
          : colors.border,
        backgroundColor: selected
          ? tokens.availability.available.tint
          : colors.surfaceRaised,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ alignSelf: "center" }}>
        <ProfileAvatar profile={friend.profile} size={48} />
        {selected && (
          <View
            style={{
              position: "absolute",
              right: -3,
              bottom: -2,
              borderRadius: 8,
              padding: 2,
              backgroundColor: tokens.availability.available.color,
            }}
          >
            <Check size={12} color={tokens.availability.available.onColor} />
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: colors.textPrimary,
          ...tokens.type.secondary,
          fontWeight: "500",
        }}
      >
        {friend.name}
      </Text>
      <Text
        testID={"availability-badge-" + friend.id}
        style={{ color: status.color, ...tokens.type.caption }}
      >
        {label}
      </Text>
      <FriendContext friend={friend} compact />
    </Pressable>
  );
}

export function SocialFriendsSection() {
  const { colors, tokens } = useDesignTheme();
  const { data } = useBeacon();
  const controller = useSocialFriendsController();
  const {
    friends,
    scoped,
    available,
    inBeacons,
    loading,
    userId,
    selectedIds,
  } = controller;
  const [browse, updateBrowse] = useFriendsBrowseState(userId);
  const [planning, setPlanning] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const listsAnchor = useRef<View>(null);
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisit((value) => value + 1);
    }, []),
  );
  // Retain IDs only, never stale status/profile objects. Scope and visit reset ranking.
  const orderKey = userId + ":" + browse.scope + ":" + visit;
  const [order, setOrder] = useState(() => ({
    key: orderKey,
    ids: scoped.map((friend) => friend.id),
  }));
  const current = new Map(scoped.map((friend) => [friend.id, friend]));
  const retained =
    order.key === orderKey ? order.ids.filter((id) => current.has(id)) : [];
  const retainedSet = new Set(retained);
  const orderedIds = [
    ...retained,
    ...scoped
      .filter((friend) => !retainedSet.has(friend.id))
      .map((friend) => friend.id),
  ];
  if (
    order.key !== orderKey ||
    order.ids.length !== orderedIds.length ||
    order.ids.some((id, index) => id !== orderedIds[index])
  ) {
    setOrder({ key: orderKey, ids: orderedIds });
  }
  const ordered = orderedIds.map((id) => current.get(id)!);
  const listName =
    data.viewer_id === userId
      ? data.lists.find(
          (list) =>
            list.id === browse.scope.slice(7) && list.owner_id === userId,
        )?.name
      : undefined;
  return (
    <View testID="friends-right-now" style={{ gap: 2, paddingVertical: 6 }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 8,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            flexGrow: 1,
            color: colors.textPrimary,
            fontSize: 18,
            lineHeight: 24,
            fontWeight: "500",
          }}
        >
          Your People
        </Text>
        <HomeAction
          title={"See all " + scoped.length + " →"}
          label={"See all " + scoped.length + " friends"}
          plain
          onPress={() => router.push("/friends")}
        />
        <HomeAction
          title={planning ? "Done" : "Plan"}
          outlined
          prominent
          icon={
            planning ? (
              <Check size={15} color={tokens.availability.available.color} />
            ) : (
              <UsersRound size={15} color={colors.textSecondary} />
            )
          }
          selected={planning}
          tone={{
            color: planning
              ? tokens.availability.available.color
              : colors.textSecondary,
            tint: "transparent",
          }}
          onPress={() => setPlanning(!planning)}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          columnGap: 18,
          rowGap: 0,
          marginTop: -4,
        }}
      >
        {(
          [
            { scope: "friends", label: "All Friends" },
            { scope: "favorites", label: "★ Favorites" },
          ] as const
        ).map(({ scope, label }) => (
          <Pressable
            key={scope}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: browse.scope === scope }}
            aria-pressed={browse.scope === scope}
            onPress={() => updateBrowse({ scope })}
            style={{
              minHeight: 44,
              justifyContent: "center",
              borderBottomWidth: 2,
              borderBottomColor:
                browse.scope === scope ? colors.accent : "transparent",
            }}
          >
            <Text
              style={{
                color:
                  browse.scope === scope
                    ? colors.textPrimary
                    : colors.textSecondary,
                ...tokens.type.caption,
                fontWeight: browse.scope === scope ? "600" : "400",
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
        <View ref={listsAnchor} collapsable={false} style={{ maxWidth: 130 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listName ? "Lists: " + listName : "Lists"}
            accessibilityState={{
              selected: browse.scope.startsWith("custom:"),
              expanded: listsOpen,
            }}
            onPress={() => setListsOpen(!listsOpen)}
            style={{
              minHeight: 44,
              minWidth: 44,
              justifyContent: "center",
              borderBottomWidth: 2,
              borderBottomColor: browse.scope.startsWith("custom:")
                ? colors.accent
                : "transparent",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: listName ? colors.textPrimary : colors.textSecondary,
                ...tokens.type.caption,
                fontWeight: listName ? "600" : "400",
              }}
            >
              {listName ?? "Lists"} ▾
            </Text>
          </Pressable>
        </View>
      </View>
      <Text
        testID="your-people-summary"
        style={{ color: colors.textSecondary, ...tokens.type.caption }}
      >
        {scoped.length} {browse.scope === "favorites" ? "favorites" : "friends"}{" "}
        · {available} free · {inBeacons} in Beacons
      </Text>
      {planning ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
          }}
        >
          <UsersRound size={16} color={colors.textSecondary} />
          <Text
            style={{
              flex: 1,
              color: colors.textPrimary,
              ...tokens.type.caption,
              fontWeight: "500",
            }}
          >
            Select your people
          </Text>
          <Text style={{ color: colors.textSecondary, ...tokens.type.caption }}>
            Scroll for more
          </Text>
          <ArrowRight size={14} color={colors.textSecondary} />
        </View>
      ) : null}
      <FlatList
        key={userId + ":" + browse.scope}
        testID="your-people-carousel"
        horizontal
        data={ordered}
        extraData={{ selectedIds, planning }}
        keyExtractor={(friend) => friend.id}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={3}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        renderItem={({ item }) => (
          <FriendCard
            friend={item}
            planning={planning}
            selected={selectedIds.includes(item.id)}
            onPress={() =>
              planning
                ? controller.toggle(item.id)
                : controller.openDetail(item.id)
            }
          />
        )}
        ListEmptyComponent={
          <View style={{ gap: 4 }}>
            <Txt muted>
              {loading
                ? "Loading your people…"
                : !friends.length
                  ? "Good plans start with your people."
                  : browse.scope === "favorites"
                    ? "No favorites yet."
                    : "No friends in this list yet."}
            </Txt>
            {!loading && (
              <HomeAction
                title={friends.length ? "View All Friends" : "Find Friends"}
                plain
                onPress={() =>
                  friends.length
                    ? updateBrowse({ scope: "friends" })
                    : router.push("/find-friends")
                }
              />
            )}
          </View>
        }
      />
      {!!controller.error && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {controller.error}
        </Text>
      )}
      {planning ? (
        controller.action
      ) : selectedIds.length ? (
        <HomeAction
          title={selectedIds.length + " selected · Continue planning"}
          plain
          onPress={() => setPlanning(true)}
        />
      ) : null}
      <ContextMenu
        title="Private Lists"
        mode="dropdown"
        visible={listsOpen}
        anchorRef={listsAnchor}
        onClose={() => setListsOpen(false)}
      >
        {data.viewer_id === userId &&
          data.lists
            .filter((list) => list.owner_id === userId)
            .map((list) => (
              <ActionRow
                key={list.id}
                label={list.name}
                selected={browse.scope === "custom:" + list.id}
                onPress={() => {
                  updateBrowse({
                    scope: ("custom:" + list.id) as `custom:${string}`,
                  });
                  setListsOpen(false);
                }}
              />
            ))}
        {!data.lists.some((list) => list.owner_id === userId) && (
          <Text
            style={{
              padding: 12,
              color: colors.textSecondary,
              ...tokens.type.caption,
            }}
          >
            No private lists yet.
          </Text>
        )}
        <ActionRow
          label="Manage Private Lists"
          onPress={() => {
            setListsOpen(false);
            router.push("/friends");
          }}
        />
      </ContextMenu>
      {controller.detailSheet}
    </View>
  );
}
