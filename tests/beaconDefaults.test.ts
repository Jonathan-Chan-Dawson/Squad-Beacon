import assert from "node:assert/strict";
import test from "node:test";
import { emptyData, type Profile } from "../src/shared/types";
import {
  eligibleDefaultTargets,
  resolveDefaultAudience,
} from "../src/features/profile/settings/beaconDefaults";

function fixture() {
  const data = emptyData();
  data.viewer_id = "viewer";
  data.profiles.push({
    id: "viewer",
    name: "Viewer",
    username: "viewer",
    bio: "",
    interests: [],
    identity_tags: [],
    aspiration_goals: [],
    onboarding_survey_status: "completed",
    featured_activity_id: null,
    hide_featured: false,
    timezone: "UTC",
    quiet_start: 22,
    quiet_end: 8,
    default_audience: "private",
  } satisfies Profile);
  data.lists.push(
    { id: "mine", name: "My people", owner_id: "viewer" },
    { id: "foreign", name: "Someone else's people", owner_id: "host" },
  );
  data.squads.push({
    id: "crew",
    name: "Crew",
    description: "",
    owner_id: "host",
  });
  data.squad_members.push({
    squad_id: "crew",
    user_id: "viewer",
    role: "member",
  });
  data.organizations.push({
    id: "org",
    name: "Organization",
    description: "",
    owner_id: "host",
    created_at: "2026-10-01T00:00:00Z",
    discoverability: "public",
  });
  data.organization_members.push({
    organization_id: "org",
    user_id: "viewer",
    role: "member",
    status: "active",
    invited_by: "host",
    created_at: "2026-10-01T00:00:00Z",
  });
  return data;
}

test("device defaults require exact viewer-owned list and current snapshot", () => {
  const data = fixture();
  assert.deepEqual(
    eligibleDefaultTargets(data, "viewer", "list").map((row) => row.id),
    ["mine"],
  );
  assert.deepEqual(
    resolveDefaultAudience(data, "viewer", {
      beaconAudience: "list",
      beaconAudienceId: "foreign",
    }),
    { audience: "private", audienceId: null, fellBack: true },
  );
  data.viewer_id = "another-viewer";
  assert.deepEqual(eligibleDefaultTargets(data, "viewer", "list"), []);
  assert.deepEqual(
    resolveDefaultAudience(data, "viewer", {
      beaconAudience: "squad",
      beaconAudienceId: "crew",
    }),
    { audience: "private", audienceId: null, fellBack: true },
  );
});

test("losing Squad membership or blocking its owner prevents reusing a saved default", () => {
  const data = fixture();
  const preference = {
    beaconAudience: "squad" as const,
    beaconAudienceId: "crew",
  };
  assert.deepEqual(resolveDefaultAudience(data, "viewer", preference), {
    audience: "squad",
    audienceId: "crew",
    fellBack: false,
  });
  data.squad_members = [];
  assert.equal(
    resolveDefaultAudience(data, "viewer", preference).fellBack,
    true,
  );
  data.squad_members.push({
    squad_id: "crew",
    user_id: "viewer",
    role: "member",
  });
  data.blocks.push({ blocker_id: "host", blocked_id: "viewer" });
  assert.deepEqual(eligibleDefaultTargets(data, "viewer", "squad"), []);
});

test("readable public Organizations are insufficient without active membership", () => {
  const data = fixture();
  const preference = {
    beaconAudience: "organization" as const,
    beaconAudienceId: "org",
  };
  assert.equal(
    resolveDefaultAudience(data, "viewer", preference).audience,
    "organization",
  );
  data.organization_members[0].status = "invited";
  assert.equal(
    resolveDefaultAudience(data, "viewer", preference).fellBack,
    true,
  );
  data.organization_members[0].status = "active";
  data.organizations[0].archived_at = "2026-10-08T00:00:00Z";
  assert.deepEqual(eligibleDefaultTargets(data, "viewer", "organization"), []);
});

test("missing local target falls back to current server default and synced choices beat stale device copies", () => {
  const data = fixture();
  assert.deepEqual(
    resolveDefaultAudience(data, "viewer", {
      beaconAudience: "list",
      beaconAudienceId: "deleted",
    }),
    { audience: "private", audienceId: null, fellBack: true },
  );
  assert.deepEqual(
    resolveDefaultAudience(data, "viewer", { beaconAudience: "friends" }),
    { audience: "private", audienceId: null, fellBack: false },
  );
  data.profiles[0].default_audience = "friends";
  assert.equal(
    resolveDefaultAudience(data, "viewer", { beaconAudience: "private" })
      .audience,
    "friends",
  );
});
