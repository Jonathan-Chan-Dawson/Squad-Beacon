import {
  markerIdentity,
  ownsMapBeacon,
  mapIdentityColors,
  friendLocationLabel,
} from "../markerIdentity";
import {
  AvatarStatusBadge,
  avatarAvailability,
} from "@/src/features/profile/AvatarStatusBadge";
import { useNow } from "@/src/shared/useNow";
import { CLUSTER_PREVIEW_LIMIT } from "../mapClusterPolicy";
import React, { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { Circle as MapCircle, Marker } from "react-native-maps";
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { MiniAvatar } from "@/src/features/people/MiniAvatar";
import { avatarSeed } from "@/src/features/profile/avatarArt";
import { canViewProfile } from "@/src/features/profile/privacy";
import { supabase } from "@/src/shared/supabase";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import { usePreferences } from "@/src/shared/preferences";
import type { ClusterPoint } from "@/src/features/maps/cluster";
import {
  clusterPreviewOverflow,
  markerVisualSize,
  CLUSTER_PREVIEW_ICON_SIZE,
  CLUSTER_PREVIEW_GAP,
} from "@/src/features/maps/cluster";
import { useReducedMotion } from "@/src/shared/design-system";
import type {
  Activity,
  Category,
  LocationSession,
  Profile,
} from "@/src/shared/types";

const AnimatedMapCircle = Animated.createAnimatedComponent(MapCircle);

function useMarkerTracking(updateKey: string) {
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => setSettledKey(updateKey), 420);
    return () => clearTimeout(timeout);
  }, [updateKey]);
  return settledKey !== updateKey;
}

function rgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function MarkerContent({
  children,
  selected,
  dimmed,
}: {
  children: React.ReactNode;
  selected?: boolean;
  dimmed?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(selected ? 1.25 : 1);
  useEffect(() => {
    scale.value = reducedMotion
      ? selected
        ? 1.25
        : 1
      : withSpring(selected ? 1.25 : 1, { damping: 16, stiffness: 240 });
    return () => cancelAnimation(scale);
  }, [selected, reducedMotion, scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: dimmed ? 0.7 : 1,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export function NowBeaconHalo({
  coordinate,
  color,
}: {
  coordinate: { latitude: number; longitude: number };
  color: string;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = reducedMotion
      ? 0
      : withRepeat(withTiming(1, { duration: 1000 }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);
  const animatedProps = useAnimatedProps(() => ({
    radius: reducedMotion ? 42 : interpolate(progress.value, [0, 1], [30, 88]),
  }));
  return (
    <AnimatedMapCircle
      center={coordinate}
      radius={reducedMotion ? 42 : 30}
      fillColor={rgba(color, 0.035)}
      strokeColor={rgba(color, 0.26)}
      strokeWidth={2}
      animatedProps={animatedProps}
      zIndex={1}
    />
  );
}

export function FriendMapAvatar({
  profile,
  size,
  onImageLoad,
}: {
  profile: Profile;
  size: number;
  onImageLoad: () => void;
}) {
  const { showAvatars } = usePreferences();
  const { data, userId } = useBeacon();
  const canReadPhoto = canViewProfile(data, profile, userId);
  const key = `${profile.id}:${profile.avatar_updated_at ?? ""}:${userId}:${canReadPhoto}`;
  const [image, setImage] = useState<{ key: string; uri: string } | null>(null);
  useEffect(() => {
    if (
      !showAvatars ||
      !canReadPhoto ||
      profile.avatar_style === "illustrated" ||
      !profile.avatar_updated_at ||
      !supabase
    )
      return;
    let active = true;
    supabase.storage
      .from("avatars")
      .download(`${profile.id}/avatar.jpg`)
      .then(({ data: file, error }) => {
        if (!file || error) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          if (active && typeof reader.result === "string")
            setImage({ key, uri: reader.result });
        };
        reader.readAsDataURL(file);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [
    showAvatars,
    canReadPhoto,
    profile.id,
    profile.avatar_style,
    profile.avatar_updated_at,
    key,
  ]);
  if (!showAvatars) return null;
  if (
    canReadPhoto &&
    profile.avatar_style !== "illustrated" &&
    image?.key === key
  )
    return (
      <Image
        source={{ uri: image.uri }}
        onLoad={onImageLoad}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  return (
    <MiniAvatar
      seed={profile.avatar_seed ?? avatarSeed(profile.id)}
      name={profile.name}
      size={size}
    />
  );
}

/** Original Beacon artwork shared by singleton pins and native constellation stacks. */
export function BeaconMarkerArtwork({ id, category, categoryColor, selected = false, dimmed = false, streetTime }: {
  id: string; category: Category; categoryColor: string; selected?: boolean; dimmed?: boolean; streetTime?: string;
}) {
  const { data, userId } = useBeacon();
  const { colors, resolvedAppearance } = useTheme();
  const activity = data.activities.find((row) => row.id === id);
  const identity = activity ? markerIdentity(data, activity, userId) : null;
  const owned = !!activity && ownsMapBeacon(data, activity, userId);
  const visualSize = markerVisualSize("beacon");
  return (
      <MarkerContent selected={selected} dimmed={dimmed}>
        <View
          style={{
            width: 58,
            height: streetTime ? 70 : 56,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: visualSize,
              height: visualSize,
              borderRadius: visualSize / 2,
              borderWidth: 3,
              borderColor: categoryColor,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              elevation: 5,
              shadowColor: "#182A32",
              shadowOpacity: 0.22,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            {owned && !selected && <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1.5, borderColor: mapIdentityColors.ownership, borderRadius: visualSize / 2 }} />}
            <ActivityBadge category={category} size={26} />
            {identity && (
              <View
                style={{
                  position: "absolute",
                  ...(owned ? { left: -7 } : { right: -7 }),
                  bottom: -4,
                  width: 21,
                  height: 21,
                  borderRadius: identity.kind === "community" ? 6 : 11,
                  borderWidth: 2,
                  borderColor: colors.white,
                  backgroundColor:
                    identity.glyph === "♥"
                      ? resolvedAppearance === "dark"
                        ? "#3D2430"
                        : "#FFF0F5"
                      : colors.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color:
                      identity.glyph === "♥"
                        ? mapIdentityColors.heart[resolvedAppearance]
                        : colors.white,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {identity.glyph}
                </Text>
              </View>
            )}
            {owned && <OwnershipStar />}
          </View>
          <View
            style={{
              position: "absolute",
              top: 34,
              width: 12,
              height: 12,
              backgroundColor: categoryColor,
              borderRadius: 2,
              transform: [{ rotate: "45deg" }],
              zIndex: -1,
            }}
          />
          {streetTime ? (
            <View
              style={{
                marginTop: 5,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 9,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: categoryColor,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: "#203038", fontSize: 10, fontWeight: "700" }}
              >
                {streetTime}
              </Text>
            </View>
          ) : null}
        </View>
      </MarkerContent>
  );
}

function BeaconMapPinComponent({
  id,
  title,
  coordinate,
  category,
  categoryColor,
  selected,
  dimmed,
  streetTime,
  appearanceKey,
  onPress,
  disabled = false,
  dot = false,
}: {
  id: string;
  title: string;
  coordinate: { latitude: number; longitude: number };
  category: Category;
  categoryColor: string;
  selected: boolean;
  dimmed: boolean;
  streetTime?: string;
  appearanceKey: string;
  onPress: (id: string) => void;
  disabled?: boolean;
  dot?: boolean;
}) {
  const { data, userId } = useBeacon();
  const activity = data.activities.find((row) => row.id === id);
  const identity = activity ? markerIdentity(data, activity, userId) : null;
  const owned = !!activity && ownsMapBeacon(data, activity, userId);
  const tracking = useMarkerTracking(
    `${owned}:${identity?.label}:${id}:${categoryColor}:${selected}:${dimmed}:${streetTime ?? ""}:${appearanceKey}:${dot}`,
  );
  if (dot)
    return (
      <Marker
        coordinate={coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracking}
        accessibilityLabel={`Map: ${title}${owned ? ", Your Beacon" : ""}${identity ? `, ${identity.label}` : ""}`}
        onPress={(event) => {
          event.stopPropagation();
          if (!disabled) onPress(id);
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: categoryColor,
              borderWidth: 1,
              borderColor: "#FFFFFF",
            }}
          />
        </View>
      </Marker>
    );
  return (
    <Marker
      key={id}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: streetTime ? 0.82 : 0.92 }}
      tracksViewChanges={tracking}
      accessibilityLabel={`Map: ${title}${owned ? ", Your Beacon" : ""}${identity ? `, ${identity.label}` : ""}`}
      onPress={(event) => {
        event.stopPropagation();
        if (!disabled) onPress(id);
      }}
    >
      <BeaconMarkerArtwork id={id} category={category} categoryColor={categoryColor}
        selected={selected} dimmed={dimmed} streetTime={streetTime} />
    </Marker>
  );
}

export const BeaconMapPin = React.memo(
  BeaconMapPinComponent,
  (left, right) =>
    left.id === right.id &&
    left.title === right.title &&
    left.coordinate.latitude === right.coordinate.latitude &&
    left.coordinate.longitude === right.coordinate.longitude &&
    left.category === right.category &&
    left.categoryColor === right.categoryColor &&
    left.selected === right.selected &&
    left.dimmed === right.dimmed &&
    left.streetTime === right.streetTime &&
    left.appearanceKey === right.appearanceKey &&
    left.disabled === right.disabled &&
    left.dot === right.dot &&
    left.onPress === right.onPress,
);

function FriendMapPinComponent({
  location,
  profile,
  availabilityColor,
  availabilityLabel,
  ageLabel,
  showLabel = true,
  appearanceKey,
  onPress,
}: {
  location: LocationSession;
  profile: Profile;
  availabilityColor: string;
  availabilityLabel: string;
  ageLabel: string;
  showLabel?: boolean;
  appearanceKey: string;
  onPress: (id: string) => void;
}) {
  const [avatarRevision, setAvatarRevision] = useState(0);
  const loadedAvatarKey = useRef<string | null>(null);
  const avatarKey = `${profile.id}:${profile.avatar_updated_at ?? ""}`;
  const tracking = useMarkerTracking(
    `${location.id}:${avatarKey}:${profile.name}:${profile.avatar_seed ?? ""}:${profile.avatar_style ?? ""}:${availabilityColor}:${ageLabel}:${showLabel}:${appearanceKey}:${avatarRevision}`,
  );
  const avatarSize = markerVisualSize("person");
  return (
    <Marker
      coordinate={{
        latitude: location.latitude!,
        longitude: location.longitude!,
      }}
      anchor={{ x: 0.5, y: 0.48 }}
      tracksViewChanges={tracking}
      accessibilityLabel={`Map friend: ${profile.name}, ${availabilityLabel}, location ${ageLabel}`}
      onPress={(event) => {
        event.stopPropagation();
        onPress(location.owner_id);
      }}
    >
      <View style={{ width: 94, height: 54, alignItems: "center" }}>
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            borderColor: availabilityColor,
            borderWidth: 3,
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            elevation: 4,
          }}
        >
          <FriendMapAvatar
            profile={profile}
            size={avatarSize - 6}
            onImageLoad={() => {
              if (loadedAvatarKey.current === avatarKey) return;
              loadedAvatarKey.current = avatarKey;
              setAvatarRevision((revision) => revision + 1);
            }}
          />
        </View>
        {availabilityLabel !== "unknown" && (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: (94 - avatarSize) / 2,
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: "#FFFFFF",
              backgroundColor: availabilityColor,
              zIndex: 5,
              elevation: 5,
            }}
          />
        )}
        {showLabel && (
          <View
            style={{
              maxWidth: 94,
              marginTop: 2,
              paddingHorizontal: 5,
              borderRadius: 8,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#D5DEDB",
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: "#34434A", fontSize: 9, fontWeight: "700" }}
            >
              {friendLocationLabel(profile.name, ageLabel)}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

export const FriendMapPin = React.memo(
  FriendMapPinComponent,
  (left, right) =>
    left.location.id === right.location.id &&
    left.location.latitude === right.location.latitude &&
    left.location.longitude === right.location.longitude &&
    left.location.updated_at === right.location.updated_at &&
    left.profile.id === right.profile.id &&
    left.profile.name === right.profile.name &&
    left.profile.avatar_seed === right.profile.avatar_seed &&
    left.profile.avatar_style === right.profile.avatar_style &&
    left.profile.avatar_updated_at === right.profile.avatar_updated_at &&
    left.availabilityColor === right.availabilityColor &&
    left.availabilityLabel === right.availabilityLabel &&
    left.ageLabel === right.ageLabel &&
    left.showLabel === right.showLabel &&
    left.appearanceKey === right.appearanceKey &&
    left.onPress === right.onPress,
);

function ClusterPersonAvatar({
  profile,
  size,
  onImageLoad,
}: {
  profile?: Profile;
  size: number;
  onImageLoad: () => void;
}) {
  const loadedKey = useRef<string | null>(null);
  if (!profile) return <Text style={{ fontSize: 28 }}>{"\u{1F464}"}</Text>;
  const key = `${profile.id}:${profile.avatar_updated_at ?? ""}:${profile.avatar_seed ?? ""}:${profile.avatar_style ?? ""}`;
  return (
    <FriendMapAvatar
      profile={profile}
      size={size}
      onImageLoad={() => {
        if (loadedKey.current === key) return;
        loadedKey.current = key;
        onImageLoad();
      }}
    />
  );
}

function ClusterMapPinComponent({
  group,
  profiles,
  peopleCount,
  areaSummary,
  availabilityActivities = [],
  appearanceKey,
  accessibilityLabel,
  onPress,
}: {
  profiles: Profile[];
  peopleCount?: number;
  areaSummary?: { name: string; reason: string; ownedCount?: number };
  availabilityActivities?: Activity[];
  group: {
    id: string;
    latitude: number;
    longitude: number;
    members: ClusterPoint[];
  };
  categoryColors: Record<Category, string>;
  appearanceKey: string;
  accessibilityLabel: string;
  onPress: (group: {
    id: string;
    latitude: number;
    longitude: number;
    members: ClusterPoint[];
  }) => void;
}) {
  const [avatarRevision, setAvatarRevision] = useState(0);
  const now = useNow();
  const { data, userId } = useBeacon();
  const preview = group.members.slice(0, CLUSTER_PREVIEW_LIMIT);
  const avatarKey = preview
    .map((member) => {
      const profile = profiles.find((row) => `person:${row.id}` === member.id);
      return `${member.id}:${data.activities.some((activity) => `beacon:${activity.id}` === member.id && ownsMapBeacon(data, activity, userId))}:${profile?.avatar_updated_at ?? ""}:${profile?.avatar_seed ?? ""}:${profile?.avatar_style ?? ""}:${avatarAvailability(availabilityActivities, profile?.id ?? "", now)}`;
    })
    .join("|");
  const tracking = useMarkerTracking(
    `${group.id}:${appearanceKey}:${areaSummary?.name}:${areaSummary?.reason}:${areaSummary?.ownedCount}:${peopleCount}:${avatarKey}:${avatarRevision}:${CLUSTER_PREVIEW_ICON_SIZE}`,
  );
  const overflow = clusterPreviewOverflow(group.members.length);
  const columns = Math.min(CLUSTER_PREVIEW_LIMIT, preview.length);
  const iconSize = CLUSTER_PREVIEW_ICON_SIZE;
  const gridWidth = columns * iconSize + (columns - 1) * CLUSTER_PREVIEW_GAP;
  const { colors } = useTheme();
  return (
    <Marker
      key={group.id}
      coordinate={{ latitude: group.latitude, longitude: group.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracking}
      accessibilityLabel={accessibilityLabel}
      onPress={(event) => {
        event.stopPropagation();
        onPress(group);
      }}
    >
      {areaSummary ? (
        <View
          style={{
            minHeight: 36,
            maxWidth: 150,
            paddingHorizontal: 9,
            paddingVertical: 5,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.white + "DD",
            gap: 1,
          }}
        >
          <Text
            numberOfLines={1}
            style={{ color: colors.ink, fontSize: 11, fontWeight: "600" }}
          >
            {areaSummary.name}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.green, fontSize: 10 }}>
            {areaSummary.reason}
          </Text>
          {!!areaSummary.ownedCount && (
            <Text style={{ color: mapIdentityColors.ownership, fontSize: 10 }}>
              ★ {areaSummary.ownedCount} yours
            </Text>
          )}
        </View>
      ) : (
        <View
          style={{
            minHeight: 44,
            padding: 3,
            borderRadius: 22,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.line,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              width: gridWidth,
              gap: CLUSTER_PREVIEW_GAP,
            }}
          >
            {preview.map((member) => (
              <View
                key={member.id}
                style={{
                  width: iconSize,
                  height: iconSize,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {member.kind === "beacon" ? (
                  <View>
                    <ActivityBadge
                      category={member.category ?? "Other"}
                      size={iconSize}
                      iconSize={22}
                    />
                    {data.activities.some(
                      (activity) =>
                        `beacon:${activity.id}` === member.id &&
                        ownsMapBeacon(data, activity, userId),
                    ) && <OwnershipStar small />}
                  </View>
                ) : (
                  <View>
                    <ClusterPersonAvatar
                      profile={profiles.find(
                        (row) => `person:${row.id}` === member.id,
                      )}
                      size={iconSize}
                      onImageLoad={() =>
                        setAvatarRevision((revision) => revision + 1)
                      }
                    />
                    <AvatarStatusBadge
                      state={avatarAvailability(
                        availabilityActivities,
                        member.id.slice(7),
                        now,
                      )}
                      size={10}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
          {!!overflow && (
            <Text style={{ fontSize: 11, color: colors.ink }}>+{overflow}</Text>
          )}
        </View>
      )}
    </Marker>
  );
}

export const ClusterMapPin = React.memo(
  ClusterMapPinComponent,
  (left, right) =>
    left.profiles === right.profiles &&
    left.peopleCount === right.peopleCount &&
    left.availabilityActivities === right.availabilityActivities &&
    left.areaSummary?.name === right.areaSummary?.name &&
    left.areaSummary?.reason === right.areaSummary?.reason &&
    left.areaSummary?.ownedCount === right.areaSummary?.ownedCount &&
    left.group.id === right.group.id &&
    left.group.latitude === right.group.latitude &&
    left.group.longitude === right.group.longitude &&
    left.categoryColors === right.categoryColors &&
    left.appearanceKey === right.appearanceKey &&
    left.accessibilityLabel === right.accessibilityLabel &&
    left.onPress === right.onPress,
);

export function OwnershipStar({ small = false }: { small?: boolean }) {
  return (
    <View
      testID="beacon-ownership-star"
      accessibilityLabel="Your Beacon"
      style={{
        position: "absolute",
        right: small ? -2 : -6,
        bottom: -4,
        width: small ? 12 : 16,
        height: small ? 12 : 16,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: "#FFFFFF",
        backgroundColor: mapIdentityColors.ownership,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: small ? 8 : 10 }}>★</Text>
    </View>
  );
}
