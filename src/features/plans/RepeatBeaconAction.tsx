import React, { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Repeat2 } from "lucide-react-native";
import type { Activity, Plan } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Button, Txt } from "@/src/shared/ui";
import { localDate } from "@/src/shared/domain";
import { canManageBeacon } from "@/src/features/beacons/permissions";
import { PlanChoice } from "./PlanPresentation";
import { RoutineScheduleSheet } from "./RoutineScheduleSheet";

export function RepeatBeaconAction({
  openRequest = 0,
  onOpenRequestConsumed,
  activity,
  onEditOccurrence,
}: {
  openRequest?: number;
  onOpenRequestConsumed?: () => void;
  activity: Activity;
  onEditOccurrence?: () => void;
}) {
  const { repeat } = useLocalSearchParams<{ repeat?: string }>();
  const { data, userId, act } = useBeacon();
  const [open, setOpen] = useState(repeat === "yes");
  const visible = open || openRequest > 0;
  const close = () => {
    setOpen(false);
    onOpenRequestConsumed?.();
  };
  if (
    !userId ||
    data.viewer_id !== userId ||
    !(data.is_demo || data.capabilities?.repeatable_plans) ||
    activity.mode === "solo" ||
    activity.status === "cancelled" ||
    !(activity.owner_id === userId || canManageBeacon(data, activity, userId))
  )
    return null;
  const occurrence = data.plans.find(
    (p) => p.id === activity.plan_id && p.routine_id,
  );
  const routine = data.plan_routines.find(
    (r) => r.id === occurrence?.routine_id,
  );
  const savedRoutine =
    routine ??
    data.plan_routines.find(
      (r) =>
        r.status !== "ended" &&
        data.plans.some(
          (p) =>
            p.id === r.plan_id &&
            p.owner_id === userId &&
            p.routine_source &&
            data.plan_stops?.some(
              (s) => s.plan_id === p.id && s.activity_id === activity.id,
            ),
        ),
    );
  const savedPlan = data.plans.find((p) => p.id === savedRoutine?.plan_id);
  const frequency = savedRoutine?.frequency ?? "weekly";
  const interval = savedRoutine?.interval_count ?? savedRoutine?.interval_weeks ?? 1;
  const unit = frequency === "daily" ? "day" : frequency === "monthly" ? "month" : "week";
  const scheduleLabel = interval === 1
    ? frequency === "daily" ? "Daily" : frequency === "monthly" ? "Monthly" : "Weekly"
    : `Every ${interval} ${unit}s`;
  const repeatSummary = savedRoutine
    ? [
        savedRoutine.status === "paused" ? "Paused" : null,
        scheduleLabel,
        frequency === "weekly"
          ? savedRoutine.weekdays.map((day) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day - 1]).join(", ")
          : frequency === "monthly" ? `Day ${savedRoutine.month_day ?? Number(savedRoutine.anchor_date.slice(8))}` : null,
      ].filter(Boolean).join(" · ")
    : "Set a schedule for future Beacons";
  const source: Plan = {
    id: `repeat:${activity.id}`,
    owner_id: userId,
    squad_id: activity.audience === "squad" ? activity.audience_id : null,
    title: activity.title,
    description: activity.description ?? "",
    timezone: activity.timezone,
    start_date: localDate(new Date(activity.starts_at), activity.timezone),
    status: "scheduled",
    created_at: new Date().toISOString(),
  };
  return (
    <>
      {routine && (
        <Txt muted>
          Beacon edits affect this occurrence only. Repeat settings apply to
          future dates.
        </Txt>
      )}
      {routine && onEditOccurrence && (
        <Button
          compact
          secondary
          title="Edit this occurrence"
          onPress={onEditOccurrence}
        />
      )}
      <PlanChoice
        title={savedRoutine ? "Repeat settings" : "Repeat this Beacon"}
        detail={
          repeatSummary
        }
        icon={Repeat2}
        expanded={visible}
        onPress={() => visible ? close() : setOpen(true)}
      />
      <RoutineScheduleSheet
        plan={savedPlan ?? source}
        routine={savedRoutine}
        repeatBeacon={savedRoutine ? undefined : activity}
        visible={visible}
        stepSchedule={[activity.title]}
        act={act}
        onClose={close}
      />
    </>
  );
}
