import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PlanRoutine } from "@/src/features/plans/routines";
import type { Plan } from "@/src/shared/types";
import { isoWeekday, validateRoutineSchedule } from "@/src/features/plans/routines";
import { Action, Button, Chips, Field, Sheet, Txt, useTheme } from "@/src/shared/ui";

const weekdays = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;
const reminders = ["No reminder", "15 minutes before", "30 minutes before", "1 hour before", "1 day before"] as const;
const reminderToMinutes = (value: string) => ({
  "No reminder": null,
  "15 minutes before": 15,
  "30 minutes before": 30,
  "1 hour before": 60,
  "1 day before": 1440,
}[value] ?? null);
const reminderLabel = (minutes: number | null) => minutes === null ? "No reminder" : ({
  15: "15 minutes before", 30: "30 minutes before", 60: "1 hour before", 1440: "1 day before",
} as Record<number, string>)[minutes] ?? `${minutes} minutes before`;

export function RoutineScheduleSheet({
  plan,
  routine,
  visible,
  stepSchedule,
  act,
  onClose,
}: {
  plan: Plan;
  routine?: PlanRoutine;
  visible: boolean;
  stepSchedule: string[];
  act: (action: string, payload?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onClose: () => void;
}) {
  const { styles, colors } = useTheme();
  const [selectedDays, setSelectedDays] = useState<number[]>(() => routine?.weekdays ?? [isoWeekday(plan.start_date)]);
  const [interval, setInterval] = useState(() => String(routine?.interval_weeks ?? 1));
  const [endsOn, setEndsOn] = useState(() => routine?.ends_on ?? "");
  const [reminder, setReminder] = useState(() => reminderLabel(routine?.reminder_minutes ?? 30));

  async function save() {
    const intervalWeeks = Number(interval);
    if (!/^\d+$/.test(interval) || !Number.isInteger(intervalWeeks)) throw new Error("Repeat interval must be a whole number of weeks.");
    const reminderMinutes = reminderToMinutes(reminder);
    validateRoutineSchedule({
      anchor_date: routine?.anchor_date ?? plan.start_date,
      weekdays: selectedDays,
      interval_weeks: intervalWeeks,
      ends_on: endsOn.trim() || null,
      reminder_minutes: reminderMinutes,
    });
    await act(routine ? "edit_routine" : "create_routine", routine ? {
      id: routine.id,
      weekdays: selectedDays,
      interval_weeks: intervalWeeks,
      ends_on: endsOn.trim() || null,
      reminder_minutes: reminderMinutes,
    } : {
      plan_id: plan.id,
      weekdays: selectedDays,
      interval_weeks: intervalWeeks,
      ends_on: endsOn.trim() || null,
      reminder_minutes: reminderMinutes,
    });
    onClose();
  }

  return <Sheet title={routine ? "Edit Routine" : "Make This a Routine"} visible={visible} onClose={onClose}>
    <Txt muted>A Routine repeats this Beacon Plan. Each Beacon keeps its source local time, location, RSVP, and privacy. A new Beacon Plan is created for each date; joining this Plan does not RSVP you to its Beacons.</Txt>
    {!!stepSchedule.length && <View style={styles.card}>
      <Text style={styles.h2}>Beacon times reused</Text>
      <Txt muted>Local time in {plan.timezone}</Txt>
      {stepSchedule.map((line, index) => <Txt key={`${index}-${line}`}>{line}</Txt>)}
    </View>}
    <View style={{ gap: 8 }}>
      <Text style={[styles.muted, { fontWeight: "600" }]}>Repeats on</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {weekdays.map((day) => {
          const selected = selectedDays.includes(day.value);
          return <Pressable key={day.value}
            accessibilityRole="button"
            accessibilityLabel={`${day.label}${selected ? ", selected" : ""}`}
            accessibilityState={{ selected }}
            onPress={() => setSelectedDays((current) => selected ? current.filter((value) => value !== day.value) : [...current, day.value].sort((a, b) => a - b))}
            style={[styles.chip, selected && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
            <Text style={[styles.chipText, selected && { color: colors.white }]}>{day.label}</Text>
          </Pressable>;
        })}
      </View>
    </View>
    <Field label="Repeat every (weeks)" value={interval} onChangeText={setInterval} keyboardType="number-pad" placeholder="1" />
    <Field label="End date (optional) · YYYY-MM-DD" value={endsOn} onChangeText={setEndsOn} placeholder="Leave blank to keep repeating" />
    <View style={{ gap: 8 }}>
      <Txt muted>Reminder timing</Txt>
      <Chips options={reminders} value={reminder as typeof reminders[number]} onChange={setReminder} showSelectedCheckmark={false} />
      <Txt muted>Notices are queued by the server schedule when it is deployed. Device push delivery still depends on notification permissions and settings.</Txt>
    </View>
    <Action title={routine ? "Save Routine" : "Create Routine"} run={save} />
    <Button title="Not now" secondary onPress={onClose} />
  </Sheet>;
}
