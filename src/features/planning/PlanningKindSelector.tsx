import React from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarClock, Dices, Radio, Vote } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import { switchComposerKind } from "./composerSession";
import { connectedPlanningEnabled } from "./connected";

export const planningCreationModes = [
  {
    kind: "ping",
    label: "Ping",
    tab: "Ping",
    Icon: Radio,
    description: "See who’s interested",
  },
  {
    kind: "time",
    label: "Find a Time",
    tab: "Time",
    Icon: CalendarClock,
    description: "See when people are free",
  },
  {
    kind: "vote",
    label: "Vote",
    tab: "Vote",
    Icon: Vote,
    description: "Let the group choose",
  },
  {
    kind: "draw",
    label: "Random Draw",
    tab: "Draw",
    Icon: Dices,
    description: "Pick a choice at random",
  },
] as const;

export function PlanningModeMenu({
  onSelect,
}: {
  onSelect: (kind: (typeof planningCreationModes)[number]["kind"]) => void;
}) {
  const { data } = useBeacon();
  const { colors, styles } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {planningCreationModes
        .filter(({ kind }) => kind !== "time" || connectedPlanningEnabled(data))
        .map(({ kind, label, description, Icon }) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={description}
            onPress={() => onSelect(kind)}
            style={({ pressed }) => [
              styles.card,
              {
                flexBasis: "45%",
                flexGrow: 1,
                minHeight: 92,
                gap: 4,
                padding: 12,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Icon size={19} color={colors.green} aria-hidden />
            <Text style={styles.body}>{label}</Text>
            <Text style={styles.muted}>{description}</Text>
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
              minHeight: 52,
              paddingVertical: 8,
              paddingHorizontal: 2,
              gap: 4,
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
