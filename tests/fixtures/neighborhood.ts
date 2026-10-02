import { emptyData, type Data } from "@/src/shared/types";
import { localDate } from "@/src/shared/domain";
const DEMO_ID = "demo-you";
export function makeDemo(): Data {
  const d = emptyData(),
    now = Date.now();
  const person = (id: string, name: string, username: string, bio: string) => ({
    id,
    name,
    username,
    bio,
    interests: ["Fitness", "Creative"],
    identity_tags: [],
    aspiration_goals: [],
    onboarding_survey_status: "completed" as const,
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
    plan_id: null,
    plan_step_index: null,
    aspiration_ids: [],
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
  d.activities.push({
    ...d.activities[0],
    id: "free-sam",
    owner_id: "sam",
    title: "Food or a walk?",
    mode: "solo",
    available: true,
    audience: "friends",
    audience_id: null,
    starts_at: new Date(now - 300000).toISOString(),
    ends_at: new Date(now + 5400000).toISOString(),
  });
  const names = [
    "Jamie Park",
    "Riley Brooks",
    "Avery Patel",
    "Taylor Reed",
    "Casey Nguyen",
    "Morgan Wells",
    "Quinn Carter",
    "Dakota Singh",
    "Skyler James",
    "Rowan Kim",
    "Emerson Cole",
    "Finley Cruz",
    "Harper Lane",
    "River Evans",
    "Sage Wilson",
    "Noah Diaz",
    "Mila Scott",
    "Leo Rivera",
    "Zoe Chen",
    "Arlo Bennett",
    "Luca Hayes",
    "Ivy Foster",
    "Nico Ross",
    "Remy Turner",
    "Jules Grant",
    "Eden Shaw",
    "Blair Stone",
    "Drew Martin",
    "Ellis Green",
    "Parker Bell",
    "Reese Adams",
    "Alexis Ford",
  ];
  const plans = [
    "Pickup basketball",
    "Sketch & sip",
    "Library power hour",
    "A sunset stroll",
    "Board games & snacks",
    "Coffee on the corner",
  ];
  const categories = [
    "Fitness",
    "Creative",
    "Study",
    "Social",
    "Gaming",
    "Social",
  ] as const;
  names.forEach((name, i) => {
    const id = `neighbor-${i}`,
      connected = i < 20;
    d.profiles.push({
      ...person(
        id,
        name,
        name.toLowerCase().replace(" ", "."),
        [
          "Always up for a tiny adventure.",
          "Good coffee, good company.",
          "Making time for the fun stuff.",
          "One more game? Count me in.",
        ][i % 4],
      ),
      avatar_seed: (i * 37) % 216,
      avatar_style: "illustrated",
      interests: [categories[i % 6], categories[(i + 2) % 6]],
    });
    if (!connected) return;
    d.friendships.push({
      id: `friend-${id}`,
      sender_id: DEMO_ID,
      recipient_id: id,
      status: "accepted",
    });
    const free = i % 4 === 0,
      solo = i % 3 !== 0;
    const aid = `neighborhood-${i}`,
      start = now + (i < 14 ? -600000 : 7200000 + (i - 14) * 3600000);
    d.activities.push({
      id: aid,
      owner_id: id,
      title: free
        ? ["Food? A walk?", "Got an hour to spare", "Something spontaneous?"][
            i % 3
          ]
        : plans[i % 6],
      description: "Come as you are. A small plan with good people.",
      category: categories[i % 6],
      mode: solo ? "solo" : "squad",
      available: free && solo,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(start + 5400000 + (i % 3) * 1800000).toISOString(),
      timezone: "America/Chicago",
      approval_required: i === 9,
      status: "scheduled",
      audience: "friends",
      audience_id: null,
      goal_id: null,
      habit_id: null,
      plan_id: null,
      plan_step_index: null,
      aspiration_ids: [],
      target_count: solo ? null : 6,
    });
    const latitude = 41.878 + (i % 5) * 0.004,
      longitude = -87.656 + Math.floor(i / 5) * 0.006;
    d.places.push({
      activity_id: aid,
      label: [
        "Riverwalk",
        "The little art cafe",
        "Neighborhood library",
        "Lakeside park",
        "The game room",
      ][i % 5],
      latitude,
      longitude,
      online_url: null,
    });
    if (i < 10)
      d.locations.push({
        id: `loc-${id}`,
        owner_id: id,
        latitude: latitude + 0.0006,
        longitude: longitude + 0.0004,
        updated_at: new Date(now).toISOString(),
        expires_at: new Date(now + 3600000).toISOString(),
      });
    if (!solo)
      ["maya", "sam", "jordan"]
        .slice(0, 1 + (i % 3))
        .forEach((user_id) =>
          d.rsvps.push({
            activity_id: aid,
            user_id,
            status: "going",
            approved: true,
          }),
        );
  });
  d.favorites.push(
    { owner_id: DEMO_ID, kind: "friend", target_id: "neighbor-4" },
    { owner_id: DEMO_ID, kind: "squad", target_id: "weekend" },
  );
  return d;
}
