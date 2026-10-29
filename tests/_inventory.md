Test map

- browser/authEmailLinks.spec.ts: canonical signup/reset/resend destinations, explicit confirmation with no prefetch exchange, cross-browser token-hash entry, recovery and expired-link handling. Uses playwright.auth.config.ts and the separate auth-email preview.
- browser/authConfirmationLayout.spec.ts: 320px/390px light/dark confirmation screenshots, focus, tap targets, horizontal fit and reduced-motion checks without consuming a token.

- accountEntry.test.ts and browser/accountEntry.spec.ts: shared required-profile readiness, all optional survey statuses, new-profile entry, invitation continuity, account/recovery callbacks, voluntary personalization and phone screenshots. Included in the onboarding test commands.

- onboarding.test.ts and onboarding.database.test.ts: explicit first-session evidence, state precedence, coherent demo fixtures, deterministic copy, confirmed success transitions and owner-scoped atomic progress claims through the ordered migration history.
- browser/onboarding.spec.ts: real-component demo scenarios, intercepted account progress/reload/failure journeys and phone screenshots. Uses playwright.onboarding.config.ts and the development export; see README.md.

- livingPlans.test.ts and livingPlans.database.test.ts: tentative Plans, stable ordering, role/revision/audience boundaries, canonical result linking, reviewed repeat sources, occurrence isolation and Calendar grouping. `npm run test:plans` includes related existing Plan, Routine, Calendar, Map-context and connected-planning suites.
- browser/livingPlans.spec.ts: durable in-session Plan reopening, linked Ping creation/return, phone-width timeline screenshots, and recurring Beacon creation/occurrence-versus-future editing.

- spaces.test.ts and spaces.database.test.ts: independent Space creation, invitations, membership revocation and private Squad boundaries.
- social.test.ts and social.database.test.ts: sanitized directory browsing, all-entity request/join flows, policy roles, independent parent membership, affiliations, Beacon associations, and safe conversion/grouping with source-history preservation.
- browser/squadsChatFirst.spec.ts: temporary search, compact Chats, Space creation/linking, permission-gated inbox-to-Squad Ping navigation, canonical response sharing and return paths.
- browser/chatHelpers.ts: opens a conversation through its row body while preserving avatar/name profile-preview behavior.

- *.test.ts: domain, aspiration, beacon controls/modules, focus timer, library, planning, plans, snapshot normalization, templates, paired-theme contrast and legacy preference migration, and widget unit coverage.
- profilePrivacy.test.ts: demo and projected-snapshot full-profile privacy helper coverage.
- personPreview.test.ts, squadProfile.test.ts: privacy-safe chat context, current/next Beacons, membership and pending decision selectors.
- communication.test.ts: canonical Squad chat Ping summaries, exact source-link eligibility, response-required state, and snapshot-safe People/inbox selectors.
- browser/chatProfilePreview.spec.ts: tappable DM/Squad headers, same-sheet Beacon previews, full profiles and scoped quick actions.
- browser/socialArchitecture.spec.ts: preview-first Space and Organization navigation, compact layouts, and social architecture acceptance journeys.
- moduleCollections.test.ts, beaconMediaTeams.test.ts: personal collections and media/team behavior.
- database.test.ts and planningThreads.database.test.ts: PGlite-backed migration/RLS/action coverage; database.test.ts applies the profile-privacy migration and validates profile/location/avatar privacy.
- organizations.test.ts and organizations.database.test.ts: organization domain and PGlite role, membership, group-chat, audience, profile-grant, and account-deletion coverage; both migration loaders include the additive organization migrations.
- planningDemo.test.ts: demo store planning action behavior.
- browser/: Playwright journeys in library.spec.ts (including waiting for save sheets to finish closing), pilot.spec.ts (including paired theme/appearance persistence and semantic accent plus selected-state assertions), and planning.spec.ts.
- fixtures/neighborhood.ts: reusable deterministic demo/test profiles and fixture data.
- mapClusters.test.ts and browser/mapClusters.spec.ts: pure screen-space grouping plus browser map cluster drill-in/dismissal coverage.
- mapFiltering.test.ts: shared discovery filters, date windows, joining eligibility and private meeting-place access.
- browser/mapRefinement.spec.ts: inline quick filters, advanced-sheet footer keyboard focus and background tab isolation, separate map controls, safe-area header and compact sharing control.
- browser/uiPolish.spec.ts: compact layouts, clear selections, and normal/reduced-motion press feedback.
- README.md: test setup and execution notes.

Tests should exercise product flows through public routes/actions and preserve existing suites when adding coverage.

- browser/themeRefinement.spec.ts: all seven families in Light/Dark across Map, Beacons, Create, Squads, Friends and Profile at mobile widths; neutral preview persistence and live System appearance. themes/themeTokens tests cover legacy defaults, warm Essential/Sunflower distinction and readable semantic roles.

- browser/unifiedPeople.spec.ts, browser/creationMobilePolish.spec.ts and browser/sonarPeople.spec.ts: staged invitation cancellation/Done, secondary list filters, inline list management, advisory large batches, canonical location route, keyboard selection, and responsive creation/Sonar screens. createHandoff and creationAtomic.database cover the 50-person recommendation and atomic 51-recipient publication.

- activityWorkspace.test.ts and browser/activityWorkspace.spec.ts: unfinished lifecycle selection, date-only presentation, request recovery/isolation, retained subtabs, creation handoffs, lost-reply replay, phone screenshots, dirty-edit protection, Beacon direct-entry/Chat Back fallback and Calendar/Plan return paths.
- guestSharing.test.ts, guestFoundation.database.test.ts, guestPlanning.database.test.ts and guestDatabase.ts: isolated guest server/security and complete ordered-history canonical RSVP/planning/Plan/Status/claiming integration. browser/guestInvitations.spec.ts, guestCanonical.spec.ts and guestPlanning.spec.ts cover browser-to-handler-to-database journeys. External Auth/email is substituted locally; hosted/native acceptance remains separate. Use playwright.guest.config.ts or test:guest scripts.

- refinementSelection.test.ts, refinementTiming.test.ts, creationPublicListing.test.ts and browser/refinement.spec.ts: full filtered selection limits, timezone/DST, frozen public-listing continuation, quiet Map, direct Inbox, staged composer/timing, category shortcuts and responsive screenshots.
