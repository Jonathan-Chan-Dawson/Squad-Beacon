import React from "react";
import { View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { Button } from "@/src/shared/ui";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { resolveMapContext, type MapContextFilter } from "./contextFilters";

/** Shared by the existing preview and expanded Beacon panel. */
export function MapRelationshipActions({
  beaconId,
  onShow,
}: {
  beaconId: string;
  onShow?: (filter: MapContextFilter) => void;
}) {
  const { data, userId } = useBeacon();
  const activity = data.activities.find((row) => row.id === beaconId);
  if (
    !onShow ||
    !activity ||
    !userId ||
    data.viewer_id !== userId ||
    !canReadBeaconActivity(data, activity, userId)
  )
    return null;
  const filters: MapContextFilter[] = [
    ...(activity.plan_id
      ? [{ kind: "plan" as const, id: activity.plan_id }]
      : []),
    ...data.planning_threads
      .filter(
        (thread) =>
          thread.materialized_activity_id === beaconId ||
          data.planning_proposals.some(
            (proposal) =>
              proposal.thread_id === thread.id &&
              proposal.activity_id === beaconId,
          ),
      )
      .map((thread) => ({ kind: "thread" as const, id: thread.id })),
  ];
  const permitted = filters.filter((filter) =>
    resolveMapContext(data, userId, filter),
  );
  if (!permitted.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {permitted.map((filter) => (
        <Button
          key={`${filter.kind}:${filter.id}`}
          compact
          secondary
          title={
            filter.kind === "plan"
              ? `Part of ${data.plans.find((plan) => plan.id === filter.id)?.title ?? "this plan"}`
              : data.planning_threads.find((thread) => thread.id === filter.id)
                    ?.kind === "ping"
                ? "Related activities"
                : `${data.planning_proposals.filter((row) => row.thread_id === filter.id).length} activity choices`
          }
          onPress={() => onShow(filter)}
        />
      ))}
    </View>
  );
}
