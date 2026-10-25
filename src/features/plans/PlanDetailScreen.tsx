import { physicalDirectionsUrl } from "@/src/features/maps/directions";
import { stepsFromPlan } from "@/src/features/plans/domain";
import { RoutineScheduleSheet } from "@/src/features/plans/RoutineScheduleSheet";
import { ConfirmDialog } from "@/src/shared/Dialogs";
import { useBeacon } from "@/src/shared/store";
import {
  Action,
  Button,
  Empty,
  Screen,
  Sheet,
  Txt,
  useTheme,
} from "@/src/shared/ui";
import { useNow } from "@/src/shared/useNow";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlanDetailScreen() {
  const { styles } = useTheme();
  const now = useNow(1000);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [routineEditor, setRoutineEditor] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId, act } = useBeacon();
  const plan = data.plans.find((p) => p.id === id);
  if (!plan)
    return (
      <Screen
        title="Beacon Plan unavailable"
        eyebrow="BEACON PLANS"
        create={false}
      >
        <Empty
          title="This plan is no longer available."
          body="It may have been removed, or its audience may have changed."
        />
        <Button
          title="Back to Beacon Plans"
          onPress={() => router.replace("/plans")}
        />
      </Screen>
    );

  const beacons = data.activities
    .filter((a) => a.plan_id === plan.id)
    .sort(
      (a, b) =>
        (a.plan_step_index ?? 0) - (b.plan_step_index ?? 0) ||
        a.starts_at.localeCompare(b.starts_at),
    );
  const canCancel = plan.owner_id === userId;
  const squad = data.squads.find((s) => s.id === plan.squad_id);
  const viewerMembership = data.squad_members.find(
    (member) => member.user_id === userId && member.squad_id === plan.squad_id,
  );
  const joined = data.plan_members.some(
    (member) => member.plan_id === plan.id && member.user_id === userId,
  );
  const canJoin =
    !!squad &&
    !!viewerMembership &&
    plan.owner_id !== userId &&
    plan.status === "scheduled";
  const canManageRoutine =
    canCancel ||
    (!!plan.squad_id &&
      !!viewerMembership &&
      ["owner", "admin"].includes(viewerMembership.role));
  const routine = data.plan_routines.find((item) => item.plan_id === plan.id);
  const ownerProfile = data.profiles.find(
    (profile) => profile.id === plan.owner_id,
  );
  const joinedProfiles = data.plan_members
    .filter((member) => member.plan_id === plan.id)
    .map(
      (member) =>
        data.profiles.find((profile) => profile.id === member.user_id)?.name ??
        "Plan member",
    );
  const stepSchedule = beacons.map((beacon) => {
    const time = new Date(beacon.starts_at).toLocaleString([], {
      timeZone: plan.timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${time} · ${beacon.title}`;
  });
  const routineDays = routine?.weekdays
    .map((day) => dayLabels[day - 1])
    .join(", ");

  return (
    <Screen
      title={plan.title}
      eyebrow={squad ? `BEACON PLAN · ${squad.name}` : "PERSONAL BEACON PLAN"}
      create={false}
    >
      <Button
        title="Show Full Plan"
        secondary
        onPress={() =>
          router.push({ pathname: "/", params: { mapPlan: plan.id } })
        }
      />
      {!!plan.description && <Txt>{plan.description}</Txt>}
      <View style={styles.card}>
        <Text style={styles.h2}>Plan schedule</Text>
        <Txt>
          {plan.start_date} · {plan.timezone}
        </Txt>
        <Txt muted>
          {beacons.length} {beacons.length === 1 ? "Beacon" : "Beacons"} ·{" "}
          {plan.status === "cancelled" ? "Cancelled" : "Scheduled"}
        </Txt>
        {squad ? (
          <Txt muted>
            Shared with {squad.name}. Plan members join this itinerary; each
            Beacon still has its own RSVP.
          </Txt>
        ) : (
          <Txt muted>
            Private to you. This Plan is separate from RSVP status on each
            Beacon.
          </Txt>
        )}
        {canJoin && !joined && (
          <Action
            title="Join Beacon Plan"
            run={() => act("join_plan", { plan_id: plan.id })}
          />
        )}
        {canJoin && joined && (
          <Action
            title="Leave Beacon Plan"
            secondary
            run={() => act("leave_plan", { plan_id: plan.id })}
          />
        )}
        {!squad && <Txt muted>You own this personal Beacon Plan.</Txt>}
      </View>

      {!!squad && (
        <View style={styles.card}>
          <Text style={styles.h2}>Plan members</Text>
          <Txt>{ownerProfile?.name ?? "Plan owner"} · Owner</Txt>
          {joinedProfiles.map((name, index) => (
            <Txt key={`${name}-${index}`}>{name} · Joined</Txt>
          ))}
          {!joinedProfiles.length && (
            <Txt muted>No one else has joined this Beacon Plan yet.</Txt>
          )}
        </View>
      )}

      {routine && (
        <View style={styles.card}>
          <Text style={styles.h2}>Routine · recurring Beacon Plan</Text>
          <Txt>
            {routine.run_mode === "manual"
              ? "Run Manually"
              : routine.interval_weeks === 1
                ? "Every"
                : `Every ${routine.interval_weeks} weeks`}{" "}
            {routineDays}
          </Txt>
          <Txt muted>
            {routine.status === "ended"
              ? "Ended"
              : routine.run_mode === "manual"
                ? "Ready to reuse"
                : routine.status === "active"
                  ? `Next · ${routine.next_occurrence_on ?? "No upcoming date"}`
                  : routine.status === "paused"
                    ? "Paused"
                    : "Ended"}
            {routine.ends_on ? ` · Ends ${routine.ends_on}` : ""}
          </Txt>
          <Button
            compact
            secondary
            title="Open Routine tools"
            onPress={() =>
              router.push({
                pathname: "/routines",
                params: { planId: plan.id },
              })
            }
          />
        </View>
      )}

      {!beacons.length && (
        <Empty
          title="No visible Beacons yet"
          body="Plan steps appear here as scheduled Beacons."
        />
      )}
      {canCancel && plan.status === "scheduled" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button
            compact
            title="+ Add Beacon"
            onPress={() =>
              router.push({
                pathname: "/create",
                params: { planId: plan.id, editor: "yes" },
              })
            }
          />
          <Action
            compact
            secondary
            title="Save as My Template"
            run={() =>
              act("save_plan_template", {
                title: plan.title,
                description: plan.description,
                timezone: plan.timezone,
                steps: stepsFromPlan(plan, data.activities, data.places),
              })
            }
          />
          <Button
            compact
            secondary
            title="Duplicate Plan"
            onPress={() =>
              router.push({
                pathname: "/plans",
                params: {
                  create: "yes",
                  sourcePlan: plan.id,
                  ...(plan.squad_id ? { squadId: plan.squad_id } : {}),
                },
              })
            }
          />
        </View>
      )}
      {beacons.map((beacon, index) => {
        const place = data.places.find((p) => p.activity_id === beacon.id);
        const destination =
          place?.online_url ??
          physicalDirectionsUrl(place?.latitude, place?.longitude);
        const waiting = !!beacon.plan_step && beacon.plan_started_at === null;
        const previous = beacons[index - 1];
        const canStart =
          waiting &&
          (beacon.plan_step?.start_mode !== "after_previous" ||
            previous?.status === "completed" ||
            (!!previous?.plan_started_at &&
              previous.plan_step?.end_mode !== "manual" &&
              Date.parse(previous.ends_at) <= now));
        return (
          <View key={beacon.id} style={{ gap: 8 }}>
            {index > 0 && (
              <Text style={[styles.muted, { marginLeft: 22 }]}>↓</Text>
            )}
            <View style={styles.card}>
              <Text style={styles.label}>
                {beacon.plan_step?.start_mode === "after_previous"
                  ? "AFTER PREVIOUS ENDS"
                  : beacon.plan_step?.start_mode === "manual"
                    ? "MANUAL START"
                    : `BEACON ${index + 1}`}
              </Text>
              <Text style={styles.h2}>{beacon.title}</Text>
              <Txt>
                {waiting
                  ? `Waiting to start · estimated ${beacon.plan_step?.start_time}`
                  : new Date(beacon.starts_at).toLocaleString([], {
                      timeZone: plan.timezone,
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
              </Txt>
              <Txt muted>
                {beacon.status === "completed"
                  ? "Completed"
                  : beacon.plan_step?.end_mode === "manual"
                    ? "Manual End"
                    : `${beacon.plan_step?.duration_minutes ?? Math.max(1, Math.round((Date.parse(beacon.ends_at) - Date.parse(beacon.starts_at)) / 60000))} min`}{" "}
                · {beacon.status}
              </Txt>
              {canCancel &&
                plan.status === "scheduled" &&
                beacon.status === "scheduled" && (
                  <>
                    {waiting && (
                      <Action
                        compact
                        title="Start Beacon"
                        disabled={!canStart}
                        run={() => act("start_plan_beacon", { id: beacon.id })}
                      />
                    )}
                    {!waiting && Date.parse(beacon.starts_at) <= now && (
                      <Action
                        compact
                        secondary
                        title="End Beacon"
                        run={() => act("end_plan_beacon", { id: beacon.id })}
                      />
                    )}
                  </>
                )}
              <Txt muted>
                {beacon.category}
                {place?.label ? ` · ${place.label}` : ""}
              </Txt>
              {beacon.description && <Txt>{beacon.description}</Txt>}
              <Button
                compact
                title="Open Beacon"
                onPress={() =>
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: beacon.id },
                  })
                }
              />
              {!!destination && (
                <Action
                  compact
                  secondary
                  title={
                    place?.online_url ? "Open virtual Beacon" : "Directions"
                  }
                  run={() => Linking.openURL(destination)}
                />
              )}
            </View>
          </View>
        );
      })}

      {canManageRoutine && !routine && plan.status === "scheduled" && (
        <Button
          title="Make This a Routine"
          secondary
          onPress={() => setRoutineEditor(true)}
        />
      )}
      {canCancel && plan.status === "scheduled" && (
        <Button
          compact
          secondary
          title="More"
          onPress={() => setMoreOpen(true)}
        />
      )}
      <Button
        compact
        secondary
        title="All Beacon Plans"
        onPress={() => router.replace("/plans")}
      />

      <RoutineScheduleSheet
        key={`${plan.id}:${routine?.id ?? "new"}`}
        plan={plan}
        routine={routine}
        visible={routineEditor}
        stepSchedule={stepSchedule}
        act={act}
        onClose={() => setRoutineEditor(false)}
      />
      <Sheet
        title="More Plan actions"
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
      >
        <Txt muted>
          Canceling affects scheduled Beacons in this Plan. Completed Beacons
          and their history remain.
        </Txt>
        {canCancel && plan.status === "scheduled" && (
          <Button
            compact
            secondary
            title="Cancel Beacon Plan…"
            onPress={() => {
              setMoreOpen(false);
              setConfirmCancel(true);
            }}
          />
        )}
        <Button
          compact
          secondary
          title="Close"
          onPress={() => setMoreOpen(false)}
        />
      </Sheet>
      <ConfirmDialog
        title="Cancel this Plan?"
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await act("cancel_plan", { id: plan.id });
          setConfirmCancel(false);
        }}
        confirmLabel={"Cancel Plan and its scheduled Beacons"}
        cancelLabel={"Keep Plan"}
        closeOnConfirm={false}
        destructive
      >
        <Txt>
          All scheduled Beacons in this Plan will be canceled. Completed Beacons
          and their history remain. This can’t be undone.
        </Txt>
      </ConfirmDialog>
    </Screen>
  );
}
