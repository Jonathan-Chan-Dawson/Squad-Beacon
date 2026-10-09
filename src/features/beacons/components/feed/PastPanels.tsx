import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Copy,
  Heart,
  Library,
} from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { Card, EmptyState, useDesignTheme } from "@/src/shared/design-system";
import { radius, space, type } from "@/src/theme/data";

export type PastToolkitCounts = {
  plans: number;
  favorites: number;
  templates: number;
  library: number;
};

export type PastToolkitProps = {
  counts: PastToolkitCounts;
  onPlans: () => void;
  onFavorites: () => void;
  onTemplates: () => void;
  onLibrary: () => void;
};

export function PastToolkit({
  counts,
  onPlans,
  onFavorites,
  onTemplates,
  onLibrary,
}: PastToolkitProps) {
  const { colors, tokens } = useDesignTheme();
  const tiles: {
    key: keyof PastToolkitCounts;
    title: string;
    count: number;
    tint: string;
    color: string;
    Icon: typeof CalendarDays;
    onPress: () => void;
  }[] = [
    {
      key: "plans",
      title: "Beacon Plans",
      count: counts.plans,
      tint: tokens.categories.Fitness.tint,
      color: tokens.categories.Fitness.color,
      Icon: CalendarDays,
      onPress: onPlans,
    },
    {
      key: "favorites",
      title: "Favorites",
      count: counts.favorites,
      tint: tokens.categories.Social.tint,
      color: tokens.categories.Social.color,
      Icon: Heart,
      onPress: onFavorites,
    },
    {
      key: "templates",
      title: "My templates",
      count: counts.templates,
      tint: tokens.categories.Creative.tint,
      color: tokens.categories.Creative.color,
      Icon: Copy,
      onPress: onTemplates,
    },
    {
      key: "library",
      title: "Library",
      count: counts.library,
      tint: tokens.categories.Study.tint,
      color: tokens.categories.Study.color,
      Icon: Library,
      onPress: onLibrary,
    },
  ];

  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: colors.textPrimary, ...type.titleSmall }}>
        Your toolkit
      </Text>
      {[tiles.slice(0, 2), tiles.slice(2)].map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: "row", gap: space.sm }}>
          {row.map(({ key, title, count, tint, color, Icon, onPress }) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${title}, ${safeCount(count)}`}
              onPress={onPress}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                minHeight: 116,
                padding: space.md,
                justifyContent: "space-between",
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: tint,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.circle,
                  backgroundColor: colors.surface,
                }}
              >
                <Icon size={19} color={color} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.textPrimary, ...type.titleSmall }}>
                  {safeCount(count)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textSecondary,
                    ...type.caption,
                    fontWeight: "700",
                  }}
                >
                  {title}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

function safeCount(count: number) {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export type SafePastHistoryRow = {
  id: string;
  title: string;
  date: string;
  people: number;
  thumbnailUri?: string | null;
};

export type PastWeeklyProgress = {
  title: string;
  current: number;
  target: number;
};

export type PastHistoryProps = {
  rows: SafePastHistoryRow[];
  progress?: PastWeeklyProgress[];
  onCreate: () => void;
  onOpen: (id: string) => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getPastMonthKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(key: string) {
  if (key === "unknown") return "Earlier";
  const date = new Date(`${key}-01T12:00:00`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString([], { month: "long", year: "numeric" })
    : "Earlier";
}

function ProgressRing({
  current,
  target,
  color,
  muted,
}: {
  current: number;
  target: number;
  color: string;
  muted: string;
}) {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const progress = Math.min(1, safeCurrent / target);
  const circumference = 2 * Math.PI * 20;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${safeCurrent} of ${target} this week`}
      style={{
        width: 52,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={52} height={52} viewBox="0 0 52 52">
        <Circle
          cx="26"
          cy="26"
          r="20"
          fill="none"
          stroke={muted}
          strokeWidth="4"
        />
        <Circle
          cx="26"
          cy="26"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          rotation={-90}
          origin="26, 26"
        />
      </Svg>
      <Text
        style={{
          position: "absolute",
          color,
          ...type.caption,
          fontWeight: "700",
        }}
      >
        {safeCurrent}
      </Text>
    </View>
  );
}

export function PastWeeklyProgressView({
  items,
}: {
  items: PastWeeklyProgress[];
}) {
  const { colors } = useDesignTheme();
  const visibleItems = items.filter(
    (item) => Number.isFinite(item.target) && item.target > 0,
  );
  if (visibleItems.length === 0) return null;
  return (
    <Card style={{ padding: space.md, gap: space.sm }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
      >
        <BookOpen size={17} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, ...type.headline }}>
          Your week, at a glance
        </Text>
      </View>
      {visibleItems.map((item, index) => {
        const current = Number.isFinite(item.current)
          ? Math.max(0, item.current)
          : 0;
        return (
          <View
            key={`${item.title}-${index}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
            }}
          >
            <ProgressRing
              current={current}
              target={item.target}
              color={colors.accent}
              muted={colors.surfaceRaised}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.textPrimary,
                  ...type.secondary,
                  fontWeight: "600",
                }}
              >
                {item.title}
              </Text>
              <Text style={{ color: colors.textSecondary, ...type.caption }}>
                {current} of {item.target} this week
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export function PastHistory({
  rows,
  progress = [],
  onCreate,
  onOpen,
}: PastHistoryProps) {
  const groups: { key: string; rows: SafePastHistoryRow[] }[] = [];
  for (const row of rows) {
    const key = getPastMonthKey(row.date);
    const existing = groups[groups.length - 1];
    if (existing?.key === key) existing.rows.push(row);
    else groups.push({ key, rows: [row] });
  }

  return (
    <View style={{ gap: space.md }}>
      <PastWeeklyProgressView items={progress} />
      {rows.length === 0 ? (
        <PastHistoryEmpty onCreate={onCreate} />
      ) : (
        <View style={{ gap: space.md }}>
          {groups.map((group) => (
            <View key={group.key} style={{ gap: space.xs }}>
              <PastMonthHeader date={group.rows[0]?.date ?? ""} />
              {group.rows.map((row) => (
                <PastHistoryRow
                  key={row.id}
                  row={row}
                  onPress={() => onOpen(row.id)}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function PastHistoryRow({
  row,
  onPress,
}: {
  row: SafePastHistoryRow;
  onPress: () => void;
}) {
  const { colors } = useDesignTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${formatDate(row.date)}, with ${safeCount(row.people)} people`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {row.thumbnailUri ? (
        <Image
          source={{ uri: row.thumbnailUri }}
          accessibilityLabel="Beacon memory"
          style={{ width: 56, height: 56, borderRadius: radius.sm }}
        />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceRaised,
          }}
        >
          <CalendarDays size={20} color={colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={2}
          style={{
            color: colors.textPrimary,
            ...type.secondary,
            fontWeight: "700",
          }}
        >
          {row.title}
        </Text>
        <Text style={{ color: colors.textSecondary, ...type.caption }}>
          {formatDate(row.date)} {"\u00b7"} With {safeCount(row.people)}{" "}
          {safeCount(row.people) === 1 ? "person" : "people"}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export function PastMonthHeader({ date }: { date: string }) {
  const { colors } = useDesignTheme();
  return (
    <Text style={{ color: colors.textPrimary, ...type.titleSmall }}>
      {monthTitle(getPastMonthKey(date))}
    </Text>
  );
}

export function PastHistoryEmpty({ onCreate }: { onCreate: () => void }) {
  const { colors } = useDesignTheme();
  return (
    <Card style={{ padding: 0 }}>
      <EmptyState
        title="Your story starts with a Beacon"
        body="Past plans and favorite memories will find a home here."
        icon={<CalendarDays size={28} color={colors.accent} />}
        action={{ label: "Create a Beacon", onPress: onCreate }}
        style={{ padding: space.xl }}
      />
    </Card>
  );
}
