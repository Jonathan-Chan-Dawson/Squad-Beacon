import { useBeacon } from "@/src/shared/store";
import { planStops, stopActivity } from "./livingPlans";
import { Repeat2, CalendarDays, Check } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { PlanRoutine } from "@/src/features/plans/routines";
import type { Activity, Plan } from "@/src/shared/types";
import {
  isoWeekday,
  validateRoutineSchedule,
} from "@/src/features/plans/routines";
import {
  Action,
  Button,
  Chips,
  Field,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";

const weekdays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;
const reminders = [
  "No reminder",
  "15 minutes before",
  "30 minutes before",
  "1 hour before",
  "1 day before",
] as const;
const reminderToMinutes = (value: string) =>
  ({
    "No reminder": null,
    "15 minutes before": 15,
    "30 minutes before": 30,
    "1 hour before": 60,
    "1 day before": 1440,
  })[value] ?? null;
const reminderLabel = (minutes: number | null) =>
  minutes === null
    ? "No reminder"
    : ((
        {
          15: "15 minutes before",
          30: "30 minutes before",
          60: "1 hour before",
          1440: "1 day before",
        } as Record<number, string>
      )[minutes] ?? `${minutes} minutes before`);

export function RoutineScheduleSheet({
  plan,
  routine,
  initialSchedule,
  visible,
  stepSchedule,
  act,
  onClose,
  repeatBeacon,
  onSaved,
}: {
  repeatBeacon?: Activity;
  onSaved?: (result: Record<string, unknown>) => void;
  plan: Plan;
  routine?: PlanRoutine;
  initialSchedule?: PlanRoutine;
  visible: boolean;
  stepSchedule: string[];
  act: (
    action: string,
    payload?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  onClose: () => void;
}) {
  const { styles, colors, semanticColors: c } = useTheme();
  const { data, userId } = useBeacon();
  const modern =
    data.is_demo === true || data.capabilities?.repeatable_plans === true;
  const stops = planStops(data, plan, userId).filter(
    (s) => s.state !== "skipped",
  );
  const confirmed = repeatBeacon
    ? [repeatBeacon]
    : stops
        .filter((s) => s.approval === "approved")
        .map((s) => stopActivity(data, s, userId))
        .filter((a): a is Activity => !!a && a.status !== "cancelled");
  const unresolved = Math.max(0, stops.length - confirmed.length);
  const [reviewed, setReviewed] = useState(false);
  const [updateSource, setUpdateSource] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const seed = routine ?? initialSchedule;
  const [runMode, setRunMode] = useState(
    seed?.run_mode === "manual" ? "Run Manually" : "Repeat on Schedule",
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(
    () =>
      seed?.weekdays ?? [
        isoWeekday(plan.start_date ?? new Date().toISOString().slice(0, 10)),
      ],
  );
  const [interval, setInterval] = useState(() =>
    String(seed?.interval_weeks ?? 1),
  );
  const [endsOn, setEndsOn] = useState(() => routine?.ends_on ?? "");
  const [reminder, setReminder] = useState(() =>
    reminderLabel(seed ? seed.reminder_minutes : 30),
  );

  async function save() {
    const manual = runMode === "Run Manually";
    const intervalWeeks = manual ? 1 : Number(interval);
    if (
      !manual &&
      (!/^\d+$/.test(interval) || !Number.isInteger(intervalWeeks))
    )
      throw new Error("Repeat interval must be a whole number of weeks.");
    const reminderMinutes = manual ? null : reminderToMinutes(reminder);
    const days = manual
      ? [isoWeekday(plan.start_date ?? new Date().toISOString().slice(0, 10))]
      : selectedDays;
    const endDate = manual ? null : endsOn.trim() || null;
    validateRoutineSchedule({
      anchor_date:
        routine?.anchor_date ??
        plan.start_date ??
        new Date().toISOString().slice(0, 10),
      weekdays: days,
      interval_weeks: intervalWeeks,
      ends_on: endDate,
      reminder_minutes: reminderMinutes,
    });
    if (modern && (!routine || updateSource) && !confirmed.length)
      throw new Error(
        "Confirm at least one Beacon before repeating this Plan.",
      );
    if (modern && (!routine || updateSource) && unresolved && !reviewed)
      throw new Error(
        "Review the unresolved stops before repeating confirmed activities only.",
      );
    const result = await act(
      repeatBeacon
        ? "repeat_beacon"
        : routine
          ? "edit_routine"
          : "create_routine",
      routine
        ? {
            id: routine.id,
            update_source: updateSource,
            confirmed_source: reviewed,
            run_mode: runMode === "Run Manually" ? "manual" : "scheduled",
            weekdays: days,
            interval_weeks: intervalWeeks,
            ends_on: endDate,
            reminder_minutes: reminderMinutes,
          }
        : {
            plan_id: plan.id,
            ...(repeatBeacon ? { activity_id: repeatBeacon.id } : {}),
            confirmed_source: reviewed,
            run_mode: runMode === "Run Manually" ? "manual" : "scheduled",
            weekdays: days,
            interval_weeks: intervalWeeks,
            ends_on: endDate,
            reminder_minutes: reminderMinutes,
          },
    );
    onSaved?.(result);
    onClose();
  }

  return (
    <Sheet
      title={routine ? "Future repeats" : `Repeat ${plan.title}`}
      visible={visible}
      onClose={onClose}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Repeat2 size={23} color={c.accent} />
        <Txt>Make room for a favorite.</Txt>
      </View>
      <Txt muted>
        {routine
          ? "Changes apply to repeats that have not been generated. Already generated and completed occurrences stay unchanged."
          : "Each repeat gets its own activities and attendance. Nobody is automatically Going."}
      </Txt>
      {repeatBeacon && (
        <Txt muted>
          You will host future repeats. The original Beacon stays unchanged.
        </Txt>
      )}
      {routine && modern && (
        <>
          <Txt muted>
            Saved repeat · {routine.source_stop_count ?? confirmed.length}{" "}
            activities
            {routine.source_reviewed_at
              ? ` · reviewed ${new Date(routine.source_reviewed_at).toLocaleDateString()}`
              : ""}
          </Txt>
          <Button
            compact
            secondary
            title={
              updateSource
                ? "✓ Update future repeats from this Plan"
                : "Update future repeats from this Plan"
            }
            icon={<CalendarDays size={16} color={c.accent} />}
            onPress={() => setUpdateSource((v) => !v)}
          />
        </>
      )}
      {(!routine || updateSource) && (
        <View style={{ gap: 8, paddingVertical: 10 }}>
          <Text style={styles.label}>REVIEW YOUR REPEAT</Text>
          {modern
            ? confirmed.map((a, index) => (
                <View key={a.id} style={styles.row}>
                  <Check size={15} color={c.accent} />
                  <Txt>
                    {index + 1}. {a.title}
                  </Txt>
                </View>
              ))
            : stepSchedule.map((line, index) => <Txt key={index}>{line}</Txt>)}
          {modern && !confirmed.length && (
            <Txt muted>
              Confirm a Beacon in this Plan first. Ideas and open decisions
              remain in your Plan.
            </Txt>
          )}
          {modern && unresolved > 0 && (
            <>
              <Txt muted>
                {unresolved} unresolved stops will stay in this Plan and will
                not repeat.
              </Txt>
              <Button
                compact
                secondary
                title={
                  reviewed
                    ? "✓ Repeat confirmed activities only"
                    : "Repeat confirmed activities only"
                }
                onPress={() => setReviewed((v) => !v)}
              />
            </>
          )}
          <Txt muted>Local time in {plan.timezone}</Txt>
        </View>
      )}
      {modern && (
        <Chips
          options={[
            "Whenever I choose",
            "Every week",
            "Every two weeks",
            "Custom repeat",
          ]}
          value={
            runMode === "Run Manually"
              ? "Whenever I choose"
              : interval === "1"
                ? "Every week"
                : interval === "2"
                  ? "Every two weeks"
                  : "Custom repeat"
          }
          onChange={(value) => {
            setRunMode(
              value === "Whenever I choose"
                ? "Run Manually"
                : "Repeat on Schedule",
            );
            if (value === "Every week") setInterval("1");
            if (value === "Every two weeks") setInterval("2");
            if (value === "Custom repeat") {
              setInterval("3");
              setAdvanced(true);
            }
          }}
        />
      )}
      {!modern && (
        <>
          <Txt muted>Start behavior</Txt>
          <Chips
            options={["Repeat on Schedule", "Run Manually"]}
            value={runMode}
            onChange={setRunMode}
          />
        </>
      )}
      {runMode === "Repeat on Schedule" && (
        <>
          <View style={{ gap: 8 }}>
            <Text style={[styles.muted, { fontWeight: "600" }]}>
              Repeats on
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {weekdays.map((day) => {
                const selected = selectedDays.includes(day.value);
                return (
                  <Pressable
                    key={day.value}
                    accessibilityRole="button"
                    accessibilityLabel={`${day.label}${selected ? ", selected" : ""}`}
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setSelectedDays((current) =>
                        selected
                          ? current.filter((value) => value !== day.value)
                          : [...current, day.value].sort((a, b) => a - b),
                      )
                    }
                    style={[
                      styles.chip,
                      selected && {
                        backgroundColor: colors.ink,
                        borderColor: colors.ink,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && { color: colors.white },
                      ]}
                    >
                      {day.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {modern && (
            <Button
              compact
              secondary
              title={advanced ? "Fewer options" : "More options"}
              onPress={() => setAdvanced((v) => !v)}
            />
          )}
          {(!modern || advanced) && (
            <>
              <Field
                label="Repeat every (weeks)"
                value={interval}
                onChangeText={setInterval}
                keyboardType="number-pad"
                placeholder="1"
              />
              <Field
                label="End date (optional) · YYYY-MM-DD"
                value={endsOn}
                onChangeText={setEndsOn}
                placeholder="Leave blank to keep repeating"
              />
              <View style={{ gap: 8 }}>
                <Txt muted>Reminder timing</Txt>
                <Chips
                  options={reminders}
                  value={reminder as (typeof reminders)[number]}
                  onChange={setReminder}
                  showSelectedCheckmark={false}
                />
              </View>
            </>
          )}
        </>
      )}
      <Txt muted>
        {runMode === "Run Manually"
          ? "Ready whenever you choose Run Now."
          : `Every ${interval} week${interval === "1" ? "" : "s"} · ${selectedDays.map((d) => weekdays[d - 1]?.label).join(", ")}${endsOn ? ` · through ${endsOn}` : ""}`}
      </Txt>
      <Action
        title={routine ? "Save future repeats" : "Create Routine"}
        disabled={
          modern &&
          (!routine || updateSource) &&
          (!confirmed.length || (unresolved > 0 && !reviewed))
        }
        run={save}
      />
      <Button title="Not now" secondary onPress={onClose} />
    </Sheet>
  );
}
