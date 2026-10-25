import { useNow } from "@/src/shared/useNow";
import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import PlanningDetailScreen from "@/src/features/planning/PlanningDetailScreen";
import { useBeacon } from "@/src/shared/store";
import { planningInteraction } from "@/src/features/planning/planningInteraction";
import { canManagePlanningThread } from "@/src/features/planning/domain";
import { planningDestination } from "@/src/features/planning/inbox";

export default function CouncilRoute() {
  const now = useNow();
  const params = useLocalSearchParams<{ id: string; mode?: string }>();
  const { data, userId, loading } = useBeacon();
  const state = planningInteraction(data, userId, params.id, now);
  // Only ordinary participant links are forwarded. Management and contextual links remain intact.
  if (
    !loading &&
    state &&
    params.mode !== "manage" &&
    Object.keys(params).every((key) => key === "id" || key === "mode") &&
    !canManagePlanningThread(state.thread, userId!)
  )
    return <Redirect href={planningDestination(params.id)} />;
  return <PlanningDetailScreen />;
}
