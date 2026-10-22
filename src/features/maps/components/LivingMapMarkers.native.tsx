import React, { useEffect, useState } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import { Marker, Polygon } from "react-native-maps";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  AvatarStatusBadge,
  avatarAvailability,
} from "@/src/features/profile/AvatarStatusBadge";
import { useTheme } from "@/src/shared/ui";
import { useDesignTheme } from "@/src/theme";
import { useReducedMotion } from "@/src/shared/design-system";
import { useNow } from "@/src/shared/useNow";
import type {
  Activity,
  Category,
  LocationSession,
  Profile,
} from "@/src/shared/types";
import type { ClusterPoint } from "../cluster";
import { formatLocationAge } from "../cluster";
import { mapIdentityColors, friendLocationLabel } from "../markerIdentity";
import {
  nativeAtmosphereRadius,
  nativePetalOffset,
  nativePointOffset,
  nativeStackOpensExplorer,
  type NativeMapPresentation,
} from "../nativeMapPresentation";
import {
  BeaconMarkerArtwork,
  FriendMapAvatar,
} from "./BeaconMapMarkers.native";

type ArtworkProps = {
  profiles: Profile[];
  activities: Activity[];
  locations: LocationSession[];
  categoryColors: Record<Category, string>;
  selectedActivityId: string | null;
  availabilityActivities?: Activity[];
};

function MemberArtwork({
  member,
  profiles,
  activities,
  availabilityActivities,
  categoryColors,
  selectedActivityId,
  onImageLoad,
}: ArtworkProps & {
  member: ClusterPoint;
  onImageLoad?: () => void;
}) {
  const now = useNow();
  const { availability } = useDesignTheme();
  const state = avatarAvailability(
    availabilityActivities ?? activities,
    member.id.slice(7),
    now,
  );
  if (member.kind === "beacon")
    return (
      <BeaconMarkerArtwork
        id={member.id.slice(7)}
        category={member.category ?? "Other"}
        categoryColor={categoryColors[member.category ?? "Other"]}
        selected={selectedActivityId === member.id.slice(7)}
      />
    );
  const profile = profiles.find((row) => `person:${row.id}` === member.id);
  if (!profile) return null;
  return (
    <View
      style={{
        width: 58,
        height: 56,
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 3,
          borderColor:
            availability[state === "ending-soon" ? "endingSoon" : state].color,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FriendMapAvatar
          profile={profile}
          size={30}
          onImageLoad={onImageLoad ?? (() => {})}
        />
        <AvatarStatusBadge state={state} size={10} />
      </View>
    </View>
  );
}

function OwnershipAnchor({ count }: { count: number }) {
  return (
    <View
      accessibilityLabel={`${count} of your Beacons`}
      style={{
        position: "absolute",
        right: 12,
        bottom: 14,
        minWidth: 22,
        height: 22,
        paddingHorizontal: 5,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        backgroundColor: mapIdentityColors.ownership,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
        ★{count > 1 ? count : ""}
      </Text>
    </View>
  );
}

export function OwnedMapAnchor({
  presentation,
  onPress,
}: {
  presentation: NativeMapPresentation;
  onPress: () => void;
}) {
  const point = presentation.owned[0];
  if (!point) return null;
  return (
    <Marker
      key={presentation.owned.map((member) => member.id).join("|")}
      coordinate={point}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={8}
      tracksViewChanges={false}
      accessibilityLabel={`${presentation.owned.length} of your Beacons. Open cluster explorer`}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    >
      <View style={{ width: 48, height: 48 }}>
        <OwnershipAnchor count={presentation.owned.length} />
      </View>
    </Marker>
  );
}

/** Native bitmap follows pan/rotation without continuous JS projection or animation. */
export function LivingMapPin({
  presentation,
  onPress,
  onMember,
  appearanceKey,
  ...artwork
}: ArtworkProps & {
  presentation: NativeMapPresentation;
  appearanceKey: string;
  onPress: (presentation: NativeMapPresentation) => void;
  onMember: (member: ClusterPoint) => void;
}) {
  const { colors } = useTheme();
  const { group, visible, owned, overflow, mode } = presentation;
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = reducedMotion ? 1 : 0.75;
    if (!reducedMotion) opacity.value = withTiming(1, { duration: 140 });
    return () => cancelAnimation(opacity);
  }, [mode, reducedMotion, opacity]);
  const transitionStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const now = useNow();
  const [avatarRevision, setAvatarRevision] = useState(0);
  const updateKey = `${appearanceKey}:${mode}:${visible.map((point) => `${point.id}:${point.latitude}:${point.longitude}:${point.category}`).join("|")}:${owned.map((point) => point.id).join("|")}:${JSON.stringify(artwork.categoryColors)}:${overflow}:${avatarRevision}:${artwork.selectedActivityId}:${artwork.profiles.map((profile) => `${profile.id}:${profile.name}:${profile.avatar_updated_at}:${profile.avatar_seed}:${profile.avatar_style}`).join("|")}:${artwork.activities.map((activity) => `${activity.id}:${activity.owner_id}:${activity.audience}:${activity.available}:${activity.status}:${activity.starts_at}:${activity.ends_at}`).join("|")}:${Math.floor(now / 60000)}`;
  const [settledKey, setSettledKey] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettledKey(updateKey), 420);
    return () => clearTimeout(timer);
  }, [updateKey]);
  const label = `${mode === "stack" ? "Map stack" : "Spark Swarm"}: ${group.members.length} items${owned.length ? `, ${owned.length} of your Beacons` : ""}${overflow && mode === "stack" ? `, ${overflow} hidden` : ""}. ${nativeStackOpensExplorer(group.members.length) ? "Open searchable cluster explorer" : "Expand to select an item"}`;
  const samples = [...group.members]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 24);
  const offsets = samples.map((point) => nativePointOffset(point, group, 14));
  const extent = Math.max(
    1,
    ...offsets.map((offset) =>
      Math.max(Math.abs(offset.x), Math.abs(offset.y)),
    ),
  );
  return (
    <Marker
      coordinate={group}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={owned.length ? 6 : 3}
      tracksViewChanges={settledKey !== updateKey}
      accessibilityLabel={label}
      accessibilityActions={
        mode === "stack" && !nativeStackOpensExplorer(group.members.length)
          ? group.members.map((member) => ({
              name: member.id,
              label: `Select ${member.kind === "beacon" ? (artwork.activities.find((a) => `beacon:${a.id}` === member.id)?.title ?? "Beacon") : (artwork.profiles.find((p) => `person:${p.id}` === member.id)?.name ?? "friend")}`,
            }))
          : [{ name: "activate", label: "Open searchable cluster explorer" }]
      }
      onAccessibilityAction={(event) => {
        const member = group.members.find(
          (point) => point.id === event.nativeEvent.actionName,
        );
        if (member) onMember(member);
        else onPress(presentation);
      }}
      onPress={(event) => {
        event.stopPropagation();
        onPress(presentation);
      }}
    >
      <Animated.View
        collapsable={false}
        style={[{ width: 180, height: 180 }, transitionStyle]}
      >
        {mode === "stack"
          ? visible.map((member, index) => {
              const offset = nativePetalOffset(index);
              return (
                <View
                  key={member.id}
                  style={{
                    position: "absolute",
                    left: 61 + offset.x,
                    top: 62 + offset.y,
                    zIndex: visible.length - index,
                  }}
                >
                  <MemberArtwork
                    {...artwork}
                    member={member}
                    onImageLoad={() => setAvatarRevision((value) => value + 1)}
                  />
                </View>
              );
            })
          : samples.map((member, index) => (
              <View
                key={member.id}
                style={{
                  position: "absolute",
                  left: 87 + (offsets[index].x / extent) * 49,
                  top: 87 + (offsets[index].y / extent) * 49,
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  opacity: 0.75,
                  backgroundColor:
                    artwork.categoryColors[member.category ?? "Other"],
                }}
              />
            ))}
        {mode === "stack" && overflow > 0 && (
          <View
            style={{
              position: "absolute",
              left: 126,
              top: 50,
              zIndex: 101,
              minWidth: 26,
              minHeight: 22,
              paddingHorizontal: 5,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{ color: colors.ink, fontWeight: "700", fontSize: 11 }}
            >
              +{overflow}
            </Text>
          </View>
        )}
        {(mode === "swarm" || owned.length > 1) && owned.length > 0 && (
          <OwnershipAnchor count={owned.length} />
        )}
      </Animated.View>
    </Marker>
  );
}

/** Feathered static geographic layers; Polygon supports taps on both providers. */
export function ActivityAtmosphere({
  presentation,
  onPress,
  zoom,
}: {
  presentation: NativeMapPresentation;
  onPress: (presentation: NativeMapPresentation) => void;
  zoom: number;
}) {
  const { colors } = useTheme();
  const radius = nativeAtmosphereRadius(presentation.group, zoom);
  const { latitude, longitude } = presentation.group;
  return (
    <>
      {[1.25, 1, 0.7].map((scale, layer) => (
        <Polygon
          key={scale}
          coordinates={Array.from({ length: 32 }, (_, index) => {
            const angle = (index / 32) * Math.PI * 2;
            return {
              latitude: Math.max(
                -85,
                Math.min(
                  85,
                  latitude + (Math.sin(angle) * radius * scale) / 111_320,
                ),
              ),
              longitude:
                ((longitude +
                  (Math.cos(angle) * radius * scale) /
                    (111_320 *
                      Math.max(0.09, Math.cos((latitude * Math.PI) / 180))) +
                  540) %
                  360) -
                180,
            };
          })}
          fillColor={
            colors.green + (layer === 0 ? "06" : layer === 1 ? "09" : "0C")
          }
          strokeWidth={0}
          strokeColor="transparent"
          zIndex={0}
          tappable
          onPress={(event) => {
            event.stopPropagation();
            onPress(presentation);
          }}
        />
      ))}
    </>
  );
}

export function ExpandedMapStack({
  presentation,
  anchor,
  size,
  onMember,
  onClose,
  ...artwork
}: ArtworkProps & {
  presentation: NativeMapPresentation;
  anchor: { x: number; y: number };
  size: { width: number; height: number };
  onMember: (member: ClusterPoint) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const now = useNow();
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);
  const x = Math.max(128, Math.min(size.width - 128, anchor.x));
  const y = Math.max(128, Math.min(size.height - 128, anchor.y));
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: x - 128,
        top: y - 128,
        width: 256,
        height: 256,
      }}
    >
      {presentation.visible.map((member, index) => {
        const offset = nativePetalOffset(index, true);
        const profile = artwork.profiles.find(
          (row) => `person:${row.id}` === member.id,
        );
        const location = artwork.locations.find(
          (row) => `person:${row.owner_id}` === member.id,
        );
        const label =
          member.kind === "beacon"
            ? (artwork.activities.find(
                (row) => `beacon:${row.id}` === member.id,
              )?.title ?? "Beacon")
            : friendLocationLabel(
                profile?.name ?? "Friend",
                formatLocationAge(location?.updated_at ?? null, now) ?? "now",
              );
        return (
          <Pressable
            key={member.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${label}`}
            onPress={() => onMember(member)}
            style={({ pressed }) => ({
              position: "absolute",
              left: 99 + offset.x,
              top: 100 + offset.y,
              width: 58,
              height: 56,
              opacity: pressed && !reducedMotion ? 0.75 : 1,
              zIndex: 10 - index,
            })}
          >
            <MemberArtwork {...artwork} member={member} />
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Collapse map stack"
        onPress={onClose}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: colors.ink,
            backgroundColor: colors.white,
            borderRadius: 12,
            paddingHorizontal: 7,
            fontSize: 18,
          }}
        >
          ×
        </Text>
      </Pressable>
    </View>
  );
}
