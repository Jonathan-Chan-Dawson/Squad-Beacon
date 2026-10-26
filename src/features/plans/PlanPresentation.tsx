import React from "react";
import { Text, View } from "react-native";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Lightbulb,
  MapPin,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { MotionPressable } from "@/src/shared/MotionPressable";
import { useTheme } from "@/src/shared/ui";

export function PlanChoice({
  title,
  detail,
  icon: Icon,
  onPress,
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const { semanticColors: c } = useTheme();
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        minHeight: 64,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: c.surfaceRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={21} color={c.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: "600" }}>
          {title}
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 18 }}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} color={c.textSecondary} />
    </MotionPressable>
  );
}

export function TimelineHeading({
  title,
  index,
  kind,
  pending,
  expanded,
  onPress,
}: {
  title: string;
  index: number;
  kind: "beacon" | "decision" | "idea";
  pending: boolean;
  expanded: boolean;
  onPress: () => void;
}) {
  const { semanticColors: c } = useTheme();
  const Icon =
    kind === "beacon"
      ? MapPin
      : kind === "decision"
        ? MessageCircle
        : Lightbulb;
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={`${index + 1}. ${title}`}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: kind === "beacon" ? c.accent : c.surfaceRaised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} color={kind === "beacon" ? c.onAccent : c.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            color: c.textSecondary,
            fontSize: 10,
            fontWeight: "600",
            letterSpacing: 1,
          }}
        >
          STOP {index + 1}
        </Text>
        <Text
          style={{
            color: c.textPrimary,
            fontWeight: "600",
            fontSize: 17,
            lineHeight: 23,
          }}
        >
          {title}
        </Text>
      </View>
      {pending ? (
        <Clock3 size={15} color={c.textSecondary} />
      ) : kind === "beacon" ? (
        <Check size={15} color={c.accent} />
      ) : null}
      {expanded ? (
        <ChevronDown size={17} color={c.textSecondary} />
      ) : (
        <ChevronRight size={17} color={c.textSecondary} />
      )}
    </MotionPressable>
  );
}

export function PlanProgress({
  confirmed,
  ideas,
  decisions,
}: {
  confirmed: number;
  ideas: number;
  decisions: number;
}) {
  const { semanticColors: c } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 14,
        paddingVertical: 8,
      }}
    >
      {[
        [Check, `${confirmed} confirmed`],
        [Lightbulb, `${ideas} ideas`],
        [Sparkles, `${decisions} decisions`],
      ].map(([Icon, label]) => {
        const Glyph = Icon as LucideIcon;
        return (
          <View
            key={String(label)}
            style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
          >
            <Glyph size={14} color={c.accent} />
            <Text style={{ fontSize: 12, color: c.textSecondary }}>
              {String(label)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
