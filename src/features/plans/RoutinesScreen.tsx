import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { ChevronDown, MoreHorizontal, Repeat2 } from "lucide-react-native";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Chips,
  Field,
  IconButton,
  Screen,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { ConfirmDialog, QuickChoiceDialog } from "@/src/shared/Dialogs";
import { planPermissions } from "./livingPlans";
import { RoutineScheduleSheet } from "./RoutineScheduleSheet";
import LegacyRoutinesScreen from "./LegacyRoutinesScreen";

export default function RoutinesScreen() {
  const { data } = useBeacon();
  return data.is_demo || data.capabilities?.recurrence_v2 ? (
    <RoutineManagement />
  ) : (
    <LegacyRoutinesScreen />
  );
}
function RoutineManagement() {
  const { data, userId, act } = useBeacon();
  const { styles, semanticColors: c } = useTheme();
  const { planId, create } = useLocalSearchParams<{
    planId?: string;
    create?: string;
  }>();
  const [selected, setSelected] = useState<string | null>(null),
    [schedule, setSchedule] = useState<string | null>(null),
    [menu, setMenu] = useState<string | null>(null),
    [end, setEnd] = useState<string | null>(null);
  const [error, setError] = useState("");
  const perform = (
    action: string,
    payload: Record<string, unknown>,
    done?: (result: Record<string, unknown>) => void,
  ) => {
    void act(action, payload)
      .then((result) => done?.(result))
      .catch((e) => setError(e.message));
  };
  const [source, setSource] = useState("Beacons"),
    [query, setQuery] = useState("");
  const routines = data.plan_routines.filter(
    (r) => !planId || r.plan_id === planId,
  );
  const target = routines.find((r) => r.id === menu);
  const inline = (label: string, fn: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={fn}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text style={{ color: c.accent, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
  return (
    <Screen
      title="Routines"
      eyebrow="MAKE TIME FOR YOUR FAVORITES"
      create={false}
    >
      <Txt muted>
        Repeat a Beacon or Plan from its own page. Your schedules stay here.
      </Txt>
      {create === "yes" && (
        <View style={{ gap: 12 }}>
          <Chips
            options={["Beacons", "Plans"]}
            value={source}
            onChange={setSource}
          />
          <Field
            label="Find a source to repeat"
            value={query}
            onChangeText={setQuery}
          />
          {source === "Beacons"
            ? data.activities
                .filter(
                  (a) =>
                    a.owner_id === userId &&
                    a.mode !== "solo" &&
                    a.status !== "cancelled" &&
                    a.title.toLowerCase().includes(query.toLowerCase()),
                )
                .slice(0, 8)
                .map((a) => (
                  <View key={a.id}>
                    {inline(a.title, () =>
                      router.push({
                        pathname: "/activity/[id]",
                        params: { id: a.id, repeat: "yes" },
                      }),
                    )}
                  </View>
                ))
            : data.plans
                .filter(
                  (p) =>
                    !p.routine_source &&
                    planPermissions(data, p, userId).editor &&
                    p.title.toLowerCase().includes(query.toLowerCase()),
                )
                .slice(0, 8)
                .map((p) => (
                  <View key={p.id}>
                    {inline(p.title, () =>
                      router.push({
                        pathname: "/plan/[id]",
                        params: { id: p.id, repeat: "yes" },
                      }),
                    )}
                  </View>
                ))}
        </View>
      )}
      {!routines.length && (
        <Txt>
          No repeats yet. Open a favorite Beacon or Plan and choose Repeat.
        </Txt>
      )}
      {routines.map((r) => {
        const p = data.plans.find((p) => p.id === r.plan_id);
        if (!p) return null;
        const manage = planPermissions(data, p, userId).review;
        return (
          <View
            key={r.id}
            style={{
              paddingVertical: 16,
              gap: 10,
              borderBottomWidth: 1,
              borderColor: c.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={p.title}
              accessibilityState={{ expanded: selected === r.id }}
              onPress={() => setSelected(selected === r.id ? null : r.id)}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Repeat2 size={20} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.h2}>{p.title}</Text>
                <Txt muted>
                  {r.status === "active"
                    ? "Active"
                    : r.status === "paused"
                      ? "Paused"
                      : "Ended"}{" "}
                  ·{" "}
                  {r.run_mode === "manual"
                    ? "Ready to reuse"
                    : `Next ${r.next_occurrence_on ?? "No upcoming date"}`}
                </Txt>
              </View>
              <ChevronDown size={18} color={c.textSecondary} />
            </Pressable>
            {r.premium_pause_reason && (
              <Txt muted>
                Paused for BEACON+. The owner can resume after upgrading;
                existing Beacons stay available.
              </Txt>
            )}
            {selected === r.id && manage && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  {inline(
                    schedule === r.id ? "Close schedule" : "Edit Schedule",
                    () => setSchedule(schedule === r.id ? null : r.id),
                  )}
                  {r.status !== "ended" && (
                    <Action
                      compact
                      secondary
                      title={r.status === "paused" ? "Resume" : "Pause"}
                      run={() =>
                        act(
                          r.status === "paused"
                            ? "resume_routine"
                            : "pause_routine",
                          { id: r.id },
                        )
                      }
                    />
                  )}
                  <IconButton
                    label="Routine options"
                    onPress={() => setMenu(r.id)}
                  >
                    <MoreHorizontal size={18} color={c.textSecondary} />
                  </IconButton>
                </View>
                <RoutineScheduleSheet
                  plan={p}
                  routine={r}
                  visible={schedule === r.id}
                  stepSchedule={[]}
                  act={act}
                  onClose={() => setSchedule(null)}
                />
              </>
            )}
          </View>
        );
      })}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <QuickChoiceDialog
        title="Routine options"
        visible={!!menu}
        onClose={() => setMenu(null)}
        items={
          target
            ? [
                ...(target.status === "active" && target.next_occurrence_on
                  ? [
                      {
                        label: "Skip Next",
                        onPress: () => {
                          perform("skip_routine_next", {
                            id: target.id,
                            expected_occurrence_on: target.next_occurrence_on,
                          });
                        },
                      },
                    ]
                  : []),
                {
                  label: "Run Now",
                  onPress: () => {
                    perform("run_routine_now", { id: target.id }, (result) => {
                      if (typeof result.occurrence_plan_id === "string")
                        router.push({
                          pathname: "/plan/[id]",
                          params: { id: result.occurrence_plan_id },
                        });
                    });
                  },
                },
                {
                  label: "Open source Plan",
                  onPress: () =>
                    router.push({
                      pathname: "/plan/[id]",
                      params: { id: target.plan_id },
                    }),
                },
                {
                  label: "Duplicate as Plan draft",
                  onPress: () =>
                    router.push(
                      ("/plan-editor?sourcePlan=" +
                        encodeURIComponent(target.plan_id)) as Href,
                    ),
                },
                {
                  label: "End Routine",
                  destructive: true,
                  onPress: () => setEnd(target.id),
                },
              ]
            : []
        }
      />
      <ConfirmDialog
        title="End this Routine?"
        message="Existing scheduled Beacons stay unchanged."
        visible={!!end}
        confirmLabel="End Routine"
        destructive
        onClose={() => setEnd(null)}
        onConfirm={async () => {
          await act("end_routine", { id: end });
          setEnd(null);
        }}
      />
    </Screen>
  );
}
