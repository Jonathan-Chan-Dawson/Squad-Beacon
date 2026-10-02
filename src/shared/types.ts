export type ID = string;
export type Audience = "private" | "friends" | "list" | "squad";
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
}
export interface SquadMember {
  squad_id: ID;
  user_id: ID;
  role: "owner" | "admin" | "member";
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
  created_at: string;
}
export interface BeaconNote {
  id: ID;
  activity_id: ID;
  author_id: ID;
  body: string;
  revision: number;
  created_at: string;
  updated_at: string;
}
export type LibraryKind = "journal" | "checklist";
export interface LibraryFolder {
  id: ID;
  owner_id: ID;
  kind: LibraryKind;
  name: string;
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
export type PlanningThreadKind = "ping" | "vote" | "draw";
export type PlanningThreadStatus =
  | "open"
  | "resolved"
  | "no_options"
  | "expired"
  | "cancelled";
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
export interface Data {
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
  beacon_notes: BeaconNote[];
  library_folders: LibraryFolder[];
  library_folder_items: LibraryFolderItem[];
  planning_threads: PlanningThread[];
  planning_ping_responses: PlanningPingResponse[];
  planning_proposals: PlanningProposal[];
  planning_votes: PlanningVote[];
  beacon_roles: BeaconRole[];
  beacon_attendance: BeaconAttendance[];
  beacon_invitation_grants: BeaconInvitationGrant[];

  is_moderator?: boolean;
  is_demo?: boolean;
  viewer_id?: ID | null;
  location_recipients?: string[];
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
  favorites: [],
  templates: [],
  plans: [],
  plan_templates: [],
  messages: [],
  beacon_checklist_items: [],
  beacon_notes: [],
  library_folders: [],
  library_folder_items: [],
  planning_threads: [],
  planning_ping_responses: [],
  planning_proposals: [],
  planning_votes: [],
  beacon_roles: [],
  beacon_attendance: [],
  beacon_invitation_grants: [],
  is_demo: false,
  viewer_id: null,
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
  data.profiles = (Array.isArray(data.profiles) ? data.profiles : []).map(
    (profile) => ({
      ...profile,
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      identity_tags: Array.isArray(profile.identity_tags)
        ? profile.identity_tags
        : [],
      aspiration_goals: Array.isArray(profile.aspiration_goals)
        ? profile.aspiration_goals
        : [],
      // Pre-survey profiles already use the app and should not be gated.
      onboarding_survey_status:
        profile.onboarding_survey_status ?? "skipped",
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
          ? [{
              activity_id: rsvp.activity_id,
              user_id: rsvp.user_id,
              invited_by: activity.owner_id,
              created_at: "",
            }]
          : [];
      });
  data.plans = Array.isArray(data.plans) ? data.plans : [];
  data.plan_templates = Array.isArray(data.plan_templates)
    ? data.plan_templates
    : [];
  data.beacon_checklist_items = Array.isArray(data.beacon_checklist_items)
    ? data.beacon_checklist_items
    : [];
  data.beacon_notes = (Array.isArray(data.beacon_notes) ? data.beacon_notes : []).map(
    (note) => ({
      ...note,
      revision: Number.isInteger(note.revision) ? note.revision : 0,
      updated_at: note.updated_at ?? note.created_at,
    }),
  );
  data.library_folders = Array.isArray(data.library_folders)
    ? data.library_folders
    : [];
  data.library_folder_items = Array.isArray(data.library_folder_items)
    ? data.library_folder_items
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
  data.beacon_roles = Array.isArray(data.beacon_roles)
    ? data.beacon_roles
    : [];
  data.beacon_attendance = Array.isArray(data.beacon_attendance)
    ? data.beacon_attendance
    : [];
  return data;
}
