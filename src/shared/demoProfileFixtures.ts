import type { Activity, Category, Data, Profile } from "./types";

export const RICH_DEMO_PROFILE_IDS = [
  "showcase-avery",
  "showcase-noor",
  "showcase-rafael",
] as const;

const sharedInterests = [
  "Photography",
  "Hiking",
  "Coffee",
  "Cooking",
  "Board games",
  "Live music",
  "Cycling",
  "Reading",
  "Volunteering",
  "Travel",
  "Museums",
  "Running",
];
const interests = [
  [
    ...sharedInterests,
    "Film photography",
    "Urban sketching",
    "Architecture",
    "Pottery",
    "Jazz",
    "Indie films",
    "Design",
    "Book clubs",
    "Bouldering",
    "Picnics",
    "Thrifting",
    "Street food",
    "Sustainability",
    "Gardening",
    "Baking",
    "Podcasts",
    "Kayaking",
    "Birdwatching",
    "Language exchange",
    "Creative writing",
    "Camping",
    "Dance",
    "Yoga",
    "Chess",
    "Fitness",
    "Creative",
  ],
  [
    ...sharedInterests,
    "Astronomy",
    "Science communication",
    "History",
    "Poetry",
    "Calligraphy",
    "Watercolors",
    "Sourdough",
    "Tea",
    "Community gardens",
    "Botany",
    "Swimming",
    "Tennis",
    "Documentaries",
    "Public speaking",
    "Learning Spanish",
    "Piano",
    "Coding",
    "Robotics",
    "Puzzles",
    "Meditation",
    "Trail running",
    "Nature journaling",
    "Indie games",
    "Ceramics",
    "Study",
    "Creative",
  ],
  [
    ...sharedInterests,
    "Basketball",
    "Soccer",
    "Strength training",
    "Boxing",
    "Beach volleyball",
    "Disc golf",
    "Skateboarding",
    "Climbing",
    "Canoeing",
    "Salsa",
    "DJing",
    "Music production",
    "Guitar",
    "Street photography",
    "Meal prep",
    "Barbecue",
    "Comedy",
    "Film nights",
    "Trivia",
    "Road trips",
    "Entrepreneurship",
    "Woodworking",
    "Repair cafes",
    "Fitness",
    "Gaming",
    "Social",
  ],
];
const goals = [
  [
    "Make one photo story with friends",
    "Walk somewhere unfamiliar",
    "Cook a meal for the whole table",
    "Keep a small sketchbook",
    "Find a new neighborhood cafe",
    "Build a gentle running habit",
    "Show up for a friend",
    "Read without checking my phone",
    "Visit an independent gallery",
    "Practice a little Spanish",
    "Spend more time by the water",
    "Make something with my hands",
    "Plan an affordable day trip",
    "Host a board-game evening",
    "Volunteer in the neighborhood",
    "Try something I am bad at",
  ],
  [
    "Finish a chapter with my study circle",
    "Look at the night sky",
    "Write a poem just for myself",
    "Grow something edible",
    "Practice piano with a friend",
    "Walk a new nature trail",
    "Make room for quiet mornings",
    "Teach someone a useful skill",
    "Learn five new Spanish phrases",
    "Bring homemade food to a gathering",
    "Read a book outside my usual genre",
    "Swim a little farther",
    "Have an unhurried conversation",
    "Make a watercolor postcard",
  ],
  [
    "Play a pickup game with new people",
    "Train consistently without burning out",
    "Cook dinner instead of ordering in",
    "Record a song with friends",
    "Explore a new cycling route",
    "Take a phone-free afternoon",
    "Be the friend who makes the plan",
    "Practice guitar for the fun of it",
    "Try a new outdoor sport",
    "Help repair something instead of replacing it",
    "Bring different friend groups together",
    "Make time for a proper weekend adventure",
  ],
];
const bios = [
  "Usually carrying a camera, a paperback, and far too many ideas for one weekend. I love slow walks that turn into coffee, dinner tables where everyone brings something, and making ordinary days feel worth remembering. Currently learning film photography, trying to keep my balcony herbs alive, and saying yes to more small adventures. Invite me to a gallery, a trail, a board-game night, or a wildly overambitious cooking project. New friends and slightly chaotic plans are always welcome.",
  "Research brain, creative heart, enthusiastic snack coordinator. I can happily talk about constellations, community gardens, speculative fiction, or the perfect cup of tea for hours. My ideal day includes a focused study session, a long walk, and making something with people I care about. Learning to play piano badly but joyfully, collecting poems, and trying to make my weeks more intentional. Looking for curious people who enjoy both big conversations and comfortable silences.",
  "The person who says 'one more game' and then organizes dinner for everyone afterward. I split my free time between pickup sports, making music, fixing things, and finding new places to eat with friends. Training for my first long-distance charity ride, relearning guitar, and trying to become a better host. Always happy to welcome a beginner, share a route, or turn a vague group-chat idea into an actual plan. Bring your friends, your favorite playlist, and your appetite.",
];

/** Fictional, local-only fixtures for inspecting genuinely dense profile layouts. */
export function addDemoProfileFixtures(
  data: Data,
  viewerId: string,
  now: number,
) {
  if (!data.is_demo || data.viewer_id !== viewerId) return;
  const viewer = data.profiles.find((profile) => profile.id === viewerId);
  if (!viewer) return;
  const names = ["Avery Bennett", "Noor Haddad", "Rafael Costa"];
  const goalCategories: Category[][] = [
    [
      "Creative",
      "Fitness",
      "Social",
      "Creative",
      "Social",
      "Fitness",
      "Social",
      "Study",
      "Creative",
      "Study",
      "Fitness",
      "Creative",
      "Social",
      "Gaming",
      "Social",
      "Other",
    ],
    [
      "Study",
      "Study",
      "Creative",
      "Other",
      "Creative",
      "Fitness",
      "Other",
      "Study",
      "Study",
      "Social",
      "Study",
      "Fitness",
      "Social",
      "Creative",
    ],
    [
      "Fitness",
      "Fitness",
      "Social",
      "Creative",
      "Fitness",
      "Other",
      "Social",
      "Creative",
      "Fitness",
      "Creative",
      "Social",
      "Fitness",
    ],
  ];
  const people = RICH_DEMO_PROFILE_IDS.map((id, index): Profile => ({
    ...viewer,
    id,
    username: ["averyb", "noorh", "rafaelc"][index],
    name: names[index],
    bio: bios[index],
    interests: interests[index],
    identity_tags: [
      "Curious",
      "Adventurous",
      "Creative",
      "Easygoing",
      "Thoughtful",
      "Ambivert",
    ],
    home: "Chicago, IL",
    birthday_note: ["June 14", "October 2", "May 9"][index],
    personality: [
      "The curious planner who always takes the scenic route.",
      "Thoughtful, a little nerdy, and always asking one more question.",
      "Big energy, open invitations, and a soft spot for beginners.",
    ][index],
    quote: [
      "Pay attention. Be astonished. Tell about it.",
      "There is always something wonderful left to learn.",
      "The best plans are the ones we actually show up for.",
    ][index],
    aspirations: [
      "A tiny photography exhibition with friends. A train trip with no packed itinerary. Learning to make the kind of dinner that keeps everyone at the table for hours.",
      "A neighborhood science-and-art club, a flourishing community garden plot, and a whole year of giving my creative interests the same attention as my work.",
      "A coast-to-coast cycle trip someday. A little home-recorded EP. A weekly open-door dinner where a friend of a friend always feels welcome.",
    ][index],
    aspiration_goals: goals[index].map((title, goal) => ({
      id: `${id}-goal-${goal}`,
      title,
      category: goalCategories[index][goal],
      target_per_week: (goal % 3) + 1,
    })),
    avatar_style: "illustrated",
    avatar_seed: [74, 151, 193][index],
    avatar_updated_at: null,
    profile_visibility: "friends",
    viewer_can_view_full_profile: undefined,
    viewer_featured_activity_id: undefined,
    viewer_profile_feature_hidden: undefined,
    hide_featured: false,
    featured_activity_id: null,
  }));
  data.profiles.push(...people);
  viewer.bio =
    "Collecting good days with good people: camera walks, ambitious shared dinners, long lakefront rides, and the occasional very competitive board-game night. I like being a beginner, asking questions, and making space for friends who have different kinds of energy. Currently working on showing up more consistently, cooking a little better, and turning the things I keep saying I want to do into actual time on the calendar. Always up for a small adventure and a really good conversation.";
  viewer.home = "Chicago, IL";
  viewer.interests = [...new Set([...viewer.interests, ...interests[0]])];
  viewer.identity_tags = [
    "Curious",
    "Creative",
    "Thoughtful",
    "Ambivert",
    "Adventurous",
  ];
  viewer.aspirations =
    "More shared meals, more time outside, more creative projects finished with friends. I want my calendar to reflect the things I care about.";
  viewer.personality =
    "Equal parts list maker and spontaneous detour enthusiast.";
  viewer.quote = "Make a little room for the unexpected.";
  viewer.aspiration_goals = goals[0].slice(0, 12).map((title, index) => ({
    id: `showcase-you-goal-${index}`,
    title,
    category: goalCategories[0][index],
    target_per_week: (index % 3) + 1,
  }));

  function friendship(left: string, right: string) {
    if (
      data.friendships.some(
        (f) =>
          (f.sender_id === left && f.recipient_id === right) ||
          (f.sender_id === right && f.recipient_id === left),
      )
    )
      return;
    data.friendships.push({
      id: `showcase-friend-${left}-${right}`,
      sender_id: left,
      recipient_id: right,
      status: "accepted",
    });
  }
  people.forEach((person) => {
    [
      viewerId,
      "maya",
      "jordan",
      "sam",
      ...RICH_DEMO_PROFILE_IDS.filter((id) => id !== person.id),
    ].forEach((friend) => friendship(person.id, friend));
    ["boxing", "weekend", "chess-table"].forEach((squadId) => {
      if (data.squads.some((s) => s.id === squadId))
        data.squad_members.push({
          squad_id: squadId,
          user_id: person.id,
          role: "member",
        });
    });
    data.organization_members.push({
      organization_id: "org-lakefront-collective",
      user_id: person.id,
      role: "member",
      status: "active",
      invited_by: "maya",
      created_at: new Date(now - 40 * 86400000).toISOString(),
    });
    data.space_members.push({
      space_id: "space-neighborhood-studio",
      user_id: person.id,
      role: "member",
      status: "active",
      invited_by: "maya",
      created_at: new Date(now - 40 * 86400000).toISOString(),
    });
    data.messages.push({
      id: `showcase-dm-${person.id}`,
      author_id: person.id,
      recipient_id: viewerId,
      activity_id: null,
      body: `Hey! Up for another ${person.id === "showcase-noor" ? "study-and-coffee afternoon" : person.id === "showcase-rafael" ? "lakefront ride" : "camera walk"} this week?`,
      created_at: new Date(now - 120000).toISOString(),
    });
  });
  const organization = data.organizations.find(
    (org) => org.id === "org-lakefront-collective",
  );
  if (organization)
    organization.member_count = new Set([
      organization.owner_id,
      ...data.organization_members
        .filter(
          (m) => m.organization_id === organization.id && m.status === "active",
        )
        .map((m) => m.user_id),
    ]).size;

  const albumTitles = [
    "Golden hour by the lake",
    "The very ambitious dinner club",
    "A trail worth the early start",
    "Coffee, cameras & wandering",
    "The longest board-game night",
    "A quiet afternoon making things",
    "The neighborhood picnic",
    "Bikes, pastries & wrong turns",
  ];
  const allPeople = [viewer, ...people];
  for (const [personIndex, person] of allPeople.entries()) {
    function beacon(
      suffix: string,
      title: string,
      category: Category,
      start: number,
      status: Activity["status"] = "scheduled",
    ) {
      const id = `${person.id}-showcase-${suffix}`;
      const activity: Activity = {
        id,
        owner_id: person.id,
        title,
        category,
        mode: "squad",
        status,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(start + 3 * 3600000).toISOString(),
        timezone: "America/Chicago",
        audience: "friends",
        audience_id: null,
        approval_required: false,
        goal_id: null,
        habit_id: null,
        plan_id: null,
        plan_step_index: null,
        aspiration_ids: [
          person.aspiration_goals[
            Number(suffix.replace(/\D/g, "")) %
              person.aspiration_goals.length || 0
          ].id,
        ],
        enable_chat: true,
        enable_experiences: true,
        description: "A fictional shared experience in the demo neighborhood.",
      };
      data.activities.push(activity);
      for (const attendee of [
        ...new Set([viewerId, "maya", "jordan", ...RICH_DEMO_PROFILE_IDS]),
      ].filter((id) => id !== person.id)) {
        data.rsvps.push({
          activity_id: id,
          user_id: attendee,
          status: "going",
          approved: true,
        });
      }
      data.places.push({
        activity_id: id,
        label: [
          "Chicago Riverwalk",
          "Neighborhood Studio",
          "Lakefront Trail",
          "A friend's kitchen",
        ][personIndex],
        latitude: null,
        longitude: null,
        online_url: null,
      });
      return activity;
    }
    const current = beacon(
      "live",
      [
        "Camera walk & a little coffee",
        "Sketching the city, one cafe at a time",
        "Study circle, then a slow walk",
        "Lakefront ride & late lunch",
      ][personIndex],
      ["Creative", "Creative", "Study", "Fitness"][personIndex] as Category,
      now - 30 * 60000,
    );
    person.featured_activity_id = current.id;
    const status = beacon(
      "status",
      [
        "Free for coffee and a creative detour",
        "Camera charged. Open to a little adventure.",
        "Studying until five, then happy to wander",
        "Always room for one more on the ride",
      ][personIndex],
      "Social",
      now - 15 * 60000,
    );
    status.mode = "solo";
    status.available = true;
    status.description = status.title;
    data.rsvps = data.rsvps.filter((rsvp) => rsvp.activity_id !== status.id);
    [
      "Sunday dinner with the whole table",
      "A beginner-friendly climbing session",
      "Bring a book, pick a cafe",
    ].forEach((title, i) =>
      beacon(
        `next-${i}`,
        title,
        (["Social", "Fitness", "Study"] as Category[])[i],
        now + (i + 1) * 86400000,
      ),
    );
    albumTitles.forEach((title, index) => {
      const activity = beacon(
        `past-${index}`,
        title,
        (
          [
            "Nature",
            "Social",
            "Fitness",
            "Creative",
            "Gaming",
            "Creative",
            "Social",
            "Fitness",
          ].map((c) => (c === "Nature" ? "Fitness" : c)) as Category[]
        )[index],
        now - [1, 3, 6, 9, 14, 21, 28, 35][index] * 86400000,
        "completed",
      );
      for (let image = 0; image < 3 + index; image++)
        data.beacon_memories.push({
          id: `${activity.id}-photo-${image}`,
          activity_id: activity.id,
          author_id: person.id,
          object_path: `demo://profile-showcase/${activity.id}/photo-${image}.jpg`,
          media_type: "image",
          duration_seconds: null,
          caption:
            "Fictional demo memory; category artwork is used instead of a personal photograph.",
          created_at: activity.ends_at,
          updated_at: activity.ends_at,
        });
    });
    beacon(
      "without-photos",
      "A great conversation we forgot to photograph",
      "Social",
      now - 4 * 86400000,
      "completed",
    );
  }
}
