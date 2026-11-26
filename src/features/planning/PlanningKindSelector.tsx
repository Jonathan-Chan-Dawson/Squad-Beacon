import React from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarClock, ChevronRight, Dices, Radio, Vote } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import { switchComposerKind } from "./composerSession";
import { connectedPlanningEnabled } from "./connected";
import { planningKindLabels } from "./planningLabels";

export const planningCreationModes = [
  {
    kind: "ping",
    label: planningKindLabels.ping,
    tab: "Ping",
    Icon: Radio,
    description: "See who’s interested",
  },
  {
    kind: "time",
    label: planningKindLabels.time,
    tab: "Time",
    Icon: CalendarClock,
    description: "See when people are free",
  },
  {
    kind: "vote",
    label: planningKindLabels.vote,
    tab: "Vote",
    Icon: Vote,
    description: "Let the group choose",
  },
  {
    kind: "draw",
    label: planningKindLabels.draw,
    tab: "Draw",
    Icon: Dices,
    description: "Pick a choice at random",
  },
] as const;

export function PlanningModeMenu({
  onSelect,
  layout = "grid",
}: {
  onSelect: (kind: (typeof planningCreationModes)[number]["kind"]) => void;
  layout?: "grid" | "list";
}) {
  const { data } = useBeacon();
  const { colors, styles } = useTheme();
  const list = layout === "list";
  const modes = planningCreationModes.filter(({ kind }) => kind !== "time" || connectedPlanningEnabled(data));
  return (
    <View style={list ? { borderTopWidth: 1, borderColor: colors.line } : { flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {modes.map(({ kind, label, description, Icon }, index) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={description}
            onPress={() => onSelect(kind)}
            style={({ pressed }) => [
              list ? {
                minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 6, paddingHorizontal: 2,
                borderBottomWidth: index < modes.length - 1 ? 1 : 0,
                borderColor: colors.line,
              } : [styles.card, { flexBasis: "45%", flexGrow: 1, minHeight: 92, gap: 4, padding: 12 }],
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={list ? { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primaryContainer, alignItems: "center", justifyContent: "center" } : undefined}>
              <Icon size={list ? 17 : 19} color={colors.primary} aria-hidden />
            </View>
            <View style={list ? { flex: 1, minWidth: 0 } : { gap: 3 }}>
              <Text style={[styles.body, list && { fontWeight: "600" }]}>{label}</Text>
              <Text style={styles.muted}>{description}</Text>
            </View>
            {list && <ChevronRight size={15} color={colors.muted} aria-hidden />}
          </Pressable>
        ))}
    </View>
  );
}

export function PlanningKindSelector({
  kind,
  sessionId,
  disabled = false,
}: {
  kind: (typeof planningCreationModes)[number]["kind"];
  sessionId: string;
  disabled?: boolean;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const params = useLocalSearchParams<Record<string, string>>();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Planning type"
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      {planningCreationModes
        .filter(
          (choice) => choice.kind !== "time" || connectedPlanningEnabled(data),
        )
        .map(({ kind: value, tab, label, Icon }) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityHint={tab === label ? undefined : label}
            accessibilityState={{ selected: kind === value, disabled }}
            disabled={disabled}
            onPress={() => {
              if (
                value === kind ||
                !userId ||
                data.viewer_id !== userId ||
                disabled
              )
                return;
              const flowId = params.flowId ?? sessionId;
              const timezone =
                data.plans.find((plan) => plan.id === params.returnPlanId)
                  ?.timezone ?? params.timezone;
              const next = switchComposerKind(
                userId,
                flowId,
                kind,
                sessionId,
                value,
                randomUUID,
                timezone,
              );
              router.replace({
                pathname: "/planning/create",
                params: {
                  ...params,
                  kind: value,
                  creationKind: value,
                  flowId,
                  sessionId: next,
                },
              });
            }}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              paddingVertical: 5,
              paddingHorizontal: 2,
              gap: 2,
              alignItems: "center",
              justifyContent: "center",
              borderBottomWidth: 2,
              borderBottomColor: kind === value ? colors.green : "transparent",
              opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <Icon
              size={18}
              color={kind === value ? colors.green : colors.muted}
              aria-hidden
            />
            <Text
              style={[
                styles.label,
                {
                  textAlign: "center",
                  color: kind === value ? colors.green : colors.muted,
                  fontWeight: kind === value ? "700" : "400",
                },
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
    </View>
  );
}
