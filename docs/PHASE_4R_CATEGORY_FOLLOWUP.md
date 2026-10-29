# Category follow-up proposal — 2026-10-28

Phase 4R adds Walking, Outdoors, Food, Music, Work and Rest behind a light **See more** disclosure in both the Activity Note composer and Beacon appearance controls. These are activity starting points, not additional stored category values. Their parent category is shown explicitly; selecting one fills an empty title and never overwrites an existing title.

| Choice | Existing saved category |
| --- | --- |
| Walking / Outdoors | Fitness |
| Food | Social |
| Music | Creative |
| Work | Study |
| Rest | Other |

## Easier category changing in the next interface pass

Make the visible category chip the direct entry to a small **Choose category** sheet, separate from artwork editing. Show the current category, six familiar choices and recently used choices first. Put search and the additional choices behind **See more**. A tap selects and closes the chooser; return keyboard focus to the category chip. Keep artwork available through its own labeled control.

Use the same chooser in creation, Activity Notes and managing a Beacon. Changing category should preserve title, description, emoji, audience, time and place. Existing-Beacon changes remain staged until the existing Save action; cancellation must preserve the original category. Keep category choices readable with icons and text, a checkmark for selection, 44px targets and light/dark tokens.

## Additional saved categories: separate data-contract pass

Candidate additions: Outdoors, Food, Music, Work and Rest. Decide whether Walking is a distinct category or an Outdoors/Fitness activity before expanding the taxonomy. Avoid creating two nearly identical filters by accident.

The current six values are enforced in activity and draft types, saved draft validation, Plan steps, planning payload validation and database constraints. A later implementation should use one frontend catalog of stable category keys, labels, icons, order and parent/compatibility mappings. Preserve existing values and URLs; add categories through an additive migration and coordinated service capability. Older clients should still receive a supported parent category until they can understand the new values. No category migration or category authorization change is included in Phase 4R.

Acceptance: create, edit, reuse, template, Plan/Routine and planning-result flows accept every supported category; map filters and artwork recognize each; saved drafts round-trip; older clients retain a safe parent display; analytics/history remain readable. Validate local database behavior separately from hosted rollout.
