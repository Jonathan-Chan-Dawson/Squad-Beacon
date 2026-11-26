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
import { mapBeaconTitle } from "@/src/features/discovery/discoveryCardPresentation";
import { planningKindLabels } from "@/src/features/planning/planningLabels";

export type MapContextFilter = {
  kind: "plan" | "thread" | "beacon";
  id: string;
};
export const mapContextKey = (filter: MapContextFilter) =>
  `context:${filter.kind}:${filter.id}`;
export type MapContextPoint = Coordinate & {
  mapIcon?: string | null;
  id: string;
  title: string;
  activityId?: string;
  stopNumber?: number;
  publicBeaconId?: string;
  publicSummary?: Pick<import("@/src/features/discovery/types").PublicBeaconSummary, "accepted_seat_count" | "viewer_response" | "starts_at" | "ends_at">;
  category?: Category;
  threadId?: string;
  planningKind?: "ping" | "vote" | "draw" | "time";
  planningDeadline?: string;
  planningPlace?: string;
  suggestion: boolean;
};
export type MapContextView = {
  key: string;
  label: string;
  activities: Activity[];
  points: MapContextPoint[];
  paths: MapRoutePoint[][];
};

export type MapRoutePoint = Coordinate & { category?: Category };

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
  function addDraft(id: string, payload: BeaconDraft, threadId: string, planningKind: MapContextPoint["planningKind"], deadline?: string) {
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
        planningKind,
        planningDeadline: deadline,
        planningPlace: payload.label || undefined,
        suggestion: true,
      });
  }
  if (filter.kind === "beacon") {
    const activity = data.activities.find((row) => row.id === filter.id);
    if (!activity || !canReadBeaconActivity(data, activity, viewerId))
      return null;
    result.label = `Beacon: ${activity.title}`;
    addActivity(activity.id, false);
  } else if (filter.kind === "plan") {
    const plan = data.plans.find((row) => row.id === filter.id);
    if (!plan || !canReadMapPlan(data, plan, viewerId)) return null;
    result.label = `Plan: ${plan.title}`;
    let path: MapRoutePoint[] = [];
    const finishPath = () => {
      if (path.length > 1) result.paths.push(path);
      path = [];
    };
    const links=(data.plan_stops??[]).filter(s=>s.plan_id===plan.id&&s.approval==="approved"&&s.state==="active").sort((a,b)=>a.position-b.position);
    const useStops=data.is_demo ? plan.revision!=null || links.length>0 : data.capabilities?.living_plans===true;
    const itinerary=useStops?links.map(s=>data.activities.find(a=>a.id===(s.activity_id??data.planning_threads.find(t=>t.id===s.thread_id)?.materialized_activity_id))):data.activities.filter(a=>a.plan_id===plan.id).sort((a,b)=>(a.plan_step_index??0)-(b.plan_step_index??0));
    for (const [index, activity] of itinerary.entries()) {
      if(!activity){finishPath();continue;}
      const coordinate = addActivity(activity.id, false);
      // Do not connect across a hidden, virtual, or missing step.
      if (coordinate) {
        const point = result.points.find(row => row.activityId === activity.id);
        if (point) {
          point.stopNumber = index + 1;
          point.title = mapBeaconTitle(activity.title, true, index).title;
          point.category = activity.category;
          point.mapIcon = activity.map_icon;
        }
        path.push({ ...coordinate, category: activity.category });
      }
      else finishPath();
    }
    finishPath();
  } else {
    const thread = data.planning_threads.find((row) => row.id === filter.id);
    if (!thread || !canReadPlanningThread(data, thread, viewerId)) return null;
    result.label = `${planningKindLabels[thread.kind]}: ${thread.title}`;
    if (thread.materialized_activity_id)
      addActivity(thread.materialized_activity_id, false);
    const deadline = thread.status === "open" ? thread.deadline_at : undefined;
    if (thread.kind === "ping" || thread.kind === "time") {
      if (!thread.materialized_activity_id && thread.payload)
        addDraft(`${thread.kind}:${thread.id}`, thread.payload, thread.id, thread.kind, deadline);
    }
    if (thread.kind !== "ping") {
      for (const proposal of visiblePlanningProposals(
        data,
        data.planning_proposals,
        thread.id,
        viewerId,
      )) {
        if (!canReadPlanningThread(data, thread, proposal.author_id) || proposal.disqualified_at) continue;
        // A linked Beacon's independent privacy rules also apply to its proposal location.
        if (proposal.activity_id) addActivity(proposal.activity_id, true);
        else if (!thread.materialized_activity_id)
          addDraft(`proposal:${proposal.id}`, proposal.payload, thread.id, thread.kind, deadline);
      }
    }
  }
  return result;
}

/** Avoid extreme fits for one stop or several stops at effectively the same place. */
export function mapContextCameraKind(points: Coordinate[]): "focus" | "fit" {
  const first = points[0];
  return first && points.every(point => Math.abs(point.latitude - first.latitude) < 0.001 && Math.abs(((point.longitude - first.longitude + 540) % 360) - 180) < 0.001) ? "focus" : "fit";
}

/** Draw each chevron within a known route leg, including paths across the date line. */
export function planPathArrowheads(paths: readonly (readonly MapRoutePoint[])[]) {
  const heads: { coordinates: Coordinate[]; category?: Category }[] = [];
  const wrapLongitude = (longitude: number) => ((longitude + 540) % 360) - 180;
  for (const path of paths) {
    for (let index = 1; index < path.length; index += 1) {
      const start = path[index - 1];
      const end = path[index];
      const centerLatitude = (start.latitude + end.latitude) / 2;
      const deltaLongitude = wrapLongitude(end.longitude - start.longitude);
      const centerLongitude = start.longitude + deltaLongitude / 2;
      const longitudeScale = Math.max(0.01, Math.cos((centerLatitude * Math.PI) / 180));
      const east = deltaLongitude * longitudeScale;
      const north = end.latitude - start.latitude;
      const distance = Math.hypot(east, north);
      if (distance < 0.000001) continue;

      const armLength = Math.min(0.0011, distance * 0.085);
      const forwardEast = (east / distance) * armLength;
      const forwardNorth = (north / distance) * armLength;
      const arm = (side: -1 | 1) => ({
        latitude: centerLatitude - forwardNorth + side * forwardEast * 0.6,
        longitude: wrapLongitude(centerLongitude - (forwardEast + side * forwardNorth * 0.6) / longitudeScale),
      });
      const points = [arm(-1), { latitude: centerLatitude, longitude: wrapLongitude(centerLongitude) }, arm(1)];
      if (points.every(isValidCoordinate)) heads.push({ coordinates: points, category: end.category });
    }
  }
  return heads;
}
