import type { Activity, Data } from "./types";

/** Fictional Map stress examples only; never used for connected accounts. */
export function addDemoMapFixtures(data: Data, viewer: string, now: number) {
  const removed = new Set([1, 4, 7, 10, 11, 12, 13, 14, 16, 17, 18, 19].map(i => `neighborhood-${i}`));
  data.activities = data.activities.filter(row => !removed.has(row.id));
  data.places = data.places.filter(row => !removed.has(row.activity_id));
  data.rsvps = data.rsvps.filter(row => !removed.has(row.activity_id));
  data.public_beacons = data.public_beacons.filter(row => !removed.has(row.activity_id));
  data.activity_social_links = data.activity_social_links.filter(row => !removed.has(row.activity_id));
  const base = data.activities.find(row => row.id === "a1")!;
  const profile = data.profiles.find(row => row.id === viewer)!;
  const organization = data.organizations.find(row => row.id === "org-lakefront-collective")!;
  const at = (hours: number) => new Date(now + hours * 3600000).toISOString();
  const firstNames = ["Amara", "Diego", "Priya", "Theo", "Leila", "Hugo", "Sofia", "Kenji", "Isla", "Omar", "Nora", "Felix"];
  const lastNames = ["Alvarez", "Okafor", "Laurent", "Sato", "Malik", "Novak", "Costa", "Reyes", "Singh", "Bennett"];
  const statuses = ["Free for coffee", "Studying at the library", "Taking a riverwalk", "Making art", "Playing a few co-op rounds", "Gardening outside",
    "Trying a new lunch spot", "Finishing a project", "Training for a 5K", "Practicing guitar", "Board games and snacks", "Walking the dog"];
  const categories = ["Social", "Study", "Fitness", "Creative", "Gaming", "Other"] as const;
  const friendCount = 120;
  // Fixed seed keeps random-looking locations reproducible across refreshes and tests.
  let seed = 20261012;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const hubs = [[41.884, -87.634], [41.899, -87.642], [41.875, -87.652], [41.925, -87.655]];
  const crewId = "map-demo-roaming-crew";
  data.squads.push({ ...data.squads.find(row => row.id === "boxing")!, id: crewId, owner_id: viewer,
    name: "Chicago roaming crew", description: "Demo friends exploring different parts of the city.", icon_key: "users" });
  data.squad_members.push({ squad_id: crewId, user_id: viewer, role: "owner" });
  for (let i = 0; i < friendCount; i++) {
    const id = `map-friend-${i}`;
    data.profiles.push({ ...profile, id, name: `${firstNames[i % 12]} ${lastNames[Math.floor(i / 12)]}`,
      username: `lakefront.${i}`, bio: `${statuses[i % statuses.length]}. Exploring Chicago with friends.`,
      interests: [categories[i % 6], categories[(i + 2) % 6]], featured_activity_id: null, avatar_seed: (i * 37 + 11) % 216,
      avatar_style: "illustrated", profile_visibility: "friends" });
    data.friendships.push({ id: `friend-${id}`, sender_id: viewer, recipient_id: id, status: "accepted" });
    if (i % 5 !== 4) data.organization_members.push({ organization_id: organization.id, user_id: id, role: "member", status: "active",
      invited_by: organization.owner_id, created_at: at(-48) });
    if (i % 3 === 0) data.squad_members.push({ squad_id: crewId, user_id: id, role: "member" });
    const hub = hubs[Math.floor(i / 6) % hubs.length];
    const latitude = i % 5 < 2 ? hub[0] + (random() - 0.5) * 0.0012 : 41.84 + random() * 0.12;
    const longitude = i % 5 < 2 ? hub[1] + (random() - 0.5) * 0.0012 : -87.75 + random() * 0.10;
    data.locations.push({ id: `loc-${id}`, owner_id: id, latitude, longitude,
      updated_at: at(i % 20 === 18 ? -25 : -(i % 6) * 0.1), expires_at: at(i % 20 === 19 ? -0.1 : i % 3 === 0 ? 0.5 : 24) });
    // Solo status records supply avatar availability; they do not add normal Beacon pins.
    if (i % 8 !== 3) {
      const activityId = `map-status-${i}`;
      const audience = i % 8 === 6 ? "private" : i % 3 === 0 ? "squad" : i % 3 === 1 && i % 5 !== 4 ? "organization" : "friends";
      data.activities.push({ ...base, id: activityId, owner_id: id, title: statuses[i % statuses.length],
        description: i % 3 === 0 ? "" : i % 3 === 1 ? "Finishing up here. Happy to hang out afterward if you are nearby." : "Taking some time for this today. Send me a message to make a plan for later.",
        category: categories[i % 6], mode: "solo", available: i % 8 < 2, audience,
        audience_id: audience === "squad" ? crewId : audience === "organization" ? organization.id : null,
        enable_reactions: i % 16 !== 7,
        starts_at: at(i % 8 === 5 ? 1 : -(i % 4 + 1) * 0.1), ends_at: at(i % 8 === 4 ? -0.05 : i % 8 === 0 ? 0.15 : 2), plan_id: null, goal_id: null, habit_id: null,
        plan_step_index: null, aspiration_ids: [] });
      data.places.push({ activity_id: activityId, label: ["Neighborhood cafe", "Harbor Library", "Chicago Riverwalk", "Art studio", "Game lounge", "Community garden"][i % 6], latitude, longitude, online_url: null });
    }
  }
  organization.member_count = 1 + data.organization_members.filter(row => row.organization_id === organization.id && row.status === "active").length;
  const event = (id: string, title: string, start: number, end: number, latitude: number, longitude: number, patch: Partial<Activity> = {}) => {
    const activity: Activity = { ...base, id, owner_id: "maya", title, description: "A distinct demo Map example.", category: "Social",
      mode: "squad", audience: "friends", audience_id: null, starts_at: at(start), ends_at: at(end),
      available: false, approval_required: false, plan_id: null, plan_step_index: null, goal_id: null, habit_id: null, aspiration_ids: [], ...patch };
    data.activities.push(activity);
    data.places.push({ activity_id: id, label: title, latitude, longitude, online_url: null });
    return activity;
  };
  event("map-past-origami", "Morning origami swap", -4, -2, 41.887, -87.638);
  event("map-past-mural", "Yesterday's mural sketch walk", -20, -18, 41.88, -87.646);
  event("map-past-archive", "Archive: board-game swap", -27, -25, 41.874, -87.642);
  event("map-org-dragonboat", "Lakefront dragon-boat practice", -0.5, 2, 41.903, -87.629,
    { category: "Fitness", audience: "organization", audience_id: organization.id });
  event("map-org-telescope", "Rooftop telescope night", 4, 7, 41.894, -87.65,
    { owner_id: "jordan", audience: "organization", audience_id: organization.id });
  event("map-extra-yoga", "Lakeside lunchtime yoga", -0.25, 1, 41.899, -87.621, { category: "Fitness" });
  event("map-extra-study", "Library study sprint", 0, 2, 41.876, -87.628, { category: "Study" });
  event("map-extra-games", "Board games at the cafe", 2, 4, 41.889, -87.648, { category: "Gaming" });
  event("map-extra-sketch", "Riverwalk sketch circle", 1, 3, 41.888, -87.626, { category: "Creative" });
  event("map-extra-coffee", "Coffee and new friends", 3, 4.5, 41.882, -87.652);
  event("map-extra-volunteer", "Neighborhood garden cleanup", 20, 22, 41.871, -87.655, { category: "Other" });
  event("map-extra-run", "Easy evening lakefront run", 5, 6.5, 41.912, -87.625, { category: "Fitness" });
  event("map-extra-music", "Acoustic open mic", 6, 8, 41.879, -87.643, { category: "Creative" });

  const planId = "map-plan-city-afternoon";
  data.plans.push({ id: planId, owner_id: viewer, squad_id: null, title: "Coffee, art and a lakefront walk",
    description: "A three-stop demo Beacon Plan to try on the Map.", timezone: "America/Chicago",
    start_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(now)),
    status: "scheduled", created_at: at(-1) });
  for (const [index, stop] of [
    { id: "map-plan-coffee", title: "Plan stop 1: Coffee together", category: "Social" as const, latitude: 41.882, longitude: -87.633 },
    { id: "map-plan-art", title: "Plan stop 2: Art museum visit", category: "Creative" as const, latitude: 41.8796, longitude: -87.6237 },
    { id: "map-plan-walk", title: "Plan stop 3: Lakefront stroll", category: "Fitness" as const, latitude: 41.886, longitude: -87.615 },
  ].entries()) {
    event(stop.id, stop.title, index + 1, index + 2, stop.latitude, stop.longitude,
      { owner_id: viewer, category: stop.category, plan_id: planId, plan_step_index: index, timezone: "America/Chicago",
        ...(stop.id === "map-plan-coffee" ? { capacity_limit: 8, capacity_policy: "strict" as const } : {}) });
  }
  // The first Plan stop demonstrates the compact joined-community row beside
  // its Plan link and strict capacity summary in the demo UI.
  data.activity_social_links.push({ activity_id: "map-plan-coffee", entity_type: "squad",
    entity_id: crewId, created_by: viewer, created_at: at(0) });
  const concert = event("map-public-concert", "Lakefront Summer Lights concert", 1, 5, 41.891, -87.617,
    { audience: "private", target_count: 500, capacity_limit: 500, capacity_policy: "soft" });
  const meetup = event("map-public-photo-walk", "Five-person street photography meetup", -0.1, 2, 41.881, -87.641,
    { owner_id: "neighbor-22", audience: "private", category: "Creative", target_count: 5, capacity_limit: 5, capacity_policy: "strict" });
  for (const activity of [concert, meetup]) {
    const count = activity === concert ? 40 : 3;
    for (let i = 0; i < count; i++) data.rsvps.push({ activity_id: activity.id, user_id: `map-friend-${i}`, status: "going", approved: true });
    data.public_beacons.push({ activity_id: activity.id, title: activity.title, category: activity.category,
      interest_tags: activity === concert ? ["music", "concert", "festival"] : ["photography", "meetup", "Creative"],
      starts_at: activity.starts_at, ends_at: activity.ends_at, area_label: "Chicago", coarse_lat: 41.89,
      coarse_lng: activity === concert ? -87.62 : -87.64, requires_approval: false, capacity_limit: activity.capacity_limit ?? null,
      capacity_policy: activity.capacity_policy ?? "soft", accepted_seat_count: count + 1, closed: false });
  }
  data.activity_social_links.push({ activity_id: concert.id, entity_type: "organization", entity_id: organization.id,
    created_by: "maya", created_at: at(0) });
}
