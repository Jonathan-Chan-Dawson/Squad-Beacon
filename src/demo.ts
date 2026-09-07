import { emptyData, type Data, type Payload } from "./types";
import { localDate, validateActivity } from "./domain";
export const DEMO_ID = "demo-you";
export function makeDemo(): Data {
  const d = emptyData(),
    now = Date.now();
  const person = (id: string, name: string, username: string, bio: string) => ({
    id,
    name,
    username,
    bio,
    interests: ["Fitness", "Creative"],
    featured_activity_id: null,
    hide_featured: false,
    timezone: "America/Chicago",
    quiet_start: 22,
    quiet_end: 8,
  });
  d.profiles = [
    person(
      DEMO_ID,
      "Alex Morgan",
      "alex",
      "Small steps. Good company. Big things ahead.",
    ),
    person(
      "maya",
      "Maya Chen",
      "maya",
      "Making room for movement and a little creativity.",
    ),
    person(
      "jordan",
      "Jordan Ellis",
      "jordan",
      "Always down for one more round.",
    ),
    person("sam", "Sam Rivera", "sam", "Coffee, code, and a good trail."),
  ];
  d.friendships = ["maya", "jordan", "sam"].map((id) => ({
    id: "friend-" + id,
    sender_id: DEMO_ID,
    recipient_id: id,
    status: "accepted",
  }));
  d.lists = [{ id: "close", owner_id: DEMO_ID, name: "Close Friends" }];
  d.squads = [
    {
      id: "boxing",
      owner_id: DEMO_ID,
      name: "The training crew",
      description: "Show up for each other. One round at a time.",
    },
    {
      id: "weekend",
      owner_id: "maya",
      name: "Weekend people",
      description: "Less scrolling, more doing.",
    },
  ];
  d.squad_members = [
    { squad_id: "boxing", user_id: DEMO_ID, role: "owner" },
    { squad_id: "boxing", user_id: "jordan", role: "member" },
    { squad_id: "weekend", user_id: DEMO_ID, role: "member" },
    { squad_id: "weekend", user_id: "maya", role: "owner" },
    { squad_id: "weekend", user_id: "sam", role: "member" },
  ];
  d.goals = [
    {
      id: "g1",
      owner_id: DEMO_ID,
      title: "Feel stronger, every week",
      description: "Build a training routine I actually enjoy.",
      target_date: null,
      progress: 40,
      audience: "friends",
      audience_id: null,
    },
    {
      id: "g2",
      owner_id: DEMO_ID,
      title: "Make something of my own",
      description: "Finish my first personal creative project.",
      target_date: null,
      progress: 25,
      audience: "private",
      audience_id: null,
    },
    {
      id: "g3",
      owner_id: "maya",
      title: "Run my first 10K",
      description: "A little further each week.",
      target_date: null,
      progress: 60,
      audience: "friends",
      audience_id: null,
    },
  ];
  d.milestones = [
    { id: "m1", goal_id: "g1", title: "Find a training partner", done: true },
    { id: "m2", goal_id: "g1", title: "Complete 12 sessions", done: false },
  ];
  d.habits = [
    {
      id: "h1",
      owner_id: DEMO_ID,
      title: "Move for 30 minutes",
      goal_id: "g1",
      schedule: "weekly",
      weekdays: [],
      weekly_target: 3,
      timezone: "America/Chicago",
      reminder_hour: 18,
      audience: "private",
      audience_id: null,
    },
    {
      id: "h2",
      owner_id: DEMO_ID,
      title: "Make time to create",
      goal_id: "g2",
      schedule: "days",
      weekdays: [1, 2, 3, 4, 5],
      weekly_target: 1,
      timezone: "America/Chicago",
      reminder_hour: null,
      audience: "private",
      audience_id: null,
    },
  ];
  d.checkins = [1, 2, 4, 7, 8, 10].map((n) => ({
    id: "c" + n,
    habit_id: "h1",
    owner_id: DEMO_ID,
    local_date: localDate(new Date(now - n * 86400000), "America/Chicago"),
  }));
  const activity = (
    id: string,
    owner_id: string,
    title: string,
    category: "Fitness" | "Study" | "Gaming",
    offset: number,
    audience_id: string | null,
  ) => ({
    id,
    owner_id,
    title,
    category,
    mode: "squad" as const,
    starts_at: new Date(now + offset * 3600000).toISOString(),
    ends_at: new Date(now + (offset + 2) * 3600000).toISOString(),
    timezone: "America/Chicago",
    approval_required: false,
    status: "scheduled" as const,
    goal_id: null,
    habit_id: null,
    audience: audience_id ? ("squad" as const) : ("friends" as const),
    audience_id,
  });
  d.activities = [
    activity(
      "a1",
      "jordan",
      "A few rounds. Good company.",
      "Fitness",
      -0.25,
      "boxing",
    ),
    activity("a2", "maya", "Coffee & a little focus", "Study", 2, null),
    activity("a3", "sam", "Game night, anyone?", "Gaming", 5, "weekend"),
  ];
  d.places = [
    {
      activity_id: "a1",
      label: "Chicago Boxing Club",
      latitude: 41.889,
      longitude: -87.65,
      online_url: null,
    },
    {
      activity_id: "a2",
      label: "The neighborhood café",
      latitude: 41.882,
      longitude: -87.637,
      online_url: null,
    },
    {
      activity_id: "a3",
      label: "Online · bring your favorite game",
      latitude: null,
      longitude: null,
      online_url: "https://discord.com",
    },
  ];
  d.rsvps = [
    { activity_id: "a1", user_id: "jordan", status: "going", approved: true },
    { activity_id: "a2", user_id: "maya", status: "going", approved: true },
  ];
  d.comments = [
    {
      id: "comment1",
      activity_id: "a1",
      author_id: "jordan",
      body: "All levels welcome. Come hang out!",
      created_at: new Date(now - 600000).toISOString(),
    },
  ];
  return d;
}
export function demoAction(previous: Data, action: string, p: Payload): Data {
  const d = structuredClone(previous),
    id = String(p.id ?? ""),
    uid = DEMO_ID;
  const newId = () => "demo-" + Math.random().toString(36).slice(2);
  if (action === "save_profile")
    Object.assign(
      d.profiles.find((x) => x.id === uid)!,
      p,
    );
  if (action === "create_activity") {
    validateActivity(p);
    const aid = newId();
    d.activities.push({
      id: aid,
      owner_id: uid,
      title: String(p.title),
      category: p.category as any,
      mode: p.mode as any,
      starts_at: String(p.starts_at),
      ends_at: String(p.ends_at),
      timezone: String(p.timezone),
      approval_required: !!p.approval_required,
      status: "scheduled",
      goal_id: p.goal_id as string | null,
      habit_id: p.habit_id as string | null,
      audience: p.audience as any,
      audience_id: p.audience_id as string | null,
    });
    d.places.push({
      activity_id: aid,
      label: String(p.label ?? ""),
      latitude: p.latitude as number | null,
      longitude: p.longitude as number | null,
      online_url: p.online_url as string | null,
    });
  }
  if (action === "rsvp") {
    const a = d.activities.find((x) => x.id === id)!;
    d.rsvps = d.rsvps.filter(
      (x) => !(x.activity_id === id && x.user_id === uid),
    );
    if (p.status !== "withdraw")
      d.rsvps.push({
        activity_id: id,
        user_id: uid,
        status:
          p.status === "going" && (a.approval_required || a.mode === "invite")
            ? "requested"
            : (p.status as any),
        approved: false,
      });
  }
  if (action === "activity_status")
    d.activities.find((x) => x.id === id)!.status = p.status as any;
  if (action === "edit_activity") {
    validateActivity(p);
    Object.assign(
      d.activities.find((x) => x.id === id)!,
      { title: p.title, starts_at: p.starts_at, ends_at: p.ends_at },
    );
  }
  if (action === "invite_activity")
    d.rsvps.push({
      activity_id: id,
      user_id: String(p.user_id),
      status: "invited",
      approved: true,
    });
  if (action === "approve_rsvp")
    Object.assign(
      d.rsvps.find((x) => x.activity_id === id && x.user_id === p.user_id)!,
      { approved: true, status: "going" },
    );
  if (action === "remove_rsvp")
    d.rsvps = d.rsvps.filter(
      (x) => !(x.activity_id === id && x.user_id === p.user_id),
    );
  if (action === "comment")
    d.comments.push({
      id: newId(),
      activity_id: id,
      author_id: uid,
      body: String(p.body),
      created_at: new Date().toISOString(),
    });
  if (action === "react") {
    d.reactions = d.reactions.filter(
      (x) => !(x.activity_id === id && x.user_id === uid),
    );
    d.reactions.push({ activity_id: id, user_id: uid, emoji: "🙌" });
  }
  if (action === "save_goal") {
    if (id)
      Object.assign(
        d.goals.find((x) => x.id === id)!,
        p,
      );
    else
      d.goals.push({
        id: newId(),
        owner_id: uid,
        title: String(p.title),
        description: String(p.description ?? ""),
        target_date: p.target_date as string | null,
        progress: 0,
        audience: (p.audience as any) ?? "private",
        audience_id: (p.audience_id as string | null) ?? null,
      });
  }
  if (action === "milestone") {
    if (p.milestone_id) {
      const m = d.milestones.find((x) => x.id === p.milestone_id)!;
      m.done = !m.done;
    } else
      d.milestones.push({
        id: newId(),
        goal_id: id,
        title: String(p.title),
        done: false,
      });
  }
  if (action === "save_habit")
    d.habits.push({ ...p, id: newId(), owner_id: uid } as any);
  if (action === "checkin") {
    const habit = d.habits.find((x) => x.id === id)!;
    const date = localDate(new Date(), habit.timezone);
    if (!d.checkins.some((x) => x.habit_id === id && x.local_date === date))
      d.checkins.push({
        id: newId(),
        habit_id: id,
        owner_id: uid,
        local_date: date,
      });
  }
  if (action === "create_squad") {
    const sid = newId();
    d.squads.push({
      id: sid,
      owner_id: uid,
      name: String(p.name),
      description: String(p.description ?? ""),
    });
    d.squad_members.push({ squad_id: sid, user_id: uid, role: "owner" });
  }
  if (action === "create_list")
    d.lists.push({ id: newId(), owner_id: uid, name: String(p.name) });
  if (action === "list_member") {
    d.list_members = d.list_members.filter(
      (x) => !(x.list_id === id && x.user_id === p.user_id),
    );
    if (p.add) d.list_members.push({ list_id: id, user_id: String(p.user_id) });
  }
  if (action === "friend_request") {
    const person = d.profiles.find((x) => x.username === p.username);
    if (!person)
      throw new Error(
        "No demo profile has that username. Try a real account to invite friends.",
      );
    if (
      !d.friendships.some((x) =>
        [x.sender_id, x.recipient_id].includes(person.id),
      )
    )
      d.friendships.push({
        id: newId(),
        sender_id: uid,
        recipient_id: person.id,
        status: "pending",
      });
  }
  if (action === "accept_friend")
    d.friendships.find((x) => x.id === id)!.status = "accepted";
  if (action === "invite_squad")
    d.squad_invites.push({
      id: newId(),
      squad_id: id,
      sender_id: uid,
      recipient_id: String(p.user_id),
    });
  if (action === "accept_squad") {
    const invite = d.squad_invites.find((x) => x.id === id)!;
    d.squad_members.push({
      squad_id: invite.squad_id,
      user_id: uid,
      role: "member",
    });
    d.squad_invites = d.squad_invites.filter((x) => x.id !== id);
  }
  if (action === "remove_member")
    d.squad_members = d.squad_members.filter(
      (x) => !(x.squad_id === id && x.user_id === p.user_id),
    );
  if (action === "block") {
    d.blocks.push({ blocker_id: uid, blocked_id: id });
    d.profiles = d.profiles.filter((x) => x.id !== id);
    d.activities = d.activities.filter((x) => x.owner_id !== id);
    d.comments = d.comments.filter((x) => x.author_id !== id);
    d.friendships = d.friendships.filter(
      (x) => ![x.sender_id, x.recipient_id].includes(id),
    );
  }
  if (action === "report")
    d.reports.push({
      id: newId(),
      reporter_id: uid,
      subject_id: id,
      reason: String(p.reason),
      created_at: new Date().toISOString(),
      resolved: false,
    });
  if (action === "read_notices")
    d.notices = d.notices.map((n) => ({
      ...n,
      read_at: new Date().toISOString(),
    }));
  if (action === "start_location")
    throw new Error(
      "Live location is available only with a connected account. Demo never shares your location.",
    );
  return d;
}
