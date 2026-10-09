import type { Profile } from "@/src/shared/types";
import { avatarSeed } from "./avatarArt";

export function profileEditorDraft(profile: Profile) {
  return {
    name: profile.name, bio: profile.bio ?? "", home: profile.home ?? "",
    birthday_note: profile.birthday_note ?? "", aspirations: profile.aspirations ?? "",
    personality: profile.personality ?? "", quote: profile.quote ?? "",
    avatar_seed: profile.avatar_seed ?? avatarSeed(profile.id),
    avatar_style: profile.avatar_style ?? "illustrated",
    interests: [...(profile.interests ?? [])], identity_tags: [...(profile.identity_tags ?? [])],
    aspiration_goals: (profile.aspiration_goals ?? []).map((goal) => ({ ...goal })),
    hide_featured: profile.hide_featured,
    featured_activity_id: profile.featured_activity_id,
  };
}

export type ProfileEditorDraft = ReturnType<typeof profileEditorDraft>;

export function requireProfileOwner(profile: Profile, viewerId: string | null) {
  if (!viewerId || profile.id !== viewerId)
    throw new Error("Your profile session changed. Reopen the editor.");
  return profile;
}

/** The legacy profile action requires settings fields; merge them from the latest snapshot. */
export function profileEditorPayload(
  latest: Profile, baseline: ProfileEditorDraft, draft: ProfileEditorDraft,
) {
  const merged = profileEditorDraft(latest);
  for (const field of Object.keys(draft) as (keyof ProfileEditorDraft)[]) {
    if (JSON.stringify(draft[field]) !== JSON.stringify(baseline[field])) {
      Object.assign(merged, { [field]: draft[field] });
    }
  }
  return profileSavePayload(latest, merged);
}

/** Enumerate writable fields; profile visibility and server projections have their own contract. */
type ProfileSaveEdits = Partial<ProfileEditorDraft & Pick<Profile,
  "timezone" | "quiet_start" | "quiet_end" | "default_audience" | "onboarding_survey_status"
>>;
export function profileSavePayload(latest: Profile, edits: ProfileSaveEdits = {}) {
  return {
    ...profileEditorDraft(latest),
    timezone: latest.timezone, quiet_start: latest.quiet_start, quiet_end: latest.quiet_end,
    default_audience: latest.default_audience ?? "friends",
    onboarding_survey_status: latest.onboarding_survey_status,
    ...edits,
  };
}

export function validateProfileEditor(draft: ProfileEditorDraft) {
  if (!draft.name.trim() || draft.name.trim().length > 80)
    throw new Error("Add a name with up to 80 characters.");
  if (draft.bio.trim().length > 500) throw new Error("Keep your bio under 500 characters.");
  if (draft.home.length > 120 || draft.birthday_note.length > 80 || draft.aspirations.length > 500 ||
    draft.personality.length > 80 || draft.quote.length > 300)
    throw new Error("One of your optional profile details is too long.");
  if (draft.identity_tags.length > 50 || draft.identity_tags.some((tag) => !tag.trim() || tag.trim().length > 60))
    throw new Error("Choose up to 50 identity badges, each under 60 characters.");
  if (draft.aspiration_goals.length > 20 || draft.aspiration_goals.some((goal) =>
    !goal.id.trim() || goal.id.length > 80 || !goal.title.trim() || goal.title.trim().length > 100 ||
    !goal.category.trim() || goal.category.length > 60 ||
    !Number.isInteger(goal.target_per_week) || goal.target_per_week < 1 || goal.target_per_week > 7))
    throw new Error("Give each aspiration a title and a weekly target from 1 to 7.");
  return {
    ...draft, name: draft.name.trim(), bio: draft.bio.trim(),
    interests: [...new Set(draft.interests.map((value) => value.trim()).filter(Boolean))],
    identity_tags: [...new Set(draft.identity_tags.map((value) => value.trim()))],
    aspiration_goals: draft.aspiration_goals.map((goal) => ({ ...goal, title: goal.title.trim() })),
  };
}
