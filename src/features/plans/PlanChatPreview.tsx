import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useBeacon } from "@/src/shared/store";
import { Button, Txt } from "@/src/shared/ui";
import { canReadMapPlan } from "@/src/features/maps/contextFilters";
import { PlanningResponseControls } from "@/src/features/planning/PlanningResponseControls";
import { planStops, stopActivity, stopThread } from "./livingPlans";

export function PlanChatPreview({ planId }: { planId: string }) {
  const { data, userId } = useBeacon();
  const plan = data.plans.find((p) => p.id === planId);
  if (!plan || !userId || !canReadMapPlan(data, plan, userId))
    return <Txt muted>Plan no longer available</Txt>;
  const stops = planStops(data, plan, userId);
  const confirmed = stops.filter((s) => !!stopActivity(data, s, userId)).length;
  const threads = stops
    .map((s) => stopThread(data, s, userId))
    .filter((t) => t && t.status === "open" && !t.materialized_activity_id);
  const next = threads[0];
  return (
    <View style={{ gap: 6, paddingVertical: 8 }}>
      <Button
        compact
        secondary
        title={plan.title}
        onPress={() =>
          router.push({ pathname: "/plan/[id]", params: { id: plan.id } })
        }
      />
      <Txt muted>
        {confirmed} confirmed · {threads.length} decisions pending
      </Txt>
      {next && (
        <PlanningResponseControls
          threadId={next.id}
          expanded={false}
          compactPing
          onOpen={() =>
            router.push({ pathname: "/plan/[id]", params: { id: plan.id } })
          }
        />
      )}
    </View>
  );
}
