import type { Activity, Category } from "@/src/shared/types";
export type BeaconTemplate = {
  id?: string;
  title: string;
  label: string;
  category: Category;
  minutes: number;
  groupId?: string;
  groupLabel?: string;
  description?: string;
  prepPrompts?: string[];
  suggestedTools?: SuggestedTool[];
  sourceId?: string;
};
/** Recipe-selected module defaults; omitted optional tools remain off. */
export type SuggestedTool =
  | "chat"
  | "checklist"
  | "notes"
  | "focus"
  | "memories"
  | "music"
  | "scoreboard";

export type BeaconTemplateGroup = {
  id: string;
  title: string;
  category: Category;
  minutes: number;
  description: string;
  prepPrompts: string[];
  suggestedTools: SuggestedTool[];
  recipes: string[];
  recipeOverrides?: Record<
    string,
    Partial<Pick<BeaconTemplate, "category" | "minutes" | "description" | "prepPrompts" | "suggestedTools">>
  >;
};

export const templates: BeaconTemplate[] = [
  {
    id: "quick-coffee",
    label: "Coffee",
    title: "Coffee together",
    category: "Social",
    minutes: 30,
    suggestedTools: ["chat"],
  },
  {
    id: "quick-study",
    label: "Study",
    title: "Study together",
    category: "Study",
    minutes: 60,
    suggestedTools: ["chat", "checklist", "notes", "focus"],
  },
  {
    id: "quick-walk",
    label: "Walk",
    title: "Go for a walk",
    category: "Fitness",
    minutes: 30,
    suggestedTools: ["chat"],
  },
];

/**
 * Broad recipe groups mirror the product catalog while mapping every recipe
 * into the six beacon categories the current activity model supports.
 */
export const beaconTemplateGroups: BeaconTemplateGroup[] = [
  {
    id: "study-learning",
    title: "Study / Learning",
    category: "Study",
    minutes: 60,
    description: "Make space to focus, learn, and help each other make progress.",
    prepPrompts: ["What are you working on?", "What would make this session a win?"],
    suggestedTools: ["chat", "focus", "checklist", "notes"],
    recipes: [
      "General Study", "Homework", "Exam Prep", "Group Project", "Tutoring",
      "Reading", "Library Session", "Coding / Programming", "Language Practice",
      "Research Session",
    ],
  },
  {
    id: "sports-fitness",
    title: "Sports & Fitness",
    category: "Fitness",
    minutes: 60,
    description: "Move together at a pace and level that works for the group.",
    prepPrompts: ["What should everyone bring?", "What pace or skill level feels right?"],
    suggestedTools: ["chat"],
    recipeOverrides: {
      Basketball: {
        suggestedTools: ["chat", "memories", "scoreboard"],
      },
    },
    recipes: [
      "Weightlifting", "Basketball", "Tennis", "Badminton", "Football", "Soccer",
      "Rugby", "Baseball", "Softball", "Volleyball", "Beach Volleyball", "Kickball",
      "Pickleball", "Golf", "Disc Golf", "Swimming", "Running", "Walking",
      "Cycling", "Boxing", "Martial Arts", "Wrestling", "Climbing", "Gym Workout",
      "Yoga", "Pilates", "Dance",
    ],
  },
  {
    id: "hangout-social",
    title: "Hangout / Social",
    category: "Social",
    minutes: 90,
    description: "Keep the plan easy and leave room for good conversation.",
    prepPrompts: ["What kind of vibe are you in the mood for?", "Is this open to new people?"],
    suggestedTools: ["chat", "memories"],
    recipeOverrides: {
      "General Hangout": { minutes: 90 },
      "Dorm / Apartment Hangout": { minutes: 120 },
      Party: {
        minutes: 180,
        suggestedTools: ["chat", "memories", "music"],
      },
      "Meet New People": { minutes: 90 },
      Coffee: { minutes: 30 },
      "Late Night Hangout": { minutes: 120 },
      "Pool / Hot Tub": { minutes: 120 },
      Bonfire: { minutes: 120 },
      "Game Night": { category: "Gaming", minutes: 120 },
      "Conversation / Catch Up": { minutes: 60 },
    },
    recipes: [
      "General Hangout", "Chill", "Dorm / Apartment Hangout", "Party",
      "Meet New People", "Coffee", "Late Night Hangout", "Pool / Hot Tub",
      "Bonfire", "Game Night", "Conversation / Catch Up",
    ],
  },
  {
    id: "food-dining",
    title: "Food / Dining",
    category: "Social",
    minutes: 75,
    description: "Pick a place or make something together, with the details up front.",
    prepPrompts: ["Any cuisine or price range in mind?", "Do you need a reservation or seats?"],
    suggestedTools: ["chat"],
    recipeOverrides: {
      Breakfast: { minutes: 60 },
      Lunch: { minutes: 60 },
      Dinner: { minutes: 90, suggestedTools: ["chat", "memories"] },
      Brunch: { minutes: 90 },
      Coffee: { minutes: 30 },
      Dessert: { minutes: 60 },
      "Cook Together": { minutes: 120 },
      Barbecue: { minutes: 120 },
      Picnic: { category: "Other", minutes: 90 },
      "Food Crawl": { minutes: 180 },
    },
    recipes: [
      "Get Food", "Dinner", "Lunch", "Breakfast", "Brunch", "Coffee", "Dessert",
      "Fast Food", "Restaurant", "Cook Together", "Barbecue", "Picnic", "Food Crawl",
    ],
  },
  {
    id: "nature-outdoors",
    title: "Nature / Outdoors",
    category: "Fitness",
    minutes: 90,
    description: "Share the route, conditions, and gear so everyone can come prepared.",
    prepPrompts: ["Which trail or route?", "What gear or transportation is needed?"],
    suggestedTools: ["chat", "checklist", "notes"],
    recipeOverrides: {
      Hiking: { minutes: 120 },
      "Trail Walk": { minutes: 60 },
      Camping: {
        category: "Other",
        minutes: 180,
        suggestedTools: ["chat", "checklist", "notes", "memories"],
      },
      Fishing: { category: "Other", minutes: 120 },
      Kayaking: { minutes: 120 },
      Canoeing: { minutes: 120 },
      Boating: { category: "Other", minutes: 120 },
      Beach: { category: "Social", minutes: 120 },
      "Lake Day": { category: "Social", minutes: 180 },
      Park: { category: "Social", minutes: 90 },
      Picnic: { category: "Social", minutes: 90 },
      Birdwatching: { category: "Other", minutes: 90 },
      Stargazing: { category: "Other", minutes: 90 },
      Hunting: { category: "Other", minutes: 180 },
      "Scenic Drive": { category: "Other", minutes: 120 },
      "Outdoor Photography": { category: "Creative", minutes: 90 },
    },
    recipes: [
      "Hiking", "Trail Walk", "Camping", "Fishing", "Kayaking", "Canoeing", "Boating",
      "Beach", "Lake Day", "Park", "Picnic", "Birdwatching", "Stargazing", "Hunting",
      "Scenic Drive", "Outdoor Photography",
    ],
  },
  {
    id: "gaming",
    title: "Gaming",
    category: "Gaming",
    minutes: 120,
    description: "Get the game, platform, and open slots sorted before everyone joins.",
    prepPrompts: ["What are we playing, and on which platform?", "How many slots are open?"],
    suggestedTools: ["chat", "notes"],
    recipes: [
      "Video Games", "PC Gaming", "Console Gaming", "Mobile Gaming", "LAN Party",
      "Board Games", "Card Games", "Chess", "Tabletop RPG", "Dungeons & Dragons", "Arcade",
    ],
  },
  {
    id: "entertainment",
    title: "Entertainment",
    category: "Social",
    minutes: 120,
    description: "Make it easy for everyone to meet up and enjoy the event.",
    prepPrompts: ["Do people need tickets?", "When and where should everyone meet?"],
    suggestedTools: ["chat", "notes", "memories"],
    recipes: [
      "Movie", "Movie Theater", "TV / Watch Party", "Concert", "Live Music",
      "Comedy Show", "Theater", "Festival", "Museum", "Art Gallery", "Sporting Event",
      "Fair / Carnival", "Karaoke", "Bowling", "Mini Golf", "Escape Room",
    ],
  },
  {
    id: "travel-trip",
    title: "Travel / Trip",
    category: "Other",
    minutes: 180,
    description: "Plan one trip stop here; use Plans to arrange a multi-stop itinerary.",
    prepPrompts: ["Which destination or stop is this beacon for?", "What should the group bring or book?"],
    suggestedTools: ["chat", "checklist", "notes", "memories"],
    recipes: [
      "Day Trip", "Road Trip", "Vacation", "Weekend Trip", "Sightseeing",
      "Airport / Travel Day", "Hotel Meetup", "Campus Trip", "Group Excursion",
    ],
  },
  {
    id: "work-project",
    title: "Work / Project",
    category: "Study",
    minutes: 60,
    description: "Set one clear goal and split the work into manageable steps.",
    prepPrompts: ["Which project or deadline?", "What should be finished before you wrap up?"],
    suggestedTools: ["chat", "checklist", "notes", "focus"],
    recipes: [
      "Work Session", "Team Meeting", "Project Session", "Brainstorm", "Coding Session",
      "Design Session", "Startup Work", "Club Work", "Presentation Prep",
    ],
  },
  {
    id: "productivity-errands",
    title: "Productivity / Errands",
    category: "Other",
    minutes: 60,
    description: "Turn a handful of tasks into a simple plan you can finish together.",
    prepPrompts: ["Which stops or tasks matter most?", "What should be picked up or brought?"],
    suggestedTools: ["chat", "checklist"],
    recipes: [
      "Errands", "Shopping", "Grocery Run", "Cleaning", "Chores", "Moving", "Packing",
      "Study Tasks", "To-Do Session", "Appointment Run",
    ],
  },
  {
    id: "creative",
    title: "Creative",
    category: "Creative",
    minutes: 90,
    description: "Bring a project, try an idea, and make something in good company.",
    prepPrompts: ["What are we making?", "Which materials or equipment should we bring?"],
    suggestedTools: ["chat", "notes"],
    recipes: [
      "Drawing", "Painting", "Graphic Design", "Photography", "Music", "Band Practice",
      "Writing", "Filming", "Video Editing", "Content Creation", "Crafts", "Fashion",
    ],
  },
  {
    id: "wellness-self-improvement",
    title: "Wellness / Self-Improvement",
    category: "Other",
    minutes: 30,
    description: "Choose a gentle, personal goal and a pace that feels comfortable.",
    prepPrompts: ["What would feel restorative today?", "How long would you like to spend?"],
    suggestedTools: ["chat", "notes", "focus"],
    recipes: [
      "Meditation", "Journaling", "Stretching", "Relaxation", "Walk", "Morning Routine",
      "Night Routine", "Habit Session",
    ],
  },
  {
    id: "community-club",
    title: "Community / Club",
    category: "Social",
    minutes: 60,
    description: "Bring people together around a shared group, cause, or neighborhood.",
    prepPrompts: ["Which organization or community is this for?", "What roles or supplies are needed?"],
    suggestedTools: ["chat", "checklist", "notes"],
    recipes: [
      "Club Meeting", "Volunteer Event", "Community Service", "Community Gathering",
      "Campus Organization Event", "Fundraiser", "Neighborhood Event", "Workshop",
    ],
  },
  {
    id: "event-celebration",
    title: "Event / Celebration",
    category: "Social",
    minutes: 120,
    description: "Gather the people, timing, and little details that make a day special.",
    prepPrompts: ["What should guests know before they arrive?", "Is there anything to bring?"],
    suggestedTools: ["chat", "checklist", "notes"],
    recipes: [
      "Birthday", "Graduation", "Celebration", "Wedding-Related Meetup", "Tailgate",
      "Holiday Gathering", "Reunion", "House Party",
    ],
  },
  {
    id: "shopping-local-discovery",
    title: "Shopping / Local Discovery",
    category: "Other",
    minutes: 60,
    description: "Explore a few nearby shops or markets without overplanning the day.",
    prepPrompts: ["Which shops or stops are on the list?", "What budget or items should we keep in mind?"],
    suggestedTools: ["chat", "checklist"],
    recipes: [
      "Shopping Trip", "Mall", "Thrifting", "Yard Sale", "Farmers Market", "Flea Market",
      "Store Run",
    ],
  },
  {
    id: "transportation-meetup",
    title: "Transportation / Meetup",
    category: "Other",
    minutes: 45,
    description: "Coordinate a starting point, departure, destination, and available seats.",
    prepPrompts: ["Where should everyone meet?", "How many seats or pickup spots are available?"],
    suggestedTools: ["chat", "checklist"],
    recipes: [
      "Carpool", "Ride Needed", "Ride Available", "Meet Before Event", "Walk Together",
      "Bike Together", "Airport Ride",
    ],
    recipeOverrides: {
      Carpool: { minutes: 45 },
      "Ride Needed": { minutes: 30 },
      "Ride Available": { minutes: 30 },
      "Meet Before Event": { category: "Social", minutes: 30 },
      "Walk Together": { category: "Fitness", minutes: 45 },
      "Bike Together": { category: "Fitness", minutes: 45 },
      "Airport Ride": { minutes: 60 },
    },
  },
  {
    id: "routine-repeating",
    title: "Routine / Repeating Activity",
    category: "Other",
    minutes: 60,
    description: "Reuse settings from a familiar beacon or plan; this does not schedule recurrence.",
    prepPrompts: ["Which past beacon or plan are you reusing?", "What should change this time?"],
    suggestedTools: ["chat", "checklist"],
    recipeOverrides: {
      "Weekly Gym": { category: "Fitness", minutes: 60 },
      "Tuesday Study Group": { category: "Study", minutes: 60 },
      "Friday Dinner": { category: "Social", minutes: 90 },
      "Sunday Hiking": { category: "Fitness", minutes: 120 },
      "Morning Walk": { category: "Fitness", minutes: 30 },
      "Weekly Tennis": { category: "Fitness", minutes: 60 },
      "Game Night": { category: "Gaming", minutes: 120 },
    },
    recipes: [
      "Weekly Gym", "Tuesday Study Group", "Friday Dinner", "Sunday Hiking",
      "Morning Walk", "Weekly Tennis", "Game Night",
    ],
  },
  {
    id: "custom-other",
    title: "Custom / Other",
    category: "Other",
    minutes: 60,
    description: "Start with a blank beacon, then make the details your own.",
    prepPrompts: ["What are you planning?", "What does everyone need to know?"],
    suggestedTools: [],
    recipes: ["Custom Beacon"],
  },
];

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const beaconTemplateCatalog: BeaconTemplate[] = beaconTemplateGroups.flatMap(
  (group) =>
    group.recipes.map((title) => {
      const override = group.recipeOverrides?.[title];
      return {
        id: `${group.id}/${slug(title)}`,
        groupId: group.id,
        groupLabel: group.title,
        label: title,
        title,
        category: override?.category ?? group.category,
        minutes: override?.minutes ?? group.minutes,
        description: override?.description ?? group.description,
        prepPrompts: [...(override?.prepPrompts ?? group.prepPrompts)],
        suggestedTools: [...(override?.suggestedTools ?? group.suggestedTools)],
      };
    }),
);

export function searchBeaconTemplates(query: string, groupId?: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return beaconTemplateCatalog.filter((template) => {
    if (groupId && template.groupId !== groupId) return false;
    const haystack = [
      template.title,
      template.groupLabel,
      template.category,
      template.description,
      ...(template.prepPrompts ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function repeatSuggestions(
  activities: Activity[],
  userId: string,
): BeaconTemplate[] {
  const groups = new Map<string, Activity[]>();
  for (const a of activities.filter(
    (a) => a.owner_id === userId && a.status === "completed",
  )) {
    const key = a.title.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        b.length - a.length ||
        b.at(-1)!.starts_at.localeCompare(a.at(-1)!.starts_at),
    )
    .slice(0, 3)
    .map((group) => {
      const a = group
        .slice()
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
      return {
        label:
          group.length > 1 ? `Your usual: ${a.title}` : `Again? ${a.title}`,
        title: a.title,
        category: a.category,
        minutes: Math.max(
          15,
          Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000),
        ),
        sourceId: a.id,
      };
    });
}
