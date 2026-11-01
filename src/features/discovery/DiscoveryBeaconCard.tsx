import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Link2,
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
import { mapTooltip } from "@/src/features/maps/tooltipConstants";

export type DiscoveryBeaconCardProps = {
  /** Map-only density. Browse and homepage cards retain their default treatment. */
  mapPreview?: boolean;
  activityId: string;
  title: string;
  category: Category;
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
  menu,
  metadataAccessory,
  shortcutActions,
  actionShortcuts,
  feedback,
}: DiscoveryBeaconCardProps) {
  const { colors, tokens } = useDesignTheme();
  const contextBlockStyle = {
    width: "100%" as const,
    minWidth: 0,
    minHeight: 44,
    alignSelf: "stretch" as const,
    flexShrink: 0,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
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

  if (mapPreview)
    return (
      <MapTooltipShell testID={`discovery-beacon-card-${activityId}`}>
        <MapTooltipHeader
          controls={
            <>
              {menu}
              {headerAccessory}
            </>
          }
        >
          <Pressable
            accessibilityRole={onDetails ? "button" : undefined}
            accessibilityLabel={onDetails ? `Open ${title} details` : undefined}
            onPress={onDetails}
            disabled={!onDetails}
            style={{
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              minHeight: 44,
            }}
          >
            <View
              accessibilityElementsHidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: categoryToken.tint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BeaconIcon
                emoji={decorationEmoji}
                category={category}
                size={28}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  fontSize: 9,
                  lineHeight: 12,
                  fontWeight: "600",
                  textTransform: "uppercase",
                }}
              >
                {[mapTitle.context, category].filter(Boolean).join(" \u00b7 ")}
              </Text>
              <Text
                accessibilityRole="header"
                numberOfLines={2}
                style={{
                  color: colors.textPrimary,
                  fontSize: mapTooltip.titleSize,
                  lineHeight: 20,
                  fontWeight: "600",
                }}
              >
                {mapTitle.title}
              </Text>
            </View>
          </Pressable>
        </MapTooltipHeader>
        <View style={{ gap: 2 }}>
          {onOpenPeople ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${metadata}. View attendees`}
              onPress={onOpenPeople}
              style={{ minHeight: 44, justifyContent: "center", gap: 3 }}
            >
              <Text
                testID="discovery-timing"
                numberOfLines={2}
                style={{
                  color: isLive ? colors.accent : colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                {[displayWhenLabel, locationLabel]
                  .filter(Boolean)
                  .join(" \u00b7 ")}
              </Text>
              <Text
                testID="discovery-going-count"
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                {metadata}
              </Text>
            </Pressable>
          ) : (
            <>
              <Text
                testID="discovery-timing"
                numberOfLines={2}
                style={{
                  color: isLive ? colors.accent : colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                {[displayWhenLabel, locationLabel]
                  .filter(Boolean)
                  .join(" \u00b7 ")}
              </Text>
              <Text
                testID="discovery-going-count"
                numberOfLines={1}
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                {metadata}
              </Text>
            </>
          )}
        </View>
        {planContext || context || communityContext ? (
          <View testID="map-beacon-context" style={contextBlockStyle}>
            {!!planContext?.title.trim() && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open Plan ${planContext.title}`}
                onPress={planContext.onPress}
                style={{
                  minWidth: 0,
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <Link2 size={14} color={colors.textSecondary} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    color: colors.textPrimary,
                    fontSize: 12,
                  }}
                >
                  {planContext.title}
                </Text>
              </Pressable>
            )}
            {context}
            {communityContext}
          </View>
        ) : null}
        {feedback}
        {shortcutActions}
        <View
          testID="discovery-card-actions"
          style={{
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            {hosted && onDetails ? (
              <HomeAction
                title="Open Beacon"
                prominent
                stretch
                primary
                onPress={onDetails}
              />
            ) : (
              primaryAction
            )}
          </View>
          {actionShortcuts}
        </View>
      </MapTooltipShell>
    );

  return (
    <Card
      testID={`discovery-beacon-card-${activityId}`}
      style={{
        padding: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 64, alignItems: "center", gap: 5 }}>
          <View
            testID="beacon-category-artwork"
            style={{
              width: 64,
              height: 68,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: categoryToken.tint,
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
                opacity: 0.18,
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
                opacity: 0.18,
                bottom: -16,
                left: -12,
              }}
            />
            <BeaconIcon emoji={decorationEmoji} category={category} size={38} />
          </View>
          <Text
            style={{
              color: categoryToken.color,
              fontSize: 10,
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
              flexWrap: "wrap",
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
                flexBasis: 100,
                minWidth: 0,
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
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
                    backgroundColor: categoryToken.tint,
                  }}
                >
                  <Clock3
                    size={11}
                    color={isLive ? colors.accent : categoryToken.color}
                  />
                  <Text
                    testID="discovery-timing"
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

      <View
        style={{
          height: 1,
          marginVertical: 2,
          backgroundColor: colors.border,
        }}
      />

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
              <View
                style={{
                  width: 24,
                  height: 24,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={16} color={colors.textSecondary} />
              </View>
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
            <ArrowRight size={17} color={colors.onAccent} />
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
