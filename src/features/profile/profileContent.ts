import type { Activity, Category, Data, Profile } from "@/src/shared/types";
import { canViewProfile } from "./privacy";
import {
  canReadBeaconActivity,
  canReadBeaconModuleEntry,
} from "@/src/features/beacons/beaconModules";
import { isApprovedGoing } from "@/src/features/beacons/permissions";
import { friendIds } from "@/src/shared/domain";
import { canOpenSquadProfile } from "@/src/features/people/squadProfile";

const snapshotKeys = new WeakMap<Data, string>();
let previousPermissions: string | undefined;
let permissionGeneration = 0;
export function profilePermissionKey(data: Data) {
  const cached = snapshotKeys.get(data);
  if (cached) return cached;
  const key = JSON.stringify([
    data.viewer_id,
    data.profiles,
    data.blocks,
    data.profile_visibility_grants,
    data.activities,
    data.rsvps,
    data.beacon_memories,
    data.friendships,
    data.squad_members,
    data.squads,
    data.squad_bans,
    data.organizations,
    data.organization_members,
    data.organization_bans,
    data.spaces,
    data.space_members,
    data.space_bans,
    data.activity_exclusions,
    data.beacon_invitation_grants,
  ]);
  if (key !== previousPermissions) {
    previousPermissions = key;
    permissionGeneration++;
  }
  // Exact comparison, rather than a hash, avoids authorization-key collisions.
  // Components retain a small token instead of copying the full snapshot per tile.
  const token = String(permissionGeneration);
  snapshotKeys.set(data, token);
  return token;
}

export type ProfileContentFilter = "all" | "upcoming" | "past" | "albums";
export interface ProfileContentQuery {
  personId: string;
  filter?: ProfileContentFilter;
  query?: string;
  cursor?: string | null;
  pageSize?: number;
}
export interface ProfileContentRow {
  id: string;
  title: string;
  category: Category;
  startsAt: string;
  endsAt: string;
  status: Activity["status"];
  role: "host" | "attendee";
  photoCount: number;
  videoCount: number;
  hasMemories: boolean;
  coverPath: string | null;
}
export interface ProfileContentPage {
  rows: ProfileContentRow[];
  nextCursor: string | null;
  beaconCount: number;
  friendIds: string[];
  squadIds: string[];
}
export function normalizeProfileQuery(input: ProfileContentQuery) {
  return {
    personId: input.personId,
    filter: input.filter ?? "all",
    query: (input.query ?? "").trim().slice(0, 80),
    cursor: input.cursor ?? null,
    pageSize: Math.max(1, Math.min(20, Math.trunc(input.pageSize || 6))),
  };
}
export function profileParticipated(
  data: Data,
  activity: Activity,
  personId: string,
) {
  return (
    activity.mode !== "solo" &&
    !(
      activity.plan_id &&
      activity.plan_step &&
      !activity.plan_started_at &&
      activity.status === "scheduled"
    ) &&
    (activity.owner_id === personId ||
      isApprovedGoing(
        activity,
        data.rsvps.find(
          (row) => row.activity_id === activity.id && row.user_id === personId,
        ),
      ))
  );
}
export function profileActivities(
  data: Data,
  personId: string,
  viewerId: string | null,
) {
  if (!viewerId || !canViewProfile(data, personId, viewerId)) return [];
  return data.activities.filter(
    (activity) =>
      profileParticipated(data, activity, personId) &&
      canReadBeaconActivity(data, activity, viewerId),
  );
}
export function selectProfileBeacon(
  data: Data,
  profile: Profile,
  viewerId: string | null,
  now = Date.now(),
) {
  const currentProfile = data.profiles.find((p) => p.id === profile.id);
  if (!currentProfile) return undefined;
  profile = currentProfile;
  if (profile.hide_featured || !viewerId) return undefined;
  // The server projection distinguishes hidden from automatic without exposing owner settings.
  if (profile.viewer_profile_feature_hidden === true) return undefined;
  if (
    !data.is_demo &&
    profile.id !== viewerId &&
    profile.viewer_profile_feature_hidden == null &&
    profile.viewer_featured_activity_id == null
  )
    return undefined;
  const eligible = profileActivities(data, profile.id, viewerId).filter(
    (activity) =>
      activity.status === "scheduled" &&
      Number.isFinite(Date.parse(activity.starts_at)) &&
      Date.parse(activity.ends_at) > now,
  );
  const pinned =
    profile.viewer_featured_activity_id ?? profile.featured_activity_id;
  return (
    eligible.find((activity) => activity.id === pinned) ??
    eligible.sort(
      (a, b) =>
        Number(Date.parse(b.starts_at) <= now) -
          Number(Date.parse(a.starts_at) <= now) ||
        a.starts_at.localeCompare(b.starts_at) ||
        a.id.localeCompare(b.id),
    )[0]
  );
}
export function selectProfileContent(
  data: Data,
  viewerId: string | null,
  input: ProfileContentQuery,
  now = Date.now(),
): ProfileContentPage {
  const empty = {
    rows: [],
    nextCursor: null,
    beaconCount: 0,
    friendIds: [],
    squadIds: [],
  };
  if (!viewerId || !canViewProfile(data, input.personId, viewerId))
    return empty;
  const q = normalizeProfileQuery(input);
  const activities = profileActivities(data, q.personId, viewerId);
  const friends = friendIds(data, q.personId).filter(
    (id) =>
      !data.blocks.some(
        (b) =>
          (b.blocker_id === id && b.blocked_id === viewerId) ||
          (b.blocked_id === id && b.blocker_id === viewerId),
      ) &&
      (q.personId === viewerId ||
        (friendIds(data, viewerId).includes(id) &&
          canViewProfile(data, id, viewerId))),
  );
  const squads = data.squads.filter(
    (squad) =>
      canOpenSquadProfile(data, squad.id, viewerId) &&
      data.squad_members.some(
        (m) => m.squad_id === squad.id && m.user_id === q.personId,
      ) &&
      (q.personId === viewerId ||
        data.squad_members.some(
          (m) => m.squad_id === squad.id && m.user_id === viewerId,
        )),
  );
  const sources =
    q.filter === "albums"
      ? data.activities.filter(
          (a) =>
            a.mode !== "solo" &&
            a.status === "completed" &&
            canReadBeaconActivity(data, a, viewerId),
        )
      : activities;
  const rows = sources
    .flatMap((activity) => {
      const past =
        activity.status !== "scheduled" || Date.parse(activity.ends_at) <= now;
      if ((q.filter === "past" && !past) || (q.filter === "upcoming" && past))
        return [];
      if (
        q.query &&
        !`${activity.title} ${activity.category}`
          .toLocaleLowerCase()
          .includes(q.query.toLocaleLowerCase())
      )
        return [];
      const readable = data.beacon_memories.filter(
        (m) =>
          activity.enable_experiences === true &&
          m.activity_id === activity.id &&
          canViewProfile(data, m.author_id, viewerId) &&
          canReadBeaconModuleEntry(data, activity, m.author_id, viewerId),
      );
      const contributions = readable
        .filter((m) => m.author_id === q.personId)
        .sort(
          (a, b) =>
            b.created_at.localeCompare(a.created_at) ||
            b.id.localeCompare(a.id),
        );
      if (q.filter === "albums" && !contributions.length) return [];
      return [
        {
          id: activity.id,
          title: activity.title,
          category: activity.category,
          startsAt: activity.starts_at,
          endsAt: activity.ends_at,
          status: activity.status,
          role:
            activity.owner_id === q.personId
              ? ("host" as const)
              : ("attendee" as const),
          photoCount: contributions.filter((m) => m.media_type === "image")
            .length,
          videoCount: contributions.filter((m) => m.media_type === "video")
            .length,
          hasMemories: readable.length > 0,
          coverPath:
            contributions.find(
              (m) =>
                m.media_type === "image" &&
                !m.object_path.startsWith("demo://"),
            )?.object_path ?? null,
        },
      ];
    })
    .sort((a, b) =>
      q.filter === "upcoming"
        ? a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id)
        : b.startsAt.localeCompare(a.startsAt) || b.id.localeCompare(a.id),
    );
  const remaining = rows.filter(
    (row) =>
      !q.cursor ||
      (q.filter === "upcoming"
        ? `${row.startsAt}|${row.id}` > q.cursor
        : `${row.startsAt}|${row.id}` < q.cursor),
  );
  const page = remaining.slice(0, q.pageSize);
  return {
    rows: page,
    nextCursor:
      remaining.length > page.length && page.length
        ? `${page.at(-1)!.startsAt}|${page.at(-1)!.id}`
        : null,
    beaconCount: activities.length,
    friendIds: [...new Set(friends)],
    squadIds: squads.map((s) => s.id),
  };
}

export function parseProfileContentPage(value: unknown): ProfileContentPage {
  const fail = () => {
    throw new Error("Profile content returned an invalid page.");
  };
  if (!value || typeof value !== "object") return fail();
  const p = value as Record<string, unknown>;
  const ids = (v: unknown): v is string[] =>
    Array.isArray(v) &&
    v.every((id) => typeof id === "string" && id.length > 0);
  if (
    !Array.isArray(p.rows) ||
    p.rows.length > 20 ||
    !(p.nextCursor === null || typeof p.nextCursor === "string") ||
    !Number.isInteger(p.beaconCount) ||
    (p.beaconCount as number) < 0 ||
    !ids(p.friendIds) ||
    !ids(p.squadIds)
  )
    return fail();
  for (const item of p.rows) {
    if (!item || typeof item !== "object") return fail();
    const r = item as ProfileContentRow;
    if (
      typeof r.id !== "string" ||
      typeof r.title !== "string" ||
      !["Fitness", "Study", "Gaming", "Creative", "Social", "Other"].includes(
        r.category,
      ) ||
      !Number.isFinite(Date.parse(r.startsAt)) ||
      !Number.isFinite(Date.parse(r.endsAt)) ||
      !["scheduled", "completed", "cancelled"].includes(r.status) ||
      !["host", "attendee"].includes(r.role) ||
      typeof r.hasMemories !== "boolean" ||
      !Number.isInteger(r.photoCount) ||
      r.photoCount < 0 ||
      !Number.isInteger(r.videoCount) ||
      r.videoCount < 0 ||
      !(r.coverPath === null || typeof r.coverPath === "string")
    )
      return fail();
  }
  if (
    p.nextCursor !== null &&
    (!p.rows.length ||
      typeof p.nextCursor !== "string" ||
      p.nextCursor.length > 180)
  )
    return fail();
  if (
    new Set((p.rows as ProfileContentRow[]).map((row) => row.id)).size !==
    p.rows.length
  )
    return fail();
  if (typeof p.nextCursor === "string") {
    const divider = p.nextCursor.lastIndexOf("|");
    const last = p.rows.at(-1) as ProfileContentRow;
    if (
      divider <= 0 ||
      p.nextCursor.slice(divider + 1) !== last.id ||
      Date.parse(p.nextCursor.slice(0, divider)) !== Date.parse(last.startsAt)
    )
      return fail();
  }
  return p as unknown as ProfileContentPage;
}
