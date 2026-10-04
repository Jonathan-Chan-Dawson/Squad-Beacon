import type { Activity, Data, ID, Payload } from "@/src/shared/types";
import { canManageBeacon } from "@/src/features/beacons/permissions";
import {
  canReadBeaconModuleEntry,
  canUseBeaconModules,
} from "@/src/features/beacons/beaconModules";
import { canViewProfile } from "@/src/features/profile/privacy";

export const MAX_BEACON_TEAMS = 8;
export const MAX_BEACON_MEMORIES = 50;
export const MAX_TEAM_SIZE = 24;
export const MAX_TEAM_NAME_LENGTH = 36;
export const MAX_MEMORY_CAPTION_LENGTH = 500;
export const MAX_MEMORY_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_MEMORY_VIDEO_BYTES = 24 * 1024 * 1024;
export const MAX_MEMORY_VIDEO_SECONDS = 30;
// TODO: Keep Games out of the Beacon module UI until a separate interaction is scoped.

export type BeaconMemoryMediaType = "image" | "video";

export interface BeaconTeam {
  id: ID;
  activity_id: ID;
  name: string;
  score: number;
  created_at: string;
  /** Server-projected eligible occupancy; does not reveal hidden member identities. */
  member_count?: number;
}

export interface BeaconTeamMember {
  team_id: ID;
  user_id: ID;
  joined_at: string;
}

/** A reference to private storage; never put a public or signed URL in a snapshot. */
export interface BeaconMemory {
  id: ID;
  activity_id: ID;
  author_id: ID;
  object_path: string;
  media_type: BeaconMemoryMediaType;
  duration_seconds: number | null;
  caption: string;
  created_at: string;
  updated_at: string;
}

type ModuleData = Data & {
  beacon_teams: BeaconTeam[];
  beacon_team_members: BeaconTeamMember[];
  beacon_memories: BeaconMemory[];
};

type ScoreboardActivity = Activity & {
  enable_scoreboard?: boolean;
  scoreboard_max_team_size?: number | null;
  enable_experiences?: boolean;
};

function moduleData(data: Data): ModuleData {
  return data as ModuleData;
}

function canManage(data: Data, activity: Activity, userId: ID) {
  return data.viewer_id === userId && canManageBeacon(data, activity, userId);
}

function canUse(data: Data, activity: Activity, userId: ID) {
  return (
    data.viewer_id === userId && canUseBeaconModules(data, activity, userId)
  );
}

/** Demo-only domain action implementation; no storage/network effects. */
export function applyDemoBeaconMediaTeamAction(
  data: Data,
  action: string,
  payload: Payload,
  userId: ID,
): boolean {
  const state = moduleData(data);
  const activityId = String(payload.activity_id ?? "");
  const activity = data.activities.find((item) => item.id === activityId) as
    ScoreboardActivity | undefined;
  const teamId = String(payload.team_id ?? "");
  const team = state.beacon_teams.find((item) => item.id === teamId);
  const teamActivity = team
    ? (data.activities.find((item) => item.id === team.activity_id) as
        ScoreboardActivity | undefined)
    : undefined;

  if (
    action === "save_beacon_scoreboard" &&
    activity &&
    canManage(data, activity, userId)
  ) {
    const enabled = payload.enabled === true;
    const maxTeamSize =
      payload.max_team_size == null ? null : Number(payload.max_team_size);
    if (
      maxTeamSize != null &&
      (!Number.isInteger(maxTeamSize) ||
        maxTeamSize < 1 ||
        maxTeamSize > MAX_TEAM_SIZE)
    )
      throw new Error(`Choose a team size from 1 to ${MAX_TEAM_SIZE}.`);
    activity.enable_scoreboard = enabled;
    activity.scoreboard_max_team_size = maxTeamSize;
    return true;
  }

  if (
    action === "create_beacon_team" &&
    activity &&
    activity.enable_scoreboard &&
    canManage(data, activity, userId)
  ) {
    const name = String(payload.name ?? "").trim();
    if (!name || name.length > MAX_TEAM_NAME_LENGTH)
      throw new Error(
        `Team names must be 1–${MAX_TEAM_NAME_LENGTH} characters.`,
      );
    const existing = teamsForActivity(data, activity.id);
    const id = String(payload.id ?? "");
    if (!id) throw new Error("Refresh before creating a team.");
    const retry = state.beacon_teams.find((item) => item.id === id);
    if (retry) {
      if (retry.activity_id === activity.id && retry.name === name) return true;
      throw new Error("That team id is already in use.");
    }
    if (existing.length >= MAX_BEACON_TEAMS)
      throw new Error(`A Beacon can have up to ${MAX_BEACON_TEAMS} teams.`);
    if (
      existing.some(
        (item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw new Error("Choose a different team name.");
    state.beacon_teams.push({
      id,
      activity_id: activity.id,
      name,
      score: 0,
      created_at: new Date().toISOString(),
    });
    return true;
  }

  if (
    action === "rename_beacon_team" &&
    team &&
    teamActivity &&
    canManage(data, teamActivity, userId)
  ) {
    const name = String(payload.name ?? "").trim();
    if (!name || name.length > MAX_TEAM_NAME_LENGTH)
      throw new Error(
        `Team names must be 1–${MAX_TEAM_NAME_LENGTH} characters.`,
      );
    if (
      teamsForActivity(data, team.activity_id).some(
        (item) =>
          item.id !== team.id &&
          item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      throw new Error("Choose a different team name.");
    team.name = name;
    return true;
  }

  if (
    action === "remove_beacon_team" &&
    team &&
    teamActivity &&
    canManage(data, teamActivity, userId)
  ) {
    state.beacon_teams = state.beacon_teams.filter(
      (item) => item.id !== team.id,
    );
    state.beacon_team_members = state.beacon_team_members.filter(
      (item) => item.team_id !== team.id,
    );
    return true;
  }

  if (
    action === "join_beacon_team" &&
    team &&
    teamActivity &&
    teamActivity.enable_scoreboard &&
    teamActivity.status === "scheduled" &&
    canUse(data, teamActivity, userId)
  ) {
    const current = state.beacon_team_members.find(
      (item) => item.team_id === team.id && item.user_id === userId,
    );
    if (current) return true;
    const activeMembers = state.beacon_team_members.filter((member) =>
      eligibleTeamMember(data, teamActivity, member.user_id, userId),
    );
    if (
      activeMembers.some(
        (item) =>
          item.user_id === userId &&
          state.beacon_teams.some(
            (joinedTeam) =>
              joinedTeam.id === item.team_id &&
              joinedTeam.activity_id === team.activity_id,
          ),
      )
    )
      throw new Error("Leave your current team before joining another.");
    const maxSize = teamActivity.scoreboard_max_team_size;
    if (
      maxSize != null &&
      teamOccupancyCount(data, team, teamActivity) >= maxSize
    )
      throw new Error("This team is full.");
    const previousCount = teamOccupancyCount(data, team, teamActivity);
    state.beacon_team_members.push({
      team_id: team.id,
      user_id: userId,
      joined_at: new Date().toISOString(),
    });
    team.member_count = previousCount + 1;
    return true;
  }

  if (action === "leave_beacon_team" && team && teamActivity) {
    if (data.viewer_id !== userId)
      throw new Error("Refresh your Beacon first.");
    state.beacon_team_members = state.beacon_team_members.filter(
      (item) => !(item.team_id === team.id && item.user_id === userId),
    );
    if (team.member_count != null)
      team.member_count = Math.max(0, team.member_count - 1);
    return true;
  }

  if (
    action === "adjust_beacon_team_score" &&
    team &&
    teamActivity &&
    teamActivity.enable_scoreboard &&
    canManage(data, teamActivity, userId)
  ) {
    const delta = Number(payload.delta);
    if (delta !== 1 && delta !== -1)
      throw new Error("Scores can change by one point at a time.");
    team.score = Math.max(0, Math.min(9999, team.score + delta));
    return true;
  }

  if (
    action === "create_beacon_memory" &&
    activity &&
    activity.enable_experiences !== false &&
    activity.status !== "cancelled" &&
    canUse(data, activity, userId)
  ) {
    const objectPath = String(payload.object_path ?? "");
    const mediaType = payload.media_type;
    const duration =
      payload.duration_seconds == null
        ? null
        : Number(payload.duration_seconds);
    const caption = String(payload.caption ?? "").trim();
    if (
      !objectPath.startsWith(`demo://${activity.id}/${userId}/`) ||
      (mediaType !== "image" && mediaType !== "video")
    )
      throw new Error("Choose a photo or video for this Beacon memory.");
    if (caption.length > MAX_MEMORY_CAPTION_LENGTH)
      throw new Error(
        `Captions must be ${MAX_MEMORY_CAPTION_LENGTH} characters or less.`,
      );
    if (
      duration != null &&
      (!Number.isFinite(duration) ||
        duration < 0 ||
        duration > MAX_MEMORY_VIDEO_SECONDS)
    )
      throw new Error(
        `Videos must be ${MAX_MEMORY_VIDEO_SECONDS} seconds or shorter.`,
      );
    const id = String(payload.id ?? "");
    if (!id) throw new Error("Refresh before adding a memory.");
    const retry = state.beacon_memories.find((item) => item.id === id);
    if (retry) {
      if (
        retry.activity_id === activity.id &&
        retry.author_id === userId &&
        retry.object_path === objectPath &&
        retry.media_type === mediaType &&
        retry.duration_seconds === duration &&
        retry.caption === caption
      )
        return true;
      throw new Error("That memory id is already in use.");
    }
    if (
      state.beacon_memories.filter((item) => item.activity_id === activity.id)
        .length >= MAX_BEACON_MEMORIES
    )
      throw new Error(
        `A Beacon can have up to ${MAX_BEACON_MEMORIES} memories.`,
      );
    state.beacon_memories.push({
      id,
      activity_id: activity.id,
      author_id: userId,
      object_path: objectPath,
      media_type: mediaType,
      duration_seconds: duration,
      caption,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return true;
  }

  if (action === "update_beacon_memory" || action === "delete_beacon_memory") {
    const id = String(payload.id ?? "");
    const memory = state.beacon_memories.find((item) => item.id === id);
    const memoryActivity = data.activities.find(
      (item) => item.id === memory?.activity_id,
    );
    if (!memory || !memoryActivity || !canUse(data, memoryActivity, userId))
      throw new Error("That Beacon memory is unavailable.");
    if (memory.author_id !== userId && !canManage(data, memoryActivity, userId))
      throw new Error(
        "Only the creator or a Beacon manager can change this memory.",
      );
    if (action === "delete_beacon_memory") {
      state.beacon_memories = state.beacon_memories.filter(
        (item) => item.id !== memory.id,
      );
      return true;
    }
    const caption = String(payload.caption ?? "").trim();
    if (caption.length > MAX_MEMORY_CAPTION_LENGTH)
      throw new Error(
        `Captions must be ${MAX_MEMORY_CAPTION_LENGTH} characters or less.`,
      );
    memory.caption = caption;
    memory.updated_at = new Date().toISOString();
    return true;
  }

  return false;
}

export function teamsForActivity(data: Data, activityId: ID) {
  return data.beacon_teams
    .filter((team) => team.activity_id === activityId)
    .sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id),
    );
}

export function membersForTeam(data: Data, teamId: ID) {
  return data.beacon_team_members
    .filter((member) => member.team_id === teamId)
    .sort(
      (left, right) =>
        left.joined_at.localeCompare(right.joined_at) ||
        left.user_id.localeCompare(right.user_id),
    );
}

function eligibleTeamMember(
  data: Data,
  activity: Activity,
  memberId: ID,
  viewerId: ID,
) {
  if (memberId === activity.owner_id)
    return !isBlocked(data, memberId, viewerId);
  const rsvp = data.rsvps.find(
    (item) => item.activity_id === activity.id && item.user_id === memberId,
  );
  return !!(
    !isBlocked(data, memberId, activity.owner_id) &&
    !isBlocked(data, memberId, viewerId) &&
    rsvp?.status === "going" &&
    (rsvp.approved ||
      !(activity.approval_required || activity.mode === "invite"))
  );
}

function occupiesTeamSlot(data: Data, activity: Activity, memberId: ID) {
  if (memberId === activity.owner_id) return true;
  const rsvp = data.rsvps.find(
    (item) => item.activity_id === activity.id && item.user_id === memberId,
  );
  return !!(
    !isBlocked(data, memberId, activity.owner_id) &&
    rsvp?.status === "going" &&
    (rsvp.approved ||
      !(activity.approval_required || activity.mode === "invite"))
  );
}

function isBlocked(data: Data, left: ID, right: ID) {
  return data.blocks.some(
    (block) =>
      (block.blocker_id === left && block.blocked_id === right) ||
      (block.blocker_id === right && block.blocked_id === left),
  );
}

export function canJoinTeam(
  data: Data,
  activity: Activity,
  teamId: ID,
  userId: ID,
  maxTeamSize: number | null,
) {
  if (
    data.viewer_id !== userId ||
    activity.status !== "scheduled" ||
    (activity as ScoreboardActivity).enable_scoreboard !== true ||
    !canUse(data, activity, userId)
  )
    return false;
  const team = data.beacon_teams.find(
    (item) => item.id === teamId && item.activity_id === activity.id,
  );
  if (!team) return false;
  const members = membersForTeam(data, teamId);
  const eligibleCount = teamOccupancyCount(data, team, activity);
  if (
    members.some((member) => member.user_id === userId) ||
    data.beacon_team_members.some(
      (member) =>
        member.user_id === userId &&
        eligibleTeamMember(data, activity, member.user_id, userId) &&
        data.beacon_teams.some(
          (other) =>
            other.id === member.team_id && other.activity_id === activity.id,
        ),
    )
  )
    return false;
  if (maxTeamSize != null && team.member_count == null && data.is_demo !== true)
    return false;
  return maxTeamSize == null || eligibleCount < maxTeamSize;
}

export function teamOccupancyCount(
  data: Data,
  team: BeaconTeam,
  activity: Activity,
) {
  if (data.is_demo === true)
    return membersForTeam(data, team.id).filter((member) =>
      occupiesTeamSlot(data, activity, member.user_id),
    ).length;
  return team.member_count ?? membersForTeam(data, team.id).length;
}

export function mediaForActivity(data: Data, activityId: ID) {
  return data.beacon_memories
    .filter((memory) => memory.activity_id === activityId)
    .sort(
      (left, right) =>
        right.created_at.localeCompare(left.created_at) ||
        left.id.localeCompare(right.id),
    );
}

export function canReadMemory(
  data: Data,
  activity: Activity,
  memory: BeaconMemory,
  userId: ID,
) {
  return !!(
    data.viewer_id === userId &&
    (activity as ScoreboardActivity).enable_experiences === true &&
    memory.activity_id === activity.id &&
    data.beacon_memories.some(
      (item) =>
        item.id === memory.id &&
        item.activity_id === activity.id &&
        item.author_id === memory.author_id &&
        item.object_path === memory.object_path,
    ) &&
    canViewProfile(data, memory.author_id, userId) &&
    canReadBeaconModuleEntry(data, activity, memory.author_id, userId)
  );
}

export function canManageMemory(data: Data, memory: BeaconMemory, userId: ID) {
  const activity = data.activities.find(
    (item) => item.id === memory.activity_id,
  ) as ScoreboardActivity | undefined;
  return !!(
    activity &&
    activity.status !== "cancelled" &&
    memory.author_id === userId &&
    canReadMemory(data, activity, memory, userId)
  );
}
