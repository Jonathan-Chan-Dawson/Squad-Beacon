# Squad Beacon product-spec review

This review covers the latest `Squad Beacon (1).txt` and the attached UI/UX execution blueprint alongside earlier Plans, profile/onboarding, beacon tools, and planning work. The current UI checkpoint adds visible selected states, one compact activity card, relative time/Virtual presentation, clearer Vote/Draw and Beacon Plan language, and a friend-to-DM action. It distinguishes shipped scope from the wider wishlist; it does not claim every requested capability is implemented.

## Covered by the current app and this feature pass

| Area | Status |
| --- | --- |
| Beacon map, categories, activity cards, RSVP, friend/squad audiences, comments, reactions, and temporary location sharing | Existing product foundations. Location remains opt-in and private by default. |
| Beacons and Squads navigation | Current/Upcoming/Past, one compact beacon card, a small prioritized friend preview, labeled All/Squads/Friends/Private Lists controls, Past-only shortcuts for Beacon Plans/Favorites/templates/Library/planning, and direct friend messaging with a separate Profile action. |
| Profile identity, categorized/searchable interests, structured aspirations, skippable/repeatable survey | Profile onboarding includes identity tags, searchable catalog interests and custom interests, plus weekly aspiration goals and progress. Aspiration links are also exposed in beacon and Plan creation here. |
| Multi-beacon Beacon Plan with a date, timezone, ordered scheduled steps, linked beacons, and squad scope | Added as a new product concept; this replaces the pasted “Vacation” grouping idea. The Plans UI now consistently calls these Beacon Plans. |
| Reusable Plan templates | Personal and squad-scoped template flow, with squad visibility and admin controls. |
| Beacon templates | A searchable 18-category built-in recipe library complements three quick starts, saved personal templates, and repeat suggestions. Prompts are editable and tool ideas are recommendations only. Repeating reuses a recipe; it does not schedule recurrence. |
| Beacon tools | Approved participants can use a shared checklist and notes; a private 25-minute focus timer runs on-device. Completed beacons retain readable history; cancelled beacons are read-only. |
| Beacon controls and invitation continuity | Advanced capacity/tool settings, manual arrival/check-in, and paused-tool history are integrated. Durable invitations survive I'm Out and allow re-entry; manager removal revokes that grant. Database and browser coverage pass. |
| Pings, Vote/Draw, and Beacon Plans | Ping responses/conversion, searchable editable Vote/Draw proposals, option approval, deterministic vote fallback, persisted draw resolution, retries, and Beacon Plans exist. The feed now removes Full/Compact and uses one ActivityCard. |
| Plan conflict handling | Detects overlaps and suggests alternate local times. It still does not create an “Ask the group” Vote/Draw draft. |
| Selected states and relative activity time | Current/Upcoming/Past, Friends Now, and directory single-choice controls rely on contrast plus `accessibilityState.selected`, without redundant checkmarks; multi-select chips keep checks. Compact cards use Starts in / Ends in or day/time wording, show Virtual when meeting data says it is online, and distinguish the passive priority marker from a Beacon favorite action. |

## Related gaps still needing product and implementation work

| Spec request | Gap |
| --- | --- |
| Nearby interest notifications | The categorized interest catalog and custom tags are present; notification subscriptions and proximity-based matching are still needed. |
| Aspiration streaks and frequency tracking | Weekly progress and streaks count the user's completed beacons linked to an aspiration. Group beacon attribution, aspiration reminders, and any squad-level progress rules need a separate definition. |
| Long-term goals with stacked beacons | Existing goals and habits are separate from profile aspirations; there is no unified goal progress view across linked Plan steps. |
| Public profile lists/journal folders and one-tag-per-object organization | Private Library folders and item associations exist. Publishing/profile tags and one-tag-per-object organization are not implemented. |
| Organization audiences, public Beacon discovery, and category-based discovery notifications | Safe discovery/organization domain types and focused pure tests are scaffolded only. No migration 006, shared snapshot/actions, route, or screen integrates either feature; current audiences remain private/friends/lists/squads. |
| Capacity states such as filling, full/open, and full/closed | Migration 005 adds capacity limits, manual closure, and server-authoritative accepted-seat counts. Settings and admission rules passed database/browser tests; broader route presentation and native device QA remain. Target count is not strict capacity. |
| Vote/Draw and conflict proposals | Planning threads, approval, voting/draw resolution, safe materialization, and database tests now exist. User-facing copy says Vote/Draw, while internal action names/routes retain legacy council identifiers. Plan conflict UI still only surfaces alternate-time suggestions and needs an actual group decision draft. |
| Expanded beacon experiences | Checklists, notes, and a local focus timer are implemented. 005 stores optional external music links and decoration settings, but the app does not stream audio or create linked media reels/experiences; completed activity memories remain simpler than media reels. |
| Beacon attendance states, arrival/check-in, proximity-based presence, and layered beacon admins | Manual attendance UI and server-side role permissions are tested. Role assignment/revocation pickers and co-owner/admin admission UI remain unfinished. Proximity-based check-in is not implemented, and location sharing stays independent. |
| Multi-beacon map condensation by location/category | Native/web maps now cluster nearby Beacons and people as zoom changes, with mixed-cluster drill-in and visible participant rows. Plan/category filters remain available; native device acceptance is still needed. |
| Custom Bitmoji-like avatar construction | The app has a mini avatar picker and optional photo; it is not a full avatar editor. |
| Birthday date display and public/private profile field controls | Birth date is kept private for age eligibility; only an optional birthday note is shown. Per-field profile visibility controls need a separate design. |
| Custom full-profile visibility | Settings now supports Public, Friends, and selected people/squads/private lists. Profile fields, photos, live location, friend status, and widgets follow current visibility and blocks. Organization access awaits organization membership support. |

## Product boundaries

Beacon Plans are scheduled collections of beacons rather than renamed vacations. Each generated beacon keeps its local start time and timezone. Squad templates are shared only in the selected squad. The compact card's up-arrow priority marker means a related friend/squad is starred; the existing favorite table only supports friend/squad, not Beacon favorites. Utilities remain on Past, not Current/Upcoming. Existing location privacy remains unchanged: public coarse-area discovery is not integrated, and no precise Sonar location may enter a public summary.

For the complete phase-by-phase status, remaining dependencies, paths, and
priorities, see `REMAINING_UI_CHANGES.md`.

Latest bounded UI validation: targeted typecheck, targeted ESLint, and the two
focused Friends Now browser tests passed. The full unit run still has one
unrelated stale planning-message assertion to reconcile; full-suite and fresh
export status remain with root QA. Android export verifies a bundle, not native
binary/device behavior. Migrations remain local; no remote deployment was
performed.
