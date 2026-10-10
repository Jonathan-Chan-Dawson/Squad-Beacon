import test from "node:test";
import assert from "node:assert/strict";
import { makeDemo, DEMO_ID } from "@/src/shared/demo";
import {
  profileEditorDraft,
  profileEditorPayload,
  profileSavePayload,
  requireProfileOwner,
  validateProfileEditor,
} from "@/src/features/profile/profileEditorDraft";

const ownProfile = () =>
  structuredClone(makeDemo().profiles.find((item) => item.id === DEMO_ID)!);

test("editor merges only changed fields with the synchronous latest settings and profile", () => {
  const initial = ownProfile(),
    baseline = profileEditorDraft(initial);
  const draft = { ...baseline, name: "New name" };
  const latest = {
    ...initial,
    bio: "Changed elsewhere",
    home: "New home",
    quiet_start: 18,
    quiet_end: 7,
    timezone: "Europe/London",
    default_audience: "private" as const,
    profile_visibility: "custom" as const,
  };
  const saved = profileEditorPayload(latest, baseline, draft);
  assert.equal(saved.name, "New name");
  assert.equal(saved.bio, "Changed elsewhere");
  assert.equal(saved.home, "New home");
  assert.equal(saved.quiet_start, 18);
  assert.equal(saved.quiet_end, 7);
  assert.equal(saved.timezone, "Europe/London");
  assert.equal(saved.default_audience, "private");
  assert.ok(!("profile_visibility" in saved));
  assert.ok(!("viewer_can_view_full_profile" in saved));
  assert.ok(!("id" in saved));
});

test("settings payload preserves profile edits and never writes private projections", () => {
  const latest = {
    ...ownProfile(),
    name: "Saved by editor",
    quote: "Keep this",
    viewer_can_view_full_profile: true,
  };
  const saved = profileSavePayload(latest, {
    quiet_start: 22,
    default_audience: "private",
  });
  assert.equal(saved.name, "Saved by editor");
  assert.equal(saved.quote, "Keep this");
  assert.equal(saved.quiet_start, 22);
  assert.equal(saved.default_audience, "private");
  assert.ok(!("viewer_can_view_full_profile" in saved));
});

test("survey/editor weekly-target edits preserve existing aspiration identity and unrelated fields", () => {
  const profile = {
    ...ownProfile(),
    aspiration_goals: [
      {
        id: "linked-goal",
        title: "Walk",
        category: "Fitness",
        target_per_week: 2,
      },
    ],
    birthday_note: "June",
    personality: "Thoughtful",
    aspirations: "See the coast",
    featured_activity_id: "featured",
  };
  const baseline = profileEditorDraft(profile);
  const draft = validateProfileEditor({
    ...baseline,
    aspiration_goals: [{ ...baseline.aspiration_goals[0], target_per_week: 5 }],
  });
  const saved = profileEditorPayload(profile, baseline, draft);
  assert.deepEqual(saved.aspiration_goals, [
    {
      id: "linked-goal",
      title: "Walk",
      category: "Fitness",
      target_per_week: 5,
    },
  ]);
  assert.equal(saved.birthday_note, "June");
  assert.equal(saved.personality, "Thoughtful");
  assert.equal(saved.aspirations, "See the coast");
  assert.equal(saved.featured_activity_id, "featured");
  assert.equal(profile.aspiration_goals[0].target_per_week, 2);
});

test("owner guard rejects null, signed-out and changed-viewer snapshots", () => {
  const profile = ownProfile();
  assert.equal(requireProfileOwner(profile, profile.id), profile);
  assert.throws(() => requireProfileOwner(null, profile.id));
  assert.throws(() => requireProfileOwner(profile, null));
  assert.throws(() =>
    requireProfileOwner({ ...profile, id: "other-account" }, profile.id),
  );
});

test("editor trims text and rejects invalid server-bound weekly targets", () => {
  const draft = profileEditorDraft(ownProfile());
  const clean = validateProfileEditor({
    ...draft,
    name: "  Alex  ",
    bio: "  Hello  ",
    interests: [" Walking ", "Walking", ""],
    identity_tags: [" Introvert ", "Introvert"],
  });
  assert.equal(clean.name, "Alex");
  assert.equal(clean.bio, "Hello");
  assert.deepEqual(clean.interests, ["Walking"]);
  assert.deepEqual(clean.identity_tags, ["Introvert"]);
  for (const target of [0, 8, 2.5]) {
    assert.throws(() =>
      validateProfileEditor({
        ...draft,
        aspiration_goals: [
          {
            id: "goal",
            title: "Read",
            category: "Study",
            target_per_week: target,
          },
        ],
      }),
    );
  }
  assert.throws(() => validateProfileEditor({ ...draft, name: " " }));
});
