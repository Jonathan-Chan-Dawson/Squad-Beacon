import type {
  Activity,
  BeaconDraft,
  Category,
  Data,
  Plan,
} from "@/src/shared/types";
import { canReadBeaconActivity } from "@/src/features/beacons/beaconModules";
import { canReadBeaconMeetingDetails } from "./filtering";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";
import {
  canReadPlanningThread,
  visiblePlanningProposals,
} from "@/src/features/planning/domain";
import { isValidCoordinate, type Coordinate } from "@/src/shared/exploration";

export type MapContextFilter = { kind: "plan" | "thread"; id: string };
export const mapContextKey = (filter: MapContextFilter) =>
  `context:${filter.kind}:${filter.id}`;
export type MapContextPoint = Coordinate & {
  id: string;
  title: string;
  activityId?: string;
  publicBeaconId?: string;
  category?: Category;
  threadId?: string;
  suggestion: boolean;
};
export type MapContextView = {
  key: string;
  label: string;
  activities: Activity[];
  points: MapContextPoint[];
  paths: Coordinate[][];
};

export function canReadMapPlan(data: Data, plan: Plan, viewerId: string) {
  return (
    data.viewer_id === viewerId &&
    ((plan.owner_id === viewerId && !plan.squad_id) ||
      (!!plan.squad_id &&
        canOpenSquadProfile(data, plan.squad_id, viewerId) &&
        !data.blocks.some(
          (block) =>
            (block.blocker_id === plan.owner_id &&
              block.blocked_id === viewerId) ||
            (block.blocker_id === viewerId &&
              block.blocked_id === plan.owner_id),
        )))
  );
}

/** Context bypasses discovery preferences, never entity or meeting-place access. */
export function resolveMapContext(
  data: Data,
  viewerId: string | null,
  filter: MapContextFilter,
): MapContextView | null {
  if (!viewerId || data.viewer_id !== viewerId) return null;
  const result: MapContextView = {
    key: mapContextKey(filter),
    label: "",
    activities: [],
    points: [],
    paths: [],
  };
  function addActivity(id: string, suggestion: boolean) {
    const activity = data.activities.find((row) => row.id === id);
    if (!activity || !canReadBeaconActivity(data, activity, viewerId!))
      return null;
    if (!result.activities.some((row) => row.id === id))
      result.activities.push(activity);
    if (!canReadBeaconMeetingDetails(data, activity, viewerId!)) return null;
    const place = data.places.find((row) => row.activity_id === id);
    if (
      !place ||
      place.online_url != null ||
      place.latitude == null ||
      place.longitude == null
    )
      return null;
    const coordinate = { latitude: place.latitude, longitude: place.longitude };
    if (!isValidCoordinate(coordinate)) return null;
    if (!result.points.some((point) => point.activityId === id))
      result.points.push({
        ...coordinate,
        id: `beacon:${id}`,
        title: activity.title,
        activityId: id,
        suggestion,
      });
    return coordinate;
  }
  function addDraft(id: string, payload: BeaconDraft, threadId: string) {
    if (
      payload.online_url != null ||
      payload.latitude == null ||
      payload.longitude == null
    )
      return;
    const coordinate = {
      latitude: payload.latitude,
      longitude: payload.longitude,
    };
    if (isValidCoordinate(coordinate))
      result.points.push({
        ...coordinate,
        id,
        title: payload.title,
        threadId,
        suggestion: true,
      });
  }
  if (filter.kind === "plan") {
    const plan = data.plans.find((row) => row.id === filter.id);
    if (!plan || !canReadMapPlan(data, plan, viewerId)) return null;
    result.label = `Plan: ${plan.title}`;
    let path: Coordinate[] = [];
    const finishPath = () => {
      if (path.length > 1) result.paths.push(path);
      path = [];
    };
    for (const activity of data.activities
      .filter((row) => row.plan_id === plan.id)
      .sort(
        (a, b) =>
          (a.plan_step_index ?? 0) - (b.plan_step_index ?? 0) ||
          a.starts_at.localeCompare(b.starts_at),
      )) {
      const coordinate = addActivity(activity.id, false);
      // Do not connect across a hidden, virtual, or missing step.
      if (coordinate) path.push(coordinate);
      else finishPath();
    }
    finishPath();
  } else {
    const thread = data.planning_threads.find((row) => row.id === filter.id);
    if (!thread || !canReadPlanningThread(data, thread, viewerId)) return null;
    result.label = `${thread.kind === "vote" ? "Vote" : thread.kind === "draw" ? "Draw" : "Ping"}: ${thread.title}`;
    if (thread.materialized_activity_id)
      addActivity(thread.materialized_activity_id, false);
    if (thread.kind === "ping") {
      if (!thread.materialized_activity_id && thread.payload)
        addDraft(`ping:${thread.id}`, thread.payload, thread.id);
    } else {
      for (const proposal of visiblePlanningProposals(
        data,
        data.planning_proposals,
        thread.id,
        viewerId,
      )) {
        if (!canReadPlanningThread(data, thread, proposal.author_id)) continue;
        // A linked Beacon's independent privacy rules also apply to its proposal location.
        if (proposal.activity_id) addActivity(proposal.activity_id, true);
        else addDraft(`proposal:${proposal.id}`, proposal.payload, thread.id);
      }
    }
  }
  return result;
}
