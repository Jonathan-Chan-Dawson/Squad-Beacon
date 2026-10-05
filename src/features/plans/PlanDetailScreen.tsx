import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { physicalDirectionsUrl } from "@/src/features/maps/directions";
import { RoutineScheduleSheet } from "@/src/features/plans/RoutineScheduleSheet";
import { Action, Button, Empty, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlanDetailScreen() {
  const { styles } = useTheme();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [routineEditor, setRoutineEditor] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, userId, act } = useBeacon();
  const plan = data.plans.find((p) => p.id === id);
  if (!plan) return <Screen title="Beacon Plan unavailable" eyebrow="BEACON PLANS" create={false}>
    <Empty title="This plan is no longer available." body="It may have been removed, or its audience may have changed." />
    <Button title="Back to Beacon Plans" onPress={() => router.replace("/plans")} />
  </Screen>;

  const beacons = data.activities
    .filter((a) => a.plan_id === plan.id)
    .sort((a, b) => (a.plan_step_index ?? 0) - (b.plan_step_index ?? 0) || a.starts_at.localeCompare(b.starts_at));
  const canCancel = plan.owner_id === userId;
  const squad = data.squads.find((s) => s.id === plan.squad_id);
  const viewerMembership = data.squad_members.find((member) => member.user_id === userId && member.squad_id === plan.squad_id);
  const joined = data.plan_members.some((member) => member.plan_id === plan.id && member.user_id === userId);
  const canJoin = !!squad && !!viewerMembership && plan.owner_id !== userId && plan.status === "scheduled";
  const canManageRoutine = canCancel || (!!plan.squad_id && !!viewerMembership && ["owner", "admin"].includes(viewerMembership.role));
  const routine = data.plan_routines.find((item) => item.plan_id === plan.id);
  const ownerProfile = data.profiles.find((profile) => profile.id === plan.owner_id);
  const joinedProfiles = data.plan_members
    .filter((member) => member.plan_id === plan.id)
    .map((member) => data.profiles.find((profile) => profile.id === member.user_id)?.name ?? "Plan member");
  const stepSchedule = beacons.map((beacon) => {
    const time = new Date(beacon.starts_at).toLocaleString([], { timeZone: plan.timezone, weekday: "short", hour: "numeric", minute: "2-digit" });
    return `${time} · ${beacon.title}`;
  });
  const routineDays = routine?.weekdays.map((day) => dayLabels[day - 1]).join(", ");

  return <Screen title={plan.title} eyebrow={squad ? `BEACON PLAN · ${squad.name}` : "PERSONAL BEACON PLAN"} create={false}>
    {!!plan.description && <Txt>{plan.description}</Txt>}
    <View style={styles.card}>
      <Text style={styles.h2}>Plan schedule</Text>
      <Txt>{plan.start_date} · {plan.timezone}</Txt>
      <Txt muted>{beacons.length} {beacons.length === 1 ? "Beacon" : "Beacons"} · {plan.status === "cancelled" ? "Cancelled" : "Scheduled"}</Txt>
      {squad ? <Txt muted>Shared with {squad.name}. Plan members join this itinerary; each Beacon still has its own RSVP.</Txt> : <Txt muted>Private to you. This Plan is separate from RSVP status on each Beacon.</Txt>}
      {canJoin && !joined && <Action title="Join Beacon Plan" run={() => act("join_plan", { plan_id: plan.id })} />}
      {canJoin && joined && <Action title="Leave Beacon Plan" secondary run={() => act("leave_plan", { plan_id: plan.id })} />}
      {!squad && <Txt muted>You own this personal Beacon Plan.</Txt>}
    </View>

    {!!squad && <View style={styles.card}>
      <Text style={styles.h2}>Plan members</Text>
      <Txt>{ownerProfile?.name ?? "Plan owner"} · Owner</Txt>
      {joinedProfiles.map((name, index) => <Txt key={`${name}-${index}`}>{name} · Joined</Txt>)}
      {!joinedProfiles.length && <Txt muted>No one else has joined this Beacon Plan yet.</Txt>}
    </View>}

    {routine && <View style={styles.card}>
      <Text style={styles.h2}>Routine · recurring Beacon Plan</Text>
      <Txt>{routine.interval_weeks === 1 ? "Every" : `Every ${routine.interval_weeks} weeks`} {routineDays}</Txt>
      <Txt muted>{routine.status === "active" ? `Next · ${routine.next_occurrence_on ?? "No upcoming date"}` : routine.status === "paused" ? "Paused" : "Ended"}{routine.ends_on ? ` · Ends ${routine.ends_on}` : ""}</Txt>
      <Button compact secondary title="Open Routine tools" onPress={() => router.push({ pathname: "/routines", params: { planId: plan.id } })} />
    </View>}

    {!beacons.length && <Empty title="No visible Beacons yet" body="Plan steps appear here as scheduled Beacons." />}
    {beacons.map((beacon, index) => {
      const place = data.places.find((p) => p.activity_id === beacon.id);
      const destination = place?.online_url ?? physicalDirectionsUrl(place?.latitude, place?.longitude);
      return <View key={beacon.id} style={styles.card}>
        <Text style={styles.label}>BEACON {index + 1}</Text>
        <Text style={styles.h2}>{beacon.title}</Text>
        <Txt>{new Date(beacon.starts_at).toLocaleString([], { timeZone: plan.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</Txt>
        <Txt muted>Ends {new Date(beacon.ends_at).toLocaleTimeString([], { timeZone: plan.timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · {Math.max(1, Math.round((Date.parse(beacon.ends_at) - Date.parse(beacon.starts_at)) / 60000))} min · {beacon.status}</Txt>
        <Txt muted>{beacon.category}{place?.label ? ` · ${place.label}` : ""}</Txt>
        {beacon.description && <Txt>{beacon.description}</Txt>}
        <Button compact title="Open Beacon" onPress={() => router.push({ pathname: "/activity/[id]", params: { id: beacon.id } })} />
        {!!destination && <Action compact secondary title={place?.online_url ? "Open virtual Beacon" : "Directions"} run={() => Linking.openURL(destination)} />}
      </View>;
    })}

    {canManageRoutine && !routine && plan.status === "scheduled" && <Button title="Make This a Routine" secondary onPress={() => setRoutineEditor(true)} />}
    {canCancel && plan.status === "scheduled" && <Button compact secondary title="More" onPress={() => setMoreOpen(true)} />}
    <Button compact secondary title="All Beacon Plans" onPress={() => router.replace("/plans")} />

    <RoutineScheduleSheet key={`${plan.id}:${routine?.id ?? "new"}`} plan={plan} routine={routine} visible={routineEditor} stepSchedule={stepSchedule} act={act} onClose={() => setRoutineEditor(false)} />
    <Sheet title="More Plan actions" visible={moreOpen} onClose={() => setMoreOpen(false)}>
      <Txt muted>Canceling affects scheduled Beacons in this Plan. Completed Beacons and their history remain.</Txt>
      {canCancel && plan.status === "scheduled" && <Button compact secondary title="Cancel Beacon Plan…" onPress={() => { setMoreOpen(false); setConfirmCancel(true); }} />}
      <Button compact secondary title="Close" onPress={() => setMoreOpen(false)} />
    </Sheet>
    <Sheet title="Cancel this Plan?" visible={confirmCancel} onClose={() => setConfirmCancel(false)}>
      <Txt>All scheduled Beacons in this Plan will be canceled. Completed Beacons and their history remain. This can’t be undone.</Txt>
      <Action title="Cancel Plan and its scheduled Beacons" run={async () => { await act("cancel_plan", { id: plan.id }); setConfirmCancel(false); }} />
      <Button title="Keep Plan" secondary onPress={() => setConfirmCancel(false)} />
    </Sheet>
  </Screen>;
}
