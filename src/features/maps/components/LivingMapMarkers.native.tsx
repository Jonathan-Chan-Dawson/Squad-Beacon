import React, { useCallback, useEffect, useRef } from "react";
import type { EquippedLooks } from "@/src/features/beacons/rewardLooks";
import { BackHandler, Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import {
  bloomGeometry,
  bloomAccessibilityLabel,
  petalBookmarkVisible,
  STELLAR_OUTLINE, STELLAR_CORE, STELLAR_FACETS, STELLAR_PEOPLE, STELLAR_OPACITY, STELLAR_PERSON, ROUND_SIGNAL, ROUND_SIGNAL_CORE, ROUND_SIGNAL_FACETS,
} from "../clusterBloom";
import { Marker, Polygon } from "react-native-maps";
import { MapProjector } from "./MapProjector";
import { AvatarStatusBadge } from "@/src/features/profile/AvatarStatusBadge";
import { BeaconPinGlyph } from "./BeaconPinGlyph";
import { useTheme } from "@/src/shared/ui";
import { useReducedMotion } from "@/src/shared/design-system";
import type { Category } from "@/src/shared/types";
import type { FriendAvailabilityState } from "@/src/shared/domain";
import type { ClusterPoint } from "../cluster";
import type { ClusterMemberArtwork } from "../clusterArtwork";
import {
  beaconPinEmphasis,
  beaconGlyphSize,
  beaconMarkerColor,
  stellarRelationships,
  type BeaconMarkerState,
  distantBeaconPinEmphasis,
  mapIdentityColors,
  friendLocationLabel,
} from "../markerIdentity";
import {
  CLUSTER_COUNT_PATHS,
  CLUSTER_OWNERSHIP_ANCHOR,
  CLUSTER_FRIEND_SHADOW_OPACITY,
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
  BeaconPinLight,
  BeaconMarkerBadgeRow,
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
  showIdentity = true,
  showSaved = true,
  categoryColors,
  availabilityColors,
  onImageLoad,
}: Omit<ArtworkProps, "members"> & {
  model: ClusterMemberArtwork;
  compact?: boolean;
  showIdentity?: boolean;
  showSaved?: boolean;
  onImageLoad?: () => void;
}) {
  const { colors } = useTheme();
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
        lightEnabled={false}
        showProjection={false}
        markerState={model.markerState}
        showSaved={showSaved}
        id={model.id.slice(7)}
        category={model.category}
        categoryColor={categoryColors[model.category]}
        publicMarker={model.publicMarker}
      />
    );
  const size = compact ? 32 : 36;
  const color =
    model.kind === "beacon"
      ? beaconMarkerColor(model.markerState)
      : model.relationshipColor ?? availabilityColors.unknown;
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
          borderRadius: model.publicMarker ? 8 : size / 2,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {model.kind === "beacon" ? (
          <BeaconPinGlyph category={model.category} size={beaconGlyphSize(32)} color={colors.ink} />
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
        {showIdentity && model.kind === "beacon" && <BeaconMarkerBadgeRow state={model.markerState} size={32} petal showRelevance={showSaved} />}
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
  equippedLooks,
  beaconStates,
}: ArtworkProps & {
  presentation: NativeMapPresentation;
  appearanceKey: string;
  equippedLooks?: Record<string, EquippedLooks>;
  beaconStates?: ReadonlyMap<string, BeaconMarkerState>;
  onPress: (presentation: NativeMapPresentation) => void;
  onMember: (member: ClusterPoint) => void;
}) {
  const { colors } = useTheme();
  const { group, overflow } = presentation;
  const geometry = bloomGeometry(presentation);
  const explorer = presentationOpensExplorer(presentation);
  const projectorBeacon = geometry.projector && !explorer
    ? members.find((member) => member.id === geometry.primary[0]?.id)
    : undefined;
  const states = new Map(members.flatMap((member) => member.kind === "beacon" ? [[member.id, member.markerState] as const] : []));
  const relationships = stellarRelationships(presentation.beacons, (point) => beaconStates?.get(point.id.slice(7)) ?? states.get(point.id), geometry.signal?.facets ?? 0);
  const stellar = presentation.scale === "micro";
  const beaconShape = stellar ? STELLAR_OUTLINE : ROUND_SIGNAL;
  const shadowGradientId = React.useId().replace(/:/g, "");
  const shadowOpacity = geometry.friendsOnly ? CLUSTER_FRIEND_SHADOW_OPACITY : CLUSTER_SHADOW_OPACITY;
  const [avatarRevision, setAvatarRevision] = React.useState(0);
  const loaded = useCallback(() => setAvatarRevision((value) => value + 1), []);
  const tracking = useMarkerTracking(JSON.stringify([
    appearanceKey, presentation.scale, overflow, geometry, avatarRevision, relationships,
    members.map((member) => [member.visualRevision, equippedLooks?.[member.id.slice(7)]]),
  ]));
  const count = geometry.countBadge;
  return (
    <Marker
      coordinate={group}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={presentation.owned.length ? 6 : 3}
      tracksViewChanges={tracking}
      accessibilityLabel={`${bloomAccessibilityLabel(presentation)}. ${members
        .filter((m) => m.kind === "beacon")
        .map((m) => m.label)
        .join("; ")}`}
      accessibilityActions={[
        ...(!explorer
          ? (geometry.friendsOnly ? presentation.people : geometry.primary).map(
              (point) => ({
                name: point.id,
                label: `Select ${members.find((model) => model.id === point.id)?.label ?? "Beacon"}`,
              }),
            )
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
        {!!geometry.shadowSize && (
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
        )}
        {geometry.projector && (
          <MapProjector
            kind={explorer ? "cluster" : "beacon"}
            center={geometry.center + geometry.projector.x}
            top={geometry.center + geometry.projector.top}
            height={geometry.projector.height}
            width={geometry.projector.width}
            opacity={geometry.projector.opacity}
            color={explorer ? mapIdentityColors.cluster : beaconMarkerColor(projectorBeacon?.kind === "beacon" ? projectorBeacon.markerState : undefined)}
          />
        )}
        {geometry.signal && (
          <Svg
            pointerEvents="none"
            testID="cluster-signal"
            accessible={false}
            width={geometry.signal.width}
            height={geometry.signal.height}
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              left: geometry.center + geometry.signal.x - geometry.signal.width / 2,
              top: geometry.center + geometry.signal.y - geometry.signal.height / 2,
              opacity: geometry.friendsOnly ? 1 : STELLAR_OPACITY,
            }}
          >
            {geometry.friendsOnly ? (
              <Path d={STELLAR_PEOPLE} fill="#B5CCEC" stroke="#293750" strokeWidth={8} strokeLinejoin="round" />
            ) : (
              <>
                {geometry.signal.glow && <Path d={beaconShape} fill="none" stroke="#CFB9FF" strokeWidth={geometry.signal.width >= 36 ? 8 : 5} opacity={0.36} strokeLinejoin="round" />}
                <Path d={beaconShape} fill="#E8DFFD" stroke="#594A78" strokeWidth={3} strokeLinejoin="round" />
                {relationships.map((relationship, index) => (
                  <Path key={relationship} d={(stellar ? STELLAR_FACETS : ROUND_SIGNAL_FACETS)[index]} fill={mapIdentityColors[relationship]} />
                ))}
                <Path d={stellar ? STELLAR_CORE : ROUND_SIGNAL_CORE} fill="#FFF4DE" opacity={0.93} />
              </>
            )}
          </Svg>
        )}
        {geometry.primary.map((point, index) => {
          const model = members.find((member) => member.id === point.id),
            offset = geometry.offsets[index];
          if (!model) return null;
          const color = model.kind === "beacon"
            ? beaconMarkerColor(model.markerState) : model.relationshipColor ?? availabilityColors.unknown;
          const accent = !explorer && model.kind === "beacon" && presentation.scale !== "close"
            ? distantBeaconPinEmphasis(beaconPinEmphasis(model.markerState, false, color), presentation.scale)
            : null;
          const faceSize = geometry.markerSize;
          return (
            <React.Fragment key={point.id}>
              {accent && (accent.beamHeight > 0 || presentation.scale === "medium") && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    alignItems: "center",
                    width: faceSize,
                    height: faceSize,
                    left: geometry.center - faceSize / 2,
                    top: geometry.center - faceSize / 2,
                  }}
                >
                  <BeaconPinLight lighting={accent} compact faceSize={faceSize} />
                </View>
              )}
              <View
                style={{
                  position: "absolute",
                  left: geometry.center - 16 + offset.x,
                  top: geometry.center - 16 + offset.y,
                  zIndex: 20 - index,
                  transform: [{ scale: faceSize / 32 }],
                }}
              >
                {geometry.distant ? (
                  <Svg
                    testID={model.kind === "person" ? "map-single-person-signal" : stellar ? "map-single-stellar-beacon" : "map-single-round-beacon"}
                    width={32}
                    height={32}
                    viewBox="0 0 100 100"
                    style={{ opacity: STELLAR_OPACITY }}
                  >
                    <Path d={model.kind === "person" ? STELLAR_PERSON : beaconShape} fill={color} />
                  </Svg>
                ) : (
                  <MemberArtwork
                    model={model}
                    compact
                    showIdentity={faceSize >= 24}
                    showSaved={!explorer || petalBookmarkVisible(geometry, index)}
                    categoryColors={categoryColors}
                    availabilityColors={availabilityColors}
                    onImageLoad={loaded}
                  />
                )}
              </View>
            </React.Fragment>
          );
        })}
        {geometry.satellites.map((point, index) => {
          const offset = geometry.satelliteOffsets[index],
            s = geometry.satelliteSize;
          const profile = members.find((member) => member.id === point.id)?.profile;
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
                borderColor: colors.line,
                backgroundColor: colors.surface,
                opacity: presentation.friendsProminent ? 1 : 0.92,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 30,
              }}
            >
              {profile && <FriendMapAvatar profile={profile} size={s - 2} onImageLoad={loaded} />}
            </View>
          );
        })}
        {count && (
          <View
            testID="map-cluster-count"
            accessible={false}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: geometry.center + count.offset.x - count.width / 2,
              top: geometry.center + count.offset.y - count.height / 2,
              width: count.width,
              height: count.height,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 3,
              zIndex: 40,
            }}
          >
            {count.parts.map((part, index) => (
              <React.Fragment key={part.kind}>
                {index > 0 && <Text style={{ color: colors.ink, fontSize: count.fontSize }}>·</Text>}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Svg width={count.fontSize} height={count.fontSize} viewBox="0 0 24 24">
                    <Path d={CLUSTER_COUNT_PATHS[part.kind]} fill="none" stroke={colors.ink}
                      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={{ color: colors.ink, fontSize: count.fontSize,
                    fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                    {part.count}
                  </Text>
                </View>
              </React.Fragment>
            ))}
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
    a.equippedLooks === b.equippedLooks &&
    a.beaconStates === b.beaconStates &&
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
