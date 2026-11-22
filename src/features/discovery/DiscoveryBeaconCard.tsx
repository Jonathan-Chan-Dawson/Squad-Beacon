import {
  BeaconCardArtwork,
  type BeaconArtworkStyle,
} from "@/src/features/beacons/components/BeaconCardArtwork";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CalendarDays,
  ChevronRight,
  Radio,
  Route,
  Clock3,
  MapPin,
  UsersRound,
} from "lucide-react-native";
import type { Category } from "@/src/shared/types";
import { Card, useDesignTheme } from "@/src/shared/design-system";
import { BeaconIcon } from "@/src/features/beacons/components/BeaconIcon";
import { HomeAction } from "@/src/features/beacons/components/HomeAction";
import {
  discoveryCardMetadata,
  mapBeaconTitle,
  type DiscoveryCardCapacity,
} from "./discoveryCardPresentation";
import {
  MapTooltipHeader,
  MapTooltipShell,
} from "@/src/features/maps/MapTooltipShell";
import { BeaconPinGlyph } from "@/src/features/maps/components/BeaconPinGlyph";
import { CommunityArtwork } from "@/src/features/people/components/CommunityCard";
import type { SocialEntityType } from "@/src/features/social/types";

export type DiscoveryBeaconCardProps = {
  /** Map-only density. Browse and homepage cards retain their default treatment. */
  mapPreview?: boolean;
  activityId: string;
  title: string;
  category: Category;
  artworkVariant?: BeaconArtworkStyle;
  mapIcon?: string | null;
  mapHostLabel?: string;
  mapCommunityName?: string;
  mapCommunityKey?: string;
  mapCommunityType?: SocialEntityType;
  decorationAccent?: string | null;
  decorationEmoji?: string | null;
  whenLabel?: string | null;
  isLive?: boolean;
  locationLabel?: string | null;
  goingCount: number;
  capacity?: DiscoveryCardCapacity | null;
  friendsGoing?: number;
  planContext?: {
    title: string;
    onPress: () => void;
    onShowOnMap?: () => void;
    stepIndex?: number | null;
  };
  socialAvatars?: React.ReactNode;
  communityContext?: React.ReactNode;
  context?: React.ReactNode;
  /** Opens the authorized attendee roster for this Beacon. */
  onOpenPeople?: () => void;
  /** Shows the lightweight host status footer on authorized discovery cards. */
  hosted?: boolean;
  primaryAction: React.ReactNode;
  /** Accessible controls owned by the containing surface, such as Map close. */
  headerAccessory?: React.ReactNode;
  onDetails?: () => void;
  detailsLabel?: string;
  /** The More menu is kept in the top-right toolbar. */
  menu?: React.ReactNode;
  /** Lightweight reactions stay beside the attendance metadata. */
  metadataAccessory?: React.ReactNode;
  shortcutActions?: React.ReactNode;
  actionShortcuts?: React.ReactNode;
  feedback?: React.ReactNode;
};

export function DiscoveryBeaconCard({
  mapPreview = false,
  activityId,
  title,
  category,
  artworkVariant,
  mapIcon,
  mapHostLabel,
  mapCommunityName,
  mapCommunityKey,
  mapCommunityType,
  decorationAccent,
  decorationEmoji,
  whenLabel,
  isLive = false,
  locationLabel,
  goingCount,
  capacity,
  friendsGoing,
  planContext,
  socialAvatars,
  communityContext,
  context,
  onOpenPeople,
  hosted = false,
  primaryAction,
  headerAccessory,
  onDetails,
  detailsLabel,
  menu,
  metadataAccessory,
  shortcutActions,
  actionShortcuts,
  feedback,
}: DiscoveryBeaconCardProps) {
  const { colors, tokens } = useDesignTheme();
  const hasLinkedContext = !!planContext?.title.trim() || !!communityContext;
  const contextBlockStyle = {
    minWidth: 0,
    maxWidth: "100%" as const,
    alignSelf: hasLinkedContext
      ? ("stretch" as const)
      : ("flex-start" as const),
    flexShrink: 0,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: hasLinkedContext ? 0 : 5,
  };
  const categoryToken = tokens.categories[category] ?? tokens.categories.Other;
  const metadata = discoveryCardMetadata({
    goingCount,
    capacity,
    friendsGoing,
  });
  const mapTitle = mapBeaconTitle(title, !!planContext, planContext?.stepIndex);
  const trimmedWhenLabel = whenLabel?.trim() ?? "";
  const displayWhenLabel =
    isLive && trimmedWhenLabel && !/\blive\b/i.test(trimmedWhenLabel)
      ? `Live · ${trimmedWhenLabel}`
      : trimmedWhenLabel;
  const peopleContent = (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {socialAvatars ?? <UsersRound size={19} color={colors.textSecondary} />}
      </View>
      <Text
        testID="discovery-going-count"
        accessibilityLabel={metadata}
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.textSecondary,
          fontSize: 12,
          lineHeight: 17,
        }}
      >
        {metadata}
      </Text>
    </View>
  );

  if (mapPreview) {
    const communityTints = [tokens.categories.Fitness.tint, tokens.categories.Study.tint, tokens.categories.Gaming.tint, tokens.categories.Creative.tint, tokens.categories.Social.tint];
    const communitySeed = [...(mapCommunityKey ?? "")].reduce((seed, character) => (seed * 31 + character.charCodeAt(0)) >>> 0, 0);
    const headerColor = mapCommunityName ? communityTints[communitySeed % communityTints.length] : colors.surfaceRaised;
    const subtitle = mapCommunityName ?? mapHostLabel;
    const mapMetadata = discoveryCardMetadata({ goingCount, capacity });
    return (
      <MapTooltipShell testID={`discovery-beacon-card-${activityId}`} gap={3} paddingTop={6}>
        <View
          testID="map-beacon-identity"
          style={{
            backgroundColor: headerColor,
            borderRadius: 14,
            paddingLeft: 10,
            paddingRight: 3,
            paddingBottom: 4,
          }}
        >
          <View
            testID="map-beacon-header-pattern"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: "hidden", opacity: 0.38 }]}
          >
            <CommunityArtwork type={mapCommunityType ?? "squad"} />
          </View>
          <MapTooltipHeader controls={<>{menu}{headerAccessory}</>}>
            <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.textSecondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>
                {category}
              </Text>
              {planContext && mapTitle.context ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${mapTitle.context}: ${planContext.onShowOnMap ? "Show" : "Open"} ${planContext.title}${planContext.onShowOnMap ? " on Map" : ""}`}
                  onPress={planContext.onShowOnMap ?? planContext.onPress}
                  style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1, minWidth: 0 }}
                >
                  <Route size={11} color={colors.accent} />
                  <Text numberOfLines={1} style={{ flexShrink: 1, color: colors.textSecondary, fontSize: 10, fontWeight: "600" }}>
                    {mapTitle.context}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </MapTooltipHeader>
          <Pressable
            accessibilityRole={onDetails ? "button" : undefined}
            accessibilityLabel={onDetails ? `Open ${title} details` : undefined}
            onPress={onDetails}
            disabled={!onDetails}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 7, minHeight: 40 }}
          >
            <View accessibilityElementsHidden style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              {!mapIcon && decorationEmoji ? <BeaconIcon emoji={decorationEmoji} category={category} size={25} /> : <BeaconPinGlyph category={category} icon={mapIcon} size={22} color={colors.textPrimary} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text accessibilityRole="header" numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 20, lineHeight: 24, fontWeight: "700" }}>
                {mapTitle.title}
              </Text>
              {!!subtitle && <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>Hosted by {subtitle}</Text>}
            </View>
          </Pressable>
        </View>
        {trimmedWhenLabel || hosted || isLive ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 20 }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
              {trimmedWhenLabel ? <>
                <Clock3 size={14} color={colors.textSecondary} />
                <Text testID="discovery-timing" numberOfLines={2} style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }}>
                  {isLive ? trimmedWhenLabel.replace(/^live\s*[·-]\s*/i, "") : trimmedWhenLabel}
                </Text>
              </> : null}
            </View>
            {isLive ? (
              <View accessible accessibilityLabel="Happening now" style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Radio size={12} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 11, fontWeight: "600" }}>Live</Text>
              </View>
            ) : null}
            {hosted ? (
              <Text
                testID="map-hosting-status"
                style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600" }}
              >
                Hosting
              </Text>
            ) : null}
          </View>
        ) : null}
        {locationLabel ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 20 }}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text testID="map-beacon-location" numberOfLines={2} style={{ flex: 1, color: colors.textPrimary, fontSize: 12 }}>{locationLabel}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable
            accessibilityRole={onOpenPeople ? "button" : undefined}
            accessibilityLabel={onOpenPeople ? `${metadata}. View attendees` : undefined}
            onPress={onOpenPeople}
            disabled={!onOpenPeople}
            style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 38 }}
          >
            {socialAvatars ?? <UsersRound size={17} color={colors.textSecondary} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text testID="discovery-going-count" numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>{mapMetadata}</Text>
              {!!friendsGoing && <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{friendsGoing} {friendsGoing === 1 ? "friend" : "friends"} here</Text>}
            </View>
          </Pressable>
          {onDetails ? (
            <Pressable accessibilityRole="button" accessibilityLabel={detailsLabel ?? "Details"} onPress={onDetails} style={{ minHeight: 38, flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 3 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Details</Text>
              <ChevronRight size={13} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        {context || communityContext ? (
          <View testID="map-beacon-context" style={contextBlockStyle}>
            {context}
            {communityContext}
          </View>
        ) : null}
        {feedback}
        {shortcutActions}
        <View testID="discovery-card-actions" style={{ minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {hosted && onDetails ? <HomeAction title="Open Beacon" prominent stretch primary onPress={onDetails} /> : primaryAction}
          </View>
          {actionShortcuts}
        </View>
      </MapTooltipShell>
    );
  }

  return (
    <Card
      testID={`discovery-beacon-card-${activityId}`}
      style={{
        padding: 16,
        paddingTop: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.surface,
      }}
    >
      <BeaconCardArtwork
        category={category}
        accent={decorationAccent}
        variant={artworkVariant}
        radius={14}
      />
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 48, alignItems: "center", gap: 5 }}>
          <View
            testID="beacon-category-artwork"
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: colors.surfaceRaised,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                position: "absolute",
                width: 70,
                height: 70,
                borderRadius: 35,
                borderWidth: 1,
                borderColor: categoryToken.color,
                opacity: 0.08,
                top: -24,
                right: -22,
              }}
            />
            <View
              style={{
                position: "absolute",
                width: 45,
                height: 45,
                borderRadius: 23,
                borderWidth: 1,
                borderColor: categoryToken.color,
                opacity: 0.08,
                bottom: -16,
                left: -12,
              }}
            />
            <BeaconIcon emoji={decorationEmoji} category={category} size={30} />
          </View>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              lineHeight: 14,
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            {category}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 4,
              minHeight: headerAccessory || menu ? 44 : undefined,
            }}
          >
            <View
              style={{
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              {displayWhenLabel ? (
                <View
                  style={{
                    maxWidth: "100%",
                    flexShrink: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <Clock3
                    size={11}
                    color={isLive ? colors.accent : categoryToken.color}
                  />
                  <Text
                    testID="discovery-timing"
                    numberOfLines={1}
                    accessibilityLabel={displayWhenLabel}
                    style={{
                      color: isLive ? colors.accent : categoryToken.color,
                      fontSize: 11,
                      lineHeight: 16,
                      flexShrink: 1,
                    }}
                  >
                    {displayWhenLabel}
                  </Text>
                </View>
              ) : null}
              {hosted ? (
                <Text
                  testID="discovery-hosting-status"
                  style={{ color: colors.textSecondary, fontSize: 11 }}
                >
                  Hosting
                </Text>
              ) : null}
            </View>
            {headerAccessory || menu ? (
              <View
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  flexShrink: 0,
                  marginLeft: "auto",
                }}
              >
                {menu}
                {headerAccessory}
              </View>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${title} details`}
            disabled={!onDetails}
            onPress={onDetails}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: colors.textPrimary,
                fontSize: 18,
                lineHeight: 24,
                fontWeight: "600",
              }}
            >
              {title}
            </Text>
          </Pressable>
          {locationLabel ? (
            <View
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 5 }}
            >
              <MapPin size={13} color={colors.textSecondary} />
              <Text
                testID="discovery-secondary-metadata"
                style={{
                  flex: 1,
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                {locationLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        {onOpenPeople ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${metadata}. View attendees`}
            onPress={onOpenPeople}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {peopleContent}
          </Pressable>
        ) : (
          peopleContent
        )}
        {metadataAccessory}
      </View>

      {planContext || context || communityContext ? (
        <View testID="beacon-linked-context" style={contextBlockStyle}>
          {planContext?.title.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open Plan ${planContext.title}`}
              onPress={planContext.onPress}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                accessibilityElementsHidden
                style={{
                  width: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarDays size={18} color={colors.textSecondary} />
              </View>
              <Text
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                <Text style={{ fontWeight: "600" }}>Plan</Text>
                {` · ${planContext.title.trim()}`}
              </Text>
            </Pressable>
          ) : null}

          {context}
          {communityContext}
        </View>
      ) : null}

      {shortcutActions}
      {hosted && onDetails ? (
        <View
          testID="discovery-card-actions"
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Beacon"
            testID={`beacon-open-${activityId}`}
            onPress={onDetails}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              paddingHorizontal: 16,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: colors.accent,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text
              style={{
                color: colors.onAccent,
                fontSize: 14,
                lineHeight: 20,
                fontWeight: "600",
              }}
            >
              Open Beacon
            </Text>
          </Pressable>
          {actionShortcuts}
        </View>
      ) : (
        <View
          testID="discovery-card-actions"
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>{primaryAction}</View>
          {actionShortcuts}
        </View>
      )}
      {feedback}
    </Card>
  );
}
