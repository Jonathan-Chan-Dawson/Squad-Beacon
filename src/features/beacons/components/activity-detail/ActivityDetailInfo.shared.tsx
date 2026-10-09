import React, { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Navigation } from "lucide-react-native";
import { Card, useDesignTheme } from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";

export type ActivityDetailInfoProps = {
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  place?: {
    label: string;
    latitude: number | null;
    longitude: number | null;
    onlineUrl: string | null;
  };
  canReadLocation: boolean;
  onOpenMap: () => void;
  onOpenOnline: (url: string) => void;
  /** The route owns URL creation and opening through physicalDirectionsUrl. */
  onOpenDirections?: () => void;
};

type DateParts = { year: number; month: number; day: number };

function getDateParts(date: Date, timezone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function safeTimezone(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone })
      .resolvedOptions()
      .timeZone;
  } catch {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
}

function dayDistance(from: DateParts, to: DateParts) {
  return (
    Date.UTC(to.year, to.month - 1, to.day) -
    Date.UTC(from.year, from.month - 1, from.day)
  ) / 86_400_000;
}

function friendlyDay(date: Date, timezone: string, now: Date) {
  const distance = dayDistance(getDateParts(now, timezone), getDateParts(date, timezone));
  if (distance === 0) return "Today";
  if (distance === 1) return "Tomorrow";
  if (distance === -1) return "Yesterday";
  if (distance > 1 && distance < 7) return `In ${distance} days`;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function friendlyTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function timezoneLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
}

function validOnlineUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function validCoordinates(place: ActivityDetailInfoProps["place"]) {
  return (
    place?.latitude != null &&
    place.longitude != null &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    place.latitude >= -90 &&
    place.latitude <= 90 &&
    place.longitude >= -180 &&
    place.longitude <= 180
  );
}

export function ActivityDetailInfoContent({
  startsAt,
  endsAt,
  timezone,
  place,
  canReadLocation,
  onOpenMap,
  onOpenOnline,
  onOpenDirections,
  mapPreview,
}: ActivityDetailInfoProps & { mapPreview?: ReactNode }) {
  const { colors } = useDesignTheme();
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const hasTime = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime());
  const deviceTimezone = safeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const activityTimezone = timezone ? safeTimezone(timezone) : deviceTimezone;
  const canShowPlace = canReadLocation && !!place;
  const hasCoordinates = canShowPlace && !place.onlineUrl && validCoordinates(place);
  const onlineUrl = canShowPlace && place.onlineUrl && validOnlineUrl(place.onlineUrl)
    ? place.onlineUrl
    : null;
  const hasDifferentTimezone = !!timezone && activityTimezone !== deviceTimezone;
  const crossesMidnight =
    hasTime &&
    dayDistance(
      getDateParts(start, activityTimezone),
      getDateParts(end, activityTimezone),
    ) !== 0;
  const crossesMidnightAtDevice =
    hasTime &&
    dayDistance(getDateParts(start, deviceTimezone), getDateParts(end, deviceTimezone)) !== 0;
  const activityTimeLabel = hasTime
    ? `${friendlyTime(start, activityTimezone)} - ${crossesMidnight ? `${friendlyDay(end, activityTimezone, start)} ` : ""}${friendlyTime(end, activityTimezone)}${hasDifferentTimezone && timezoneLabel(start, activityTimezone) ? ` ${timezoneLabel(start, activityTimezone)}` : ""}`
    : "Time to be announced";
  const deviceTimeLabel =
    hasTime && hasDifferentTimezone
      ? `${friendlyTime(start, deviceTimezone)} - ${crossesMidnightAtDevice ? `${friendlyDay(end, deviceTimezone, start)} ` : ""}${friendlyTime(end, deviceTimezone)}${timezoneLabel(start, deviceTimezone) ? ` ${timezoneLabel(start, deviceTimezone)}` : ""}`
      : null;
  const now = new Date();
  const live = hasTime && start.getTime() <= now.getTime() && end.getTime() > now.getTime();
  const minutesToStart = hasTime ? Math.ceil((start.getTime() - now.getTime()) / 60_000) : null;
  const minutesToEnd = hasTime ? Math.ceil((end.getTime() - now.getTime()) / 60_000) : null;
  const relativeTimeLabel = live
    ? `Ends in ${minutesToEnd} min`
    : minutesToStart != null && minutesToStart > 0 && minutesToStart < 60
      ? `Starts in ${minutesToStart} min`
      : minutesToStart != null && minutesToStart >= 60 && minutesToStart < 1_440
        ? `Starts in ${Math.ceil(minutesToStart / 60)} hr`
        : null;

  return (
    <Card testID="activity-detail-info" style={{ gap: 12, padding: space.md }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View style={{ width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised }}>
          <CalendarDays size={17} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.textPrimary, ...type.secondary, fontWeight: type.weight.semibold }}>
            {hasTime ? friendlyDay(start, activityTimezone, now) : "Time to be announced"}
          </Text>
          {hasTime && (
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Clock3 size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, ...type.secondary }}>
                  {activityTimeLabel}
                </Text>
              </View>
              {relativeTimeLabel && (
                <Text style={{ color: live ? colors.accent : colors.textSecondary, ...type.caption, fontWeight: live ? type.weight.semibold : type.weight.regular }}>
                  {live ? "Happening now - " : ""}{relativeTimeLabel}
                </Text>
              )}
            </View>
          )}
          {deviceTimeLabel && (
            <Text style={{ color: colors.textSecondary, ...type.caption }}>
              Your time - {deviceTimeLabel}
            </Text>
          )}
        </View>
      </View>

      {canShowPlace && (
        onlineUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open online activity link${place.label ? `: ${place.label}` : ""}`}
            accessibilityHint={`Opens ${new URL(onlineUrl).hostname}`}
            onPress={() => onOpenOnline(onlineUrl)}
            style={({ pressed }) => ({
              minHeight: 72,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderRadius: radius.md,
              paddingHorizontal: 12,
              backgroundColor: colors.surfaceRaised,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <ArrowUpRight size={18} color={colors.accent} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: colors.textPrimary, ...type.secondary, fontWeight: type.weight.semibold }}>
                {place.label || "Online activity"}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.textSecondary, ...type.caption }}>
                {new URL(onlineUrl).hostname}
              </Text>
            </View>
            <ArrowUpRight size={16} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {hasCoordinates && mapPreview ? (
              <View style={{ width: 72, height: 72, overflow: "hidden", borderRadius: radius.md }}>
                {mapPreview}
              </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <MapPin size={16} color={colors.accent} />
                <Text numberOfLines={2} style={{ flex: 1, color: colors.textPrimary, ...type.secondary, fontWeight: type.weight.medium }}>
                  {place.label || "Place details"}
                </Text>
              </View>
              {hasCoordinates ? (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open activity on map"
                    onPress={onOpenMap}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 44,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      borderRadius: radius.button,
                      backgroundColor: colors.surfaceRaised,
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <MapPin size={15} color={colors.accent} />
                    <Text style={{ color: colors.textPrimary, ...type.caption, fontWeight: type.weight.semibold }}>
                      Open map
                    </Text>
                  </Pressable>
                  {onOpenDirections && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Get directions"
                      onPress={onOpenDirections}
                      style={({ pressed }) => ({
                        flex: 1,
                        minHeight: 44,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 5,
                        borderRadius: radius.button,
                        backgroundColor: colors.surfaceRaised,
                        opacity: pressed ? 0.72 : 1,
                      })}
                    >
                      <Navigation size={15} color={colors.accent} />
                      <Text style={{ color: colors.textPrimary, ...type.caption, fontWeight: type.weight.semibold }}>
                        Directions
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        )
      )}
    </Card>
  );
}

