import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import type { PlanRoutine } from "@/src/features/plans/routines";
import { RoutineScheduleSheet } from "@/src/features/plans/RoutineScheduleSheet";
import { Action, Button, Empty, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function RoutinesScreen() {
  const { styles } = useTheme();
  const { data, userId, act } = useBeacon();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const [editing, setEditing] = useState("");
  const [more, setMore] = useState("");
  const [ending, setEnding] = useState("");
  const routines = data.plan_routines
    .filter((routine) => !planId || routine.plan_id === planId)
    .slice()
    .sort((a, b) => (a.next_occurrence_on ?? "9999").localeCompare(b.next_occurrence_on ?? "9999"));
  const selectedRoutine = routines.find((routine) => routine.id === editing);
  const selectedPlan = data.plans.find((plan) => plan.id === selectedRoutine?.plan_id);
  const scheduleFor = (planIdValue: string) => data.activities
    .filter((activity) => activity.plan_id === planIdValue)
    .sort((a, b) => (a.plan_step_index ?? 0) - (b.plan_step_index ?? 0))
    .map((activity) => `${new Date(activity.starts_at).toLocaleString([], { timeZone: activity.timezone, weekday: "short", hour: "numeric", minute: "2-digit" })} · ${activity.title}`);

  async function runOnce(routine: PlanRoutine) {
    const result = await act("run_routine_once", { id: routine.id });
    if (typeof result.occurrence_plan_id === "string") {
      router.push({ pathname: "/plan/[id]", params: { id: result.occurrence_plan_id } });
    }
  }

  return <Screen title="Routines" eyebrow="RECURRING BEACON PLANS" create={false}>
    <Txt muted>A Routine is a recurring Beacon Plan. Each occurrence creates a fresh Plan from its source Beacons; RSVP to each Beacon separately.</Txt>
    {!routines.length ? <Empty title="No Routines yet" body="Open a Beacon Plan and choose Make This a Routine to repeat its Beacons on a schedule." /> : routines.map((routine) => {
      const plan = data.plans.find((item) => item.id === routine.plan_id);
      if (!plan) return null;
      const squadRole = plan.squad_id ? data.squad_members.find((member) => member.squad_id === plan.squad_id && member.user_id === userId)?.role : undefined;
      const canManage = plan.owner_id === userId || ["owner", "admin"].includes(squadRole ?? "");
      const weekdayText = routine.weekdays.map((day) => dayLabels[day - 1]).join(", ");
      const moreOpen = more === routine.id;
      return <View key={routine.id} style={styles.card}>
        <Text style={styles.label}>RECURRING BEACON PLAN</Text>
        <Text style={styles.h2}>{plan.title}</Text>
        <Txt>{routine.interval_weeks === 1 ? `Every ${weekdayText}` : `Every ${routine.interval_weeks} weeks · ${weekdayText}`}</Txt>
        <Txt muted>{routine.status === "active" ? `Next · ${routine.next_occurrence_on ?? "No upcoming date"}` : routine.status === "paused" ? `Paused${routine.next_occurrence_on ? ` · next ${routine.next_occurrence_on}` : ""}` : "Ended"}{routine.ends_on ? ` · Ends ${routine.ends_on}` : ""}</Txt>
        <Txt muted>{routine.reminder_minutes == null ? "No reminder" : `Reminder notice · ${routine.reminder_minutes} minutes before`}. Server schedule must be deployed for automatic reminders; push delivery also depends on device permissions.</Txt>
        {canManage && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {routine.status === "active" && <Action compact secondary title="Pause" run={() => act("pause_routine", { id: routine.id })} />}
          {routine.status === "paused" && <Action compact secondary title="Resume" run={() => act("resume_routine", { id: routine.id })} />}
          {routine.status === "active" && !!routine.next_occurrence_on && <Action compact title="Run once" run={() => runOnce(routine)} />}
          {routine.status === "active" && !!routine.next_occurrence_on && <Action compact secondary title="Skip next" run={() => act("skip_routine_next", { id: routine.id })} />}
          <Button compact secondary title="More" onPress={() => setMore(moreOpen ? "" : routine.id)} />
        </View>}
        {!canManage && <Txt muted>Only the Plan owner or a current Squad admin can manage this Routine.</Txt>}
        <Button compact secondary title="Open source Plan" onPress={() => router.push({ pathname: "/plan/[id]", params: { id: plan.id } })} />
        <Sheet title="Routine actions" visible={moreOpen} onClose={() => setMore("")}>
          {routine.status !== "ended" && <Button compact secondary title="Edit schedule" onPress={() => { setMore(""); setEditing(routine.id); }} />}
          {routine.status !== "ended" && <Button compact secondary title="End Routine…" onPress={() => { setMore(""); setEnding(routine.id); }} />}
          <Button compact secondary title="Close" onPress={() => setMore("")} />
        </Sheet>
      </View>;
    })}
    <Button compact secondary title="All Beacon Plans" onPress={() => router.replace("/plans")} />
    {selectedRoutine && selectedPlan && <RoutineScheduleSheet
      key={`${selectedPlan.id}:${selectedRoutine.id}`}
      plan={selectedPlan}
      routine={selectedRoutine}
      visible={!!editing}
      stepSchedule={scheduleFor(selectedPlan.id)}
      act={act}
      onClose={() => setEditing("")}
    />}
    <Sheet title="End this Routine?" visible={!!ending} onClose={() => setEnding("")}>
      <Txt>Ending stops future occurrences. Plans and Beacons already created from this Routine remain.</Txt>
      <Action title="End Routine" run={async () => { await act("end_routine", { id: ending }); setEnding(""); }} />
      <Button title="Keep Routine" secondary onPress={() => setEnding("")} />
    </Sheet>
  </Screen>;
}
