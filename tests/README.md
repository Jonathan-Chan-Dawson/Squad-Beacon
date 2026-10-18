# App testing

- `fixtures/neighborhood.ts`: fictional base neighborhood with 36 profiles, 23 accepted friends, live statuses, future plans and temporary shared locations. The composed demo adds 34 profiles as actual members of the 35-person Huge Squad (70 profiles total); 46 are not incoming friend-request targets. Only `startDemo()` loads this fixture; never seeds a real account or a remote database.
- `domain.test.ts`: domain behavior.
- `database.test.ts`: migrations and access checks in an isolated PGlite database.
- `organizations.test.ts` and `organizations.database.test.ts`: organization role/domain behavior and PGlite authorization, chat, audience, profile-grant, and deletion-audit coverage.
- `browser/`: phone-sized Playwright flows.
- `demoProfileFixtures.test.ts` and `src/shared/demoProfileFixtures.ts`: Avery Bennett, Noor Haddad, Rafael Costa, and a richer own profile; 38 interests each, 12–16 aspirations, long biographies, shared communities, current activity, history, and eight sample albums per person. Sample media uses category artwork, never real personal photographs or fabricated storage URLs. `profileShowcase.spec.ts` captures seven real app views per person at 390 × 844.

Run `npm test`, `npm run export:web -- --max-workers 2`, then `npm run test:e2e`.

In demo: Beacons > Find friends. Search a fictional profile, send a request, then use the clearly marked simulated acceptance action. Leave/re-enter demo to reset all changes. Real accounts continue to use username, QR and contact invitations.

## Remaining redesign extensions (2026-10-13)

- `statusReactions.*`, `statusAtomic.database.test.ts`, `statusControl.test.ts` and `statusRouteSeed.test.ts` cover finite persisted emoji, atomic history-preserving status mutation and legacy-editor seed privacy.
- `calendarProjection.*` covers bounded recurrence reads, private skipped/materialized linkage, revocation, truncation and internal demo-ledger parity. Projection never materializes future records.
- `creationAtomic.database.test.ts` and `createHandoff.test.ts` cover transactional invitations, quota/permission rollback, parent request replay, frozen UUID/payload reconciliation, actor-switch protection and legacy already-created retries.
- New database fixtures apply the complete chronological migration chain in disposable PGlite. They do not apply migrations to a linked or remote project. Hosted rollout requires migrations `202610130001` through `202610130004` after project/authorization setup and review.
- This refinement uses `npm test`, `npm run typecheck` and `npm run lint`; no exports or native builds were performed. Native acceptance remains unavailable because no device or configured AVD was connected.

Final results: all 369 tests passed in the single full run; TypeScript, all-source zero-warning lint and diff check passed. The temporary test output was removed during cleanup; results are recorded here.
