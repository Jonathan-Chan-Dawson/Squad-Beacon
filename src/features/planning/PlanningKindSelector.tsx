import React from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarClock, Dices, Radio, Vote } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useBeacon } from "@/src/shared/store";
import { useTheme } from "@/src/shared/ui";
import { switchComposerKind } from "./composerSession";

const choices = [
  { kind: "ping", label: "Ping", Icon: Radio, description: "See who’s interested. Interested is not Going." },
  { kind: "time", label: "Find a time", Icon: CalendarClock, description: "Compare everyone’s availability." },
  { kind: "vote", label: "Vote", Icon: Vote, description: "Choose an activity together." },
  { kind: "draw", label: "Draw", Icon: Dices, description: "Let a random draw choose an activity." },
] as const;

export function PlanningKindSelector({ kind, sessionId, disabled = false }: {
  kind: (typeof choices)[number]["kind"]; sessionId: string; disabled?: boolean;
}) {
  const { data, userId } = useBeacon();
  const { styles, colors } = useTheme();
  const params = useLocalSearchParams<Record<string, string>>();
  return (
    <View style={{ gap: 8 }}>
      <View accessibilityRole="tablist" accessibilityLabel="Planning type" style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line }}>
        {choices.filter((choice) => choice.kind !== "time" || data.is_demo || data.capabilities?.connected_planning).map(({ kind: value, label, Icon }) => (
          <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label}
            accessibilityState={{ selected: kind === value, disabled }} disabled={disabled}
            onPress={() => {
              if (value === kind || !userId || data.viewer_id !== userId || disabled) return;
              const flowId = params.flowId ?? sessionId;
              const timezone = data.plans.find((plan) => plan.id === params.returnPlanId)?.timezone ?? params.timezone;
              const next = switchComposerKind(userId, flowId, kind, sessionId, value, randomUUID, timezone);
              router.replace({ pathname: "/planning/create", params: { ...params, kind: value, creationKind: value, flowId, sessionId: next } });
            }}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 8, paddingHorizontal: 2, gap: 4, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: kind === value ? colors.green : "transparent", opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}>
            <Icon size={18} color={kind === value ? colors.green : colors.muted} accessible={false} />
            <Text style={[styles.label, { textAlign: "center", color: kind === value ? colors.green : colors.muted, fontWeight: kind === value ? "700" : "400" }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.muted}>{choices.find((choice) => choice.kind === kind)?.description}</Text>
    </View>
  );
}
