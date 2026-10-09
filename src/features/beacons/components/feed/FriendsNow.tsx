import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  MessageCircle,
  Radio,
  Search,
  Star,
} from "lucide-react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import type { Profile } from "@/src/shared/types";
import { ProfileAvatar } from "@/src/features/profile/ProfileAvatar";
import {
  Card,
  EmptyState,
  PrimaryButton,
  SegmentedControl,
  useDesignTheme,
  useReducedMotion,
} from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";

export type FriendsNowFilter = "everyone" | "free" | "starred";
export type FriendAvailability =
  "available" | "ending-soon" | "unavailable" | "unknown";

export type SafeFriendNowRow = {
  id: string;
  name: string;
  profile?: Profile;
  availability: FriendAvailability;
  statusText: string;
  until?: string | null;
  starred: boolean;
  hasFreshSharedLocation: boolean;
  activeBeaconId?: string;
};

export type FriendsNowProps = {
  friends: SafeFriendNowRow[];
  filter: FriendsNowFilter;
  expanded: boolean;
  onFilterChange: (filter: FriendsNowFilter) => void;
  onToggleExpanded: () => void;
  onProfile: (id: string) => void;
  onMessage: (id: string) => void;
  onToggleStar: (id: string) => void;
  onFindFriends: () => void;
  onOpenBeacon: (id: string) => void;
};

export type FriendsNowHeaderProps = {
  count: number;
  filter: FriendsNowFilter;
  onFilterChange: (filter: FriendsNowFilter) => void;
};

export type FriendNowRowProps = {
  friend: SafeFriendNowRow;
  onProfile: (id: string) => void;
  onMessage: (id: string) => void;
  onToggleStar: (id: string) => void;
  onOpenBeacon: (id: string) => void;
};

const FILTERS = [
  { value: "everyone", label: "Everyone" },
  { value: "free", label: "Free to hang" },
  { value: "starred", label: "Starred" },
] as const;
const COLLAPSED_COUNT = 3;

function availableForPlans(state: FriendAvailability) {
  return state === "available" || state === "ending-soon";
}

function formatUntil(until?: string | null) {
  if (!until) return null;
  const timestamp = Date.parse(until);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FriendsNowHeader({
  count,
  filter,
  onFilterChange,
}: FriendsNowHeaderProps) {
  const { colors } = useDesignTheme();
  return (
    <View style={{ gap: space.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, ...type.titleSmall }}>
            Friends now
          </Text>
          <Text style={{ color: colors.textSecondary, ...type.caption }}>
            See who might be up for something
          </Text>
        </View>
        <Text
          accessibilityLabel={`${count} friends`}
          style={{ color: colors.textSecondary, ...type.caption }}
        >
          {count}
        </Text>
      </View>
      <SegmentedControl
        options={FILTERS}
        value={filter}
        onChange={onFilterChange}
        accessibilityLabel="Filter friends"
      />
    </View>
  );
}

export function FriendNowRow({
  friend,
  onProfile,
  onMessage,
  onToggleStar,
  onOpenBeacon,
}: FriendNowRowProps) {
  const { colors, tokens } = useDesignTheme();
  const availability =
    friend.availability === "ending-soon" ? "endingSoon" : friend.availability;
  const status = tokens.availability[availability];
  const AvailabilityIcon = status.icon;
  const time = formatUntil(friend.until);
  return (
    <View
      style={{
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        paddingVertical: space.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${friend.name}'s profile`}
        onPress={() => onProfile(friend.id)}
        style={{
          width: tokens.layout.minTapTarget,
          height: tokens.layout.minTapTarget,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.circle,
          borderWidth: 2,
          borderColor: status.color,
        }}
      >
        <ProfileAvatar profile={friend.profile} size={38} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Message ${friend.name}`}
        onPress={() => onMessage(friend.id)}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: tokens.layout.minTapTarget,
          justifyContent: "center",
          gap: 2,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            ...type.secondary,
            fontWeight: "700",
          }}
        >
          {friend.name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            columnGap: space.xs,
            rowGap: 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <AvailabilityIcon size={14} color={status.color} />
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                ...type.caption,
                maxWidth: 150,
              }}
            >
              {friend.statusText || status.label}
            </Text>
          </View>
          {time ? (
            <View
              style={{
                minHeight: 24,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                paddingHorizontal: space.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <Clock3 size={12} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, ...type.caption }}>
                until {time}
              </Text>
            </View>
          ) : null}
          {friend.hasFreshSharedLocation ? (
            <View
              accessibilityRole="text"
              accessibilityLabel="Fresh shared location is available"
              style={{
                minHeight: 24,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                paddingHorizontal: space.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <MapPin size={12} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, ...type.caption }}>
                Shared location
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {friend.activeBeaconId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${friend.name}'s active Beacon`}
          onPress={() => onOpenBeacon(friend.activeBeaconId!)}
          style={{
            width: tokens.layout.minTapTarget,
            height: tokens.layout.minTapTarget,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.button,
          }}
        >
          <Radio size={18} color={colors.accent} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Message ${friend.name}`}
        onPress={() => onMessage(friend.id)}
        style={{
          width: tokens.layout.minTapTarget,
          height: tokens.layout.minTapTarget,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.button,
        }}
      >
        <MessageCircle size={18} color={colors.accent} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${friend.starred ? "Unstar" : "Star"} ${friend.name}`}
        accessibilityState={{ selected: friend.starred }}
        onPress={() => onToggleStar(friend.id)}
        style={{
          width: tokens.layout.minTapTarget,
          height: tokens.layout.minTapTarget,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.button,
        }}
      >
        <Star
          size={18}
          color={friend.starred ? colors.accent : colors.textSecondary}
          fill={friend.starred ? colors.accent : "transparent"}
        />
      </Pressable>
    </View>
  );
}

export function FriendsNow({
  friends,
  filter,
  expanded,
  onFilterChange,
  onToggleExpanded,
  onProfile,
  onMessage,
  onToggleStar,
  onFindFriends,
  onOpenBeacon,
}: FriendsNowProps) {
  const { colors, tokens } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  const filteredFriends = friends.filter((friend) => {
    if (filter === "free") return availableForPlans(friend.availability);
    if (filter === "starred") return friend.starred;
    return true;
  });
  const visibleFriends = expanded
    ? filteredFriends
    : filteredFriends.slice(0, COLLAPSED_COUNT);

  return (
    <Card style={{ padding: space.md, gap: space.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, ...type.titleSmall }}>
            Friends now
          </Text>
          <Text style={{ color: colors.textSecondary, ...type.caption }}>
            See who might be up for something
          </Text>
        </View>
        <Text
          accessibilityLabel={`${filteredFriends.length} friends`}
          style={{ color: colors.textSecondary, ...type.caption }}
        >
          {filteredFriends.length}
        </Text>
      </View>

      <SegmentedControl
        options={FILTERS}
        value={filter}
        onChange={onFilterChange}
        accessibilityLabel="Filter friends"
      />

      {visibleFriends.length > 0 ? (
        <Animated.View
          layout={
            reducedMotion
              ? undefined
              : LinearTransition.duration(tokens.motion.standardDuration)
          }
          style={{ gap: space.xs }}
        >
          {visibleFriends.map((friend) => {
            const availability =
              friend.availability === "ending-soon"
                ? "endingSoon"
                : friend.availability;
            const status = tokens.availability[availability];
            const AvailabilityIcon = status.icon;
            const time = formatUntil(friend.until);
            return (
              <View
                key={friend.id}
                style={{
                  minHeight: 76,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  paddingVertical: space.xs,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${friend.name}'s profile`}
                  onPress={() => onProfile(friend.id)}
                  style={{
                    width: tokens.layout.minTapTarget,
                    height: tokens.layout.minTapTarget,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.circle,
                    borderWidth: 2,
                    borderColor: status.color,
                  }}
                >
                  <ProfileAvatar profile={friend.profile} size={38} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${friend.name}`}
                  onPress={() => onMessage(friend.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: tokens.layout.minTapTarget,
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.textPrimary,
                      ...type.secondary,
                      fontWeight: "700",
                    }}
                  >
                    {friend.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                      columnGap: space.xs,
                      rowGap: 2,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <AvailabilityIcon size={14} color={status.color} />
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.textSecondary,
                          ...type.caption,
                          maxWidth: 150,
                        }}
                      >
                        {friend.statusText || status.label}
                      </Text>
                    </View>
                    {time ? (
                      <View
                        style={{
                          minHeight: 24,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          paddingHorizontal: space.xs,
                          borderRadius: radius.pill,
                          backgroundColor: colors.surfaceRaised,
                        }}
                      >
                        <Clock3 size={12} color={colors.textSecondary} />
                        <Text
                          style={{
                            color: colors.textSecondary,
                            ...type.caption,
                          }}
                        >
                          until {time}
                        </Text>
                      </View>
                    ) : null}
                    {friend.hasFreshSharedLocation ? (
                      <View
                        accessibilityRole="text"
                        accessibilityLabel="Fresh shared location is available"
                        style={{
                          minHeight: 24,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          paddingHorizontal: space.xs,
                          borderRadius: radius.pill,
                          backgroundColor: colors.surfaceRaised,
                        }}
                      >
                        <MapPin size={12} color={colors.textSecondary} />
                        <Text
                          style={{
                            color: colors.textSecondary,
                            ...type.caption,
                          }}
                        >
                          Shared location
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>

                {friend.activeBeaconId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${friend.name}'s active Beacon`}
                    onPress={() => onOpenBeacon(friend.activeBeaconId!)}
                    style={{
                      width: tokens.layout.minTapTarget,
                      height: tokens.layout.minTapTarget,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.button,
                    }}
                  >
                    <Radio size={18} color={colors.accent} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${friend.name}`}
                  onPress={() => onMessage(friend.id)}
                  style={{
                    width: tokens.layout.minTapTarget,
                    height: tokens.layout.minTapTarget,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.button,
                  }}
                >
                  <MessageCircle size={18} color={colors.accent} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${friend.starred ? "Unstar" : "Star"} ${friend.name}`}
                  accessibilityState={{ selected: friend.starred }}
                  onPress={() => onToggleStar(friend.id)}
                  style={{
                    width: tokens.layout.minTapTarget,
                    height: tokens.layout.minTapTarget,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: radius.button,
                  }}
                >
                  <Star
                    size={18}
                    color={
                      friend.starred ? colors.accent : colors.textSecondary
                    }
                    fill={friend.starred ? colors.accent : "transparent"}
                  />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      ) : (
        <EmptyState
          title={
            filter === "starred"
              ? "No starred friends yet"
              : "No friends to show"
          }
          body={
            filter === "free"
              ? "When friends share that they are free, they will show up here."
              : "Find people to make plans together."
          }
          icon={<Search size={22} color={colors.textSecondary} />}
          style={{ padding: space.md }}
        />
      )}

      {filteredFriends.length > COLLAPSED_COUNT ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "See fewer friends" : "See more friends"
          }
          accessibilityState={{ expanded }}
          onPress={onToggleExpanded}
          style={{
            minHeight: tokens.layout.minTapTarget,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.xs,
          }}
        >
          {expanded ? (
            <ChevronUp size={17} color={colors.accent} />
          ) : (
            <ChevronDown size={17} color={colors.accent} />
          )}
          <Text
            style={{
              color: colors.accent,
              ...type.secondary,
              fontWeight: "700",
            }}
          >
            {expanded ? "See less" : "See more"}
          </Text>
        </Pressable>
      ) : null}

      <PrimaryButton
        title="Find friends"
        compact
        icon={<Search size={17} color={colors.onAccent} />}
        onPress={onFindFriends}
      />
    </Card>
  );
}
