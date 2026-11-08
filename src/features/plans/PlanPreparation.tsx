import { useNow } from "@/src/shared/useNow";
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Chips, Txt } from "@/src/shared/ui";
import { useBeacon } from "@/src/shared/store";
import {
  resolvePersonalEntitlements,
  resolveSquadEntitlements,
  resolvePremiumFeature,
} from "@/src/shared/entitlements";
import {
  canReadBeaconModuleEntry,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import type { Plan } from "@/src/shared/types";
import { planPermissions, planStops, stopActivity } from "./livingPlans";
export function PlanPreparation({ plan }: { plan: Plan }) {
  const now = useNow();
  const { data, userId } = useBeacon();
  const [open, setOpen] = useState(false),
    [filter, setFilter] = useState("Open tasks"),
    [limit, setLimit] = useState(50);
  const tier = resolvePersonalEntitlements(data, userId).tier;
  const squad = plan.squad_id
    ? resolveSquadEntitlements(data, plan.squad_id)
    : null;
  if (
    !userId ||
    !planPermissions(data, plan, userId).editor ||
    !(data.is_demo || data.capabilities?.premium_tools) ||
    (tier !== "pro" && squad?.tier !== "pro")
  )
    return null;
  const beacons = planStops(data, plan, userId)
    .map((s) => stopActivity(data, s, userId))
    .filter(
      (a) =>
        a &&
        canUseBeaconModules(data, a, userId) &&
        (tier === "pro" ||
          (a.audience === "squad" &&
            a.audience_id === plan.squad_id &&
            resolvePremiumFeature(data, "preparation", a).available)),
    );
  const tasks = data.beacon_checklist_items.filter(
    (t) =>
      !t.completed &&
      beacons.some(
        (a) =>
          a?.id === t.activity_id &&
          canReadBeaconModuleEntry(data, a, t.author_id, userId),
      ),
  );
  const shown = tasks.filter((t) =>
    filter === "Unassigned"
      ? !t.assignee_id
      : filter === "Overdue"
        ? !!(t.due_at || t.due_on) &&
          Date.parse(t.due_at || `${t.due_on}T23:59:59`) < now
        : true,
  );
  return (
    <View style={{ gap: 8 }}>
      <Button
        compact
        secondary
        title={open ? "Hide preparation" : "Preparation overview"}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Txt muted>
            {tasks.length} loaded open tasks across accessible Beacons. Open a
            Beacon for its complete Checklist.
          </Txt>
          <Chips
            options={["Open tasks", "Overdue", "Unassigned"]}
            value={filter}
            onChange={setFilter}
          />
          {shown.slice(0, limit).map((t) => (
            <View key={t.id} style={{ gap: 4 }}>
              <Txt>{t.text}</Txt>
              <Button
                compact
                secondary
                title={
                  beacons.find((a) => a?.id === t.activity_id)?.title ??
                  "Open Beacon"
                }
                onPress={() =>
                  router.push({
                    pathname: "/activity/[id]",
                    params: { id: t.activity_id, tool: "checklist" },
                  })
                }
              />
            </View>
          ))}
          {shown.length > limit && (
            <Button
              compact
              secondary
              title="Show more tasks"
              onPress={() => setLimit((n) => n + 50)}
            />
          )}
          {!shown.length && <Txt muted>No tasks in this view.</Txt>}
        </>
      )}
    </View>
  );
}
