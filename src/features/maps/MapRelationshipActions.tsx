import React from "react";
import { ChevronRight, Route } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useBeacon } from "@/src/shared/store";
import { useNow } from "@/src/shared/useNow";
import { activityWhen } from "@/src/shared/domain";
import { Button, useTheme } from "@/src/shared/ui";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { resolveMapContext, type MapContextFilter } from "./contextFilters";
import { planningCreationModes } from "@/src/features/planning/PlanningKindSelector";

/** Shared by the existing preview and expanded Beacon panel. */
export function MapRelationshipActions({
  beaconId,
  onShow,
  expanded = false,
  threadOnly = false,
}: {
  expanded?: boolean;
  threadOnly?: boolean;
  beaconId: string;
  onShow?: (filter: MapContextFilter) => void;
}) {
  const { colors, styles } = useTheme();
  const { data, userId } = useBeacon();
  const now = useNow();
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
    ...(!threadOnly && activity.plan_id
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
  const permitted = filters.filter((filter) => {
    const view = resolveMapContext(data, userId, filter);
    return filter.kind === "thread"
      ? view?.points.some((point) => point.activityId === beaconId)
      : !!view;
  });
  if (!permitted.length) return null;
  return (
    <View style={threadOnly
      ? { gap: 2, marginBottom: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white }
      : { gap: 6 }}>
      {permitted.map((filter) =>
        filter.kind === "plan" ? (
          (() => {
            const plan = data.plans.find((row) => row.id === filter.id)!;
            const view = resolveMapContext(data, userId, filter)!;
            const steps = view.activities;
            const position = steps.findIndex((row) => row.id === beaconId) + 1;
            const next = steps
              .slice(position)
              .find(
                (row) =>
                  row.status === "scheduled" && Date.parse(row.ends_at) > now,
              );
            return (
              <View
                key={`plan:${filter.id}`}
                style={{
                  borderTopWidth: 1,
                  borderColor: colors.line,
                  paddingTop: 4,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show Plan ${plan.title}`}
                  onPress={() => onShow(filter)}
                  style={{
                    flexDirection: "row",
                    gap: 7,
                    alignItems: "center",
                    minHeight: 44,
                  }}
                >
                  <Route size={15} color={colors.muted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.label,
                        { fontSize: 12, textAlign: "left" },
                      ]}
                    >
                      {plan.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.muted,
                        { fontSize: 11, textAlign: "left" },
                      ]}
                    >
                      Stop {position} of {steps.length}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.green, fontSize: 11 },
                    ]}
                  >
                    {expanded ? "Show Plan on Map" : "Show Plan"}
                  </Text>
                  <ChevronRight size={14} color={colors.green} />
                </Pressable>
                {expanded && next && (
                  <Text
                    style={[styles.muted, { fontSize: 12, marginBottom: 6 }]}
                  >
                    Next: {next.title} · {activityWhen(next, new Date(now))}
                  </Text>
                )}
                {expanded && (
                  <Button
                    title="View full Plan"
                    compact
                    secondary
                    onPress={() =>
                      router.push({
                        pathname: "/plan/[id]",
                        params: { id: plan.id },
                      })
                    }
                  />
                )}
              </View>
            );
          })()
        ) : (() => {
          const thread = data.planning_threads.find((row) => row.id === filter.id)!;
          const mode = planningCreationModes.find(({ kind }) => kind === thread.kind)!;
          const Icon = mode.Icon;
          return (
            <Pressable
              key={`thread:${filter.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Show ${mode.label} on Map, ${thread.title}`}
              onPress={() => onShow(filter)}
              style={{ flexDirection: "row", alignItems: "center", minHeight: 44, gap: 7, borderTopWidth: threadOnly ? 0 : 1, borderColor: colors.line }}
            >
              <Icon size={15} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{mode.label}</Text>
                <Text numberOfLines={1} style={styles.muted}>{thread.title}</Text>
              </View>
              <Text style={[styles.label, { color: colors.green }]}>Show on Map</Text>
              <ChevronRight size={14} color={colors.green} />
            </Pressable>
          );
        })(),
      )}
    </View>
  );
}
