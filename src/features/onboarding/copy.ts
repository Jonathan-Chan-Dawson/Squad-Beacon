export type CopyTone = "friendly" | "playful" | "bro";
export const copy = {
  "welcome.newAccount": {
    title: "Your next story starts here.",
    body: "Find something happening, bring your people together, or start something new.",
  },
  "empty.upcoming": {
    title: "No upcoming Beacons.",
    body: "Explore Beacons or bring a few people together.",
  },
  "empty.friends": {
    title: "Find your people.",
    body: "Connect with someone you know, then make something happen together.",
  },
  "empty.squads": {
    title: "A place for your people.",
    body: "Start a Squad or explore communities around your interests.",
  },
  "empty.chats": {
    title: "Good plans start with a hello.",
    body: "Find a friend to start a conversation.",
  },
  "empty.discovery": {
    title: "Nothing happening here yet.",
    body: "Explore another area or start a Beacon of your own.",
  },
  "empty.filtered": {
    title: "No matches with these filters.",
    body: "Try a broader search or clear your filters.",
  },
  "empty.search": {
    title: "No matches yet.",
    body: "Try a different name or a shorter search.",
  },
  "empty.location": {
    title: "Choose an area to explore.",
    body: "Search for a place, or choose to use your location. Location sharing stays off.",
  },
  "empty.calendar": {
    title: "Nothing scheduled for this day.",
    body: "Choose Schedule to make time for a Beacon, Plan, or Routine.",
  },
  "empty.planFilter": {
    title: "No Plans in this view.",
    body: "Try another audience, or show all your Plans.",
  },
  "empty.planStops": {
    title: "No stops yet. What should we do first?",
    body: "Save an idea, add a Beacon, or decide together.",
  },
  "empty.plans": {
    title: "Start with a name. Figure out the stops later.",
    body: "Save a Plan, then add ideas and Beacons whenever you’re ready.",
  },
  "empty.routines": {
    title: "Make a good thing a regular thing.",
    body: "Repeat a Plan or Beacon on a schedule you choose.",
  },
  "empty.memories": {
    title: "Your stories will live here.",
    body: "Memories stay connected to the Beacons they came from.",
  },
  "empty.templates": {
    title: "No saved templates yet.",
    body: "Browse Beacon templates for a starting point. Save your own setup from the editor.",
  },
  "empty.pending": {
    title: "Waiting for replies.",
    body: "Your decision is open. People can respond until its deadline.",
  },
  "empty.responses": {
    title: "You're all caught up.",
    body: "Invitations and decisions that need your response will appear here.",
  },
  "state.error": {
    title: "Couldn't load this right now.",
    body: "Try again when you're connected.",
  },
  "state.offline": {
    title: "You're offline.",
    body: "Reconnect, then try again. Your account hasn't been changed.",
  },
  "state.loading": {
    title: "Loading…",
    body: "Getting the latest information.",
  },
  "state.unavailable": {
    title: "This isn't available.",
    body: "It may have ended or you may no longer have access.",
  },
  "success.firstBeacon": {
    title: "Your first Beacon is ready.",
    body: "Invite your people or take a look at the details.",
  },
  "success.firstConnection": {
    title: "Connection confirmed.",
    body: "You're connected. Say hello or make a plan.",
  },
  "success.firstCompletion": {
    title: "Your first Beacon, completed.",
    body: "A new story for your history.",
  },
} as const;
export type CopyKey = keyof typeof copy;
const quips: Partial<Record<CopyKey, Record<CopyTone, readonly string[]>>> = {
  "welcome.newAccount": {
    friendly: ["Something good can start small."],
    playful: ["Every good story needs a starting point."],
    bro: ["The group chat prophecy starts here."],
  },
  "empty.upcoming": {
    friendly: ["Leave a little room for something fun."],
    playful: [
      "Zero plans. Infinite side quests.",
      "Your social calendar is a minimalist masterpiece.",
    ],
    bro: [
      "The group chat prophecy remains unfulfilled.",
      "An entire weekend without a side quest? Suspicious.",
    ],
  },
  "empty.squads": {
    friendly: ["Start with a familiar face."],
    playful: ["The crew is still in casting."],
    bro: ["Squad headquarters currently exists only in the lore."],
  },
  "empty.plans": {
    friendly: ["One idea is enough to begin."],
    playful: ["The itinerary is still in its imagination phase."],
    bro: ["The master plan is currently a napkin sketch."],
  },
  "empty.memories": {
    friendly: ["There's more ahead."],
    playful: ["This scrapbook is still in its pilot episode."],
    bro: ["The lore hasn't dropped yet."],
  },
  "success.firstBeacon": {
    friendly: ["A good idea, out in the world."],
    playful: ["The plan has escaped the group chat."],
    bro: ["You actually did the thing. Historic moment."],
  },
  "success.firstConnection": {
    friendly: ["Good company is a good start."],
    playful: ["Crew assembled. Possibilities increasing."],
    bro: ["The council has begun to assemble."],
  },
};
/** Stable for a view; never rotate on render. Functional copy is tone-independent. */
export function getCopy(
  key: CopyKey,
  tone: CopyTone = "playful",
  seed = "beacon",
  enabled = true,
) {
  const lines = enabled ? quips[key]?.[tone] : undefined;
  let hash = 0;
  for (const char of `${seed}:${key}`)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    ...copy[key],
    quip: lines?.length ? lines[hash % lines.length] : undefined,
  };
}
