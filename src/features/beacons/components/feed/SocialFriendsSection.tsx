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
  X,
  Star,
  CircleHelp,
  Radio,
  ChevronRight,
  Clock3,
} from "lucide-react-native";
import { HomeAction } from "../HomeAction";
import { useDesignTheme } from "@/src/shared/design-system";
import { Button, Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import { usePreferences } from "@/src/shared/preferences";
import { useNow } from "@/src/shared/useNow";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import { StatusViewer } from "./StatusViewer";
import { SharedStatusControl } from "./SharedStatusControl";
import {
  availabilityLabel,
  homeFriendAvailability,
  isFreeWithoutEnd,
  prioritizeFreeFriends,
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
  const { data, userId, loading, getCurrentData } = useBeacon();
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
  const plan = (invitees = selectedIds) => {
    try {
      const snapshot = getCurrentData();
      if (!snapshot || snapshot.viewer_id !== userId) return;
      validateCreationInvitees(snapshot, userId, invitees);
      const params = hubInviteeParams(
        invitees,
        eligibleCreationInvitees(snapshot, userId),
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
            onPress={() => plan()}
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
      primaryAction={detail && eligible.has(detail.id) ? (
        <Button title="Plan Together" onPress={() => {
          afterDetail.current = () => plan([detail.id]);
          setDetailId(null);
        }} />
      ) : undefined}
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
    filtered: browse.scope === "friends" && browse.filter === "All" && !browse.query.trim()
      ? prioritizeFreeFriends(filtered) : filtered,
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
}: {
  friend: SocialFriend;
}) {
  const { colors, tokens } = useDesignTheme();
  const beacon = friend.currentBeacon?.activity ?? friend.beacon;
  const activityTitle = beacon?.title ?? friend.currentActivityTitle;
  const differentTitle = activityTitle && activityTitle !== friend.statusText;
  const attachment = friend.attachment;
  return (
    <View style={{ gap: 2 }}>
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
          }}
        >
          In a Beacon{differentTitle ? " · " + activityTitle : ""}
          {" · Happening now"}
        </Text>
      ) : differentTitle ? (
        <Text
          numberOfLines={2}
          style={{ color: colors.textSecondary, ...tokens.type.caption }}
        >
          Activity · {activityTitle}
        </Text>
      ) : null}
      {attachment &&
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
      {friend.ping &&
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
  now,
  width,
  onPress,
  onOpenBeacon,
}: {
  friend: SocialFriend;
  now: number;
  width: number;
  onPress: () => void;
  onOpenBeacon: (id: string) => void;
}) {
  const { colors, tokens } = useDesignTheme();
  const status =
    tokens.availability[
      friend.availability === "ending-soon" ? "endingSoon" : friend.availability
    ];
  const label = homeFriendAvailability(friend, now);
  const priority = isFreeWithoutEnd(friend);
  const timedFree = !!friend.until && Date.parse(friend.until) > now &&
    (friend.availability === "available" || friend.availability === "ending-soon");
  const beacon = friend.currentBeacon?.activity ?? friend.beacon;
  const title = beacon?.title ?? friend.attachment?.title ?? friend.currentActivityTitle;
  const distinctTitle = title?.trim().toLocaleLowerCase() !==
    friend.statusText?.trim().toLocaleLowerCase();
  const context = beacon
    ? distinctTitle && title ? `In a Beacon · ${title}` : "In a Beacon"
    : title ? (distinctTitle ? title : "Current activity") : null;
  const contextText = context ? (
    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
      <Text numberOfLines={1} style={{ color: colors.accent, ...tokens.type.caption }}>
        {beacon ? "In a Beacon" : context}
      </Text>
      {beacon && distinctTitle && title ? (
        <Text numberOfLines={1} style={{ color: colors.textPrimary, ...tokens.type.caption }}>
          {title}
        </Text>
      ) : null}
    </View>
  ) : null;
  return (
    <View testID="your-people-card" style={{
      width,
      minHeight: 212,
      flexGrow: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    }}>
      <Pressable
        testID={"social-friend-" + friend.id}
        accessibilityRole="button"
        accessibilityLabel={"Open " + friend.name + "'s shared status"}
        accessibilityHint={[label, friend.statusText].filter(Boolean).join(". ") || undefined}
        onPress={onPress}
        style={({ pressed }) => ({
          flexGrow: 1,
          padding: 10,
          gap: 5,
          borderRadius: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ alignSelf: "flex-start" }}>
          <ProfileAvatar profile={friend.profile} size={48} />

        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: colors.textPrimary,
            ...tokens.type.secondary,
            fontWeight: "600",
          }}
        >
          {friend.name}
        </Text>
        {friend.starred && <Star size={13} color={colors.accent} fill={colors.accent} accessibilityLabel="Favorite" />}
        </View>
        {label ? (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            ...(priority || timedFree ? {
              alignSelf: "flex-start",
              maxWidth: "100%",
              backgroundColor: priority ? status.tint : colors.surface,
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 6,
            } : {}),
          }}>
            {timedFree
              ? <Clock3 size={12} color={friend.availability === "ending-soon" ? status.color : colors.textSecondary} />
              : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.color }} />}
            <Text testID={"availability-badge-" + friend.id} style={{
              flexShrink: 1, color: priority ? status.color : colors.textPrimary,
              ...tokens.type.caption,
              ...(priority ? { fontWeight: "600" } : {}),
            }}>
              {label}
            </Text>
          </View>
        ) : null}
        {friend.statusText ? (
          <Text numberOfLines={2} style={{ color: colors.textSecondary, ...tokens.type.secondary }}>
            {friend.statusText}
          </Text>
        ) : null}
      </Pressable>
      {contextText ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={beacon ? `Open Beacon: ${beacon.title}` : `Open ${friend.name}'s current activity`}
          onPress={() => beacon ? onOpenBeacon(beacon.id) : onPress()}
          style={({ pressed }) => ({
            minHeight: 44, flexDirection: "row", alignItems: "center", paddingVertical: 6,
            paddingHorizontal: 8, marginHorizontal: 7, marginBottom: 7,
            borderRadius: 8, backgroundColor: beacon ? colors.surface : undefined,
            gap: 5, opacity: pressed ? 0.65 : 1,
          })}
        >
          <Radio size={13} color={colors.accent} />
          {contextText}
          <ChevronRight size={13} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SocialFriendsSection() {
  const { colors, tokens } = useDesignTheme();
  const { data, getCurrentData } = useBeacon();
  const now = useNow();
  const { width } = useWindowDimensions();
  const cardWidth = width <= 360 ? 136 : width <= 600 ? 152 : 160;
  const controller = useSocialFriendsController();
  const { friends, scoped, loading, userId } = controller;
  const [browse, updateBrowse] = useFriendsBrowseState(userId);
  const free = friends.filter((friend) => ["available", "ending-soon"].includes(friend.availability)).length;
  const favorites = friends.filter((friend) => friend.starred).length;
  const inBeacons = friends.filter((friend) => friend.currentBeacon || friend.beacon).length;
  const filters = [
    { label: "All", count: friends.length, scope: "friends", filter: "All" },
    { label: "Free", count: free, scope: "friends", filter: "Available" },
    { label: "Favorites", count: favorites, scope: "favorites", filter: "All" },
    { label: "In Beacons", count: inBeacons, scope: "friends", filter: "In a Beacon" },
  ] as const;
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
  const allowed = new Set(filterSocialFriends(friends, data, userId, { ...browse, query: "" }).map((friend) => friend.id));
  const ordered = prioritizeFreeFriends(orderedIds.filter((id) => allowed.has(id)).map((id) => current.get(id)!));
  return (
    <View testID="friends-right-now" style={{ gap: 4, paddingVertical: 6 }}>
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
          title="See All →"
          label={"See all " + friends.length + " friends"}
          plain
          onPress={() => router.push("/friends")}
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {filters.map(({ label, count, scope, filter }) => {
          const selected = browse.scope === scope && browse.filter === filter;
          return (
            <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${label} · ${count}`}
              accessibilityState={{ selected }} aria-pressed={selected} onPress={() => updateBrowse({ scope, filter })}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8, borderRadius: 8, backgroundColor: selected ? colors.surfaceSelected : "transparent" }}>
              <Text style={{ color: selected ? colors.textPrimary : colors.textSecondary, ...tokens.type.caption }}>{label} · {count}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text testID="your-people-summary" style={{ color: colors.textSecondary, ...tokens.type.caption }}>
        {`${ordered.length} ${ordered.length === 1 ? "friend" : "friends"}`}
      </Text>
      <FlatList
        key={userId + ":" + browse.scope + ":" + browse.filter}
        testID="your-people-carousel"
        horizontal
        data={ordered}
        ListHeaderComponent={userId && data.viewer_id === userId ? (
          <View testID="your-people-self" style={{ width: cardWidth, minHeight: 212, flex: 1, borderRadius: 12, backgroundColor: colors.surfaceSelected }}>
            <SharedStatusControl card />
          </View>
        ) : null}
        keyExtractor={(friend) => friend.id}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={3}
        contentContainerStyle={{ alignItems: "stretch", gap: 8, paddingVertical: 4 }}
        renderItem={({ item }) => (
          <FriendCard
            friend={item}
            now={now}
            width={cardWidth}
            onOpenBeacon={(id) => {
              const snapshot = getCurrentData();
              if (!snapshot || !userId) return;
              const fresh = socialFriends(snapshot, userId, Date.now()).find((friend) => friend.id === item.id);
              if ((fresh?.currentBeacon?.activity.id ?? fresh?.beacon?.id) !== id) return;
              router.push({ pathname: "/activity/[id]", params: { id } });
            }}
            onPress={() => controller.openDetail(item.id)}
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
                    : "No friends match this filter."}
            </Txt>
            {!loading && (
              <HomeAction
                title={friends.length ? "View All Friends" : "Find Friends"}
                plain
                onPress={() =>
                  friends.length
                    ? updateBrowse({ scope: "friends", filter: "All" })
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
      {controller.detailSheet}
    </View>
  );
}
