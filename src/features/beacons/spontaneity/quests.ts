import type { Category } from "@/src/shared/types";
import { formatDurationLabel } from "../createTiming";

export const vibes = ["Random", "Chill", "Competitive", "Productive", "Creative", "Outdoors"] as const;
export const activityFilters = [
  "Any Activity", "Food & Drink", "Gaming", "Sports & Fitness", "Study", "Social", "Creative", "Outdoors",
] as const;

export type Vibe = (typeof vibes)[number];
export type ActivityFilter = (typeof activityFilters)[number];
type ActivityTag = Exclude<ActivityFilter, "Any Activity">;
type QuestRow = [
  id: string,
  title: string,
  description: string,
  activity: ActivityTag,
  category: Category,
  icon: string,
  minutes: number,
  ping?: [title: string, body: string],
];

const ideas: Record<Exclude<Vibe, "Random">, QuestRow[]> = {
  Chill: [
    ["coffee","Coffee Side Quest","Grab coffee or tea and trade one good story from this week.","Food & Drink","Social","☕",30],
    ["pizza","Emergency Pizza Council","Get a few people together and settle where you’re eating.","Food & Drink","Social","🍕",45,["Anyone up for pizza?","Thinking about getting a few people together for pizza. Anyone interested?"]],
    ["cards","Cards and Catch-Up","Bring a deck of cards and pick a game everyone can learn in five minutes.","Gaming","Gaming","🃏",45],
    ["picnic","Snack Blanket Meetup","Bring a snack, find a public spot to sit, and catch up outdoors.","Outdoors","Social","🧺",45],
    ["movie","Mystery Movie Night","Have everyone suggest one movie, then pick one at random.","Social","Social","🍿",120],
    ["book","Silent Reading Club","Read your own books together for half an hour, then give a one-sentence review.","Social","Social","📖",45],
    ["tea","Tea Flight","Brew or order a few teas and pick a surprise favorite.","Food & Drink","Social","🫖",30],
    ["playlist","Pass the Playlist","Take turns playing a favorite song and explaining where you first heard it.","Creative","Creative","🎧",30],
    ["puzzles","Puzzle Table","Set out a jigsaw puzzle and see how much you can finish while chatting.","Gaming","Gaming","🧩",45],
    ["dessert","Dessert Detour","Pick one dessert to split and give it a wildly specific rating.","Food & Drink","Social","🍦",30],
    ["brunch","Late Breakfast Club","Make or grab breakfast together, whatever the time.","Food & Drink","Social","🥞",45],
    ["photos","Camera Roll Stories","Share a photo you’re comfortable showing and tell the story behind it.","Social","Social","🖼️",20],
  ],
  Competitive: [
    ["ping-pong","Ping-Pong Duel","Find someone for a friendly best-of-three at a table you can use.","Sports & Fitness","Fitness","🏓",30],
    ["chess","Chess Showdown","Play two short games and switch colors between rounds.","Gaming","Gaming","♟️",30],
    ["pickup","Pickup Hoops","Gather a few people for a friendly game or a round of HORSE.","Sports & Fitness","Fitness","🏀",45],
    ["trivia","Trivia Face-Off","Each person brings three questions from a topic they know too much about.","Gaming","Gaming","🧠",30],
    ["badminton","Badminton Rally","Pair up and see who can keep a rally going the longest.","Sports & Fitness","Fitness","🏸",45],
    ["wordplay","Word Game Gauntlet","Play three short word games and see who takes the most rounds.","Gaming","Gaming","🔤",30],
    ["party-game","Party Game Playoffs","Pick a quick multiplayer game and run a few friendly rounds.","Gaming","Gaming","🎮",45],
    ["frisbee","Frisbee Target Round","Pick safe targets in an open area and take turns trying to land closest.","Outdoors","Fitness","🥏",30],
    ["guess-song","Name That Song","Take turns playing the first few seconds of a song and guessing the title.","Creative","Gaming","🎵",30],
    ["speed-stack","Cup Stack Challenge","Grab some reusable cups and see who can stack and unstack them fastest.","Gaming","Gaming","🥤",20],
    ["mini-golf","Mini Golf Showdown","Pick a course you can get to and play a friendly round.","Sports & Fitness","Fitness","⛳",60],
    ["pictionary","Pictionary Sprint","Set a one-minute timer and draw whatever ridiculous prompt your team picks.","Creative","Gaming","✏️",30],
  ],
  Productive: [
    ["study","Study Boss Battle","Pick one thing to finish and do a 45-minute study sprint together.","Study","Study","📚",45],
    ["teach","Teach It Back","Each person explains one confusing concept while the other asks questions.","Study","Study","💡",30],
    ["planning","Calendar Reset","Grab a friend and sort out next week’s deadlines, plans, and loose ends.","Social","Other","🗓️",30],
    ["build","Build Session","Pick a tiny project and see what you can get working in an hour.","Creative","Creative","💻",60],
    ["peer-review","Peer Review Swap","Swap a draft or slide deck and give each other two specific suggestions.","Study","Study","📝",30],
    ["flashcards","Flashcard Rapid Fire","Bring your own flashcards and quiz each other one round at a time.","Study","Study","🗂️",25],
    ["tidy","Twenty-Minute Reset","Pick one small area each, set a timer, and compare progress afterward.","Social","Other","🧹",20],
    ["meal-prep","Meal Prep Power Hour","Pick a simple meal and prep a few portions together.","Food & Drink","Other","🥗",60],
    ["interview","Mock Interview Swap","Ask each other three practice questions and give honest, specific feedback.","Study","Study","🎙️",30],
    ["debug","Debug Buddy","Bring a small coding problem and take turns explaining it out loud.","Study","Study","🐛",45],
    ["walk-plan","Walking Brainstorm","Take a short walk and talk through one idea you’ve each been putting off.","Outdoors","Other","💭",30],
    ["library","Library Focus Sprint","Find a spot where you can work quietly and take a break together when the timer ends.","Study","Study","⏱️",60],
  ],
  Creative: [
    ["sketch","Sketchbook Roulette","Pick a random subject, draw it for ten minutes, and compare sketches.","Creative","Creative","🎨",20],
    ["photo-walk","Photo Prompt Walk","Choose a theme like shadows or blue and find three photos each along a public route.","Outdoors","Creative","📸",45],
    ["story","One-Line Story","Write a story together, adding one sentence at a time until it takes a ridiculous turn.","Creative","Creative","📓",20],
    ["collage","Collage Jam","Make a tiny collage from materials you already have and trade titles.","Creative","Creative","✂️",45],
    ["music","Kitchen Table Jam","Bring an instrument or tap out a rhythm and make a short tune together.","Creative","Creative","🎸",45],
    ["comic","Four-Panel Comic","Draw a four-panel comic about a minor inconvenience and read them out loud.","Creative","Creative","💬",30],
    ["cook","Pantry Remix","Pick a few ingredients you already have and make something to share.","Food & Drink","Creative","🍳",45],
    ["poetry","Bad Poetry Night","Give everyone the same ordinary object to write a dramatic poem about.","Creative","Creative","📜",30],
    ["bracelet","Friendship Bracelet Swap","Make a simple bracelet with supplies you have and swap at the end.","Creative","Creative","🧵",45],
    ["album","Fake Album Cover","Design an album cover for a band name pulled from a hat.","Creative","Creative","💿",45],
    ["video","One-Minute Movie","Make a tiny video with friends who want to be filmed and screen it together.","Creative","Creative","🎬",45],
    ["board-game","Make a Tiny Board Game","Draw a board, write three rules, and playtest it together.","Gaming","Creative","🎲",60],
  ],
  Outdoors: [
    ["sunset","Sunset Walk","Pick a public route and invite someone out for an evening walk.","Outdoors","Fitness","🌇",40],
    ["park","Park Expedition","Choose a park you can get to and explore one path you haven’t taken.","Outdoors","Fitness","🌳",45],
    ["bike","Easy Bike Loop","If everyone has a bike, choose an easy route and a turnaround point.","Sports & Fitness","Fitness","🚲",45],
    ["bird","Bird Bingo","Go to a public green space and see how many birds you can spot together.","Outdoors","Other","🐦",30],
    ["architecture","Building Detail Hunt","Walk a public route and look for interesting doors, signs, or brickwork.","Outdoors","Creative","🧱",45],
    ["outside-coffee","Coffee Outside","Bring a drink from home or a café and find somewhere pleasant to sit.","Food & Drink","Social","☕",30],
    ["stretch","Stretch Break Outside","Find a flat open space and go through a few comfortable stretches together.","Sports & Fitness","Fitness","🌿",20],
    ["clouds","Cloud Spotting","Sit outside with a friend and find the weirdest shapes in the clouds.","Outdoors","Social","⛅",20],
    ["scavenger","Color Scavenger Walk","Pick three colors and see who can spot them first along a public route.","Gaming","Gaming","🔎",35],
    ["nature-sketch","Sketch Something Green","Bring a pencil and spend a few minutes drawing a plant or tree you can see.","Creative","Creative","🍃",30],
    ["stairs","Outdoor Walk Break","Pick a comfortable loop and take a short walk together between classes or meetings.","Sports & Fitness","Fitness","👟",20],
    ["outdoor-reading","Read in the Shade","Bring something short to read and share one good line with a friend.","Social","Social","📗",30],
  ],
};

export type SideQuest = {
  id: string;
  title: string;
  description: string;
  vibe: Exclude<Vibe, "Random">;
  activity: ActivityTag;
  category: Category;
  icon: string;
  minutes: number;
  ping?: QuestRow[7];
};

export const sideQuests: SideQuest[] = Object.entries(ideas).flatMap(
  ([vibe, rows]) => rows.map(([id, title, description, activity, category, icon, minutes, ping]) => ({
    id, title, description, vibe: vibe as SideQuest["vibe"], activity, category, icon, minutes, ping,
  })),
);

export function matchingQuests(vibe: Vibe, filter: ActivityFilter) {
  return sideQuests.filter((quest) =>
    (vibe === "Random" || quest.vibe === vibe) &&
    (filter === "Any Activity" || quest.activity === filter),
  );
}

export function rollQuest(
  choices: readonly SideQuest[],
  recent: readonly string[],
  random = Math.random,
) {
  if (!choices.length) return undefined;
  const fresh = choices.filter((quest) => !recent.includes(quest.id));
  const other = choices.filter((quest) => quest.id !== recent[0]);
  const pool = fresh.length ? fresh : other.length ? other : choices;
  return pool[Math.floor(random() * pool.length)];
}

export function questBeaconFields(quest: SideQuest, title = quest.title, description = quest.description) {
  return {
    title: title.trim(),
    description: description.trim(),
    category: quest.category,
    duration: formatDurationLabel(quest.minutes),
  };
}

export function questPing(quest: SideQuest, title: string, description: string) {
  const fields = questBeaconFields(quest, title, description);
  return {
    title: fields.title === quest.title ? quest.ping?.[0] ?? `${fields.title} — anyone in?` : fields.title,
    body: fields.description === quest.description ? quest.ping?.[1] ?? `${fields.description} Anyone interested?` : fields.description,
    category: fields.category,
  };
}
