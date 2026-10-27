import { DEMO_ID, makeDemo } from "@/src/shared/demo";
import { emptyData, normalizeData, type Data } from "@/src/shared/types";
import type { OnboardingKey } from "./progress";

export const scenarios = {
  fresh: "Fresh account",
  disconnected: "No friends or Squads",
  friends: "Friends, no commitments",
  discovery: "Discoverable Beacons",
  responses: "Pending Ping and Vote",
  noHistory: "No history or saves",
  filtered: "Restrictive filters",
  offline: "Simulated connection error",
  invitation: "Incoming invitation",
  populated: "Populated demo",
} as const;
export type DemoScenario = keyof typeof scenarios;
export const scenarioTime = Date.parse("2026-10-26T18:00:00Z");
export function makeScenario(name: DemoScenario): {
  data: Data;
  progress: OnboardingKey[];
} {
  if (name === "populated" || name === "filtered")
    return { data: normalizeData(makeDemo()), progress: ["welcome.seen.v1"] };
  // Construct from an empty snapshot, never prune a connected graph into orphans.
  const reference = makeDemo();
  const profile = structuredClone(
    reference.profiles.find((p) => p.id === DEMO_ID)!,
  );
  profile.onboarding_survey_status = "skipped";
  profile.featured_activity_id = null;
  const data = {
    ...emptyData(),
    is_demo: true,
    viewer_id: DEMO_ID,
    profiles: [profile],
    capabilities: reference.capabilities,
  };
  const other = structuredClone(
    reference.profiles.find((p) => p.id !== DEMO_ID)!,
  );
  other.featured_activity_id = null;
  if (["friends", "responses", "invitation", "discovery"].includes(name))
    data.profiles.push(other);
  if (["friends", "responses"].includes(name))
    data.friendships.push({
      id: "lab-friend",
      sender_id: DEMO_ID,
      recipient_id: other.id,
      status: "accepted",
    });
  if (name === "invitation")
    data.friendships.push({
      id: "lab-invitation",
      sender_id: other.id,
      recipient_id: DEMO_ID,
      status: "pending",
    });
  if (name === "responses")
    for (const kind of ["ping", "vote"] as const)
      data.planning_threads.push({
        id: `lab-${kind}`,
        owner_id: other.id,
        coowner_ids: [],
        kind,
        title: kind === "ping" ? "Coffee this week?" : "Choose our next outing",
        body: "A small plan with a friend.",
        audience: "friends",
        audience_id: null,
        deadline_at: new Date(scenarioTime + 365 * 86400000).toISOString(),
        status: "open",
        payload: null,
        winner_proposal_id: null,
        replaced_from_proposal_id: null,
        materialized_activity_id: null,
        created_at: new Date(scenarioTime).toISOString(),
        resolved_at: null,
      });
  if (name === "responses") {
    const draft = {
      title: "Coffee and a walk",
      description: "A small outing.",
      category: "Social" as const,
      mode: "squad" as const,
      starts_at: new Date(scenarioTime + 365 * 86400000).toISOString(),
      ends_at: new Date(scenarioTime + 365 * 86400000 + 3600000).toISOString(),
      timezone: "America/Chicago",
      approval_required: false,
      audience: "friends" as const,
      audience_id: null,
      target_count: null,
      label: "",
      online_url: null,
      latitude: null,
      longitude: null,
      aspiration_ids: [],
    };
    data.planning_threads[0].payload = draft;
    for (const [index, title] of [
      "Coffee and a walk",
      "A relaxed lunch",
    ].entries())
      data.planning_proposals.push({
        id: `lab-option-${index}`,
        thread_id: "lab-vote",
        author_id: other.id,
        payload: { ...draft, title },
        approved: true,
        disqualified_at: null,
        created_at: new Date(scenarioTime).toISOString(),
        activity_id: null,
      });
  }
  if (name === "discovery") {
    data.activities.push({
      id: "lab-public",
      owner_id: other.id,
      title: "A walk and a good coffee",
      category: "Social",
      mode: "squad",
      audience: "friends",
      audience_id: null,
      starts_at: new Date(scenarioTime + 365 * 86400000).toISOString(),
      ends_at: new Date(scenarioTime + 365 * 86400000 + 3600000).toISOString(),
      timezone: "America/Chicago",
      approval_required: false,
      status: "scheduled",
      goal_id: null,
      habit_id: null,
      plan_id: null,
      plan_step_index: null,
      aspiration_ids: [],
    });
    data.public_beacons = [
      {
        activity_id: "lab-public",
        title: "A walk and a good coffee",
        category: "Social",
        interest_tags: [],
        starts_at: data.activities[0].starts_at,
        ends_at: data.activities[0].ends_at,
        area_label: "Auburn",
        coarse_lat: 47.3073,
        coarse_lng: -122.2285,
        requires_approval: false,
        capacity_limit: null,
        capacity_policy: "soft",
        accepted_seat_count: 1,
        closed: false,
      },
    ];
  }
  return {
    data: normalizeData(data),
    progress: name === "fresh" ? ["entry.eligible.v1"] : ["welcome.seen.v1"],
  };
}
