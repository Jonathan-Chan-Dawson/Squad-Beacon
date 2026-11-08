import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MoreHorizontal } from "lucide-react-native";
import { QuickChoiceDialog, ConfirmDialog } from "@/src/shared/Dialogs";
import { SegmentedControl } from "@/src/shared/design-system";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Action, Field, IconButton, Txt, useTheme } from "@/src/shared/ui";
import { supabase } from "@/src/shared/supabase";
import { hasPlanRecurrenceEntitlement } from "@/src/shared/entitlements";
import { PremiumPreview } from "@/src/features/profile/settings/PremiumUI";
import { localDate } from "@/src/shared/domain";
import { ThemedSwitch } from "@/src/shared/ThemedSwitch";
import { LegacyRoutineScheduleSheet } from "./LegacyRoutineScheduleSheet";
import { isoWeekday, type PlanRoutine } from "./routines";
import { recurrencePreview, type RecurrenceSchedule } from "./recurrence";
import { planStops, stopActivity } from "./livingPlans";
import PlanDateField from "./PlanDateField";
import type { Activity, Plan } from "@/src/shared/types";

type Props = {
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
  repeatBeacon?: Activity;
  onSaved?: (result: Record<string, unknown>) => void;
};
type Upcoming = {
  date: string;
  state: "projected" | "materialized" | "skipped";
  plan_id?: string;
};
export function RoutineScheduleSheet(props: Props) {
  const { data } = useBeacon();
  if (!data.is_demo && !data.capabilities?.recurrence_v2)
    return <LegacyRoutineScheduleSheet {...props} />;
  return props.visible ? (
    <InlineRoutine key={props.routine?.id ?? props.plan.id} {...props} />
  ) : null;
}
function InlineRoutine({
  plan,
  routine,
  initialSchedule,
  act,
  onClose,
  repeatBeacon,
  onSaved,
}: Props) {
  const { data, userId, getViewerEpoch } = useBeacon();
  const { styles, semanticColors: c } = useTheme();
  const seed = routine ?? initialSchedule;
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
      seed?.frequency ?? "weekly",
    ),
    [custom, setCustom] = useState(false);
  const [interval, setInterval] = useState(
    String(seed?.interval_count ?? seed?.interval_weeks ?? 1),
  );
  const [days, setDays] = useState(
    seed?.weekdays ?? [
      isoWeekday(plan.start_date ?? localDate(new Date(), plan.timezone)),
    ],
  );
  const [start, setStart] = useState(
    seed?.anchor_date ??
      plan.start_date ??
      localDate(new Date(), plan.timezone),
  );
  const [end, setEnd] = useState(seed?.ends_on ?? ""),
    [reminder, setReminder] = useState(
      seed?.reminder_minutes === null
        ? ""
        : String(seed?.reminder_minutes ?? 30),
    );
  const [advanced, setAdvanced] = useState(false),
    [manual, setManual] = useState(seed?.run_mode === "manual"),
    [reviewed, setReviewed] = useState(false),
    [count, setCount] = useState(3);
  const [menu, setMenu] = useState(false),
    [ending, setEnding] = useState(false),
    [actionError, setActionError] = useState("");
  const [updateSource, setUpdateSource] = useState(false);
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]),
    [loadError, setLoadError] = useState("");
  const today = localDate(new Date(), plan.timezone);
  const stops = planStops(data, plan, userId).filter(
    (s) => s.state !== "skipped",
  );
  const confirmed = repeatBeacon
    ? [repeatBeacon]
    : stops
        .filter((s) => s.approval === "approved")
        .map((s) => stopActivity(data, s, userId))
        .filter((a): a is Activity => !!a && a.status !== "cancelled");
  const unresolved = stops.length - confirmed.length;
  const rule: RecurrenceSchedule = {
    frequency,
    interval_count: Number(interval),
    interval_weeks: frequency === "weekly" ? Number(interval) : 1,
    weekdays: days,
    anchor_date: start,
    month_day: Number(start.slice(8)),
    ends_on: end || null,
  };
  let dates: string[] = [],
    validation = "";
  try {
    dates = manual ? [] : recurrencePreview(rule, today, 10);
  } catch (e) {
    validation = e instanceof Error ? e.message : "Check your schedule.";
  }
  useEffect(() => {
    let alive = true;
    const epoch = getViewerEpoch();
    if (!routine || data.is_demo || !supabase) return;
    void supabase
      .rpc("routine_upcoming", { routine_id: routine.id, limit_count: 10 })
      .then(({ data: result, error }) => {
        if (!alive || epoch !== getViewerEpoch()) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        if (
          result?.viewer_id !== userId ||
          !Array.isArray(result.rows) ||
          result.rows.length > 10
        ) {
          setLoadError("Upcoming dates could not be verified.");
          return;
        }
        setUpcoming(result.rows);
      });
    return () => {
      alive = false;
    };
  }, [routine, data.is_demo, getViewerEpoch, userId]);
  const records: Upcoming[] = data.is_demo
    ? (data.demo_routine_occurrences ?? [])
        .filter((o) => o.routine_id === routine?.id)
        .map((o) => ({
          date: o.occurrence_on,
          state: o.status === "created" ? "materialized" : "skipped",
          plan_id: o.occurrence_plan_id ?? undefined,
        }))
    : upcoming;
  const rows = [
    ...new Set([
      ...dates,
      ...records
        .filter((r) => r.state === "materialized" && r.date >= today)
        .map((r) => r.date),
    ]),
  ]
    .sort()
    .filter(
      (date) => !records.some((r) => r.date === date && r.state === "skipped"),
    )
    .slice(0, count)
    .map(
      (date) =>
        records.find((r) => r.date === date) ?? {
          date,
          state: "projected" as const,
        },
    );
  const needsPlus =
    !manual &&
    confirmed.length > 1 &&
    !hasPlanRecurrenceEntitlement(
      data,
      plan.id,
      routine?.owner_id ?? plan.owner_id,
    ) &&
    routine?.premium_eligible !== true;
  async function save() {
    if (validation) throw new Error(validation);
    if (!manual && !dates.length)
      throw new Error(
        "This schedule has no upcoming dates. Check the start and end dates.",
      );
    if (
      reminder !== "" &&
      (!Number.isInteger(Number(reminder)) ||
        Number(reminder) < 1 ||
        Number(reminder) > 10080)
    )
      throw new Error(
        "Choose a reminder from 1 to 10080 minutes, or leave it blank.",
      );
    if (!routine && !confirmed.length)
      throw new Error(
        "Publish at least one Beacon before repeating this Plan.",
      );
    if ((!routine || updateSource) && unresolved > 0 && !reviewed)
      throw new Error("Confirm that only published Beacons should repeat.");
    const result = await act(
      repeatBeacon
        ? "repeat_beacon"
        : routine
          ? "edit_routine"
          : "create_routine",
      {
        ...(routine ? { id: routine.id } : { plan_id: plan.id }),
        ...(repeatBeacon ? { activity_id: repeatBeacon.id } : {}),
        confirmed_source: reviewed,
        update_source: updateSource,
        run_mode: manual ? "manual" : "scheduled",
        ...rule,
        reminder_minutes: manual || reminder === "" ? null : Number(reminder),
      },
    );
    onSaved?.(result);
  }
  const inline = (label: string, press: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={press}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text style={{ color: c.accent, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      testID="inline-routine-editor"
      style={{
        gap: 14,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderColor: c.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={styles.h2}>Repeat {plan.title}</Text>
        {inline("Close repeat settings", onClose)}
      </View>
      {routine && (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Txt muted>
              {routine.status === "active"
                ? "Active"
                : routine.status === "paused"
                  ? "Paused"
                  : "Ended"}{" "}
              · Next {routine.next_occurrence_on ?? "No scheduled date"}
            </Txt>
          </View>
          {routine.status !== "ended" && (
            <Action
              compact
              secondary
              title={routine.status === "paused" ? "Resume" : "Pause"}
              run={() =>
                act(
                  routine.status === "paused"
                    ? "resume_routine"
                    : "pause_routine",
                  { id: routine.id },
                )
              }
            />
          )}
          <IconButton label="Repeat options" onPress={() => setMenu(true)}>
            <MoreHorizontal size={18} color={c.textSecondary} />
          </IconButton>
        </View>
      )}
      <SegmentedControl
        shape="panel"
        accessibilityLabel="Repeat frequency"
        options={["Daily", "Weekly", "Monthly", "Custom"].map((label) => ({
          label,
          value: label,
        }))}
        value={
          custom
            ? "Custom"
            : frequency === "daily"
              ? "Daily"
              : frequency === "monthly"
                ? "Monthly"
                : "Weekly"
        }
        onChange={(v) => {
          setCustom(v === "Custom");
          if (v !== "Custom") {
            setFrequency(
              v === "Daily" ? "daily" : v === "Monthly" ? "monthly" : "weekly",
            );
            setInterval("1");
          }
        }}
      />
      {custom && (
        <SegmentedControl
          shape="panel"
          accessibilityLabel="Custom repeat unit"
          options={["Days", "Weeks", "Months"].map((label) => ({
            label,
            value: label,
          }))}
          value={
            frequency === "daily"
              ? "Days"
              : frequency === "monthly"
                ? "Months"
                : "Weeks"
          }
          onChange={(v) =>
            setFrequency(
              v === "Days" ? "daily" : v === "Months" ? "monthly" : "weekly",
            )
          }
        />
      )}
      <Field
        label={`Repeat every (${frequency === "daily" ? "days" : frequency === "monthly" ? "months" : "weeks"})`}
        value={interval}
        keyboardType="number-pad"
        onChangeText={setInterval}
      />
      {frequency === "weekly" && (
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: days.includes(i + 1) }}
              onPress={() =>
                setDays(
                  days.includes(i + 1)
                    ? days.filter((d) => d !== i + 1)
                    : [...days, i + 1].sort(),
                )
              }
              style={{
                minHeight: 44,
                minWidth: 36,
                padding: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: days.includes(i + 1) ? c.accent : c.border,
                backgroundColor: days.includes(i + 1)
                  ? c.surfaceRaised
                  : undefined,
              }}
            >
              <Text style={{ color: c.textPrimary }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <PlanDateField
        label="Repeat start date"
        value={start}
        onChange={setStart}
      />
      {frequency === "monthly" && Number(start.slice(8)) > 28 && (
        <Txt muted>
          Shorter months use their last day; later months return to day{" "}
          {Number(start.slice(8))}.
        </Txt>
      )}
      {inline(advanced ? "Fewer settings" : "End date & reminders", () =>
        setAdvanced(!advanced),
      )}
      {advanced && (
        <View style={{ gap: 12 }}>
          {routine && (
            <View style={{ gap: 8 }}>
              <Txt muted>
                Use current published activities for future repeats
              </Txt>
              <ThemedSwitch
                accessibilityLabel="Use current published activities for future repeats"
                value={updateSource}
                onValueChange={setUpdateSource}
              />
            </View>
          )}
          <PlanDateField
            label="Repeat end date · optional"
            value={end}
            onChange={setEnd}
          />
          <Field
            label="Reminder minutes · leave blank for none"
            value={reminder}
            keyboardType="number-pad"
            onChangeText={setReminder}
          />
          {inline(manual ? "✓ Reuse manually" : "Reuse manually instead", () =>
            setManual(!manual),
          )}
        </View>
      )}
      {!!unresolved && (
        <Txt muted>
          {unresolved} ideas, unpublished drafts or decisions will stay in the
          Plan and will not repeat.
        </Txt>
      )}
      {(!routine || updateSource) &&
        unresolved > 0 &&
        inline(
          reviewed
            ? "✓ Repeat published Beacons only"
            : "Repeat published Beacons only",
          () => setReviewed(!reviewed),
        )}
      {needsPlus && (
        <>
          <Txt muted>
            Repeating multiple Beacons requires the Routine owner’s BEACON+.
            Single-Beacon repeats remain Free.
          </Txt>
          <PremiumPreview />
        </>
      )}
      {!manual && routine?.status !== "ended" && (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Upcoming Repeats</Text>
          {rows.map((row) => (
            <View
              key={row.date}
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <View style={{ flex: 1 }}>
                <Txt>{row.date}</Txt>
                <Txt muted>
                  {row.state === "materialized"
                    ? "Scheduled occurrence"
                    : "Projected · not published"}
                </Txt>
              </View>
              {row.state === "materialized" &&
                row.plan_id &&
                inline("Open occurrence", () =>
                  router.push({
                    pathname: "/plan/[id]",
                    params: { id: row.plan_id! },
                  }),
                )}
            </View>
          ))}
          {count < 10 && inline("Show more dates", () => setCount(10))}
          {!!loadError && <Txt muted>{loadError}</Txt>}
        </View>
      )}
      {!!validation && <Txt muted>{validation}</Txt>}
      {!!actionError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {actionError}
        </Text>
      )}
      <QuickChoiceDialog
        title="Repeat options"
        visible={menu}
        onClose={() => setMenu(false)}
        items={
          routine
            ? [
                {
                  label: "Run Now",
                  onPress: () => {
                    void act("run_routine_now", { id: routine.id })
                      .then((result) => {
                        if (typeof result.occurrence_plan_id === "string")
                          router.push({
                            pathname: "/plan/[id]",
                            params: { id: result.occurrence_plan_id },
                          });
                      })
                      .catch((e) => setActionError(e.message));
                  },
                },
                {
                  label: "End Routine",
                  destructive: true,
                  onPress: () => setEnding(true),
                },
              ]
            : []
        }
      />
      <ConfirmDialog
        title="End this Routine?"
        message="Already scheduled Beacons stay available."
        visible={ending}
        confirmLabel="End Routine"
        destructive
        onClose={() => setEnding(false)}
        onConfirm={async () => {
          await act("end_routine", { id: routine?.id });
          setEnding(false);
        }}
      />
      <Action
        title={routine ? "Save Schedule" : "Save Repeat"}
        disabled={!!validation || routine?.status === "ended"}
        run={save}
      />
    </View>
  );
}
