import React, { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { Circle as MapCircle, Marker } from "react-native-maps";
import Svg, { Circle } from "react-native-svg";
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
import { usePreferences } from "@/src/shared/preferences";
import type {
  ClusterPoint,
  ClusterCategoryCount,
} from "@/src/features/maps/cluster";
import {
  clusterCategoryMix,
  markerVisualSize,
} from "@/src/features/maps/cluster";
import { useReducedMotion } from "@/src/shared/design-system";
import type { Category, LocationSession, Profile } from "@/src/shared/types";

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

function FriendMapAvatar({
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
}) {
  const tracking = useMarkerTracking(
    `${id}:${categoryColor}:${selected}:${dimmed}:${streetTime ?? ""}:${appearanceKey}`,
  );
  const visualSize = markerVisualSize("beacon");
  return (
    <Marker
      key={id}
      coordinate={coordinate}
      anchor={{ x: 0.5, y: streetTime ? 0.82 : 0.92 }}
      tracksViewChanges={tracking}
      accessibilityLabel={`Map: ${title}`}
      onPress={(event) => {
        event.stopPropagation();
        if (!disabled) onPress(id);
      }}
    >
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
            <ActivityBadge category={category} size={26} />
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
    left.onPress === right.onPress,
);

function FriendMapPinComponent({
  location,
  profile,
  availabilityColor,
  availabilityLabel,
  ageLabel,
  appearanceKey,
  onPress,
}: {
  location: LocationSession;
  profile: Profile;
  availabilityColor: string;
  availabilityLabel: string;
  ageLabel: string;
  appearanceKey: string;
  onPress: (id: string) => void;
}) {
  const [avatarRevision, setAvatarRevision] = useState(0);
  const loadedAvatarKey = useRef<string | null>(null);
  const avatarKey = `${profile.id}:${profile.avatar_updated_at ?? ""}`;
  const tracking = useMarkerTracking(
    `${location.id}:${avatarKey}:${profile.name}:${profile.avatar_seed ?? ""}:${profile.avatar_style ?? ""}:${availabilityColor}:${ageLabel}:${appearanceKey}:${avatarRevision}`,
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
      <View style={{ width: 64, height: 54, alignItems: "center" }}>
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
        <View
          style={{
            marginTop: 2,
            paddingHorizontal: 5,
            borderRadius: 8,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#D5DEDB",
          }}
        >
          <Text style={{ color: "#34434A", fontSize: 9, fontWeight: "700" }}>
            {ageLabel}
          </Text>
        </View>
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
    left.appearanceKey === right.appearanceKey &&
    left.onPress === right.onPress,
);

function clusterStrokeSegments(
  mix: ClusterCategoryCount[],
  total: number,
  size: number,
  categoryColors: Record<Category, string>,
) {
  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return mix.map((segment) => {
    const length = Math.max(1, (segment.count / total) * circumference - 2);
    const strokeDashoffset = -offset;
    offset += length + 2;
    return (
      <Circle
        key={segment.category}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={
          segment.category === "People"
            ? "#74828A"
            : categoryColors[segment.category]
        }
        strokeWidth={3}
        strokeDasharray={`${length} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        rotation={-90}
        origin={`${size / 2}, ${size / 2}`}
      />
    );
  });
}

function ClusterMapPinComponent({
  group,
  categoryColors,
  appearanceKey,
  accessibilityLabel,
  onPress,
}: {
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
  const tracking = useMarkerTracking(`${group.id}:${appearanceKey}`);
  const beaconCount = group.members.filter(
    (point) => point.kind === "beacon",
  ).length;
  const personCount = group.members.length - beaconCount;
  const size = Math.min(
    74,
    54 + Math.log2(Math.max(2, group.members.length)) * 4,
  );
  const mix = clusterCategoryMix(group.members);
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
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 3}
            fill="#FFFFFF"
            stroke="#FFFFFF"
            strokeWidth={5}
          />
          {clusterStrokeSegments(
            mix,
            group.members.length,
            size,
            categoryColors,
          )}
        </Svg>
        <View
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#17252B",
              fontSize: 17,
              lineHeight: 20,
              fontWeight: "800",
            }}
          >
            {group.members.length}
          </Text>
          <Text
            style={{
              color: "#54636B",
              fontSize: 8,
              lineHeight: 10,
              fontWeight: "700",
            }}
          >
            {beaconCount}B · {personCount}P
          </Text>
        </View>
      </View>
    </Marker>
  );
}

export const ClusterMapPin = React.memo(
  ClusterMapPinComponent,
  (left, right) =>
    left.group.id === right.group.id &&
    left.group.latitude === right.group.latitude &&
    left.group.longitude === right.group.longitude &&
    left.categoryColors === right.categoryColors &&
    left.appearanceKey === right.appearanceKey &&
    left.accessibilityLabel === right.accessibilityLabel &&
    left.onPress === right.onPress,
);
