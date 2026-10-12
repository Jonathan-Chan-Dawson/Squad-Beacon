import {
  beaconTemplateCatalog,
  type BeaconTemplate,
} from "@/src/shared/templates";

/** Presentation-only families reference the existing catalog; recipe IDs never change. */
export type TemplateFamily = {
  id: string;
  title: string;
  description: string;
  icon: string;
  groupId?: string;
  titles?: string[];
};
export const mainTemplateFamilies: TemplateFamily[] = [
  {
    id: "hangout",
    groupId: "hangout-social",
    title: "Hangout",
    description: "Meet up and spend time together",
    icon: "hangout",
  },
  {
    id: "food",
    groupId: "food-dining",
    title: "Food & Coffee",
    description: "Grab food, cook, or meet for coffee",
    icon: "food",
  },
  {
    id: "sports",
    groupId: "sports-fitness",
    title: "Sports & Fitness",
    description: "Play, exercise, or practice",
    icon: "sports",
  },
  {
    id: "study",
    groupId: "study-learning",
    title: "Study & Learning",
    description: "Study, homework, and learning together",
    icon: "study",
  },
  {
    id: "errands",
    groupId: "productivity-errands",
    title: "Errands & Shopping",
    description: "Groceries, shopping, and shared tasks",
    icon: "errands",
  },
  {
    id: "outing",
    groupId: "entertainment",
    title: "Outing & Event",
    description: "Movies, shows, and a night out",
    icon: "outing",
  },
];
export const moreTemplateFamilies: TemplateFamily[] = [
  {
    id: "outdoors",
    groupId: "nature-outdoors",
    title: "Outdoors & Adventure",
    description: "Trails, camping, fishing, beach, and lake",
    icon: "outdoors",
  },
  {
    id: "gaming",
    groupId: "gaming",
    title: "Gaming",
    description: "Video games, board games, and tabletop",
    icon: "gaming",
  },
  {
    id: "creative",
    groupId: "creative",
    title: "Creative Arts",
    description: "Drawing, painting, crafts, and design",
    icon: "creative",
  },
  {
    id: "work",
    groupId: "work-project",
    title: "Work & Projects",
    description: "Meetings, coding, and shared goals",
    icon: "work",
  },
  {
    id: "wellness",
    groupId: "wellness-self-improvement",
    title: "Wellness & Personal",
    description: "Meditation, reflection, and gentle movement",
    icon: "wellness",
  },
  {
    id: "travel",
    groupId: "travel-trip",
    title: "Travel & Trips",
    description: "Road trips, sightseeing, and excursions",
    icon: "travel",
  },
  {
    id: "community",
    groupId: "community-club",
    title: "Community & Volunteering",
    description: "Service, charity, and neighborhood gatherings",
    icon: "community",
  },
  {
    id: "campus",
    titles: [
      "Club Meeting",
      "Club Work",
      "Campus Organization Event",
      "Campus Trip",
      "Workshop",
    ],
    title: "Clubs & Campus",
    description: "Club meetings, campus events, and workshops",
    icon: "study",
  },
  {
    id: "celebrations",
    groupId: "event-celebration",
    title: "Celebrations",
    description: "Birthdays, graduations, reunions, and holidays",
    icon: "celebrations",
  },
  {
    id: "music",
    titles: [
      "Music",
      "Band Practice",
      "Concert",
      "Live Music",
      "Karaoke",
      "Dance",
    ],
    title: "Music & Performance",
    description: "Jam sessions, karaoke, and dance",
    icon: "music",
  },
  {
    id: "photography",
    titles: [
      "Photography",
      "Outdoor Photography",
      "Filming",
      "Video Editing",
      "Content Creation",
    ],
    title: "Photography & Content",
    description: "Photo walks, filming, and creating together",
    icon: "photography",
  },
  {
    id: "transport",
    groupId: "transportation-meetup",
    title: "Transportation & Carpool",
    description: "Shared rides, pickups, and meeting points",
    icon: "transport",
  },
  {
    id: "home",
    titles: [
      "Cleaning",
      "Chores",
      "Moving",
      "Packing",
      "Dorm / Apartment Hangout",
      "Cook Together",
      "House Party",
    ],
    title: "Home & Hosting",
    description: "House projects, moving, and welcoming friends",
    icon: "home",
  },
  {
    id: "classes",
    titles: ["Tutoring", "Language Practice", "Workshop", "Research Session"],
    title: "Classes & Workshops",
    description: "Lessons, tutorials, and sharing skills",
    icon: "study",
  },
  {
    id: "shops",
    groupId: "shopping-local-discovery",
    title: "Shops & Markets",
    description: "Thrifting, local finds, and market trips",
    icon: "errands",
  },
  {
    id: "familiar",
    groupId: "routine-repeating",
    title: "Familiar Activities",
    description: "A fresh Beacon for something you do often",
    icon: "hangout",
  },
  {
    id: "other",
    groupId: "custom-other",
    title: "Other Activities",
    description: "Make something your own",
    icon: "creative",
  },
];
export function familyTemplates(family: TemplateFamily): BeaconTemplate[] {
  return beaconTemplateCatalog.filter((item) =>
    family.groupId
      ? item.groupId === family.groupId
      : family.titles?.includes(item.title),
  );
}
