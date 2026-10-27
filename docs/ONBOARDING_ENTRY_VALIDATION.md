# Phase 4A — Onboarding and entry polish

Validation checkpoint: October 26, 2026. This report describes this phase, not hosted deployment status.

## What changed

- Beacons Home presents one introduction for a verified first app session, a small returning-user invitation otherwise, and real commitments when present. Empty personal/friend/discovery sections no longer repeat. Status controls, errors, invitations and collection access remain available.
- The existing EmptyState primitive now supports hero, section and inline densities, optional secondary links and left alignment. The semantic copy registry and local SVG/Lucide vignette registry live in `src/features/onboarding/`; changing a motif or quip does not require editing every screen.
- Playful is the default tone. Friendly and Bro previews, deterministic optional quips, and quip disabling are available in the development lab. Functional and privacy text stay factual.
- Help is a searchable, expandable nine-category field guide. Dismissible contextual tips sit beside Ping, Vote, Plan, visibility, Sonar and Routine controls. Help retains their explanations.
- First Beacon publication, first accepted friendship and first explicitly completed hosted Beacon use confirmed action transitions and atomic receipts. Status/Activity Notes, historical snapshots, failed actions and ambiguous prior history do not celebrate. Other success feedback remains unchanged.

## Screen audit

| Area                                                                 | Outcome                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                                                                 | New/unknown/returning accounts distinguished; compact pending-response doorway; populated sections retained.                                                                                                |
| Map and Browse                                                       | Distinct discovery/filter/location/error guidance with relevant recovery actions; no automatic location request. Browse ignores SectionList header/footer tokens when tracking visible Beacons.             |
| Friends, Squads and Chats                                            | Shared compact empty guidance; existing conversation, community, invitation and selection controls preserved.                                                                                               |
| Create and templates                                                 | Saved-template emptiness links to the existing catalog; search emptiness stays separate. Visibility tip uses the real control. Invalid SVG accessibility attributes were removed from tip/Add People icons. |
| Plans and Routines                                                   | Shared contextual emptiness and adjacent tips; existing capability-gated implementations and scheduling behavior retained.                                                                                  |
| Profile, Calendar and Responses                                      | Quiet inline/section states; loading/error checks precede emptiness. Concurrent response dropdown/card work was preserved.                                                                                  |
| History, memories, collections, private lists and secondary searches | Audited existing authorization/loading/error handling. Your Activity's page empty state uses one primary Explore action. Already-helpful memory/library/private-list UI was retained.                       |

## Account progress and rollout

`20261026185923_onboarding_progress.sql` is additive and **has not been deployed to hosted Supabase**. Apply it after preceding ordered migrations. It adds one owner-only table, one public claim RPC and a private profile-insert trigger; it does not modify registration, the survey gate, display preferences, discovery, scheduling or business action dispatch.

- Only profiles inserted after migration receive server-owned first-entry eligibility. Older empty accounts are not backfilled as new.
- After required account entry is satisfied, progress loads independently. A new eligible account atomically reserves its first normal app session using the existing welcome receipt. A profile's age, empty arrays or missing progress rows cannot independently show the large hero.
- The welcome is latched for its current visit, consumed in memory, and remains suppressed on later sessions. Dismissals/tips are owner-scoped, and failed writes remain effective for the current visit with a quiet retry.
- Success claims check authoritative owner-visible business records and insert with conflict handling. Repeated/concurrent claims do not create repeated receipts. Unknown older achievement history falls back to ordinary success feedback.
- Account/epoch changes discard pending UI results. The claim RPC also verifies the expected viewer against the authenticated caller, so a queued write cannot mark the next account's progress. Progress reads occur on account entry and foreground return; progress updates do not refresh the activity snapshot or replay business actions.
- Demo data/progress are isolated. Scenario switching resets the snapshot, pending requests, exploration and workflow UI. The populated demo remains the default.

Hosted acceptance still requires applying the migration, checking grants/RLS with two actual accounts, confirming profile eligibility and duplicate claims, and testing cross-device/reinstall persistence against hosted Auth. The local tests below do not establish those hosted results.

## Verification and visual evidence

The focused local selection passes **70 unit/database tests**, including the full ordered migration history in PGlite, ownership/anonymous denial, invalid keys, account deletion, first-entry evidence, atomic receipts, fixture integrity, creation/planning/calendar regressions, privacy and theme contrast. `npm test` is a separate explicit selection and was not used as a claim of exhaustive coverage.

Final integrated results:

- `npm run typecheck` and `npm run lint`: passed.
- Onboarding Playwright suite: **7 passed**. It covers all ten scenarios, correct destinations, reset isolation (including Friends search state), tip dismissal/reset, confirmed first publication, no replay on revisit, delayed progress loading, reload/fresh-browser persistence, unknown accounts and failed-write recovery.
- Development and production web exports: passed, with 50 static routes. Production bundle inspection confirmed the expected-viewer guard is present and developer-lab control markers are absent.
- Phone screenshots: reviewed at 320px/390px in light/dark, with enlarged text, long copy and reduced motion. Capture waits for the lab sheet to close; exported development hot-reload sockets are isolated by the test harness.

Before screenshots came from the existing pre-change web export, using an intercepted empty-account fixture with a valid survey-skipped profile. After screenshots use the same profile/data shape and actual app components. Account transport in these screenshots/tests is intercepted; no hosted account mutations were made.

| Experience                 | Before                                                | After                                                                     |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Empty Home, 390px dark     | [Before](screenshots/onboarding/before-home.png)      | [First entry](screenshots/onboarding/after-home-dark-390.png)             |
| Returning Home, 390px dark | Same repeated sections above                          | [Compact invitation](screenshots/onboarding/after-returning-dark-390.png) |
| Narrow Home, 320px light   | —                                                     | [First entry](screenshots/onboarding/after-home-light-320.png)            |
| Empty Browse               | [Before](screenshots/onboarding/before-discovery.png) | [After](screenshots/onboarding/after-discovery.png)                       |

The screenshot review checked hierarchy, spacing, icon consistency, CTA prominence, readability, density, above-the-fold usefulness, both appearances and narrow composition. The returning card was reduced after review; the introduction's extra quip was removed to keep the primary action visible. Additional generated evidence lives under `test-results/onboarding-*.png`.

Additional reviewed examples: [enlarged text and reduced motion](screenshots/onboarding/large-text-reduced-motion.png), [long copy](screenshots/onboarding/long-copy.png), and [simulated request failure](screenshots/onboarding/discovery-error.png). At enlarged text sizes the secondary actions wrap and the existing page remains scrollable.

For reproduction, use the commands in README.md. The static development export's browser harness keeps Expo hot-reload sockets connected without updates; normal Expo development uses its real Metro server. Production builds compile out the lab dependency/control markers.

## Remaining boundaries

- **Phase 4B:** registration/required profile setup and removal of the automatic optional-survey interruption. Full real-account first-entry acceptance requires 4B. Demo and intercepted account profiles use `skipped`; the 4A readiness check must follow 4B's required-profile readiness once the survey is user-initiated.
- **Phase 4C:** broader navigation, modal/menu consistency, universal people/group selection and unrelated cleanup. No new bottom tabs, tutorial platform or mandatory overlay were introduced here.
- Native device layout, VoiceOver/TalkBack, native Dynamic Type and native reduced-motion behavior were not device-tested. Web enlarged-text/long-copy/reduced-motion checks do not substitute for them.
- Existing development-export warnings include the Squad/Space require cycle, legacy shadow/pointerEvents props and Expo's generated root component name. They were not expanded into a cleanup project.
