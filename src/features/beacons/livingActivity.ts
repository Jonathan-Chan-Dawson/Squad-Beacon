import type { Activity, Data, Presence } from "@/src/shared/types";
import { canReadActivityPreview, canReadBeaconActivity } from "./beaconModules";
import {
  eligibleCurrentBeacons,
  projectedOwnerRelationshipIsCurrent,
  visibleCurrentBeacon,
} from "./currentStatusBeacon";
import { isApprovedGoing, beaconRoleFor } from "./permissions";
import { canReadPlanningThread } from "@/src/features/planning/domain";
import { visibleStatusAttachment } from "./statusAttachments";

export const isActivityNote = (activity: Activity) =>
  activity.mode === "solo" && activity.solo_purpose === "activity_note";
export const isStatusNote = (activity: Activity) =>
  activity.mode === "solo" && !isActivityNote(activity);
export const activeAt = (activity: Activity, now: number) =>
  activity.status === "scheduled" &&
  Date.parse(activity.starts_at) <= now &&
  Date.parse(activity.ends_at) > now;
export function ownActivityNote(data: Data, owner: string, now: number) {
  return data.activities
    .filter(
      (a) => a.owner_id === owner && isActivityNote(a) && activeAt(a, now),
    )
    .sort(
      (a, b) =>
        b.starts_at.localeCompare(a.starts_at) || a.id.localeCompare(b.id),
    )[0];
}
export function presenceFor(data: Data, owner: string): Presence | undefined {
  return data.presence?.find((p) => p.owner_id === owner);
}
export type CurrentActivity = {
  activity: Activity;
  type: "activity_note" | "beacon";
  role?: "hosting" | "cohosting" | "going";
};
export function currentActivity(
  data: Data,
  owner: string,
  viewer: string | null,
  now: number,
): CurrentActivity | null {
  if (
    !viewer ||
    data.viewer_id !== viewer ||
    data.blocks.some(
      (b) =>
        (b.blocker_id === owner && b.blocked_id === viewer) ||
        (b.blocker_id === viewer && b.blocked_id === owner),
    )
  )
    return null;
  const presence = presenceFor(data, owner);
  if (presence?.sharing === false && owner !== viewer) return null;
  if (!data.is_demo && data.capabilities?.living_activity) {
    const projection = presence?.current_activity;
    if (!projection) return null;
    const activity = data.activities.find((a) => a.id === projection.id);
    if (
      !activity ||
      !activeAt(activity, now) ||
      !canReadActivityPreview(data, activity, viewer)
    )
      return null;
    if (projection.type === "activity_note" && !isActivityNote(activity))
      return null;
    if (
      projection.type === "beacon" &&
      (activity.mode === "solo" ||
        !projection.role ||
        !projectedOwnerRelationshipIsCurrent(
          data,
          { owner_id: owner },
          activity,
          projection.role,
        ) ||
        (owner === viewer &&
          !eligibleCurrentBeacons(data, owner, now).some(
            (a) => a.id === activity.id,
          )))
    )
      return null;
    return { activity, type: projection.type, role: projection.role };
  }
  const status = data.activities
    .filter((a) => a.owner_id === owner && isStatusNote(a) && activeAt(a, now))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  if (presence?.show_current_beacon) {
    const ownerView = { ...data, viewer_id: owner };
    const options = eligibleCurrentBeacons(ownerView, owner, now);
    const selected = presence.current_beacon_id
      ? options.find((a) => a.id === presence.current_beacon_id)
      : options[0];
    if (selected) {
      if (
        owner !== viewer &&
        !canReadBeaconActivity(
          data,
          {
            ...selected,
            id: "presence-" + owner,
            owner_id: owner,
            mode: "solo",
            audience: presence.current_audience ?? "friends",
            audience_id: presence.current_audience_id ?? null,
          },
          viewer,
        )
      )
        return null;
      if (!canReadActivityPreview(data, selected, viewer)) return null;
      const role = beaconRoleFor(data, selected, owner);
      return {
        activity: selected,
        type: "beacon",
        role:
          role === "owner"
            ? "hosting"
            : role === "coowner"
              ? "cohosting"
              : "going",
      };
    }
  } else if (!presence) {
    const existing = visibleCurrentBeacon(data, status, viewer, now);
    if (existing) return { ...existing, type: "beacon" };
  }
  const note = ownActivityNote(data, owner, now);
  return note && canReadActivityPreview(data, note, viewer)
    ? { activity: note, type: "activity_note" }
    : null;
}

export function upNext(data: Data, owner: string | null, now: number) {
  if (!owner || data.viewer_id !== owner) return null;
  const status = data.activities
    .filter((a) => a.owner_id === owner && isStatusNote(a) && activeAt(a, now))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  const featured = visibleStatusAttachment(data, status, owner, now);
  const beacons = data.activities.filter(
    (a) =>
      a.mode !== "solo" &&
      a.status === "scheduled" &&
      Date.parse(a.starts_at) > now &&
      !(a.plan_id && a.plan_step && !a.plan_started_at) &&
      canReadActivityPreview(data, a, owner) &&
      (["owner", "coowner"].includes(beaconRoleFor(data, a, owner)) ||
        isApprovedGoing(
          a,
          data.rsvps.find((r) => r.activity_id === a.id && r.user_id === owner),
        )),
  );
  const pings = data.planning_threads.filter(
    (t) =>
      t.kind === "ping" &&
      t.owner_id === owner &&
      t.status === "open" &&
      Date.parse(t.deadline_at) > now &&
      t.payload &&
      Date.parse(t.payload.starts_at) > now &&
      canReadPlanningThread(data, t, owner),
  );
  const candidates = [
    ...beacons.map((a) => ({
      type: "beacon" as const,
      id: a.id,
      title: a.title,
      time: a.starts_at,
      category: a.category,
      state: "Upcoming",
    })),
    ...pings.map((t) => ({
      type: "ping" as const,
      id: t.id,
      title: t.title,
      time: t.payload!.starts_at,
      category: t.payload!.category,
      state: "Planning",
    })),
  ];
  candidates.sort(
    (a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id),
  );
  const highlighted = candidates.find(
    (c) => c.id === featured?.id && c.type === featured.type,
  );
  // Do not choose a different item merely to fill the duplicate's space.
  return highlighted
    ? null
    : (candidates.find((c) => c.type === "beacon") ?? candidates[0] ?? null);
}

export function activityNoteSeed(
  data: Data,
  owner: string | null,
  id: string | undefined,
  now: number,
) {
  if (!owner || data.viewer_id !== owner || !id) return undefined;
  const note = data.activities.find(
    (a) =>
      a.id === id &&
      a.owner_id === owner &&
      isActivityNote(a) &&
      activeAt(a, now),
  );
  return note && canReadActivityPreview(data, note, owner)
    ? {
        title: note.title,
        category: note.category,
        description: note.description ?? "",
        emoji: note.decoration_emoji,
      }
    : undefined;
}
