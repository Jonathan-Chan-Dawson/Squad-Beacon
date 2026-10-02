import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Action, Button, Empty, Screen, Sheet, Txt, useTheme } from "@/src/shared/ui";

export default function PlanDetailScreen() {
  const { styles } = useTheme();
  const [confirmCancel, setConfirmCancel] = useState(false);
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

  return <Screen title={plan.title} eyebrow={squad ? `BEACON PLAN · ${squad.name}` : "PERSONAL BEACON PLAN"} create={false}>
    {!!plan.description && <Txt>{plan.description}</Txt>}
    <View style={styles.card}>
      <Text style={styles.h2}>Schedule</Text>
      <Txt>{plan.start_date} · {plan.timezone}</Txt>
      <Txt muted>{beacons.length} beacons · {plan.status === "cancelled" ? "Cancelled" : "Scheduled"}</Txt>
    </View>
    {!beacons.length && <Empty title="No visible beacons yet" body="Plan steps appear here as scheduled beacons." />}
    {beacons.map((beacon, index) => {
      const place = data.places.find((p) => p.activity_id === beacon.id);
      return <View key={beacon.id} style={styles.card}>
        <Text style={styles.label}>BEACON {index + 1}</Text>
        <Text style={styles.h2}>{beacon.title}</Text>
        <Txt>{new Date(beacon.starts_at).toLocaleString([], { timeZone: plan.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</Txt>
        <Txt muted>Ends {new Date(beacon.ends_at).toLocaleTimeString([], { timeZone: plan.timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · {Math.max(1, Math.round((Date.parse(beacon.ends_at) - Date.parse(beacon.starts_at)) / 60000))} min · {beacon.status}</Txt>
        <Txt muted>{beacon.category}{place?.label ? ` · ${place.label}` : ""}</Txt>
        {beacon.description && <Txt>{beacon.description}</Txt>}
        <Button title="Open beacon" onPress={() => router.push({ pathname: "/activity/[id]", params: { id: beacon.id } })} />
      </View>;
    })}
    {canCancel && plan.status === "scheduled" && <Button title="Cancel plan" secondary onPress={() => setConfirmCancel(true)} />}
    <Button title="All Beacon Plans" secondary onPress={() => router.replace("/plans")} />
    <Sheet title="Cancel this plan?" visible={confirmCancel} onClose={() => setConfirmCancel(false)}>
      <Txt>All scheduled beacons in this plan will be cancelled. Completed beacons and their history remain. This can’t be undone.</Txt>
      <Action title="Cancel plan and its scheduled beacons" run={async () => { await act("cancel_plan", { id: plan.id }); setConfirmCancel(false); }} />
      <Button title="Keep plan" secondary onPress={() => setConfirmCancel(false)} />
    </Sheet>
  </Screen>;
}
