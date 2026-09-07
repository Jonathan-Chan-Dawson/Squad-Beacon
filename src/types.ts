export type ID = string;
export type Audience = "private" | "friends" | "list" | "squad";
export type Mode = "solo" | "squad" | "invite";
export type Category =
  "Fitness" | "Study" | "Gaming" | "Creative" | "Social" | "Other";
export interface Profile {
  avatar_updated_at?: string | null;
  id: ID;
  username: string;
  name: string;
  bio: string;
  interests: string[];
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
export interface Data {
  is_moderator?: boolean;
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
