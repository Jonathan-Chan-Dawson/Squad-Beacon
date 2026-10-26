import React, { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Repeat2 } from "lucide-react-native";
import type { Activity, Plan } from "@/src/shared/types";
import { useBeacon } from "@/src/shared/store";
import { Button, Txt, useTheme } from "@/src/shared/ui";
import { localDate } from "@/src/shared/domain";
import { canManageBeacon } from "@/src/features/beacons/permissions";
import { RoutineScheduleSheet } from "./RoutineScheduleSheet";

export function RepeatBeaconAction({
  activity,
  onEditOccurrence,
}: {
  activity: Activity;
  onEditOccurrence?: () => void;
}) {
  const { repeat } = useLocalSearchParams<{ repeat?: string }>();
  const { data, userId, act } = useBeacon();
  const { semanticColors: c } = useTheme();
  const [open, setOpen] = useState(repeat === "yes");
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
  if (routine)
    return (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button
            compact
            secondary
            title="This occurrence"
            onPress={() => onEditOccurrence?.()}
          />
          <Button
            compact
            secondary
            title="Future repeats"
            icon={<Repeat2 size={16} color={c.accent} />}
            onPress={() =>
              router.push({
                pathname: "/routines",
                params: { planId: routine.plan_id },
              })
            }
          />
        </View>
        <Txt muted>Beacon edits affect this occurrence only.</Txt>
      </View>
    );
  const savedRoutine = data.plan_routines.find(
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
      <Button
        compact
        secondary
        title={savedRoutine ? "Future repeats" : "Repeat this Beacon"}
        icon={<Repeat2 size={17} color={c.accent} />}
        onPress={() => setOpen(true)}
      />
      <RoutineScheduleSheet
        plan={savedPlan ?? source}
        routine={savedRoutine}
        repeatBeacon={savedRoutine ? undefined : activity}
        visible={open}
        stepSchedule={[activity.title]}
        act={act}
        onClose={() => setOpen(false)}
        onSaved={(result) => {
          if (typeof result.plan_id === "string")
            router.push({
              pathname: "/routines",
              params: { planId: result.plan_id },
            });
        }}
      />
    </>
  );
}
