import type { Activity, Data } from "./types";

/** Current social examples for fictional friends; existing privacy/stale examples stay intact. */
export function addDemoSocialActivityFixtures(
  data: Data,
  viewer: string,
  now: number,
) {
  if (!data.is_demo || data.viewer_id !== viewer) return;
  const at = (minutes: number) =>
    new Date(now + minutes * 60_000).toISOString();
  const templates = data.activities
    .filter(
      (activity) =>
        activity.id.startsWith("map-status-") &&
        activity.audience !== "private" &&
        activity.status === "scheduled" &&
        Date.parse(activity.starts_at) <= now &&
        Date.parse(activity.ends_at) > now,
    )
    .slice(0, 20);
  const base = templates[0];
  if (!base) return;
  // Give some previously quiet friends explicit statuses and availability too.
  const quietFriends = data.profiles
    .filter(
      (profile) =>
        profile.id.startsWith("map-friend-") &&
        profile.id !== "map-friend-3" &&
        !data.activities.some(
          (activity) =>
            activity.owner_id === profile.id && activity.mode === "solo",
        ),
    )
    .slice(0, 10);
  quietFriends.forEach((profile, index) => {
    const status: Activity = {
      ...base,
      id: `demo-social-status-${profile.id}`,
      owner_id: profile.id,
      title: [
        "Free for a coffee break",
        "Reading at the park",
        "Taking a neighborhood walk",
        "Trying a new recipe",
        "A little sketching time",
      ][index % 5],
      description: "Send me a message if you are nearby.",
      audience: "friends",
      audience_id: null,
      available: index % 3 !== 2,
      starts_at: at(-15),
      ends_at: at(90 + (index % 3) * 30),
    };
    data.activities.push(status);
    templates.push(status);
  });
  const gatherings = [
    ["Coffee and a neighborhood catch-up", "Social"],
    ["A few friendly games of pickup", "Fitness"],
    ["Quiet study table at the library", "Study"],
    ["Sketching together at the park", "Creative"],
    ["Co-op games and good company", "Gaming"],
    ["A relaxed riverwalk", "Social"],
  ] as const;
  const presences = (data.presence ??= []);
  templates.forEach((source, index) => {
    const hosting = index < 12;
    const [title, category] = gatherings[index % gatherings.length];
    const activity: Activity = {
      ...source,
      id: `demo-social-${source.owner_id}`,
      title: hosting ? title : source.title,
      description: hosting
        ? "A small, easygoing hangout. Friends are welcome to join."
        : source.description,
      mode: hosting ? "squad" : "solo",
      solo_purpose: hosting ? undefined : "activity_note",
      category: hosting ? category : source.category,
      audience: "friends",
      audience_id: null,
      starts_at: at(-20 - index),
      ends_at: at(90 + (index % 4) * 30),
      status_attachment: null,
      status_presentation: "text_only",
      status_show_current_beacon: false,
      status_current_beacon_id: null,
      status_current_beacon: null,
      approval_required: false,
      available: source.available,
    };
    data.activities.push(activity);
    if (hosting) {
      const place = data.places.find((row) => row.activity_id === source.id);
      if (place) data.places.push({ ...place, activity_id: activity.id });
    }
    presences.push({
      owner_id: source.owner_id,
      sharing: true,
      availability: activity.available ? "available" : "busy",
      availability_until: source.ends_at,
      availability_audience: "friends",
      availability_audience_id: null,
      show_current_beacon: hosting,
      current_beacon_id: hosting ? activity.id : null,
      current_audience: "friends",
      current_audience_id: null,
      current_activity: {
        type: hosting ? "beacon" : "activity_note",
        id: activity.id,
        ...(hosting ? { role: "hosting" as const } : {}),
      },
    });
  });
}
