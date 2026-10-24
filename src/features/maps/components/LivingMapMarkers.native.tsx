import React, { useCallback, useEffect, useRef } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
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
  clusterLayout,
  CLUSTER_COUNT_ANCHOR,
  CLUSTER_OWNERSHIP_ANCHOR,
  CLUSTER_SHADOW_OPACITY,
} from "../clusterLayout";
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
  const { group, visible, owned, overflow, mode } = presentation;
  const [avatarRevision, setAvatarRevision] = React.useState(0);
  const loaded = useCallback(() => setAvatarRevision((value) => value + 1), []);
  const layout = clusterLayout(group.members.length);
  const size = mode === "stack" ? layout.size : 180;
  const samples =
    mode === "swarm"
      ? [...group.members].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 24)
      : [];
  const offsets = samples.map((point) => nativePointOffset(point, group, 14));
  const revision = `${appearanceKey}:${mode}:${members.map((member) => member.visualRevision).join("|")}:${owned.length}:${overflow}:${avatarRevision}:${mode === "swarm" ? JSON.stringify([samples, offsets]) : ""}`;
  const tracking = useMarkerTracking(revision);
  const extent = Math.max(
    1,
    ...offsets.map((offset) =>
      Math.max(Math.abs(offset.x), Math.abs(offset.y)),
    ),
  );
  const label = `${mode === "stack" ? "Map stack" : "Spark Swarm"}: ${group.members.length} items${owned.length ? `, ${owned.length} of your Beacons` : ""}${overflow && mode === "stack" ? `, ${overflow} hidden` : ""}. ${nativeStackOpensExplorer(group.members.length) ? "Open searchable cluster explorer" : "Expand to select an item"}`;
  return (
    <Marker
      coordinate={{ latitude: group.latitude, longitude: group.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={owned.length ? 6 : 3}
      tracksViewChanges={tracking}
      accessibilityLabel={label}
      accessibilityActions={
        mode === "stack" && !nativeStackOpensExplorer(group.members.length)
          ? members.map((model) => ({
              name: model.id,
              label: `Select ${model.label}`,
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
      <View collapsable={false} style={{ width: size, height: size }}>
        {mode === "stack" && (
          <View
            pointerEvents="none"
            testID="cluster-circle-shadow"
            style={{
              position: "absolute",
              width: layout.shadowSize,
              height: layout.shadowSize,
              left: layout.shadowLeft,
              top: layout.shadowTop,
              borderRadius: layout.shadowSize / 2,
              backgroundColor: "black",
              opacity: CLUSTER_SHADOW_OPACITY,
            }}
          />
        )}
        {mode === "stack"
          ? visible.map((member, index) => {
              const offset = nativePetalOffset(index, false, visible.length);
              const model = members[index];
              return model ? (
                <View
                  key={member.id}
                  style={{
                    position: "absolute",
                    left: layout.center - 16 + offset.x,
                    top: layout.center - 16 + offset.y,
                    zIndex: visible.length - index,
                  }}
                >
                  <MemberArtwork
                    model={model}
                    compact
                    categoryColors={categoryColors}
                    availabilityColors={availabilityColors}
                    onImageLoad={loaded}
                  />
                </View>
              ) : null;
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
                  backgroundColor: categoryColors[member.category ?? "Other"],
                }}
              />
            ))}
        {mode === "stack" && overflow > 0 && (
          <View
            style={{
              position: "absolute",
              ...CLUSTER_COUNT_ANCHOR,
              zIndex: 101,
              minWidth: 24,
              height: 20,
              paddingHorizontal: 4,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{ color: colors.ink, fontSize: 10, fontWeight: "700" }}
            >
              +{overflow}
            </Text>
          </View>
        )}
        {(mode === "swarm" || owned.length > 1) && owned.length > 0 && (
          <OwnershipAnchor count={owned.length} compact={mode === "stack"} />
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
  members,
  categoryColors,
  availabilityColors,
}: ArtworkProps & {
  presentation: NativeMapPresentation;
  anchor: { x: number; y: number };
  size: { width: number; height: number };
  onMember: (member: ClusterPoint) => void;
  onClose: () => void;
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
      {presentation.visible.map((member, index) => {
        const offset = nativePetalOffset(index, true),
          model = members[index];
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
