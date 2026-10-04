Test map

- *.test.ts: domain, aspiration, beacon controls/modules, focus timer, library, planning, plans, snapshot normalization, templates, themes, and widget unit coverage.
- profilePrivacy.test.ts: demo and projected-snapshot full-profile privacy helper coverage.
- moduleCollections.test.ts, beaconMediaTeams.test.ts: personal collections and media/team behavior.
- database.test.ts and planningThreads.database.test.ts: PGlite-backed migration/RLS/action coverage; database.test.ts applies the profile-privacy migration and validates profile/location/avatar privacy.
- planningDemo.test.ts: demo store planning action behavior.
- browser/: Playwright journeys in library.spec.ts, pilot.spec.ts, and planning.spec.ts.
- fixtures/neighborhood.ts: reusable deterministic demo/test profiles and fixture data.
- mapClusters.test.ts and browser/mapClusters.spec.ts: pure screen-space grouping plus browser map cluster drill-in/dismissal coverage.
- browser/uiPolish.spec.ts: compact layouts, clear selections, and normal/reduced-motion press feedback.
- README.md: test setup and execution notes.

Tests should exercise product flows through public routes/actions and preserve existing suites when adding coverage.
