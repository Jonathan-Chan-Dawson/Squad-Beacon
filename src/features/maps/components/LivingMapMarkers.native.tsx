import React, { useCallback, useEffect, useRef } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { bloomGeometry, bloomAccessibilityLabel } from "../clusterBloom";
import { Marker, Polygon } from "react-native-maps";
import { AvatarStatusBadge } from "@/src/features/profile/AvatarStatusBadge";
import { ActivityBadge } from "@/src/features/beacons/ActivityBadge";
import { useTheme } from "@/src/shared/ui";
import { useReducedMotion } from "@/src/shared/design-system";
import type { Category } from "@/src/shared/types";
import type { FriendAvailabilityState } from "@/src/shared/domain";
import type { ClusterPoint } from "../cluster";
import type { ClusterMemberArtwork } from "../clusterArtwork";
import { mapIdentityColors, friendLocationLabel } from "../markerIdentity";
import {
  friendCountLabel,
  friendCountWidth,
  CLUSTER_OWNERSHIP_ANCHOR,
  CLUSTER_FRIEND_SHADOW_OPACITY,
  CLUSTER_MICRO_SHADOW_OPACITY,
  CLUSTER_SHADOW_OPACITY,
} from "../clusterLayout";
import {
  nativeAtmosphereRadius,
  nativePetalOffset,
  presentationOpensExplorer,
  type NativeMapPresentation,
} from "../nativeMapPresentation";
import {
  BeaconMarkerArtwork,
  FriendMapAvatar,
  useMarkerTracking,
} from "./BeaconMapMarkers.native";

type ArtworkProps = {
  members: readonly ClusterMemberArtwork[];
  categoryColors: Record<Category, string>;
  availabilityColors: Record<FriendAvailabilityState, string>;
};

const MemberArtwork = React.memo(function MemberArtwork({
  model,
  compact = false,
  categoryColors,
  availabilityColors,
  onImageLoad,
}: Omit<ArtworkProps, "members"> & {
  model: ClusterMemberArtwork;
  compact?: boolean;
  onImageLoad?: () => void;
}) {
  const { colors, resolvedAppearance } = useTheme();
  const loaded = useRef<string | null>(null);
  const imageKey = `${model.id}:${model.profile?.avatar_updated_at ?? ""}`;
  const imageLoaded = useCallback(() => {
    if (loaded.current !== imageKey) {
      loaded.current = imageKey;
      onImageLoad?.();
    }
  }, [imageKey, onImageLoad]);
  if (model.kind === "beacon" && !compact)
    return (
      <BeaconMarkerArtwork
        id={model.id.slice(7)}
        category={model.category}
        categoryColor={categoryColors[model.category]}
      />
    );
  const size = compact ? 32 : 36;
  const color =
    model.kind === "beacon"
      ? categoryColors[model.category]
      : availabilityColors[model.availability];
  return (
    <View
      style={{
        width: compact ? 32 : 58,
        height: compact ? 32 : 56,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {model.kind === "beacon" ? (
          <ActivityBadge category={model.category} size={24} iconSize={18} />
        ) : model.profile ? (
          <FriendMapAvatar
            profile={model.profile}
            size={size - 4}
            onImageLoad={imageLoaded}
          />
        ) : null}
        {model.kind === "person" && (
          <AvatarStatusBadge state={model.availability} size={8} />
        )}
        {model.identity && (
          <View
            accessibilityLabel={model.identity.label}
            style={{
              position: "absolute",
              ...(model.owned ? { left: -2 } : { right: -2 }),
              bottom: -2,
              width: 12,
              height: 12,
              borderRadius: model.identity.kind === "community" ? 4 : 6,
              borderWidth: 1,
              borderColor: colors.white,
              backgroundColor:
                model.identity.glyph === "♥"
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
                  model.identity.glyph === "♥"
                    ? mapIdentityColors.heart[resolvedAppearance]
                    : colors.white,
                fontSize: 8,
              }}
            >
              {model.identity.glyph}
            </Text>
          </View>
        )}
        {model.owned && (
          <View
            accessibilityLabel="Your Beacon"
            testID="beacon-ownership-star"
            style={{
              position: "absolute",
              right: -3,
              bottom: -2,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: mapIdentityColors.ownership,
              borderWidth: 1,
              borderColor: "white",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 8 }}>★</Text>
          </View>
        )}
      </View>
    </View>
  );
});

function OwnershipAnchor({
  count,
  compact = false,
}: {
  count: number;
  compact?: boolean;
}) {
  return (
    <View
      accessibilityLabel={`${count} of your Beacons`}
      style={{
        position: "absolute",
        ...(compact ? CLUSTER_OWNERSHIP_ANCHOR : { right: 12, bottom: 14 }),
        minWidth: 22,
        height: 22,
        paddingHorizontal: 4,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: "white",
        backgroundColor: mapIdentityColors.ownership,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
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
      key={presentation.owned.map((m) => m.id).join("|")}
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

function LivingMapPinComponent({
  presentation,
  onPress,
  onMember,
  appearanceKey,
  members,
  categoryColors,
  availabilityColors,
}: ArtworkProps & {
  presentation: NativeMapPresentation;
  appearanceKey: string;
  onPress: (presentation: NativeMapPresentation) => void;
  onMember: (member: ClusterPoint) => void;
}) {
  const { colors } = useTheme();
  const { group, overflow } = presentation;
  const geometry = bloomGeometry(presentation);
  const explorer = !!presentationOpensExplorer(presentation);
  const shadowGradientId = React.useId().replace(/:/g, "");
  const shadowOpacity = geometry.friendsOnly
    ? CLUSTER_FRIEND_SHADOW_OPACITY
    : presentation.scale === "micro"
      ? CLUSTER_MICRO_SHADOW_OPACITY
      : CLUSTER_SHADOW_OPACITY;
  const [avatarRevision, setAvatarRevision] = React.useState(0);
  const loaded = useCallback(() => setAvatarRevision((value) => value + 1), []);
  const tracking = useMarkerTracking(
    `${appearanceKey}:${geometry.markerSize}:${geometry.satelliteSize}:${presentation.scale}:${presentation.people.length}:${overflow}:${members.map((member) => member.visualRevision).join("|")}:${avatarRevision}:${JSON.stringify(geometry.satelliteOffsets)}:${JSON.stringify(geometry.countBadge)}`,
  );
  const badgeStyle = {
    position: "absolute" as const,
    bottom: 0,
    minWidth: presentation.scale === "micro" ? 16 : 24,
    height: presentation.scale === "micro" ? 14 : 20,
    paddingHorizontal: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 40,
  };
  return (
    <Marker
      coordinate={group}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={presentation.owned.length ? 6 : 3}
      tracksViewChanges={tracking}
      accessibilityLabel={bloomAccessibilityLabel(presentation)}
      accessibilityActions={[
        ...(!explorer
          ? geometry.primary.map((point) => ({
              name: point.id,
              label: `Select ${members.find((model) => model.id === point.id)?.label ?? "Beacon"}`,
            }))
          : [{ name: "activate", label: "Open searchable cluster explorer" }]),
        ...(presentation.people.length && presentation.beacons.length
          ? [
              {
                name: "friends",
                label: `Explore ${presentation.people.length} nearby shared friend locations`,
              },
            ]
          : []),
      ]}
      onAccessibilityAction={(event) => {
        const point = group.members.find(
          (point) => point.id === event.nativeEvent.actionName,
        );
        if (point) onMember(point);
        else
          onPress(
            event.nativeEvent.actionName === "friends"
              ? { ...presentation, forceExplorer: true }
              : presentation,
          );
      }}
      onPress={(event) => {
        event.stopPropagation();
        onPress(presentation);
      }}
    >
      <View
        collapsable={false}
        style={{ width: geometry.size, height: geometry.size }}
      >
        <View
          pointerEvents="none"
          testID="cluster-circle-shadow"
          style={{
            position: "absolute",
            width: geometry.shadowSize,
            height: geometry.shadowSize,
            left: geometry.shadowLeft,
            top: geometry.shadowTop,
            borderRadius: geometry.shadowSize / 2,
          }}
        >
          <Svg width={geometry.shadowSize} height={geometry.shadowSize}>
            <Defs>
              <RadialGradient id={shadowGradientId}>
                <Stop
                  offset="0"
                  stopColor="black"
                  stopOpacity={shadowOpacity}
                />
                <Stop
                  offset="0.55"
                  stopColor="black"
                  stopOpacity={shadowOpacity * 0.5}
                />
                <Stop offset="1" stopColor="black" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle
              cx={geometry.shadowSize / 2}
              cy={geometry.shadowSize / 2}
              r={geometry.shadowSize / 2}
              fill={`url(#${shadowGradientId})`}
            />
          </Svg>
        </View>
        {geometry.primary.map((point, index) => {
          const model = members.find((member) => member.id === point.id),
            offset = geometry.offsets[index];
          if (!model) return null;
          const dot =
            geometry.friendsOnly &&
            (presentation.scale === "far" || presentation.scale === "micro");
          return (
            <View
              key={point.id}
              style={{
                position: "absolute",
                left:
                  geometry.center - (geometry.fullBeacon ? 29 : 16) + offset.x,
                top:
                  geometry.center - (geometry.fullBeacon ? 20 : 16) + offset.y,
                zIndex: 20 - index,
                transform: geometry.fullBeacon
                  ? undefined
                  : [{ scale: geometry.markerSize / 32 }],
              }}
            >
              {dot ? (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.ink,
                    opacity: presentation.scale === "micro" ? 0.35 : 0.6,
                  }}
                />
              ) : (
                <MemberArtwork
                  model={model}
                  compact={!geometry.fullBeacon}
                  categoryColors={categoryColors}
                  availabilityColors={availabilityColors}
                  onImageLoad={loaded}
                />
              )}
            </View>
          );
        })}
        {geometry.satellites.map((point, index) => {
          const offset = geometry.satelliteOffsets[index],
            s = geometry.satelliteSize;
          return (
            <View
              key={point.id}
              pointerEvents="none"
              testID="cluster-friend-satellite"
              style={{
                position: "absolute",
                left: geometry.center + offset.x - s / 2,
                top: geometry.center + offset.y - s / 2,
                width: s,
                height: s,
                borderRadius: s / 2,
                borderWidth: 1,
                borderColor:
                  s >= 10 ? mapIdentityColors.ownership : colors.white,
                backgroundColor:
                  s >= 10 ? colors.white : mapIdentityColors.ownership,
                opacity: presentation.scale === "micro" ? 0.8 : 1,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 30,
              }}
            >
              {s >= 10 && (
                <Svg
                  width={s - 4}
                  height={s - 4}
                  viewBox="0 0 24 24"
                  fill={colors.ink}
                >
                  <Circle cx={12} cy={7} r={4} />
                  <Path d="M5 21v-3a7 7 0 0 1 14 0v3Z" />
                </Svg>
              )}
            </View>
          );
        })}
        {geometry.friendsOnly && presentation.people.length >= 5 && (
          <View
            style={{
              ...badgeStyle,
              left:
                geometry.center -
                friendCountWidth(
                  presentation.people.length,
                  presentation.scale === "micro",
                ) /
                  2,
              top: geometry.center - 10,
              bottom: undefined,
              minWidth: friendCountWidth(
                presentation.people.length,
                presentation.scale === "micro",
              ),
              opacity: presentation.scale === "micro" ? 0.8 : 1,
              flexDirection: "row",
              gap: 2,
            }}
          >
            <Text
              style={{
                color: colors.ink,
                fontSize: presentation.scale === "micro" ? 8 : 10,
                fontWeight: "700",
              }}
            >
              {friendCountLabel(presentation.people.length)}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

export const LivingMapPin = React.memo(
  LivingMapPinComponent,
  (a, b) =>
    a.presentation === b.presentation &&
    a.appearanceKey === b.appearanceKey &&
    a.onPress === b.onPress &&
    a.onMember === b.onMember &&
    a.categoryColors === b.categoryColors &&
    a.availabilityColors === b.availabilityColors &&
    a.members.length === b.members.length &&
    a.members.every((member, index) => member === b.members[index]),
);

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
  onPeople,
  members,
  categoryColors,
  availabilityColors,
}: ArtworkProps & {
  presentation: NativeMapPresentation;
  anchor: { x: number; y: number };
  size: { width: number; height: number };
  onMember: (member: ClusterPoint) => void;
  onClose: () => void;
  onPeople?: () => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
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
  const x = Math.max(128, Math.min(size.width - 128, anchor.x)),
    y = Math.max(128, Math.min(size.height - 128, anchor.y));
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
      {(presentation.beacons.length
        ? presentation.beacons
        : presentation.people
      )
        .filter((point) =>
          presentation.beacons.length
            ? point.kind === "beacon"
            : point.kind === "person",
        )
        .map((member, index) => {
          const offset = nativePetalOffset(index, true),
            model = members.find((model) => model.id === member.id);
          if (!model) return null;
          const label =
            model.kind === "person"
              ? friendLocationLabel(model.label, model.age)
              : model.label;
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
              <MemberArtwork
                model={model}
                categoryColors={categoryColors}
                availabilityColors={availabilityColors}
              />
            </Pressable>
          );
        })}
      {presentation.people.length > 0 && presentation.beacons.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Explore ${presentation.people.length} nearby friends; proximity is not attendance`}
          onPress={onPeople}
          style={{
            position: "absolute",
            bottom: 0,
            left: 64,
            minHeight: 44,
            minWidth: 128,
            borderRadius: 16,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 12 }}>
            Nearby friends · {presentation.people.length}
          </Text>
        </Pressable>
      )}
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
