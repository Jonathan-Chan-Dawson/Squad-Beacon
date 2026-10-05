import type {
  BeaconMemory,
  BeaconTeam,
  BeaconTeamMember,
} from "@/src/features/beacons/models";
import type {
  GroupMessage,
  GroupMessageRead,
  Organization,
  OrganizationBan,
  OrganizationMember,
  OrganizationSquad,
} from "@/src/features/organizations/types";
import type {
  Space,
  SpaceBan,
  SpaceMember,
  SpaceSquad,
} from "@/src/features/spaces/types";
import type { PlanMember, PlanRoutine } from "@/src/features/plans/routines";
import type {
  ActivitySocialLink,
  OrganizationSpace,
  SquadBan,
  SquadJoinRequest,
} from "@/src/features/social/types";

export type ID = string;
export type Audience =
  "private" | "friends" | "list" | "squad" | "organization";
export type Mode = "solo" | "squad" | "invite";
export type Category =
  "Fitness" | "Study" | "Gaming" | "Creative" | "Social" | "Other";
export interface AspirationGoal {
  id: ID;
  title: string;
  category: string;
  target_per_week: number;
}
export interface Profile {
  profile_visibility?: "public" | "friends" | "custom";
  /** Server-computed for this snapshot viewer; never accepted as a write field. */
  viewer_can_view_full_profile?: boolean;
  /** A privacy-filtered featured beacon id for non-owner profile projections. */
  viewer_featured_activity_id?: ID | null;
  avatar_seed?: number;
  avatar_style?: "illustrated" | "photo";
  home?: string;
  birthday_note?: string;
  aspirations?: string;
  personality?: string;
  quote?: string;
  default_audience?: "private" | "friends";

  avatar_updated_at?: string | null;
  id: ID;
  username: string;
  name: string;
  bio: string;
  interests: string[];
  identity_tags: string[];
  aspiration_goals: AspirationGoal[];
  onboarding_survey_status: "pending" | "skipped" | "completed";
  featured_activity_id: ID | null;
  hide_featured: boolean;
  timezone: string;
  quiet_start: number;
  quiet_end: number;
}
export interface Friendship {
  id: ID;
  sender_id: ID;
  recipient_id: ID;
  status: "pending" | "accepted";
}
export interface FriendList {
  id: ID;
  owner_id: ID;
  name: string;
}
export interface ListMember {
  list_id: ID;
  user_id: ID;
}
export interface Squad {
  id: ID;
  owner_id: ID;
  name: string;
  description: string;
  space_type?: string;
  discoverability?: "public" | "community" | "private";
  join_mode?: "open" | "request" | "invite";
  invite_policy?: "admins" | "elders" | "members";
  archived_at?: string | null;
}
export interface SquadMember {
  squad_id: ID;
  user_id: ID;
  role: "owner" | "coowner" | "admin" | "elder" | "member";
}
export interface SquadInvite {
  id: ID;
  squad_id: ID;
  sender_id: ID;
  recipient_id: ID;
}
export interface Shared {
  audience: Audience;
  audience_id: ID | null;
}
export interface Goal extends Shared {
  id: ID;
  owner_id: ID;
  title: string;
  description: string;
  target_date: string | null;
  progress: number;
}
export interface Milestone {
  id: ID;
  goal_id: ID;
  title: string;
  done: boolean;
}
export interface Habit extends Shared {
  id: ID;
  owner_id: ID;
  title: string;
  goal_id: ID | null;
  schedule: "days" | "weekly";
  weekdays: number[];
  weekly_target: number;
  timezone: string;
  reminder_hour: number | null;
}
export interface Checkin {
  id: ID;
  habit_id: ID;
  owner_id: ID;
  local_date: string;
}
export interface Activity extends Shared {
  available?: boolean;
  /** Snapshot projection for the authenticated viewer; never accepted as write input. */
  viewer_can_access?: boolean;
  /** Authoritative host + accepted-Going count from the current snapshot. */
  accepted_seat_count?: number;
  description?: string;
  target_count?: number | null;
  capacity_limit?: number | null;
  capacity_policy?: "soft" | "strict";
  manual_closed?: boolean;
  enable_chat?: boolean;
  enable_checklist?: boolean;
  enable_journal?: boolean;
  enable_experiences?: boolean;
  enable_focus?: boolean;
  enable_reactions?: boolean;
  enable_comments?: boolean;
  enable_scoreboard?: boolean;
  scoreboard_max_team_size?: number | null;
  enable_music?: boolean;
  checklist_edit_policy?: "participants" | "managers";
  music_url?: string | null;
  decoration_emoji?: string | null;
  decoration_accent?: string | null;
  id: ID;
  owner_id: ID;
  title: string;
  category: Category;
  mode: Mode;
  starts_at: string;
  ends_at: string;
  timezone: string;
  approval_required: boolean;
  status: "scheduled" | "completed" | "cancelled";
  goal_id: ID | null;
  habit_id: ID | null;
  plan_id: ID | null;
  plan_step_index: number | null;
  aspiration_ids: ID[];
}
export interface PlanStep {
  title: string;
  description: string;
  category: Category;
  location_name: string;
  lat: number | null;
  lng: number | null;
  day_offset: number;
  start_time: string;
  duration_minutes: number;
  aspiration_ids?: ID[];
}
export interface Plan {
  id: ID;
  owner_id: ID;
  squad_id: ID | null;
  title: string;
  description: string;
  timezone: string;
  start_date: string;
  status: "scheduled" | "cancelled";
  created_at: string;
}
export interface PlanTemplate {
  id: ID;
  owner_id: ID;
  squad_id: ID | null;
  title: string;
  description: string;
  timezone: string;
  steps: PlanStep[];
  created_at: string;
  updated_at: string;
}
export interface ActivityPlace {
  activity_id: ID;
  label: string;
  latitude: number | null;
  longitude: number | null;
  online_url: string | null;
}
export interface RSVP {
  activity_id: ID;
  user_id: ID;
  status: "interested" | "going" | "requested" | "invited";
  approved: boolean;
}
export interface BeaconAttendance {
  activity_id: ID;
  user_id: ID;
  state: "none" | "arriving" | "present";
  updated_at: string;
}
export interface Comment {
  id: ID;
  activity_id: ID;
  author_id: ID;
  body: string;
  created_at: string;
}
export interface Reaction {
  activity_id: ID;
  user_id: ID;
  emoji: string;
}
export interface LocationSession {
  id: ID;
  owner_id: ID;
  expires_at: string;
  latitude: number | null;
  longitude: number | null;
  updated_at: string | null;
}
export interface Notice {
  id: ID;
  recipient_id: ID;
  body: string;
  activity_id: ID | null;
  created_at: string;
  read_at: string | null;
}
export interface Report {
  id: ID;
  reporter_id: ID;
  subject_id: ID;
  reason: string;
  created_at: string;
  resolved: boolean;
}
export interface PersonalTemplate {
  id: ID;
  owner_id: ID;
  name: string;
  title: string;
  description: string;
  category: Category;
  minutes: number;
  label: string;
  target_count: number | null;
  approval_required: boolean;
  module_defaults?: Partial<BeaconModuleDefaults> | null;
}
export interface BeaconModuleDefaults {
  enable_chat: boolean;
  enable_checklist: boolean;
  enable_journal: boolean;
  enable_experiences: boolean;
  enable_focus: boolean;
  enable_scoreboard: boolean;
  enable_comments: boolean;
  enable_music: boolean;
}
export interface Message {
  id: ID;
  author_id: ID;
  activity_id: ID | null;
  recipient_id: ID | null;
  body: string;
  created_at: string;
}
export interface BeaconChecklistItem {
  id: ID;
  activity_id: ID;
  author_id: ID;
  text: string;
  completed: boolean;
  section_id: ID | null;
  assignee_id: ID | null;
  created_at: string;
  updated_at: string;
}
export interface BeaconChecklistSection {
  id: ID;
  activity_id: ID;
  title: string;
  position: number;
  created_at: string;
}
export interface BeaconNote {
  id: ID;
  activity_id: ID | null;
  author_id: ID;
  section_heading: string;
  body: string;
  visibility: "private" | "shared";
  revision: number;
  created_at: string;
  updated_at: string;
}
export type LibraryKind = "journal" | "checklist";
export interface ChecklistCopySection {
  id: ID;
  title: string;
  position: number;
}
export interface ChecklistCopyItem {
  id: ID;
  text: string;
  completed: boolean;
  section_id: ID | null;
  assignee_id: ID | null;
}
export interface LibrarySavedChecklist {
  id: ID;
  owner_id: ID;
  source_activity_id: ID | null;
  title: string;
  sections: ChecklistCopySection[];
  items: ChecklistCopyItem[];
  revision: number;
  created_at: string;
  updated_at: string;
}
/** resource_id names a private beacon note for journal, saved checklist for checklist. */
export interface LibraryResourceFolder {
  owner_id: ID;
  kind: LibraryKind;
  resource_id: ID;
  folder_id: ID;
  updated_at: string;
}
export interface LibraryFolder {
  id: ID;
  owner_id: ID;
  kind: LibraryKind;
  name: string;
  parent_id: ID | null;
  created_at: string;
  updated_at: string;
}
export interface LibraryFolderItem {
  owner_id: ID;
  kind: LibraryKind;
  activity_id: ID;
  folder_id: ID;
  updated_at: string;
}
export interface BeaconFavorite {
  owner_id: ID;
  activity_id: ID;
  created_at: string;
}
export type PlanningThreadKind = "ping" | "vote" | "draw";
export type PlanningThreadStatus =
  "open" | "resolved" | "no_options" | "expired" | "cancelled";
export type PlanningResponse = "interested" | "maybe" | "pass";
export interface BeaconDraft {
  title: string;
  description: string;
  category: Category;
  mode: "squad" | "invite";
  starts_at: string;
  ends_at: string;
  timezone: string;
  approval_required: boolean;
  audience: Audience;
  audience_id: ID | null;
  target_count: number | null;
  label: string;
  online_url: string | null;
  latitude: number | null;
  longitude: number | null;
  aspiration_ids: ID[];
}
export interface PlanningThread {
  id: ID;
  owner_id: ID;
  coowner_ids: ID[];
  kind: PlanningThreadKind;
  title: string;
  body: string;
  audience: Audience;
  audience_id: ID | null;
  deadline_at: string;
  status: PlanningThreadStatus;
  payload: BeaconDraft | null;
  winner_proposal_id: ID | null;
  replaced_from_proposal_id: ID | null;
  materialized_activity_id: ID | null;
  created_at: string;
  resolved_at: string | null;
}
export interface PlanningPingResponse {
  thread_id: ID;
  user_id: ID;
  response: PlanningResponse;
  auto_rsvp: boolean;
  created_at: string;
  updated_at: string;
}
export interface PlanningProposal {
  id: ID;
  thread_id: ID;
  author_id: ID;
  payload: BeaconDraft;
  approved: boolean;
  disqualified_at: string | null;
  created_at: string;
  activity_id: ID | null;
}
export interface PlanningVote {
  thread_id: ID;
  proposal_id: ID;
  user_id: ID;
  created_at: string;
  updated_at?: string;
}
export interface BeaconRole {
  activity_id: ID;
  user_id: ID;
  role: "coowner" | "admin";
  assigned_by: ID;
  created_at: string;
}
export interface BeaconInvitationGrant {
  activity_id: ID;
  user_id: ID;
  invited_by: ID;
  created_at: string;
}
export interface ProfileVisibilityGrant {
  owner_id: ID;
  kind: "person" | "squad" | "list" | "organization";
  target_id: ID;
}
export interface Data {
  plan_members: PlanMember[];
  plan_routines: PlanRoutine[];
  organizations: Organization[];
  organization_members: OrganizationMember[];
  organization_squads: OrganizationSquad[];
  organization_spaces: OrganizationSpace[];
  organization_bans: OrganizationBan[];
  group_messages: GroupMessage[];
  group_message_reads: GroupMessageRead[];
  spaces: Space[];
  space_members: SpaceMember[];
  space_squads: SpaceSquad[];
  space_bans: SpaceBan[];
  squad_bans: SquadBan[];
  squad_join_requests: SquadJoinRequest[];
  activity_social_links: ActivitySocialLink[];
  beacon_teams: BeaconTeam[];
  beacon_team_members: BeaconTeamMember[];
  beacon_memories: BeaconMemory[];
  beacon_favorites: BeaconFavorite[];
  favorites: {
    owner_id: string;
    kind: "friend" | "squad";
    target_id: string;
  }[];
  templates: PersonalTemplate[];
  plans: Plan[];
  plan_templates: PlanTemplate[];
  messages: Message[];
  beacon_checklist_items: BeaconChecklistItem[];
  beacon_checklist_sections: BeaconChecklistSection[];
  beacon_notes: BeaconNote[];
  library_saved_checklists: LibrarySavedChecklist[];
  library_resource_folders: LibraryResourceFolder[];
  library_folders: LibraryFolder[];
  library_folder_items: LibraryFolderItem[];
  planning_threads: PlanningThread[];
  planning_ping_responses: PlanningPingResponse[];
  planning_proposals: PlanningProposal[];
  planning_votes: PlanningVote[];
  beacon_roles: BeaconRole[];
  beacon_attendance: BeaconAttendance[];
  beacon_invitation_grants: BeaconInvitationGrant[];
  /** Private selection data; the signed-in snapshot only returns the viewer's own rows. */
  profile_visibility_grants: ProfileVisibilityGrant[];

  is_moderator?: boolean;
  is_demo?: boolean;
  viewer_id?: ID | null;
  location_recipients?: string[];
  /** Demo-only mirror of server-private kicked-attendee exclusions. */
  activity_exclusions: { activity_id: ID; user_id: ID }[];
  profiles: Profile[];
  friendships: Friendship[];
  lists: FriendList[];
  list_members: ListMember[];
  squads: Squad[];
  squad_members: SquadMember[];
  squad_invites: SquadInvite[];
  goals: Goal[];
  milestones: Milestone[];
  habits: Habit[];
  checkins: Checkin[];
  activities: Activity[];
  places: ActivityPlace[];
  rsvps: RSVP[];
  comments: Comment[];
  reactions: Reaction[];
  locations: LocationSession[];
  notices: Notice[];
  reports: Report[];
  blocks: { blocker_id: ID; blocked_id: ID }[];
}
export type Payload = Record<string, unknown>;
export const emptyData = (): Data => ({
  plan_members: [],
  plan_routines: [],
  organizations: [],
  organization_members: [],
  organization_squads: [],
  organization_spaces: [],
  organization_bans: [],
  group_messages: [],
  group_message_reads: [],
  spaces: [],
  space_members: [],
  space_squads: [],
  space_bans: [],
  squad_bans: [],
  squad_join_requests: [],
  activity_social_links: [],
  beacon_teams: [],
  beacon_team_members: [],
  beacon_memories: [],
  beacon_favorites: [],
  favorites: [],
  templates: [],
  plans: [],
  plan_templates: [],
  messages: [],
  beacon_checklist_items: [],
  beacon_checklist_sections: [],
  beacon_notes: [],
  library_saved_checklists: [],
  library_resource_folders: [],
  library_folders: [],
  library_folder_items: [],
  planning_threads: [],
  planning_ping_responses: [],
  planning_proposals: [],
  planning_votes: [],
  beacon_roles: [],
  beacon_attendance: [],
  beacon_invitation_grants: [],
  profile_visibility_grants: [],
  is_demo: false,
  viewer_id: null,
  activity_exclusions: [],
  profiles: [],
  friendships: [],
  lists: [],
  list_members: [],
  squads: [],
  squad_members: [],
  squad_invites: [],
  goals: [],
  milestones: [],
  habits: [],
  checkins: [],
  activities: [],
  places: [],
  rsvps: [],
  comments: [],
  reactions: [],
  locations: [],
  notices: [],
  reports: [],
  blocks: [],
});

/** Fill fields introduced by later snapshots while keeping legacy accounts usable. */
export function normalizeData(value: Partial<Data> | null | undefined): Data {
  const hasInvitationGrantRows = Array.isArray(value?.beacon_invitation_grants);
  const data = { ...emptyData(), ...(value ?? {}) } as Data;
  data.plan_members = Array.isArray(data.plan_members) ? data.plan_members : [];
  data.plan_routines = Array.isArray(data.plan_routines)
    ? data.plan_routines
    : [];
  data.profiles = (Array.isArray(data.profiles) ? data.profiles : []).map(
    (profile) => ({
      ...profile,
      profile_visibility: profile.profile_visibility ?? "public",
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      identity_tags: Array.isArray(profile.identity_tags)
        ? profile.identity_tags
        : [],
      aspiration_goals: Array.isArray(profile.aspiration_goals)
        ? profile.aspiration_goals
        : [],
      // Pre-survey profiles already use the app and should not be gated.
      onboarding_survey_status: profile.onboarding_survey_status ?? "skipped",
    }),
  );
  data.activities = (Array.isArray(data.activities) ? data.activities : []).map(
    (activity) => ({
      ...activity,
      plan_id: activity.plan_id ?? null,
      plan_step_index: activity.plan_step_index ?? null,
      aspiration_ids: Array.isArray(activity.aspiration_ids)
        ? activity.aspiration_ids
        : [],
      capacity_limit: activity.capacity_limit ?? null,
      capacity_policy: activity.capacity_policy ?? "soft",
      manual_closed: activity.manual_closed ?? false,
      enable_chat: activity.enable_chat ?? true,
      enable_checklist: activity.enable_checklist ?? true,
      enable_journal: activity.enable_journal ?? true,
      enable_experiences: activity.enable_experiences ?? true,
      enable_focus: activity.enable_focus ?? true,
      enable_reactions: activity.enable_reactions ?? true,
      enable_comments:
        activity.enable_comments ?? activity.enable_experiences ?? true,
      enable_scoreboard: activity.enable_scoreboard ?? false,
      enable_music: activity.enable_music ?? !!activity.music_url,
      scoreboard_max_team_size:
        activity.scoreboard_max_team_size == null
          ? null
          : Number.isInteger(activity.scoreboard_max_team_size) &&
              activity.scoreboard_max_team_size >= 1 &&
              activity.scoreboard_max_team_size <= 24
            ? activity.scoreboard_max_team_size
            : null,
      checklist_edit_policy: activity.checklist_edit_policy ?? "participants",
      music_url: activity.music_url ?? null,
      decoration_emoji: activity.decoration_emoji ?? null,
      decoration_accent: activity.decoration_accent ?? null,
    }),
  );
  data.rsvps = Array.isArray(data.rsvps) ? data.rsvps : [];
  data.beacon_invitation_grants = hasInvitationGrantRows
    ? data.beacon_invitation_grants
    : data.rsvps.flatMap((rsvp) => {
        if (rsvp.status !== "invited") return [];
        const activity = data.activities.find(
          (item) => item.id === rsvp.activity_id,
        );
        return activity
          ? [
              {
                activity_id: rsvp.activity_id,
                user_id: rsvp.user_id,
                invited_by: activity.owner_id,
                created_at: "",
              },
            ]
          : [];
      });
  data.profile_visibility_grants = Array.isArray(data.profile_visibility_grants)
    ? data.profile_visibility_grants
    : [];
  data.organizations = (Array.isArray(data.organizations)
    ? data.organizations
    : []).map((organization) => ({
    ...organization,
    discoverability: organization.discoverability ?? "private",
    join_mode: organization.join_mode ?? "invite",
    invite_policy: organization.invite_policy ?? "admins",
    archived_at: organization.archived_at ?? null,
  }));
  data.organization_members = Array.isArray(data.organization_members)
    ? data.organization_members
    : [];
  data.organization_squads = Array.isArray(data.organization_squads)
    ? data.organization_squads
    : [];
  data.organization_spaces = Array.isArray(data.organization_spaces)
    ? data.organization_spaces
    : [];
  data.organization_bans = Array.isArray(data.organization_bans)
    ? data.organization_bans
    : [];
  data.group_messages = Array.isArray(data.group_messages)
    ? data.group_messages
    : [];
  data.group_message_reads = Array.isArray(data.group_message_reads)
    ? data.group_message_reads
    : [];
  data.spaces = (Array.isArray(data.spaces) ? data.spaces : []).map((space) => ({
    ...space,
    space_type: space.space_type ?? "other",
    discoverability: space.discoverability ?? "private",
    join_mode: space.join_mode ?? "invite",
    invite_policy: space.invite_policy ?? "admins",
    archived_at: space.archived_at ?? null,
  }));
  data.space_members = Array.isArray(data.space_members)
    ? data.space_members
    : [];
  data.space_squads = Array.isArray(data.space_squads)
    ? data.space_squads
    : [];
  data.space_bans = Array.isArray(data.space_bans) ? data.space_bans : [];
  data.squad_bans = Array.isArray(data.squad_bans) ? data.squad_bans : [];
  data.squad_join_requests = Array.isArray(data.squad_join_requests)
    ? data.squad_join_requests
    : [];
  data.activity_social_links = Array.isArray(data.activity_social_links)
    ? data.activity_social_links
    : [];
  data.squads = (Array.isArray(data.squads) ? data.squads : []).map((squad) => ({
    ...squad,
    discoverability: squad.discoverability ?? "private",
    join_mode: squad.join_mode ?? "invite",
    invite_policy: squad.invite_policy ?? "admins",
    archived_at: squad.archived_at ?? null,
  }));
  data.activity_exclusions = Array.isArray(data.activity_exclusions)
    ? data.activity_exclusions
    : [];
  data.plans = Array.isArray(data.plans) ? data.plans : [];
  data.plan_templates = Array.isArray(data.plan_templates)
    ? data.plan_templates
    : [];
  data.beacon_checklist_items = Array.isArray(data.beacon_checklist_items)
    ? data.beacon_checklist_items.map((item) => ({
        ...item,
        section_id: item.section_id ?? null,
        assignee_id: item.assignee_id ?? null,
        updated_at: item.updated_at ?? item.created_at,
      }))
    : [];
  data.beacon_checklist_sections = Array.isArray(data.beacon_checklist_sections)
    ? data.beacon_checklist_sections
    : [];
  data.beacon_notes = (
    Array.isArray(data.beacon_notes) ? data.beacon_notes : []
  ).map((note) => ({
    ...note,
    section_heading: note.section_heading ?? "",
    // Existing rows were shared notes; new inserts explicitly default private.
    visibility: note.visibility ?? "shared",
    revision: Number.isInteger(note.revision) ? note.revision : 0,
    updated_at: note.updated_at ?? note.created_at,
  }));
  data.library_folders = Array.isArray(data.library_folders)
    ? data.library_folders.map((folder) => ({
        ...folder,
        parent_id: folder.parent_id ?? null,
      }))
    : [];
  data.library_folder_items = Array.isArray(data.library_folder_items)
    ? data.library_folder_items
    : [];
  data.library_saved_checklists = Array.isArray(data.library_saved_checklists)
    ? data.library_saved_checklists
    : [];
  data.library_resource_folders = Array.isArray(data.library_resource_folders)
    ? data.library_resource_folders
    : [];
  data.beacon_favorites = Array.isArray(data.beacon_favorites)
    ? data.beacon_favorites
    : [];
  data.beacon_teams = Array.isArray(data.beacon_teams)
    ? data.beacon_teams.map((team) => ({
        ...team,
        member_count:
          Number.isInteger(team.member_count) && (team.member_count ?? -1) >= 0
            ? team.member_count
            : undefined,
      }))
    : [];
  data.beacon_team_members = Array.isArray(data.beacon_team_members)
    ? data.beacon_team_members
    : [];
  data.beacon_memories = Array.isArray(data.beacon_memories)
    ? data.beacon_memories
    : [];
  data.planning_threads = (
    Array.isArray(data.planning_threads) ? data.planning_threads : []
  ).map((thread) => ({
    ...thread,
    coowner_ids: Array.isArray(thread.coowner_ids) ? thread.coowner_ids : [],
    replaced_from_proposal_id: thread.replaced_from_proposal_id ?? null,
  }));
  data.planning_ping_responses = Array.isArray(data.planning_ping_responses)
    ? data.planning_ping_responses
    : [];
  data.planning_proposals = Array.isArray(data.planning_proposals)
    ? data.planning_proposals
    : [];
  data.planning_votes = Array.isArray(data.planning_votes)
    ? data.planning_votes
    : [];
  data.beacon_roles = Array.isArray(data.beacon_roles) ? data.beacon_roles : [];
  data.beacon_attendance = Array.isArray(data.beacon_attendance)
    ? data.beacon_attendance
    : [];
  return data;
}
