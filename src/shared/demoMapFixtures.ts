import type { Activity, Category, Data } from "./types";

// Fictional activity around real cities. Auburn has a tighter campus core
// so the demo shows regional summaries as well as dense, walkable clusters.
const REGIONAL_HUBS = [
  ["auburn", "Auburn University, AL", 32.603, -85.486, "America/Chicago"],
  ["atlanta", "Atlanta, GA", 33.778, -84.385, "America/New_York"],
  ["nashville", "Nashville, TN", 36.157, -86.783, "America/Chicago"],
  ["miami", "Miami, FL", 25.779, -80.198, "America/New_York"],
  ["new-york", "New York, NY", 40.734, -73.991, "America/New_York"],
  ["boston", "Boston, MA", 42.354, -71.071, "America/New_York"],
  ["minneapolis", "Minneapolis, MN", 44.977, -93.265, "America/Chicago"],
  ["austin", "Austin, TX", 30.274, -97.748, "America/Chicago"],
  ["denver", "Denver, CO", 39.74, -104.98, "America/Denver"],
  ["los-angeles", "Los Angeles, CA", 34.053, -118.245, "America/Los_Angeles"],
  ["san-francisco", "San Francisco, CA", 37.769, -122.439, "America/Los_Angeles"],
  ["seattle", "Seattle, WA", 47.614, -122.331, "America/Los_Angeles"],
  ["anchorage", "Anchorage, AK", 61.218, -149.9, "America/Anchorage"],
  ["phoenix", "Phoenix, AZ", 33.448, -112.074, "America/Phoenix"],
  ["little-rock", "Little Rock, AR", 34.747, -92.289, "America/Chicago"],
  ["hartford", "Hartford, CT", 41.765, -72.674, "America/New_York"],
  ["wilmington", "Wilmington, DE", 39.74, -75.551, "America/New_York"],
  ["washington", "Washington, DC", 38.909, -77.034, "America/New_York"],
  ["honolulu", "Honolulu, HI", 21.31, -157.858, "Pacific/Honolulu"],
  ["boise", "Boise, ID", 43.616, -116.202, "America/Boise"],
  ["indianapolis", "Indianapolis, IN", 39.769, -86.158, "America/Indiana/Indianapolis"],
  ["des-moines", "Des Moines, IA", 41.588, -93.623, "America/Chicago"],
  ["wichita", "Wichita, KS", 37.687, -97.337, "America/Chicago"],
  ["louisville", "Louisville, KY", 38.253, -85.753, "America/New_York"],
  ["new-orleans", "New Orleans, LA", 29.951, -90.071, "America/Chicago"],
  ["portland-me", "Portland, ME", 43.661, -70.262, "America/New_York"],
  ["baltimore", "Baltimore, MD", 39.295, -76.614, "America/New_York"],
  ["detroit", "Detroit, MI", 42.334, -83.05, "America/Detroit"],
  ["jackson", "Jackson, MS", 32.3, -90.185, "America/Chicago"],
  ["st-louis", "St. Louis, MO", 38.636, -90.251, "America/Chicago"],
  ["missoula", "Missoula, MT", 46.872, -114.002, "America/Denver"],
  ["omaha", "Omaha, NE", 41.258, -95.936, "America/Chicago"],
  ["las-vegas", "Las Vegas, NV", 36.17, -115.14, "America/Los_Angeles"],
  ["manchester", "Manchester, NH", 42.992, -71.463, "America/New_York"],
  ["jersey-city", "Jersey City, NJ", 40.725, -74.058, "America/New_York"],
  ["albuquerque", "Albuquerque, NM", 35.085, -106.651, "America/Denver"],
  ["raleigh", "Raleigh, NC", 35.78, -78.639, "America/New_York"],
  ["fargo", "Fargo, ND", 46.877, -96.791, "America/Chicago"],
  ["columbus", "Columbus, OH", 39.969, -83.002, "America/New_York"],
  ["oklahoma-city", "Oklahoma City, OK", 35.467, -97.516, "America/Chicago"],
  ["portland-or", "Portland, OR", 45.523, -122.682, "America/Los_Angeles"],
  ["philadelphia", "Philadelphia, PA", 39.953, -75.165, "America/New_York"],
  ["providence", "Providence, RI", 41.825, -71.413, "America/New_York"],
  ["greenville", "Greenville, SC", 34.85, -82.399, "America/New_York"],
  ["sioux-falls", "Sioux Falls, SD", 43.548, -96.731, "America/Chicago"],
  ["salt-lake-city", "Salt Lake City, UT", 40.761, -111.891, "America/Denver"],
  ["burlington", "Burlington, VT", 44.477, -73.208, "America/New_York"],
  ["richmond", "Richmond, VA", 37.541, -77.436, "America/New_York"],
  ["morgantown", "Morgantown, WV", 39.631, -79.955, "America/New_York"],
  ["madison", "Madison, WI", 43.074, -89.401, "America/Chicago"],
  ["cheyenne", "Cheyenne, WY", 41.14, -104.818, "America/Denver"],
] as const;

const STATEWIDE_BEACON_CITIES = [
  ["gary", "Gary, IN", 41.59, -87.34, "America/Chicago"],
  ["valparaiso", "Valparaiso, IN", 41.47, -87.06, "America/Chicago"],
  ["south-bend", "South Bend, IN", 41.68, -86.25, "America/Indiana/Indianapolis"],
  ["elkhart", "Elkhart, IN", 41.68, -85.97, "America/Indiana/Indianapolis"],
  ["fort-wayne", "Fort Wayne, IN", 41.08, -85.14, "America/Indiana/Indianapolis"],
  ["lafayette", "Lafayette, IN", 40.42, -86.89, "America/Indiana/Indianapolis"],
  ["kokomo", "Kokomo, IN", 40.49, -86.13, "America/Indiana/Indianapolis"],
  ["muncie", "Muncie, IN", 40.19, -85.39, "America/Indiana/Indianapolis"],
  ["terre-haute", "Terre Haute, IN", 39.47, -87.41, "America/Indiana/Indianapolis"],
  ["bloomington", "Bloomington, IN", 39.17, -86.53, "America/Indiana/Indianapolis"],
  ["columbus-in", "Columbus, IN", 39.2, -85.92, "America/Indiana/Indianapolis"],
  ["richmond-in", "Richmond, IN", 39.83, -84.89, "America/Indiana/Indianapolis"],
  ["evansville", "Evansville, IN", 37.97, -87.57, "America/Chicago"],
  ["new-albany", "New Albany, IN", 38.29, -85.82, "America/Indiana/Indianapolis"],
  ["toledo", "Toledo, OH", 41.65, -83.54, "America/New_York"],
  ["sandusky", "Sandusky, OH", 41.45, -82.71, "America/New_York"],
  ["cleveland", "Cleveland, OH", 41.5, -81.69, "America/New_York"],
  ["akron", "Akron, OH", 41.08, -81.52, "America/New_York"],
  ["youngstown", "Youngstown, OH", 41.1, -80.65, "America/New_York"],
  ["canton", "Canton, OH", 40.8, -81.38, "America/New_York"],
  ["mansfield", "Mansfield, OH", 40.76, -82.52, "America/New_York"],
  ["lima", "Lima, OH", 40.74, -84.1, "America/New_York"],
  ["findlay", "Findlay, OH", 41.04, -83.65, "America/New_York"],
  ["dayton", "Dayton, OH", 39.76, -84.19, "America/New_York"],
  ["springfield-oh", "Springfield, OH", 39.93, -83.81, "America/New_York"],
  ["cincinnati", "Cincinnati, OH", 39.1, -84.51, "America/New_York"],
  ["athens-oh", "Athens, OH", 39.33, -82.1, "America/New_York"],
  ["marietta", "Marietta, OH", 39.42, -81.45, "America/New_York"],
  ["portsmouth", "Portsmouth, OH", 38.73, -82.99, "America/New_York"],
  ["birmingham", "Birmingham, AL", 33.52, -86.81, "America/Chicago"],
  ["huntsville", "Huntsville, AL", 34.73, -86.59, "America/Chicago"],
  ["decatur", "Decatur, AL", 34.61, -86.98, "America/Chicago"],
  ["florence", "Florence, AL", 34.8, -87.68, "America/Chicago"],
  ["tuscaloosa", "Tuscaloosa, AL", 33.21, -87.57, "America/Chicago"],
  ["montgomery", "Montgomery, AL", 32.38, -86.3, "America/Chicago"],
  ["anniston", "Anniston, AL", 33.66, -85.83, "America/Chicago"],
  ["dothan", "Dothan, AL", 31.22, -85.39, "America/Chicago"],
  ["mobile", "Mobile, AL", 30.69, -88.04, "America/Chicago"],
] as const;

const STANDALONE_BEACON_CITIES = [
  ["bar-harbor", "Bar Harbor, ME", 44.39, -68.2, "America/New_York"],
  ["plattsburgh", "Plattsburgh, NY", 44.7, -73.45, "America/New_York"],
  ["corning", "Corning, NY", 42.14, -77.05, "America/New_York"],
  ["cape-may", "Cape May, NJ", 38.94, -74.91, "America/New_York"],
  ["beaufort", "Beaufort, NC", 34.72, -76.66, "America/New_York"],
  ["savannah", "Savannah, GA", 32.08, -81.09, "America/New_York"],
  ["key-west", "Key West, FL", 24.56, -81.79, "America/New_York"],
  ["natchez", "Natchez, MS", 31.56, -91.4, "America/Chicago"],
  ["hot-springs", "Hot Springs, AR", 34.51, -93.05, "America/Chicago"],
  ["marfa", "Marfa, TX", 30.31, -104.02, "America/Chicago"],
  ["dodge-city", "Dodge City, KS", 37.75, -100.02, "America/Chicago"],
  ["north-platte", "North Platte, NE", 41.14, -100.76, "America/Chicago"],
  ["decorah", "Decorah, IA", 43.3, -91.79, "America/Chicago"],
  ["duluth", "Duluth, MN", 46.79, -92.1, "America/Chicago"],
  ["marquette", "Marquette, MI", 46.54, -87.4, "America/Detroit"],
  ["medora", "Medora, ND", 46.91, -103.52, "America/Denver"],
  ["sheridan", "Sheridan, WY", 44.8, -106.96, "America/Denver"],
  ["durango", "Durango, CO", 37.27, -107.88, "America/Denver"],
  ["moab", "Moab, UT", 38.57, -109.55, "America/Denver"],
  ["flagstaff", "Flagstaff, AZ", 35.2, -111.65, "America/Phoenix"],
  ["taos", "Taos, NM", 36.41, -105.57, "America/Denver"],
  ["ely", "Ely, NV", 39.25, -114.89, "America/Los_Angeles"],
  ["bishop", "Bishop, CA", 37.36, -118.4, "America/Los_Angeles"],
  ["eureka", "Eureka, CA", 40.8, -124.16, "America/Los_Angeles"],
  ["bend", "Bend, OR", 44.06, -121.31, "America/Los_Angeles"],
  ["walla-walla", "Walla Walla, WA", 46.07, -118.34, "America/Los_Angeles"],
  ["sandpoint", "Sandpoint, ID", 48.28, -116.55, "America/Los_Angeles"],
  ["sitka", "Sitka, AK", 57.05, -135.33, "America/Sitka"],
  ["hilo", "Hilo, HI", 19.72, -155.09, "Pacific/Honolulu"],
] as const;

const REGIONAL_EVENTS = [
  ["Library study sprint", "Study", "Campus library"],
  ["Pickup basketball", "Fitness", "Recreation courts"],
  ["Coffee and conversation", "Social", "Neighborhood cafe"],
  ["Outdoor sketch circle", "Creative", "Arts plaza"],
  ["Board game meetup", "Gaming", "Game lounge"],
  ["Volunteer garden hour", "Other", "Community garden"],
  ["Easy group run", "Fitness", "Greenway trailhead"],
  ["Street photography walk", "Creative", "Main square"],
  ["Lunch and language exchange", "Social", "Food hall"],
  ["Open study table", "Study", "Reading room"],
  ["Co-op game night", "Gaming", "Student commons"],
  ["Bike repair meetup", "Other", "Community workshop"],
] as const satisfies readonly (readonly [string, Category, string])[];

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
  const event = (id: string, title: string, start: number, end: number, latitude: number, longitude: number, patch: Partial<Activity> = {}, placeLabel = title) => {
    const activity: Activity = { ...base, id, owner_id: "maya", title, description: "A distinct demo Map example.", category: "Social",
      mode: "squad", audience: "friends", audience_id: null, starts_at: at(start), ends_at: at(end),
      available: false, approval_required: false, plan_id: null, plan_step_index: null, goal_id: null, habit_id: null, aspiration_ids: [], ...patch };
    data.activities.push(activity);
    data.places.push({ activity_id: id, label: placeLabel, latitude, longitude, online_url: null });
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

  const publishRegionalBeacon = (activity: Activity, area: string, latitude: number, longitude: number) => {
    // The public summary exposes only rounded coordinates.
    data.public_beacons.push({
      activity_id: activity.id, title: activity.title, category: activity.category, interest_tags: [activity.category],
      starts_at: activity.starts_at, ends_at: activity.ends_at, area_label: area,
      coarse_lat: Math.round(latitude * 100) / 100, coarse_lng: Math.round(longitude * 100) / 100,
      requires_approval: false, capacity_limit: null, capacity_policy: "soft", accepted_seat_count: 1, closed: false,
    });
  };

  for (const [regionIndex, [region, area, centerLat, centerLng, timezone]] of REGIONAL_HUBS.entries()) {
    const campus = region === "auburn";
    const regionalFriendCount = campus ? 36 : 12;
    const point = (index: number) => {
      const tightlyGrouped = index % 3 !== 2;
      const spread = campus ? (tightlyGrouped ? 0.002 : 0.011) : (tightlyGrouped ? 0.007 : 0.085);
      return [centerLat + (random() - 0.5) * spread, centerLng + (random() - 0.5) * spread] as const;
    };
    const friendId = (index: number) => `map-region-${region}-friend-${index}`;
    for (let i = 0; i < regionalFriendCount; i++) {
      const id = friendId(i);
      const [latitude, longitude] = point(i);
      const slot = regionIndex * 13 + i;
      const givenName = firstNames[slot % firstNames.length];
      const familyName = lastNames[(regionIndex + Math.floor(i / firstNames.length)) % lastNames.length];
      const category = categories[(i + regionIndex) % categories.length];
      data.profiles.push({
        ...profile, id, username: `${region}.friend${i}`, name: `${givenName} ${familyName}`,
        bio: `Based near ${area}.`, interests: [category], featured_activity_id: null,
        avatar_seed: (slot * 53 + 7) % 216, avatar_style: "illustrated", profile_visibility: "friends",
      });
      data.friendships.push({ id: `friend-${id}`, sender_id: viewer, recipient_id: id, status: "accepted" });
      data.locations.push({ id: `loc-${id}`, owner_id: id, latitude, longitude, updated_at: at(-(i % 5) * 0.1), expires_at: at(8) });
      if (i % 4 !== 3) {
        event(`map-region-${region}-status-${i}`, statuses[(i + regionIndex) % statuses.length], -0.1, i % 4 === 1 ? 0.15 : 2,
          latitude, longitude, { owner_id: id, mode: "solo", solo_purpose: "status_note", available: i % 4 !== 2, category, timezone });
      }
    }
    const beaconCount = campus ? 24 : 8;
    for (let i = 0; i < beaconCount; i++) {
      const isPublic = i % 3 === 2;
      const [title, category, place] = REGIONAL_EVENTS[(i + regionIndex * 2) % REGIONAL_EVENTS.length];
      const [latitude, longitude] = point(i);
      const start = i % 4 === 0 ? -0.25 : i % 4 + 0.5;
      const activity = event(`map-region-${region}-beacon-${i}`, title, start, start + 2, latitude, longitude, {
        owner_id: friendId(i), category, timezone, audience: isPublic ? "private" : "friends",
        description: `A fictional demo meetup near ${area}.`,
      }, `${place} · ${area}`);
      if (isPublic) publishRegionalBeacon(activity, area, latitude, longitude);
    }
  }

  // The Midwest has a continuous trail from Chicago across both states.
  // The standalone cities intentionally get no extra nearby friend pins.
  const spread = [...STATEWIDE_BEACON_CITIES, ...STANDALONE_BEACON_CITIES];
  for (const [cityIndex, [city, area, centerLat, centerLng, timezone]] of spread.entries()) {
    const standalone = cityIndex >= STATEWIDE_BEACON_CITIES.length;
    const count = standalone ? 1 : city === "birmingham" ? 8 : 3;
    for (let i = 0; i < count; i++) {
      const [title, category, place] = REGIONAL_EVENTS[(cityIndex + i * 5) % REGIONAL_EVENTS.length];
      const offset = count === 1 ? 0 : i - (count - 1) / 2;
      const latitude = centerLat + offset * 0.008;
      const longitude = centerLng + (i % 2 ? 1 : -1) * offset * 0.011;
      const isPublic = standalone ? cityIndex % 3 === 0 : i % 3 === 1;
      const start = i === 0 && cityIndex % 2 === 0 ? -0.35 : 0.5 + (cityIndex + i) % 8;
      const activity = event(`map-spread-${city}-${i}`, title, start, start + 2, latitude, longitude, {
        owner_id: `map-friend-${(cityIndex * 7 + i) % friendCount}`,
        category, timezone, audience: isPublic ? "private" : "friends",
        description: `A fictional demo meetup near ${area}.`,
      }, `${place} · ${area}`);
      if (isPublic) publishRegionalBeacon(activity, area, latitude, longitude);
    }
  }
}
