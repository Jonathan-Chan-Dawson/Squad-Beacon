import { router } from "expo-router";
import React from "react";
import { resolveMapContext } from "@/src/features/maps/contextFilters";
import { useBeacon } from "@/src/shared/store";
import { PlanningLink } from "./PlanningControls";

export function ShowPlanningOnMap({ threadId, onShow }: {
  threadId: string;
  onShow?: (id: string) => void;
}) {
  const { data, userId } = useBeacon();
  const context = resolveMapContext(data, userId, { kind: "thread", id: threadId });
  if (!context?.points.length) return null;
  return (
    <PlanningLink
      title="Show on Map"
      onPress={() => onShow
        ? onShow(threadId)
        : router.push({ pathname: "/", params: { mapThread: threadId } })}
    />
  );
}
