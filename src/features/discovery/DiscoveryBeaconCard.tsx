import React from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  MapPin,
  Maximize2,
  Route,
  Zap,
} from "lucide-react-native";
import { Card, useDesignTheme } from "@/src/shared/design-system";
import type { Category } from "@/src/shared/types";
import {
  BeaconCardArtwork,
  type BeaconArtworkStyle,
} from "@/src/features/beacons/components/BeaconCardArtwork";
import { BeaconIcon } from "@/src/features/beacons/components/BeaconIcon";
import { BeaconPinGlyph } from "@/src/features/maps/components/BeaconPinGlyph";
import { MapTooltipShell } from "@/src/features/maps/MapTooltipShell";
import {
  discoveryCardMetadata,
  mapBeaconTitle,
  type DiscoveryCardCapacity,
} from "./discoveryCardPresentation";

export type BeaconCardDensity = "standard" | "compact" | "mini";

export type CardPlanContext = {
  title: string;
  onPress: () => void;
  onShowOnMap?: () => void;
  stepIndex?: number | null;
  stop?: { position: number; total: number };
};

export type DiscoveryBeaconCardProps = {
  density?: BeaconCardDensity;
  mapPreview?: boolean;
  activityId: string;
  testID?: string;
  title: string;
  category: Category;
  artworkVariant?: BeaconArtworkStyle;
  mapIcon?: string | null;
  decorationAccent?: string | null;
  decorationEmoji?: string | null;
  relationshipColor?: string;
  cosmeticTint?: string;
  whenLabel?: string | null;
  statusLabel?: string;
  isLive?: boolean;
  locationLabel?: string | null;
  hostLabel?: string | null;
  description?: string | null;
  goingCount?: number;
  capacity?: DiscoveryCardCapacity | null;
  friendsGoing?: number;
  planContext?: CardPlanContext;
  socialAvatars?: React.ReactNode;
  communityContext?: React.ReactNode;
  context?: React.ReactNode;
  smartFeature?: React.ReactNode;
  primaryAction?: React.ReactNode;
  headerAccessory?: React.ReactNode;
  onDetails?: () => void;
  detailsLabel?: string;
  expanded?: boolean;
  menu?: React.ReactNode;
  shortcutActions?: React.ReactNode;
  actionShortcuts?: React.ReactNode;
  feedback?: React.ReactNode;
};

export function DiscoveryBeaconCard({
  density = "standard",
  mapPreview = false,
  activityId,
  testID = `discovery-beacon-card-${activityId}`,
  title,
  category,
  artworkVariant,
  mapIcon,
  decorationAccent,
  decorationEmoji,
  relationshipColor,
  cosmeticTint,
  whenLabel,
  statusLabel,
  isLive = false,
  locationLabel,
  hostLabel,
  description,
  goingCount,
  capacity,
  friendsGoing,
  planContext,
  socialAvatars,
  communityContext,
  context,
  smartFeature,
  primaryAction,
  headerAccessory,
  onDetails,
  detailsLabel,
  expanded,
  menu,
  shortcutActions,
  actionShortcuts,
  feedback,
}: DiscoveryBeaconCardProps) {
  const { colors, tokens } = useDesignTheme();
  const { fontScale } = useWindowDimensions();
  const mini = density === "mini";
  const compact = density === "compact";
  const titleText = mapBeaconTitle(
    title,
    !!planContext,
    planContext?.stepIndex,
  ).title;
  const accent = relationshipColor ?? colors.accent;
  const iconSize = mini ? 32 : compact ? 38 : 42;
  const glyphSize = mini ? 19 : compact ? 22 : 25;
  const metadata = { ...tokens.type.caption, color: colors.textSecondary };
  const when = isLive ? whenLabel?.replace(/^live\s*[·-]\s*/i, "") : whenLabel;
  const status = statusLabel?.trim();
  const stop = planContext?.stop;
  const position = stop ? `${stop.position}/${stop.total}` : null;
  const strictLimit =
    capacity?.strict &&
    Number.isSafeInteger(capacity.limit) &&
    capacity.limit! > 0
      ? capacity.limit
      : null;
  const seats = Number.isFinite(goingCount)
    ? Math.max(0, Math.floor(goingCount!))
    : 0;
  const fill = strictLimit ? Math.min(1, seats / strictLimit) : 0;
  const fillColor =
    capacity?.full || fill >= 1
      ? colors.textSecondary
      : fill >= 0.8
        ? "#F5B952"
        : colors.success;
  const heading = (
    <Text
      accessibilityRole="header"
      numberOfLines={fontScale > 1.25 ? undefined : 2}
      style={{
        ...tokens.type.titleSmall,
        fontSize: mini ? 15 : 18,
        color: colors.textPrimary,
        fontWeight: "700",
      }}
    >
      {titleText}
    </Text>
  );
  const identityIcon = (
    <View
      testID="beacon-category-artwork"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: iconSize,
        height: iconSize,
        borderRadius: mini ? 9 : 12,
        borderLeftWidth: 2,
        borderLeftColor: accent,
        backgroundColor: tokens.categories[category].tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {mapIcon ? (
        <BeaconPinGlyph
          category={category}
          icon={mapIcon}
          size={glyphSize}
          color={colors.textPrimary}
        />
      ) : (
        <BeaconIcon
          category={category}
          emoji={decorationEmoji}
          size={glyphSize}
        />
      )}
    </View>
  );
  const timeAndStatus =
    when || status || isLive ? (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          columnGap: 8,
          rowGap: 2,
        }}
      >
        {isLive ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Zap size={13} color="#F5B952" fill="#F5B952" />
            <Text
              accessibilityLabel="Happening now"
              style={[
                metadata,
                { color: colors.textPrimary, fontWeight: "700" },
              ]}
            >
              Live
            </Text>
          </View>
        ) : null}
        {when ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              flexShrink: 1,
            }}
          >
            {!mini && !isLive && (
              <Clock3 size={13} color={colors.textSecondary} />
            )}
            <Text
              testID="discovery-timing"
              style={[metadata, { flexShrink: 1 }]}
            >
              {when}
            </Text>
          </View>
        ) : null}
        {status && status !== when ? (
          <Text
            testID={
              status === "Hosting"
                ? mapPreview
                  ? "map-hosting-status"
                  : "discovery-hosting-status"
                : undefined
            }
            style={metadata}
          >
            {status}
          </Text>
        ) : null}
      </View>
    ) : null;

  if (mini || (compact && !mapPreview && !primaryAction && !actionShortcuts)) {
    const row = {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      minHeight: 48,
      borderRadius: 12,
      padding: 8,
      backgroundColor: colors.surfaceRaised,
    };
    const content = (
      <>
        {identityIcon}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {heading}
          {timeAndStatus}
          {!mini && locationLabel ? (
            <Text numberOfLines={1} style={metadata}>
              {locationLabel}
            </Text>
          ) : null}
        </View>
        {onDetails &&
          (expanded ? (
            <ChevronDown size={16} color={colors.textSecondary} />
          ) : (
            <ChevronRight size={16} color={colors.textSecondary} />
          ))}
      </>
    );
    return onDetails ? (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={detailsLabel ?? `Open ${titleText}`}
        accessibilityState={expanded == null ? undefined : { expanded }}
        onPress={onDetails}
        style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1 }]}
      >
        {content}
      </Pressable>
    ) : (
      <View testID={testID} style={row}>
        {content}
      </View>
    );
  }

  const body = (
    <>
      <BeaconCardArtwork
        category={category}
        accent={decorationAccent}
        variant={artworkVariant}
        tint={cosmeticTint}
        integrated
        quiet={compact}
        radius={16}
      />
      <View
        testID={mapPreview ? "map-beacon-identity" : undefined}
        style={{ gap: 4 }}
      >
        <View
          style={{
            flexDirection: "row",
            flexWrap: fontScale > 1.4 ? "wrap" : "nowrap",
            alignItems: "center",
            gap: 4,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              flexShrink: 1,
            }}
          >
            {identityIcon}
            {!planContext && (
              <Text numberOfLines={1} style={[metadata, { flexShrink: 1 }]}>
                {category}
              </Text>
            )}
          </View>
          <View
            style={{
              marginStart: "auto",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {!!planContext?.title.trim() && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open Plan ${planContext.title}${stop ? `, stop ${stop.position} of ${stop.total}` : ""}`}
                onPress={planContext.onPress}
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 44,
                  maxWidth: 208,
                  flexShrink: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  paddingHorizontal: 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Route color={colors.textSecondary} size={16} />
                <View
                  style={{
                    flexShrink: 1,
                    minWidth: 0,
                    flexDirection: fontScale > 1.4 ? "column" : "row",
                    alignItems: fontScale > 1.4 ? "flex-end" : "center",
                    gap: 3,
                  }}
                >
                  <Text numberOfLines={1} style={[metadata, { flexShrink: 1 }]}>
                    {planContext.title.trim()}
                  </Text>
                  {position && (
                    <Text
                      testID="beacon-plan-position"
                      style={[metadata, { fontWeight: "700" }]}
                    >
                      {position}
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
            {mapPreview && planContext?.onShowOnMap && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom to Fit"
                onPress={planContext.onShowOnMap}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Maximize2 size={18} color={colors.textSecondary} />
              </Pressable>
            )}
            {menu}
            {headerAccessory}
          </View>
        </View>
        {onDetails ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailsLabel ?? `Open ${titleText} details`}
            onPress={onDetails}
            style={{ justifyContent: "center", minHeight: 44 }}
          >
            {heading}
          </Pressable>
        ) : (
          heading
        )}
        {timeAndStatus}
        {locationLabel || hostLabel ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 8,
              rowGap: 3,
            }}
          >
            {locationLabel ? (
              <View style={{ flexDirection: "row", gap: 4, flexShrink: 1 }}>
                <MapPin size={13} color={colors.textSecondary} />
                <Text
                  testID={
                    mapPreview
                      ? "map-beacon-location"
                      : "discovery-secondary-metadata"
                  }
                  style={[metadata, { flexShrink: 1 }]}
                >
                  {locationLabel}
                </Text>
              </View>
            ) : null}
            {hostLabel ? <Text style={metadata}>{hostLabel}</Text> : null}
          </View>
        ) : null}
        {!compact && description?.trim() ? (
          <Text numberOfLines={2} style={metadata}>
            {description}
          </Text>
        ) : null}
      </View>
      {goingCount != null ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {socialAvatars && (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
              >
                {socialAvatars}
              </View>
            )}
            <Text
              testID="discovery-going-count"
              style={[metadata, { flex: 1 }]}
            >
              {discoveryCardMetadata({ goingCount, capacity, friendsGoing })}
            </Text>
          </View>
          {strictLimit ? (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Beacon capacity"
              accessibilityValue={{
                min: 0,
                max: strictLimit,
                now: Math.min(seats, strictLimit),
                text: `${seats} of ${strictLimit} accepted seats`,
              }}
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.surfaceRaised,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${fill * 100}%`,
                  height: 4,
                  backgroundColor: fillColor,
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {communityContext}
      {context}
      {smartFeature}
      {shortcutActions}
      {primaryAction || actionShortcuts ? (
        <View
          testID="discovery-card-actions"
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          {primaryAction ? (
            <View style={{ flex: 1, minWidth: 96 }}>{primaryAction}</View>
          ) : null}
          {actionShortcuts}
        </View>
      ) : null}
      {feedback}
    </>
  );
  return mapPreview ? (
    <MapTooltipShell testID={testID} gap={8} paddingTop={8}>
      {body}
    </MapTooltipShell>
  ) : (
    <Card
      testID={testID}
      style={{
        padding: compact ? 12 : 16,
        gap: compact ? 8 : 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {body}
    </Card>
  );
}
