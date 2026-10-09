Test map

- spaces.test.ts and spaces.database.test.ts: independent Space creation, invitations, membership revocation and private Squad boundaries.
- social.test.ts and social.database.test.ts: sanitized directory browsing, all-entity request/join flows, policy roles, independent parent membership, affiliations, Beacon associations, and safe conversion/grouping with source-history preservation.
- browser/squadsChatFirst.spec.ts: temporary search, compact Chats, Space creation/linking and source-linked Squad Ping navigation.
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
