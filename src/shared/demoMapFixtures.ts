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
  const lastNames = ["Alvarez", "Okafor", "Laurent", "Sato", "Malik", "Novak", "Costa", "Reyes"];
  const statuses = ["Free for coffee", "Studying at the library", "Taking a riverwalk", "Making art"];
  const categories = ["Social", "Study", "Fitness", "Creative"] as const;
  for (let i = 0; i < 96; i++) {
    const id = `map-friend-${i}`;
    data.profiles.push({ ...profile, id, name: `${firstNames[i % 12]} ${lastNames[Math.floor(i / 12)]}`,
      username: `lakefront.${i}`, bio: `${statuses[i % 4]}. Part of Lakefront Collective.`,
      interests: [categories[i % 4]], featured_activity_id: null, avatar_seed: (i * 37 + 11) % 216,
      avatar_style: "illustrated", profile_visibility: "friends" });
    data.friendships.push({ id: `friend-${id}`, sender_id: viewer, recipient_id: id, status: "accepted" });
    data.organization_members.push({ organization_id: organization.id, user_id: id, role: "member", status: "active",
      invited_by: organization.owner_id, created_at: at(-48) });
    const latitude = i < 24 ? 41.884 + (i % 6) * 0.00025 : 41.86 + (i % 12) * 0.0044;
    const longitude = i < 24 ? -87.634 + Math.floor(i / 6) * 0.00025 : -87.67 + Math.floor((i - 24) / 12) * 0.008;
    data.locations.push({ id: `loc-${id}`, owner_id: id, latitude, longitude, updated_at: at(0), expires_at: at(24) });
    // Solo status records supply avatar availability; they do not add normal Beacon pins.
    if (i % 4 !== 3) {
      const activityId = `map-status-${i}`;
      data.activities.push({ ...base, id: activityId, owner_id: id, title: statuses[i % 4], description: "Demo status",
        category: categories[i % 4], mode: "solo", available: i % 4 === 0, audience: "friends", audience_id: null,
        starts_at: at(-0.25), ends_at: at(i % 8 === 0 ? 0.15 : 2), plan_id: null, goal_id: null, habit_id: null,
        plan_step_index: null, aspiration_ids: [] });
      data.places.push({ activity_id: activityId, label: i % 4 === 1 ? "Harbor Library" : "Chicago Riverwalk", latitude, longitude, online_url: null });
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
